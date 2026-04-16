import { state } from './state.js';
import {
    languageNameToCodeMap,
    COMPETITION_WEBHOOK_URL,
    TITLE_GENERATION_WEBHOOK_URL,
    TRANSLATION_WEBHOOK_URL,
    IMAGE_TRANSLATION_WEBHOOK_URL,
    DESCRIPTION_GENERATION_WEBHOOK_URL,
    CATEGORY_ATTRIBUTES_WEBHOOK_URL,
    AI_FILL_ATTRIBUTES_WEBHOOK_URL,
    AI_MAP_VALUE_WEBHOOK_URL,
    SAVE_PRODUCT_ATTRIBUTES_URL,
    GET_PRODUCT_ATTRIBUTES_URL,
    ALL_CATEGORIES_URL,
    CATEGORY_MAPPINGS_WEBHOOK_URL,
    MARKETPLACES
} from './constants.js';

// LocalStorage key pentru ordinea coloanelor marketplace — persistă între reload-uri.
const MARKETPLACE_ORDER_STORAGE_KEY = 'off-site-dev:marketplace-order';

// Aplică ordinea salvată peste array-ul MARKETPLACES IMPORTAT (mutare in-place).
// Trebuie să ruleze ÎNAINTE ca templates.js să citească MARKETPLACES — apel top-level.
// Edge case: dacă ordinea salvată nu conține toate marketplace-urile (ex: utilizator
// a făcut reorder → apoi a fost adăugat un marketplace nou), cele lipsă se duc la
// coadă (indicele 1e9), păstrând ordinea lor relativă din array-ul original.
function applyPersistedMarketplaceOrder() {
    try {
        const saved = JSON.parse(localStorage.getItem(MARKETPLACE_ORDER_STORAGE_KEY) || 'null');
        if (!Array.isArray(saved) || !saved.length) return;
        const indexOf = id => {
            const i = saved.indexOf(id);
            return i === -1 ? 1e9 : i;
        };
        MARKETPLACES.sort((a, b) => indexOf(a.id) - indexOf(b.id));
    } catch (e) { /* storage indisponibil — ignorăm */ }
}
applyPersistedMarketplaceOrder();
import { renderImageGallery, initializeSortable, templates } from './templates.js';
import { saveProductDetails } from './data.js';

const cleanImages = (images) =>
    [...new Set((images || []).filter(img => img))];

export function getCurrentImagesArray() {
    const key = state.activeVersionKey;
    if (key === 'origin') {
        if (!state.editedProductData.images) state.editedProductData.images = [];
        return [...state.editedProductData.images];
    }

    if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
    if (!state.editedProductData.other_versions[key]) state.editedProductData.other_versions[key] = {};

    if (!state.editedProductData.other_versions[key].images) return null;

    return [...state.editedProductData.other_versions[key].images];
}

export function setCurrentImagesArray(imagesArray) {
    const key = state.activeVersionKey;
    if (key === 'origin') {
        state.editedProductData.images = imagesArray;
        return;
    }

    if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
    if (!state.editedProductData.other_versions[key]) state.editedProductData.other_versions[key] = {};

    state.editedProductData.other_versions[key].images = imagesArray;
}


export function saveCurrentTabData() {
    const titleEl = document.getElementById('product-title');
    if (!titleEl) return;

    const title = titleEl.value;
    const description = state.descriptionEditorMode === 'raw'
        ? (document.getElementById('product-description-raw')?.value || '')
        : (document.getElementById('product-description-preview')?.innerHTML || '');

    const key = state.activeVersionKey;

    if (key === 'origin') {
        state.editedProductData.title = title;
        state.editedProductData.description = description;
    } else {
        if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
        if (!state.editedProductData.other_versions[key]) state.editedProductData.other_versions[key] = {};
        state.editedProductData.other_versions[key].title = title;
        state.editedProductData.other_versions[key].description = description;
    }

    const thumbsContainer = document.getElementById('thumbnails-container');
    if (thumbsContainer) {
        const currentImages = [];
        thumbsContainer.querySelectorAll('[data-image-src]').forEach(el => {
            currentImages.push(el.dataset.imageSrc);
        });
        setCurrentImagesArray([...new Set(currentImages)]);
    }
}

export function loadTabData(versionKey) {
    saveCurrentTabData();
    state.activeVersionKey = versionKey;

    let dataToLoad = {};
    let imagesToLoad = null;

    if (versionKey === 'origin') {
        dataToLoad = state.editedProductData;
        imagesToLoad = dataToLoad.images;
        if (!imagesToLoad) imagesToLoad = [];
    } else {
        dataToLoad = state.editedProductData.other_versions?.[versionKey] || {};
        imagesToLoad = dataToLoad.images;
    }

    const titleEl = document.getElementById('product-title');
    if (titleEl) titleEl.value = dataToLoad.title || '';

    const description = dataToLoad.description || '';
    const rawEl = document.getElementById('product-description-raw');
    const previewEl = document.getElementById('product-description-preview');
    if (rawEl) rawEl.value = description;
    if (previewEl) previewEl.innerHTML = description;

    if (rawEl && previewEl) {
         rawEl.classList.remove('hidden');
         previewEl.classList.add('hidden');
         const rawBtn = document.querySelector('.desc-mode-btn[data-mode="raw"]');
         const previewBtn = document.querySelector('.desc-mode-btn[data-mode="preview"]');
         if (rawBtn) {
            rawBtn.classList.add('bg-blue-600', 'text-white');
            rawBtn.classList.remove('hover:bg-gray-100');
         }
         if (previewBtn) {
            previewBtn.classList.remove('bg-blue-600', 'text-white');
            previewBtn.classList.add('hover:bg-gray-100');
         }
         state.descriptionEditorMode = 'raw';
    }

    const galleryContainer = document.getElementById('image-gallery-container');
    if (galleryContainer) {
        galleryContainer.innerHTML = renderImageGallery(imagesToLoad);
        initializeSortable();
    }
    
    document.querySelectorAll('.version-btn').forEach(btn => {
        const isCurrent = btn.dataset.versionKey === versionKey;
        btn.classList.toggle('bg-blue-600', isCurrent);
        btn.classList.toggle('text-white', isCurrent);
    });

    const refreshBtn = document.getElementById('refresh-title-btn');
    if (refreshBtn) {
        const isRomanianTab = languageNameToCodeMap[versionKey.toLowerCase()] === 'RO';
        refreshBtn.classList.toggle('hidden', !isRomanianTab);
    }
    
    const refreshDescBtn = document.getElementById('refresh-description-btn');
    if (refreshDescBtn) {
        const isRomanianTab = languageNameToCodeMap[versionKey.toLowerCase()] === 'RO';
        refreshDescBtn.classList.toggle('hidden', !isRomanianTab);
    }
}


// --- API CALLS & HANDLERS ---
export async function fetchAndRenderCompetition(asin) {
    const container = document.getElementById('competition-container');
    if (!container) return;
    state.competitionDataCache = null;

    // Init-uri idempotente — leagă drag-connect și drag-reorder pe elementele care tocmai
    // au fost montate de templates.produsDetaliu. Se poate să fi fost deja apelate din
    // loadProductAttributesFromDB (care rulează înainte), dar flag-urile `_dragHandler`
    // și `_sortableBound` previn dublarea listenerilor.
    initDragConnect();
    initMarketplaceReorder();

    try {
        const response = await fetch(COMPETITION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asin })
        });

        if (!response.ok) throw new Error('Eroare la preluarea datelor de competiție');

        const rawData = await response.json();
        const data = rawData?.get_competition_v2 || rawData || {};
        state.competitionDataCache = data;
        container.innerHTML = templates.competition(data);
        populateCategorySelector();
        populateTemuCategorySelector();
    } catch (error) {
        console.error('Eroare competiție:', error);
        container.innerHTML = `<div class="p-8 text-center text-red-500">Nu s-au putut încărca produsele concurente.</div>`;
    }
}

export async function saveProductCoreData() {
    try {
        saveCurrentTabData();

        state.editedProductData.brand = document.getElementById('product-brand').value;
        const priceValue = document.getElementById('product-price').value;
        state.editedProductData.price = priceValue.trim() === '' ? null : priceValue;

        const localCopy = JSON.parse(JSON.stringify(state.editedProductData));
        localCopy.images = cleanImages(localCopy.images);

        if (localCopy.other_versions) {
            for (const langName in localCopy.other_versions) {
                localCopy.other_versions[langName].images = cleanImages(localCopy.other_versions[langName].images);
            }
        }

        const payloadForServer = JSON.parse(JSON.stringify(localCopy));
        if (payloadForServer.other_versions) {
            const converted = {};
            for (const [langName, langData] of Object.entries(payloadForServer.other_versions)) {
                const langCode = (languageNameToCodeMap[langName.toLowerCase()] || langName).toLowerCase();
                converted[langCode] = langData;
            }
            payloadForServer.other_versions = converted;
        }

        const asin = document.getElementById('product-asin').value;
        const success = await saveProductDetails(asin, payloadForServer);

        if (success) {
            state.editedProductData = localCopy;
            await saveAttributesToDB(asin);
            return true;
        }
        return false;
    } catch (error) {
        console.error("Eroare în saveProductCoreData:", error);
        return false;
    }
}


export async function handleProductSave(actionButton) {
    const originalText = actionButton.textContent;
    actionButton.textContent = 'Se salvează...';
    actionButton.disabled = true;
    
    const success = await saveProductCoreData(); 
    
    if (success) {
        alert('Salvat cu succes!');
        actionButton.textContent = originalText;
        actionButton.disabled = false;
        return true;
    } else {
        alert('Eroare la salvare!');
        actionButton.textContent = originalText;
        actionButton.disabled = false;
        return false;
    }
}

export async function handleTitleRefresh(actionButton) {
    const refreshIcon = actionButton.querySelector('.refresh-icon');
    const refreshSpinner = actionButton.querySelector('.refresh-spinner');

    const originTitle = state.editedProductData.title;
    const originDescription = state.editedProductData.description;
    const currentAsin = document.getElementById('product-asin')?.value;

    if (!originTitle || !originDescription || !currentAsin) {
        alert('Eroare: Datele minime necesare (Titlu, Descriere, ASIN) nu sunt disponibile.');
        return;
    }

    refreshIcon.classList.add('hidden');
    refreshSpinner.classList.remove('hidden');
    actionButton.disabled = true;

    const competitors = (state.competitionDataCache?.competitors || [])
        .map(c => c.name)
        .filter(Boolean);

    const payload = {
        asin: currentAsin,
        title: originTitle,
        description: originDescription,
        competitors
    };

    try {
        const response = await fetch(TITLE_GENERATION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);

        const result = await response.json();

        if (result.output) {
            document.getElementById('product-title').value = result.output;
            const roKey = 'Romanian';
            if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
            if (!state.editedProductData.other_versions[roKey]) state.editedProductData.other_versions[roKey] = {};
            state.editedProductData.other_versions[roKey].title = result.output;
        } else {
            throw new Error('Răspuns invalid de la server.');
        }
    } catch (error) {
        console.error('Eroare la generarea titlului:', error);
        alert(`A apărut o eroare la generarea titlului: ${error.message}`);
    } finally {
        refreshIcon.classList.remove('hidden');
        refreshSpinner.classList.add('hidden');
        actionButton.disabled = false;
    }
}

export async function handleDescriptionRefresh(actionButton) {
    const refreshIcon = actionButton.querySelector('.refresh-icon');
    const refreshSpinner = actionButton.querySelector('.refresh-spinner');

    const originTitle = state.editedProductData.title;
    const originDescription = state.editedProductData.description;

    if (!originTitle || !originDescription) {
        alert('Eroare: Titlul sau descrierea "origin" nu sunt disponibile.');
        return;
    }

    refreshIcon.classList.add('hidden');
    refreshSpinner.classList.remove('hidden');
    actionButton.disabled = true;

    try {
        const response = await fetch(DESCRIPTION_GENERATION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: originTitle, description: originDescription })
        });
        if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);

        const result = await response.json();

        if (result.output) {
            const rawEl = document.getElementById('product-description-raw');
            const previewEl = document.getElementById('product-description-preview');
            if (rawEl) rawEl.value = result.output;
            if (previewEl) previewEl.innerHTML = result.output;

            const roKey = 'Romanian';
            if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
            if (!state.editedProductData.other_versions[roKey]) state.editedProductData.other_versions[roKey] = {};
            state.editedProductData.other_versions[roKey].description = result.output;
        } else {
            throw new Error('Răspuns invalid de la server.');
        }
    } catch (error) {
        console.error('Eroare la generarea descrierii:', error);
        alert(`A apărut o eroare la generarea descrierii: ${error.message}`);
    } finally {
        refreshIcon.classList.remove('hidden');
        refreshSpinner.classList.add('hidden');
        actionButton.disabled = false;
    }
}


export async function handleTranslationInit(languageOption) {
    if (languageOption.hasAttribute('data-processing')) return;

    saveCurrentTabData();

    const langCode = languageOption.dataset.langCode;
    const langName = languageOption.textContent;
    const asin = document.getElementById('product-asin').value;

    const originTitle = state.editedProductData.title || '';
    const originDescription = state.editedProductData.description || '';
    const originImages = cleanImages(state.editedProductData.images);

    const resetUI = () => {
        languageOption.removeAttribute('data-processing');
        languageOption.innerHTML = langName;
        languageOption.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        languageOption.style.pointerEvents = 'auto';
    };

    if (originDescription.trim().length < 50) {
        alert(`Eroare: Descrierea este prea scurtă (${originDescription.trim().length} caractere). Minim necesar: 50.`);
        return;
    }
    if (originTitle.trim().length < 10) {
        alert(`Eroare: Titlul este prea scurt (${originTitle.trim().length} caractere). Minim necesar: 10.`);
        return;
    }
    if (originImages.length < 3) {
        alert(`Eroare: Produsul are doar ${originImages.length} imagini. Sunt necesare minim 3 imagini.`);
        return;
    }

    languageOption.setAttribute('data-processing', 'true');
    languageOption.style.pointerEvents = 'none';
    languageOption.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
    languageOption.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${langName}</span>
            <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ml-2"></div>
        </div>`;

    try {
        const competitors = state.competitionDataCache?.competitors || [];
        const competitionPayload = {};
        competitors.slice(0, 5).forEach((c, i) => {
            competitionPayload[`competition_${i + 1}_title`] = c.name || '';
        });

        const response = await fetch(TRANSLATION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                asin,
                language: langCode,
                title: originTitle,
                description: originDescription,
                images: originImages,
                ...competitionPayload
            })
        });

        if (response.ok) {
            languageOption.innerHTML = `
                <div class="flex items-center justify-between text-green-600">
                    <span>${langName}</span>
                    <span class="material-icons text-sm">check</span>
                </div>`;
            setTimeout(() => {
                alert(`Traducere pentru ${langCode.toUpperCase()} a fost inițiată cu succes.`);
                languageOption.closest('.dropdown-menu')?.classList.add('hidden');
                resetUI();
            }, 500);
        } else {
            alert('Eroare la inițierea traducerii (Răspuns server invalid).');
            resetUI();
        }
    } catch (error) {
        console.error('Eroare Webhook:', error);
        alert('Eroare de rețea la inițierea traducerii.');
        resetUI();
    }
}


export async function handleImageTranslation(button) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

    try {
        const asin = document.getElementById('product-asin')?.value;
        const activeKey = state.activeVersionKey;
        const originImages = cleanImages(state.editedProductData.images).slice(0, 5);
        const langCode = (languageNameToCodeMap[activeKey.toLowerCase()] || activeKey).toLowerCase();

        if (!asin) throw new Error("ASIN-ul produsului nu a fost găsit.");
        if (!langCode || langCode === 'origin') throw new Error("Limba selectată este invalidă pentru traducere.");
        if (originImages.length === 0) throw new Error("Nu există imagini 'origin' de tradus.");

        const response = await fetch(IMAGE_TRANSLATION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ asin, lang: langCode, images: originImages }])
        });

        if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);

        const result = await response.json();
        if (result.status === 'success') {
            alert('Traducerea imaginilor a fost inițiată cu succes!');
            return true;
        }
        throw new Error('Webhook-ul a răspuns, dar nu cu status "success".');
    } catch (error) {
        console.error('Eroare la inițierea traducerii imaginilor:', error);
        alert(`A apărut o eroare: ${error.message}`);
        return false;
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}


// --- EVENT HANDLERS (PENTRU A FI APELATE DIN main.js) ---

export function handleImageActions(action, actionButton) {
    let currentImages; 

    if (action === 'delete-image') {
        currentImages = getCurrentImagesArray(); 
        if (currentImages === null) currentImages = []; 

        const imageSrc = actionButton.dataset.imageSrc;
        if (!imageSrc) return;
        
        const indexToDelete = currentImages.indexOf(imageSrc);
        if (indexToDelete > -1) {
            currentImages.splice(indexToDelete, 1);
        }
    }
    else if (action === 'add-image-url') {
        currentImages = getCurrentImagesArray(); 
        if (currentImages === null) currentImages = []; 

        const validImages = currentImages.filter(img => img);
        if (validImages.length >= 5) {
            alert("Puteți adăuga maxim 5 imagini.");
            return;
        }
        const newImageUrl = prompt("Vă rugăm introduceți URL-ul noii imagini:");
        if (newImageUrl) {
            if (currentImages.includes(newImageUrl)) {
                alert("Această imagine este deja în galerie.");
                return;
            }
            currentImages.push(newImageUrl);
        }
    }
    else if (action === 'copy-origin-images') {
        currentImages = [...(state.editedProductData.images || [])].filter(img => img);
    }
    else {
        return;
    }

    setCurrentImagesArray(currentImages); 
    const galleryContainer = document.getElementById('image-gallery-container');
    if (galleryContainer) {
        galleryContainer.innerHTML = renderImageGallery(currentImages);
        initializeSortable();
    }
}

export function handleDescriptionToggle(descModeButton) {
    const mode = descModeButton.dataset.mode;
    if (mode === state.descriptionEditorMode) return;

    const rawEl = document.getElementById('product-description-raw');
    const previewEl = document.getElementById('product-description-preview');

    if (mode === 'preview') {
        previewEl.innerHTML = rawEl.value;
        rawEl.classList.add('hidden');
        previewEl.classList.remove('hidden');
        state.descriptionEditorMode = 'preview';
    } else {
        rawEl.value = previewEl.innerHTML;
        previewEl.classList.add('hidden');
        rawEl.classList.remove('hidden');
        state.descriptionEditorMode = 'raw';
    }

    document.querySelectorAll('.desc-mode-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('hover:bg-gray-100');
    });
    descModeButton.classList.add('bg-blue-600', 'text-white');
    descModeButton.classList.remove('hover:bg-gray-100');
}

// --- CATEGORII & CARACTERISTICI + DRAG-CONNECT ---

const mappingState = {
    connections: [],
    dragging: null,
    // Categorii și savedValues: construite dinamic din MARKETPLACES → generalizare
    // spre adăugarea ulterioară de marketplace-uri noi fără edit aici.
    categories: Object.fromEntries(MARKETPLACES.map(m => [m.id, null])),
    // savedValues[platform][categoryId] = { attrId: value, ... }
    // Indexat pe categoryId ca să nu se piardă munca la switch accidental de categorie.
    savedValues: Object.fromEntries(MARKETPLACES.map(m => [m.id, {}])),
    // savedConnections[comboKey] = [{fromPlatform, fromAttrId, ...}, ...]
    // comboKey = 'emag:X|trendyol:Y|temu:Z' — conexiunile depind de categoriile TUTUROR platformelor.
    savedConnections: {},
    savedMappings: [],
    searchTimers: {},
    // Când e true, schimbarea categoriei eMAG NU declanșează lookup automat
    // de mapări pe Trendyol/Temu. Folosit la restore din DB ca să respectăm
    // ce a salvat userul anterior.
    _suppressEmagMappingLookup: false
};

// Construiește cheia de combo din categoriile active pe toate platformele.
// Folosim ordinea *canonică* (nu cea din MARKETPLACES) ca să fie stabilă cross-session:
// dacă user-ul rearanjează coloanele, cheia rămâne aceeași pentru același combo.
function buildConnectionsKey() {
    const c = mappingState.categories;
    return MARKETPLACES
        .map(m => m.id)
        .sort()
        .map(id => `${id}:${c[id] || ''}`)
        .join('|');
}

// Cache pentru valorile predefinite ale atributelor: key = `${platform}-${attrId}`
const attrValuesCache = new Map();

// Închide toate dropdown-urile când se dă click în afară
document.addEventListener('click', () => {
    document.querySelectorAll('.attr-dropdown-list').forEach(l => l.classList.add('hidden'));
});

export function populateCategorySelector() {
    const categories = [...(state.competitionDataCache?.suggested_categories || [])];
    categories.sort((a, b) => (b.count || 0) - (a.count || 0));
    const selector = document.getElementById('category-selector-emag');
    if (!selector) return;

    const savedEmagId = mappingState.categories.emag;

    if (categories.length === 0 && !savedEmagId) {
        selector.innerHTML = '<option value="">Nu există categorii disponibile</option>';
        return;
    }

    // Dacă avem o categorie deja încărcată din DB și nu apare în suggestions,
    // păstrăm opțiunea ei (cu numele deja setat în selector, dacă există).
    if (savedEmagId && !categories.find(c => String(c.id) === String(savedEmagId))) {
        const existingOpt = selector.querySelector(`option[value="${savedEmagId}"]`);
        const savedName = (existingOpt?.dataset?.name || existingOpt?.textContent || '').trim()
            || `Categorie ${savedEmagId}`;
        categories.unshift({ id: savedEmagId, name: savedName });
    }

    selector.innerHTML = categories.map(cat => {
        const safeName = String(cat.name || '').replace(/"/g, '&quot;');
        const isSelected = savedEmagId
            ? String(cat.id) === String(savedEmagId)
            : cat === categories[0];
        return `<option value="${cat.id}" data-name="${safeName}"${isSelected ? ' selected' : ''}>${safeName}</option>`;
    }).join('');

    // Sincronizăm selector-ul pe categoria activă explicit (fallback)
    if (savedEmagId) {
        selector.value = String(savedEmagId);
    }

    // Dacă n-aveam deja o categorie salvată din DB, inițializăm cu prima sugestie —
    // asta va declanșa și lookup-ul de mapări pe Trendyol/Temu prin handleCategoryChange.
    if (!savedEmagId) {
        handleCategoryChange('emag', String(categories[0].id));
    }
}

// Temu: recomandările vin per-produs de la Temu API (pre-calculate la inserare ordin)
// și sunt returnate de v2-competition în `temu_recommendations` (deja îmbogățite cu
// nume RO/EN prin JOIN pe catalogs.categories). Structura item: { categoryId, categoryName, nameRo, isBest }.
// NU depind de categoria eMAG aleasă — de aceea sunt excluse din applyCategoryMappings.
export function populateTemuCategorySelector() {
    const list = [...(state.competitionDataCache?.temu_recommendations || [])];
    const selector = document.getElementById('category-selector-temu');
    if (!selector) return;

    const savedTemuId = mappingState.categories.temu;

    // Produs fără recomandări Temu și fără nimic salvat → dropdown gol.
    // User-ul are butonul "Toate" care apelează v2-all-categories pentru căutare manuală.
    if (list.length === 0 && !savedTemuId) {
        selector.innerHTML = '<option value="">Selectați o categorie...</option>';
        return;
    }

    // Dacă produsul are deja o categorie Temu salvată care nu e în recomandări,
    // o păstrăm ca opțiune selectată (evităm pierderea alegerii user-ului).
    if (savedTemuId && !list.find(m => String(m.categoryId) === String(savedTemuId))) {
        const existingOpt = selector.querySelector(`option[value="${savedTemuId}"]`);
        const savedName = (existingOpt?.dataset?.name || existingOpt?.textContent || '').trim()
            || `Categorie ${savedTemuId}`;
        list.unshift({ categoryId: savedTemuId, categoryName: savedName });
    }

    const targetId = savedTemuId ? String(savedTemuId) : null;
    populateMappedCategoryDropdown('temu', list, targetId);

    // Dacă n-avea nimic salvat, aplicăm prima recomandare (cea mai bună conform Temu API) —
    // declanșează fetch-ul de atribute pentru acea categorie.
    if (!savedTemuId && list.length) {
        const best = list.find(m => m.isBest) || list[0];
        if (best && best.categoryId) {
            handleCategoryChange('temu', String(best.categoryId));
        }
    }
}

export async function handleCategoryChange(platform, categoryId) {
    if (!categoryId) return;

    const prevCategoryId = mappingState.categories[platform];

    // 1. Salvează valorile actuale în memorie, indexate pe (platform, categoryId)
    if (prevCategoryId) {
        if (!mappingState.savedValues[platform]) mappingState.savedValues[platform] = {};
        mappingState.savedValues[platform][prevCategoryId] = collectAttributeValuesForPlatform(platform);
    }

    // 2. Salvează conexiunile curente sub cheia combo actuală (înainte de a schimba categoria)
    const prevKey = buildConnectionsKey();
    mappingState.savedConnections[prevKey] = mappingState.connections.map(({ path: _, ...c }) => c);

    // 3. Actualizează categoria (cu ID-ul original) și șterge liniile de pe ecran
    mappingState.categories[platform] = categoryId;
    clearAllConnections();

    // Defensiv: dacă selector-ul nu e deja pe categoryId (ex: apel programmatic),
    // îl sincronizăm și adăugăm opțiunea dacă lipsește.
    const selectorSync = document.getElementById(`category-selector-${platform}`);
    if (selectorSync && String(selectorSync.value) !== String(categoryId)) {
        if (!selectorSync.querySelector(`option[value="${categoryId}"]`)) {
            const opt = document.createElement('option');
            opt.value = String(categoryId);
            opt.textContent = `Categorie ${categoryId}`;
            opt.dataset.name = `Categorie ${categoryId}`;
            selectorSync.appendChild(opt);
        }
        selectorSync.value = String(categoryId);
    }

    const el = document.getElementById(`${platform}-attributes`);
    if (el) el.innerHTML = '<p class="text-xs text-gray-400 italic">Se încarcă...</p>';
    const fetchResult = await fetchAndRenderAttributes(platform, categoryId);

    // Dacă webhook-ul a rezolvat un alt ID de categorie (ex: căutare după nume),
    // actualizăm mappingState cu ID-ul rezolvat și salvăm valorile sub cheia corectă.
    const resolvedCategoryId = fetchResult?.resolvedCategoryId || categoryId;
    if (resolvedCategoryId !== categoryId) {
        // Mută valorile salvate sub cheia originală la cheia rezolvată, dacă există
        if (mappingState.savedValues[platform]?.[categoryId]) {
            mappingState.savedValues[platform][resolvedCategoryId] =
                mappingState.savedValues[platform][categoryId];
            delete mappingState.savedValues[platform][categoryId];
        }
        mappingState.categories[platform] = resolvedCategoryId;
    }

    // 4. Restaurează valorile pentru noua categorie (dacă au mai fost pe ea)
    const restoredValues = mappingState.savedValues[platform]?.[resolvedCategoryId] || {};
    restoreAttributeValues(platform, restoredValues);

    // 5. Restaurează conexiunile pentru noul combo de categorii (dacă există în memorie)
    //    Dacă nu, fallback pe savedMappings din DB (primul load).
    const newKey = buildConnectionsKey();
    const memConns = mappingState.savedConnections[newKey];
    if (memConns && memConns.length) {
        restoreConnectionsFromList(memConns);
    } else {
        restoreConnections();
    }
    initDragConnect();
    initMarketplaceReorder();

    // 6. La schimbarea activă a categoriei eMAG, caută mapări pe Trendyol/Temu
    //    și pre-populează dropdown-urile + fetch caracteristici pentru cea mai bună.
    //    Folosim resolvedCategoryId (ID-ul canonic din DB) pentru lookup în mappings.
    if (platform === 'emag' && !mappingState._suppressEmagMappingLookup) {
        await applyCategoryMappings(resolvedCategoryId);
    }
}

async function applyCategoryMappings(emagCategoryId) {
    try {
        const res = await fetch(CATEGORY_MAPPINGS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePlatform: 'emag', sourceCategoryId: String(emagCategoryId) })
        });
        if (!res.ok) return;
        const data = await res.json();
        const mappings = data?.mappings || {};
        // Iterăm peste toate marketplace-urile în afară de eMAG (sursa).
        // Când adaugi un marketplace nou în MARKETPLACES, va primi automat mapping lookup
        // pentru noul `<id>_ro` dacă workflow-ul v2-category-mappings îl returnează.
        // Temu are propriul flux de recomandări (per-produs, via Temu API) încărcat în
        // populateTemuCategorySelector, NU derivat din categoria eMAG. Îl excludem aici
        // ca să nu suprascriem recomandarea specifică produsului la schimbarea categoriei eMAG.
        const targetPlatforms = MARKETPLACES.map(m => m.id).filter(id => id !== 'emag' && id !== 'temu');
        for (const targetPlatform of targetPlatforms) {
            const list = Array.isArray(mappings[targetPlatform]) ? mappings[targetPlatform] : [];
            if (!list.length) continue;

            // Dacă există deja o categorie setată pentru acea platformă (ex: user-ul a salvat
            // ceva pentru produs), preferăm să o păstrăm selectată în loc să o suprascriem cu cea auto.
            const existingId = mappingState.categories[targetPlatform];
            const listHasExisting = existingId && list.some(m => String(m.categoryId) === String(existingId));
            const targetId = listHasExisting ? String(existingId) : null;

            populateMappedCategoryDropdown(targetPlatform, list, targetId);

            // Dacă user-ul nu avea deja o categorie salvată, aplicăm recomandarea "best"
            if (!listHasExisting) {
                const best = list.find(m => m.isBest) || list[0];
                if (best && best.categoryId) {
                    await handleCategoryChange(targetPlatform, String(best.categoryId));
                }
            } else {
                // Altfel, doar ne asigurăm că selector-ul arată categoria deja activă
                const selector = document.getElementById(`category-selector-${targetPlatform}`);
                if (selector) selector.value = String(existingId);
            }
        }
    } catch (err) {
        console.error('Eroare lookup mapări categorii:', err);
    }
}

function populateMappedCategoryDropdown(platform, list, selectedId = null) {
    const selector = document.getElementById(`category-selector-${platform}`);
    if (!selector) return;
    const best = list.find(m => m.isBest) || list[0];
    const targetId = selectedId != null ? String(selectedId) : (best ? String(best.categoryId) : '');
    const emptyOpt = '<option value="">Selectați o categorie...</option>';
    const opts = list.map(m => {
        const badge = m.confidence === 'manual' ? ' ✓' : '';
        // EN-only în data-name: fetchAndRenderAttributes folosește dataset.name ca fallback
        // pentru lookup-ul de categorii în v2-category-attributes (care caută după numele
        // oficial EN, nu după traducere). Afișarea însă poate fi bilingvă.
        const enName = (m.categoryName || ('Categorie ' + m.categoryId)).replace(/"/g, '&quot;');
        const displayName = m.nameRo
            ? `${String(m.nameRo).replace(/"/g, '&quot;')} (${enName})`
            : enName;
        const isSel = String(m.categoryId) === targetId ? ' selected' : '';
        return `<option value="${m.categoryId}" data-name="${enName}"${isSel}>${displayName}${badge}</option>`;
    }).join('');
    selector.innerHTML = emptyOpt + opts;
    if (targetId) selector.value = targetId;
}

async function fetchAndRenderAttributes(platform, categoryId) {
    const container = document.getElementById(`${platform}-attributes`);
    if (!container) return null;
    // Trimitem și numele categoriei (ENGLEZĂ, oficial din catalogs) ca fallback
    // pentru căutarea după nume în DB. Dacă option-ul are data-name (cazul search bilingv),
    // îl folosim pe acela — textContent poate fi "RO (EN)" sau alte variante afișate.
    const selector = document.getElementById(`category-selector-${platform}`);
    const selectedOpt = selector?.selectedOptions?.[0];
    let categoryName = selectedOpt?.dataset?.name || selectedOpt?.text?.trim() || '';
    // Cleanup compatibilitate:
    //   - șterge sufix ` (123)` (vechi, număr de produse)
    //   - șterge ` ✓` (badge confidence=manual)
    //   - extrage partea din paranteză dacă formatul e "Nume RO (Nume EN)" → doar "Nume EN"
    categoryName = categoryName
        .replace(/\s*✓\s*$/, '')
        .replace(/\s*\(\d+\)\s*$/, '');
    // Dacă textContent e "Nume RO (Nume EN)" și nu avem data-name, extragem EN din paranteze
    if (!selectedOpt?.dataset?.name) {
        const parenMatch = categoryName.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
        if (parenMatch) categoryName = parenMatch[2].trim();
    }
    try {
        const response = await fetch(CATEGORY_ATTRIBUTES_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, categoryId, categoryName })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const attrs = Array.isArray(data.attributes) ? data.attributes : [];
        // Populăm cache-ul de valori pentru dropdown-uri
        attrValuesCache.clear();
        attrs.forEach(attr => {
            const attrId = String(attr.id ?? attr.name ?? '').replace(/[^a-zA-Z0-9_-]/g, '_');
            if (Array.isArray(attr.values) && attr.values.length > 0) {
                attrValuesCache.set(`${platform}-${attrId}`, attr.values);
            }
        });
        container.innerHTML = attrs.length
            ? attrs.map(attr => renderAttributeRow(attr, platform)).join('')
            : '<p class="text-xs text-gray-400 italic">Nu există caracteristici pentru această categorie</p>';
        initAttrDropdowns(platform);
        return {
            resolvedCategoryId: data.resolvedCategoryId ? String(data.resolvedCategoryId) : categoryId,
            resolvedCategoryName: data.resolvedCategoryName || categoryName
        };
    } catch {
        container.innerHTML = '<p class="text-xs text-red-400 italic">Caracteristicile vor fi disponibile după configurarea webhook-ului</p>';
        return null;
    }
}

function renderAttributeRow(attr, platform) {
    const attrId = String(attr.id ?? attr.name ?? '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const isRequired = attr.required === true;
    const allowsCustom = attr.allowsCustom === true;
    const hasValues = Array.isArray(attr.values) && attr.values.length > 0;

    const requiredMark = isRequired ? '<span class="text-red-500 text-xs ml-0.5">*</span>' : '';
    const bgClass = isRequired ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50';
    const labelClass = isRequired ? 'text-amber-800' : 'text-gray-600';
    const borderClass = isRequired ? 'border-amber-300 focus:border-amber-500' : 'border-gray-300 focus:border-blue-400';

    // Badge allowsCustom — apare doar dacă există valori predefinite
    const customBadge = hasValues
        ? (allowsCustom
            ? `<span class="flex-shrink-0 text-xs bg-green-100 text-green-700 rounded px-1 leading-4 cursor-default" title="Poți introduce și valori personalizate">✏️</span>`
            : `<span class="flex-shrink-0 text-xs bg-gray-200 text-gray-500 rounded px-1 leading-4 cursor-default" title="Doar valori din listă">🔒</span>`)
        : '';

    let inputHtml;
    if (hasValues) {
        // Dropdown cu search — readonly dacă nu allowsCustom, editabil dacă allowsCustom
        const readonlyAttr = allowsCustom ? '' : 'readonly';
        const placeholder = allowsCustom
            ? (isRequired ? 'Caută sau introdu obligatoriu...' : 'Caută sau introdu valoare...')
            : (isRequired ? 'Selectează (obligatoriu)...' : 'Selectează valoare...');
        inputHtml = `<div class="attr-search-dropdown flex-1 relative" data-attr-id="${attrId}" data-platform="${platform}" data-allow-custom="${allowsCustom}">
            <input type="text" class="attr-value-input w-full text-xs bg-transparent border-0 border-b ${borderClass} focus:outline-none px-0 min-w-0 cursor-pointer"
                   data-attr-id="${attrId}" data-platform="${platform}" placeholder="${placeholder}" value="${attr.value || ''}" ${readonlyAttr} autocomplete="off">
            <div class="attr-dropdown-list hidden absolute left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-44 overflow-y-auto" style="top:calc(100% + 2px); z-index:100;"></div>
        </div>`;
    } else {
        // Input text simplu
        const placeholder = isRequired ? 'Obligatoriu...' : 'Valoare...';
        inputHtml = `<input type="text" class="attr-value-input flex-1 text-xs bg-transparent border-0 border-b ${borderClass} focus:outline-none px-0 min-w-0"
               data-attr-id="${attrId}" data-platform="${platform}" placeholder="${placeholder}" value="${attr.value || ''}">`;
    }

    // Prima coloană (din MARKETPLACES) nu are dot stâng, ultima nu are dot drept.
    // Coloanele intermediare (bridge) au ambele dot-uri. Asta urmează ordinea curentă
    // din MARKETPLACES, deci funcționează corect după drag-reorder.
    const idx = MARKETPLACES.findIndex(m => m.id === platform);
    const isFirstCol = idx === 0;
    const isLastCol  = idx === MARKETPLACES.length - 1;
    const leftDot = isFirstCol
        ? '<div class="w-3 flex-shrink-0"></div>'
        : `<div class="connector-dot bg-gray-300" data-side="left" data-platform="${platform}" data-attr-id="${attrId}"></div>`;
    const rightDot = isLastCol
        ? '<div class="w-3 flex-shrink-0"></div>'
        : `<div class="connector-dot bg-gray-300" data-side="right" data-platform="${platform}" data-attr-id="${attrId}"></div>`;

    // Display bilingv: dacă există nameRo (din catalogs.characteristics.name_ro),
    // arată "Nume RO (Nume EN)". Altfel, doar EN. Titlul tooltip-ului e RO dacă există,
    // ca să confirme exact ce a generat Gemini pe hover.
    const nameEn = escapeHtmlAttr(attr.name || '');
    const nameRo = attr.nameRo ? escapeHtmlAttr(attr.nameRo) : '';
    const displayName = nameRo
        ? `${nameRo} <span class="text-gray-400 font-normal">(${nameEn})</span>`
        : nameEn;
    const tooltipName = nameRo
        ? `${attr.nameRo}${isRequired ? ' (obligatoriu)' : ''} — EN: ${attr.name}`
        : `${attr.name}${isRequired ? ' (obligatoriu)' : ''}`;

    return `<div class="attr-row flex items-center gap-1" data-attr-id="${attrId}" data-platform="${platform}" data-required="${isRequired}">
        ${leftDot}
        <div class="flex-1 flex items-center gap-1.5 ${bgClass} rounded px-2 py-1 min-w-0">
            <span class="text-xs ${labelClass} font-medium flex-shrink-0 truncate" style="width:40%" title="${escapeHtmlAttr(tooltipName)}">${displayName}${requiredMark}</span>
            ${customBadge}
            ${inputHtml}
        </div>
        ${rightDot}
    </div>`;
}

function initAttrDropdowns(platform) {
    const container = document.getElementById(`${platform}-attributes`);
    if (!container) return;

    container.querySelectorAll('.attr-search-dropdown').forEach(wrapper => {
        const input = wrapper.querySelector('.attr-value-input');
        const list = wrapper.querySelector('.attr-dropdown-list');
        const allowCustom = wrapper.dataset.allowCustom === 'true';
        const key = `${platform}-${wrapper.dataset.attrId}`;
        const values = attrValuesCache.get(key) || [];

        function renderList(filter) {
            const search = (filter || '').toLowerCase().trim();
            const filtered = search
                ? values.filter(v => v.name.toLowerCase().includes(search))
                : values;

            let html = filtered
                .map(v => `<div class="attr-dropdown-item px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-xs" data-val="${v.name.replace(/"/g, '&quot;')}">${v.name}</div>`)
                .join('');

            // Opțiune de valoare personalizată — doar dacă allowCustom și textul nu e deja în listă
            if (allowCustom && filter && !filtered.some(v => v.name.toLowerCase() === filter.toLowerCase())) {
                html += `<div class="attr-dropdown-item px-2 py-1.5 hover:bg-green-50 cursor-pointer text-xs text-green-700 italic border-t border-gray-100" data-val="${filter.replace(/"/g, '&quot;')}">✏️ Valoare personalizată: "${filter}"</div>`;
            }

            list.innerHTML = html;
            list.classList.toggle('hidden', !html);
        }

        // Deschide dropdown la focus / click
        input.addEventListener('focus', (e) => {
            e.stopPropagation();
            renderList(allowCustom ? input.value : '');
        });
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            renderList(allowCustom ? input.value : '');
        });

        // Filtrare live — doar pentru allowCustom (readonly nu trimite input events)
        if (allowCustom) {
            input.addEventListener('input', () => renderList(input.value));
        }

        // Selectare item
        list.addEventListener('mousedown', (e) => {
            // mousedown în loc de click ca să nu pierdem focus-ul înainte de selecție
            const item = e.target.closest('.attr-dropdown-item');
            if (!item) return;
            e.preventDefault();
            input.value = item.dataset.val;
            list.classList.add('hidden');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Închide la blur
        input.addEventListener('blur', () => {
            // Mic delay ca mousedown pe item să ruleze primul
            setTimeout(() => list.classList.add('hidden'), 150);
        });
    });
}

// Referința pentru coordonatele SVG e #mapping-inner (wrapper-ul cu min-width:max-content
// care conține atât grid-ul coloanelor cât și SVG-ul). Fallback pe #attributes-mapping-area
// pentru robustețe în caz că template-ul e intermediar într-un re-render.
function getInnerRect() {
    const inner = document.getElementById('mapping-inner') || document.getElementById('attributes-mapping-area');
    return inner ? inner.getBoundingClientRect() : null;
}

function getDotPos(dot) {
    const innerRect = getInnerRect();
    if (!innerRect) return { x: 0, y: 0 };
    const dotRect = dot.getBoundingClientRect();
    return {
        x: dotRect.left + dotRect.width / 2 - innerRect.left,
        y: dotRect.top + dotRect.height / 2 - innerRect.top
    };
}

function bezierPath(x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2;
    return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

function makeSvgPath(d, stroke, dashed) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.8');
    if (dashed) path.setAttribute('stroke-dasharray', '6,3');
    return path;
}

// Recalculează poziția tuturor path-urilor SVG pe baza pozițiilor curente ale dot-urilor.
// Triggerat de window.resize, ResizeObserver pe mapping area, și drag-reorder marketplaces.
function recomputeAllConnectionPositions() {
    if (!mappingState.connections.length) return;
    for (const conn of mappingState.connections) {
        if (!conn.path || !conn.path.isConnected) continue;
        const fromDot = document.querySelector(
            `.connector-dot[data-platform="${conn.fromPlatform}"][data-attr-id="${conn.fromAttrId}"][data-side="${conn.fromSide}"]`);
        const toDot = document.querySelector(
            `.connector-dot[data-platform="${conn.toPlatform}"][data-attr-id="${conn.toAttrId}"][data-side="${conn.toSide}"]`);
        if (!fromDot || !toDot) continue;
        const a = getDotPos(fromDot);
        const b = getDotPos(toDot);
        conn.path.setAttribute('d', bezierPath(a.x, a.y, b.x, b.y));
    }
}

function initDragConnect() {
    const area = document.getElementById('attributes-mapping-area');
    if (!area) return;
    if (area._dragHandler) area.removeEventListener('mousedown', area._dragHandler);

    // Idempotent: leagă listenerii de resize o singură dată per element #attributes-mapping-area.
    // La remount-ul template-ului (nou element) flag-ul lipsește și se leagă din nou.
    if (!area._resizeBound) {
        let rafPending = false;
        const onResize = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                recomputeAllConnectionPositions();
            });
        };
        window.addEventListener('resize', onResize);
        try {
            const ro = new ResizeObserver(onResize);
            ro.observe(area);
            area._resizeObserver = ro;
        } catch (e) { /* ResizeObserver not available — window.resize is enough */ }
        // Recompute și la scroll (orizontal/vertical) pentru ca dacă vreun listener extern
        // modifică scroll-ul în timpul unui drag liniile să rămână aliniate.
        area.addEventListener('scroll', onResize);
        area._resizeBound = true;
        area._resizeHandler = onResize;
    }

    // Parametri pentru auto-scroll în timpul drag-ului.
    const SCROLL_ZONE = 60;          // px de la margine la care începe auto-scroll
    const MAX_SCROLL_SPEED = 14;     // px/frame la apropiere maximă

    const handler = e => {
        const dot = e.target.closest('.connector-dot');
        if (!dot) return;
        e.preventDefault();

        const svg = document.getElementById('connections-svg');
        const tempPath = makeSvgPath(bezierPath(0, 0, 0, 0), '#3b82f6', true);
        svg.appendChild(tempPath);
        dot.style.backgroundColor = '#3b82f6';

        let lastEv = e;
        let rafId = null;

        // rAF loop: auto-scroll pe muchie + redraw temp path. Rulează continuu cât timp
        // drag-ul e activ (se oprește în onUp). Citește cursorul curent din `lastEv` care
        // e actualizat de onMove — astfel scroll-ul se întâmplă chiar dacă user-ul ține
        // mouse-ul nemișcat lângă marginea containerului.
        const frame = () => {
            if (!lastEv) { rafId = null; return; }
            const areaEl = document.getElementById('attributes-mapping-area');
            if (!areaEl) { rafId = null; return; }
            const areaRect = areaEl.getBoundingClientRect();

            const distTop    = lastEv.clientY - areaRect.top;
            const distBottom = areaRect.bottom - lastEv.clientY;
            if (distTop    < SCROLL_ZONE) areaEl.scrollTop -= MAX_SCROLL_SPEED * Math.max(0, 1 - distTop    / SCROLL_ZONE);
            if (distBottom < SCROLL_ZONE) areaEl.scrollTop += MAX_SCROLL_SPEED * Math.max(0, 1 - distBottom / SCROLL_ZONE);

            const distLeft  = lastEv.clientX - areaRect.left;
            const distRight = areaRect.right - lastEv.clientX;
            if (distLeft  < SCROLL_ZONE) areaEl.scrollLeft -= MAX_SCROLL_SPEED * Math.max(0, 1 - distLeft  / SCROLL_ZONE);
            if (distRight < SCROLL_ZONE) areaEl.scrollLeft += MAX_SCROLL_SPEED * Math.max(0, 1 - distRight / SCROLL_ZONE);

            // Redraw temp path. Sursa e recalculată fresh în fiecare frame, pentru ca
            // dacă scroll-ul a modificat poziția dot-ului (container scrollabil), path-ul
            // să rămână ancorat. getDotPos folosește innerRect → coordonate stabile.
            const innerRect = getInnerRect();
            if (innerRect) {
                const srcPos = getDotPos(dot);
                const ex = lastEv.clientX - innerRect.left;
                const ey = lastEv.clientY - innerRect.top;
                tempPath.setAttribute('d', bezierPath(srcPos.x, srcPos.y, ex, ey));
            }

            rafId = requestAnimationFrame(frame);
        };

        const onMove = ev => {
            lastEv = ev;
            if (rafId == null) rafId = requestAnimationFrame(frame);
        };

        const onUp = ev => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
            lastEv = null;
            dot.style.backgroundColor = '';

            const targetDot = ev.target.closest('.connector-dot');
            if (targetDot && targetDot !== dot && targetDot.dataset.platform !== dot.dataset.platform) {
                const srcPos = getDotPos(dot);
                const endPos = getDotPos(targetDot);
                tempPath.setAttribute('d', bezierPath(srcPos.x, srcPos.y, endPos.x, endPos.y));
                tempPath.setAttribute('stroke', '#16a34a');
                tempPath.removeAttribute('stroke-dasharray');
                tempPath.setAttribute('pointer-events', 'visibleStroke');
                tempPath.setAttribute('class', 'connection-line');
                tempPath.style.cursor = 'pointer';

                const conn = {
                    fromPlatform: dot.dataset.platform,
                    fromAttrId: dot.dataset.attrId,
                    fromSide: dot.dataset.side,
                    toPlatform: targetDot.dataset.platform,
                    toAttrId: targetDot.dataset.attrId,
                    toSide: targetDot.dataset.side,
                    path: tempPath
                };
                // Strict 1:1: orice conexiune existentă care atinge unul dintre cele
                // două dot-uri (sursă SAU țintă, orice capăt) este înlocuită automat.
                // Evită duplicate vizuale și împiedică 1-to-many pe aceeași caracteristică.
                const conflicting = mappingState.connections.filter(c =>
                    (c.fromPlatform === dot.dataset.platform && c.fromAttrId === dot.dataset.attrId && c.fromSide === dot.dataset.side) ||
                    (c.toPlatform   === dot.dataset.platform && c.toAttrId   === dot.dataset.attrId && c.toSide   === dot.dataset.side) ||
                    (c.fromPlatform === targetDot.dataset.platform && c.fromAttrId === targetDot.dataset.attrId && c.fromSide === targetDot.dataset.side) ||
                    (c.toPlatform   === targetDot.dataset.platform && c.toAttrId   === targetDot.dataset.attrId && c.toSide   === targetDot.dataset.side)
                );
                conflicting.forEach(removeConnection);
                mappingState.connections.push(conn);
                dot.style.backgroundColor = '#16a34a';
                targetDot.style.backgroundColor = '#16a34a';
                tempPath.addEventListener('click', () => removeConnection(conn));
                saveConnections();
                // AI map-value: dacă un capăt al conexiunii e completat și celălalt nu,
                // cere AI-ului să propună o valoare pentru capătul gol pe baza sursei.
                maybeTriggerAiMapValue(conn);
            } else {
                tempPath.remove();
            }
        };

        // Inițiere: poziționăm path-ul la sursă (primul frame ascunde start = end).
        const initPos = getDotPos(dot);
        tempPath.setAttribute('d', bezierPath(initPos.x, initPos.y, initPos.x, initPos.y));

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    area.addEventListener('mousedown', handler);
    area._dragHandler = handler;
}

// Drag-reorder coloane marketplace folosind SortableJS (deja încărcat global via CDN).
// Idempotent: leagă Sortable o singură dată per element #marketplace-grid, ca să nu
// dubleze listenerii la remount-uri consecutive ale template-ului.
function initMarketplaceReorder() {
    if (typeof Sortable === 'undefined') return;
    const grid = document.getElementById('marketplace-grid');
    if (!grid || grid._sortableBound) return;
    grid._sortableBound = true;

    Sortable.create(grid, {
        animation: 150,
        handle: '.marketplace-drag-handle',
        draggable: '.marketplace-column',
        ghostClass: 'opacity-50',
        chosenClass: 'ring-2',
        onEnd: () => {
            // Citim noua ordine direct din DOM (sursa de adevăr post-drag)
            const newOrder = Array.from(grid.querySelectorAll('.marketplace-column'))
                .map(el => el.dataset.platform)
                .filter(Boolean);
            if (!newOrder.length) return;
            // Persistăm în localStorage pentru reload
            try {
                localStorage.setItem(MARKETPLACE_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
            } catch (e) { /* storage indisponibil — ignorăm */ }
            // Mutăm in-memory array-ul MARKETPLACES (preserves identity — alte module
            // care importă MARKETPLACES vor vedea noua ordine fără reimport)
            MARKETPLACES.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
            // Conexiunile sunt identificate prin (platform, attrId) — nu prin poziție,
            // deci nu se pierde nicio conexiune. Dot-urile SVG trebuie doar recalculate
            // la noua poziție DOM (un frame după reflow-ul SortableJS).
            requestAnimationFrame(() => recomputeAllConnectionPositions());
        }
    });
}

function removeConnection(conn) {
    conn.path.remove();
    const fromDot = document.querySelector(`.connector-dot[data-platform="${conn.fromPlatform}"][data-attr-id="${conn.fromAttrId}"][data-side="${conn.fromSide}"]`);
    const toDot = document.querySelector(`.connector-dot[data-platform="${conn.toPlatform}"][data-attr-id="${conn.toAttrId}"][data-side="${conn.toSide}"]`);
    if (fromDot) fromDot.style.backgroundColor = '';
    if (toDot) toDot.style.backgroundColor = '';
    mappingState.connections = mappingState.connections.filter(c => c !== conn);
    saveConnections();
}

// Placeholder pentru a evita ReferenceError — persistarea se face prin butonul de save.
function saveConnections() {}

function getAttrInput(platform, attrId) {
    return document.querySelector(
        `.attr-value-input[data-platform="${platform}"][data-attr-id="${attrId}"]`
    );
}

function getAttrNameFromRow(platform, attrId) {
    const row = document.querySelector(
        `.attr-row[data-platform="${platform}"][data-attr-id="${attrId}"]`
    );
    const label = row?.querySelector('span[title]');
    // Folosește title (fără " (obligatoriu)") când există, fallback pe textContent
    const raw = (label?.getAttribute('title') || label?.textContent || '').trim();
    return raw.replace(/\s*\(obligatoriu\)\s*$/i, '').trim();
}

function maybeTriggerAiMapValue(conn) {
    const fromInput = getAttrInput(conn.fromPlatform, conn.fromAttrId);
    const toInput = getAttrInput(conn.toPlatform, conn.toAttrId);
    const fromVal = fromInput?.value?.trim() || '';
    const toVal = toInput?.value?.trim() || '';

    // Determină care capăt e sursa (cel completat) și care e ținta (cel gol)
    let sourcePlatform, sourceAttrId, sourceValue, targetPlatform, targetAttrId, targetInput;
    if (fromVal && !toVal) {
        sourcePlatform = conn.fromPlatform;
        sourceAttrId = conn.fromAttrId;
        sourceValue = fromVal;
        targetPlatform = conn.toPlatform;
        targetAttrId = conn.toAttrId;
        targetInput = toInput;
    } else if (toVal && !fromVal) {
        sourcePlatform = conn.toPlatform;
        sourceAttrId = conn.toAttrId;
        sourceValue = toVal;
        targetPlatform = conn.fromPlatform;
        targetAttrId = conn.fromAttrId;
        targetInput = fromInput;
    } else {
        // Ambele goale sau ambele completate — nu facem nimic
        return;
    }

    const targetCategoryId = mappingState.categories[targetPlatform];
    if (!targetCategoryId || !targetInput) return;

    const sourceAttrName = getAttrNameFromRow(sourcePlatform, sourceAttrId);
    const origPlaceholder = targetInput.placeholder || '';
    targetInput.placeholder = '🤖 AI map...';

    fetch(AI_MAP_VALUE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sourcePlatform,
            sourceAttrName,
            sourceValue,
            targetPlatform,
            targetCategoryId: String(targetCategoryId),
            targetAttrId: String(targetAttrId),
            productTitle: state.editedProductData?.title || ''
        })
    })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
        if (data && typeof data.value === 'string' && data.value) {
            targetInput.value = data.value;
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    })
    .catch(err => console.error('AI map-value eșuat:', err))
    .finally(() => { targetInput.placeholder = origPlaceholder; });
}

function clearAllConnections() {
    const svg = document.getElementById('connections-svg');
    if (svg) svg.innerHTML = '';
    const area = document.getElementById('attributes-mapping-area');
    if (area && area._dragHandler) {
        area.removeEventListener('mousedown', area._dragHandler);
        area._dragHandler = null;
    }
    mappingState.connections = [];
}

// Restaurează conexiunile din DB (savedMappings) — folosit la primul load al produsului.
function restoreConnections() {
    restoreConnectionsFromList(mappingState.savedMappings);
}

// Restaurează o listă de conexiuni pe ecran (din memorie sau DB).
// Conexiunile al căror dot nu există în DOM (categorie diferită) sunt ignorate silențios.
function restoreConnectionsFromList(list) {
    if (!list || !list.length) return;
    const svg = document.getElementById('connections-svg');
    if (!svg) return;
    // Defensive 1:1 dedup — row-urile legacy din DB pot viola strict 1:1 (era posibil
    // înainte de enforcement). Păstrăm DOAR ultima conexiune per-endpoint, ca fiecare
    // caracteristică să aibă cel mult o linie la restore.
    const seenEndpoints = new Map();
    const dedupedList = [];
    for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        const keyFrom = `${c.fromPlatform}|${c.fromAttrId}|${c.fromSide}`;
        const keyTo   = `${c.toPlatform}|${c.toAttrId}|${c.toSide}`;
        if (seenEndpoints.has(keyFrom) || seenEndpoints.has(keyTo)) continue;
        seenEndpoints.set(keyFrom, true);
        seenEndpoints.set(keyTo, true);
        dedupedList.unshift(c);
    }
    list = dedupedList;
    list.forEach(c => {
        const fromDot = document.querySelector(`.connector-dot[data-platform="${c.fromPlatform}"][data-attr-id="${c.fromAttrId}"][data-side="${c.fromSide}"]`);
        const toDot = document.querySelector(`.connector-dot[data-platform="${c.toPlatform}"][data-attr-id="${c.toAttrId}"][data-side="${c.toSide}"]`);
        if (!fromDot || !toDot) return;
        const p1 = getDotPos(fromDot);
        const p2 = getDotPos(toDot);
        const path = makeSvgPath(bezierPath(p1.x, p1.y, p2.x, p2.y), '#16a34a', false);
        path.setAttribute('pointer-events', 'visibleStroke');
        path.setAttribute('class', 'connection-line');
        path.style.cursor = 'pointer';
        svg.appendChild(path);
        fromDot.style.backgroundColor = '#16a34a';
        toDot.style.backgroundColor = '#16a34a';
        const conn = { ...c, path };
        mappingState.connections.push(conn);
        path.addEventListener('click', () => removeConnection(conn));
    });
}

function collectAttributeValuesForPlatform(platform) {
    const result = {};
    document.querySelectorAll(`.attr-value-input[data-platform="${platform}"]`).forEach(input => {
        if (input.value) result[input.dataset.attrId] = input.value;
    });
    const selector = document.getElementById(`category-selector-${platform}`);
    if (selector?.value) result.__categoryId = selector.value;
    return result;
}

function collectAllAttributeValues() {
    const result = {};
    MARKETPLACES.forEach(mp => {
        const platform = mp.id;
        const values = collectAttributeValuesForPlatform(platform);
        const categoryId = mappingState.categories[platform];
        const selector = document.getElementById(`category-selector-${platform}`);
        const selectedOpt = selector?.selectedOptions?.[0];
        const categoryName = selectedOpt?.dataset?.name || selectedOpt?.textContent?.trim() || null;
        result[platform] = { categoryId: categoryId || null, categoryName: categoryName || null, attributes: values };
    });
    return result;
}

function restoreAttributeValues(platform, values) {
    Object.entries(values).forEach(([attrId, value]) => {
        if (attrId === '__categoryId') return;
        const input = document.querySelector(`.attr-value-input[data-platform="${platform}"][data-attr-id="${attrId}"]`);
        if (input) input.value = value;
    });
}

async function saveAttributesToDB(asin) {
    try {
        const listingData = collectAllAttributeValues();
        const mappings = mappingState.connections.map(({ path: _, ...c }) => c);
        // Chain inference: dacă există eMAG[X]↔Trendyol[Y] ȘI Trendyol[Y]↔Temu[Z]
        // pentru același attrId pe Trendyol, adăugăm o mapare virtuală eMAG[X]↔Temu[Z]
        // marcată `via: 'trendyol'`. Backend-ul o va folosi la învățarea în
        // mappings.characteristics ca să știm că toate trei reprezintă aceeași caracteristică.
        // LITE LIMITATION: chain inference e 3-platform-aware hardcodat (eMAG↔Trendyol↔Temu).
        // Pentru a generaliza la N platforme: construiește un graf de mapping peste TOATE
        // perechile (platform, attrId) și propagă tranzitiv echivalența prin BFS/DFS, apoi
        // emit toate perechile eMAG↔<otherN> care rezultă din closure-ul tranzitiv.
        const chainMappings = [];
        for (const a of mappings) {
            const aIsEmagTr = (a.fromPlatform === 'emag' && a.toPlatform === 'trendyol');
            const aIsTrEmag = (a.fromPlatform === 'trendyol' && a.toPlatform === 'emag');
            if (!aIsEmagTr && !aIsTrEmag) continue;
            const emagAttrId = aIsEmagTr ? a.fromAttrId : a.toAttrId;
            const trAttrId = aIsEmagTr ? a.toAttrId : a.fromAttrId;
            for (const b of mappings) {
                if (a === b) continue;
                const bIsTrTemu = (b.fromPlatform === 'trendyol' && b.toPlatform === 'temu');
                const bIsTemuTr = (b.fromPlatform === 'temu' && b.toPlatform === 'trendyol');
                if (!bIsTrTemu && !bIsTemuTr) continue;
                const bTrAttrId = bIsTrTemu ? b.fromAttrId : b.toAttrId;
                if (bTrAttrId !== trAttrId) continue;
                const temuAttrId = bIsTrTemu ? b.toAttrId : b.fromAttrId;
                chainMappings.push({
                    fromPlatform: 'emag',
                    fromAttrId: emagAttrId,
                    fromSide: 'right',
                    toPlatform: 'temu',
                    toAttrId: temuAttrId,
                    toSide: 'left',
                    via: 'trendyol'
                });
            }
        }
        const payload = { asin, listingData, mappings, chainMappings };
        await fetch(SAVE_PRODUCT_ATTRIBUTES_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Eroare la salvarea atributelor:', err);
    }
}

export async function loadProductAttributesFromDB(asin) {
    // CRITICAL: mappingState e la nivel de modul, nu per-produs. Trebuie resetat
    // complet la începutul fiecărei încărcări de produs altfel datele produsului
    // anterior rămân în memorie și contaminează produsul curent. Scenariu clasic:
    // Produs A salvat cu Temu=500, apoi deschis Produs B care NU are Temu salvat;
    // fără reset, categories.temu rămâne 500 din A și la save-ul lui B se trimite
    // accidental Temu=500 deși user-ul nu a ales nimic pe Temu pentru B.
    mappingState.connections = [];
    mappingState.dragging = null;
    mappingState.categories = Object.fromEntries(MARKETPLACES.map(m => [m.id, null]));
    mappingState.savedValues = Object.fromEntries(MARKETPLACES.map(m => [m.id, {}]));
    mappingState.savedConnections = {};
    mappingState.savedMappings = [];
    mappingState.searchTimers = {};
    mappingState._suppressEmagMappingLookup = false;
    // Și curățăm SVG-ul de conexiuni din renderul anterior (dacă a mai rămas ceva)
    const svgEl = document.getElementById('connections-svg');
    if (svgEl) svgEl.innerHTML = '';

    try {
        const res = await fetch(GET_PRODUCT_ATTRIBUTES_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asin })
        });
        if (!res.ok) return;
        const raw = await res.json();
        const data = raw?.get_product_attributes_v2 || raw;
        const listingData = data?.listing_data || {};
        const mappings = data?.mappings || [];
        if (!Object.keys(listingData).length && !mappings.length) return;
        mappingState.savedMappings = mappings;
        // Suprimă lookup-ul automat de mapări cât timp restaurăm datele salvate —
        // userul a confirmat deja categoriile pentru acest produs, nu le rescriem.
        mappingState._suppressEmagMappingLookup = true;
        try {
            // Restaurare categorii și valori per platformă
            const platforms = MARKETPLACES.map(m => m.id);
            for (const platform of platforms) {
                const platformData = listingData[platform];
                if (!platformData?.categoryId) continue;
                // Salvăm valorile din DB indexate pe (platform, categoryId)
                if (!mappingState.savedValues[platform]) mappingState.savedValues[platform] = {};
                mappingState.savedValues[platform][platformData.categoryId] = platformData.attributes || {};
                mappingState.categories[platform] = platformData.categoryId;
                const selector = document.getElementById(`category-selector-${platform}`);
                let opt = null;
                if (selector) {
                    const catName = platformData.categoryName || `Categorie ${platformData.categoryId}`;
                    // Adaugă opțiunea dacă nu există deja
                    opt = selector.querySelector(`option[value="${platformData.categoryId}"]`);
                    if (!opt) {
                        opt = document.createElement('option');
                        opt.value = platformData.categoryId;
                        opt.textContent = catName;
                        opt.dataset.name = catName;
                        selector.appendChild(opt);
                    }
                    selector.value = platformData.categoryId;
                }
                const fetchResult = await fetchAndRenderAttributes(platform, platformData.categoryId);
                // Aplică ID-ul și numele rezolvate de backend (name-based lookup când ID-ul din
                // competiție eMAG e greșit dar numele e corect → backend găsește ID-ul canonical).
                if (fetchResult) {
                    const resolvedId = fetchResult.resolvedCategoryId || platformData.categoryId;
                    const resolvedName = fetchResult.resolvedCategoryName;
                    if (resolvedId !== platformData.categoryId) {
                        mappingState.categories[platform] = resolvedId;
                        if (!mappingState.savedValues[platform]) mappingState.savedValues[platform] = {};
                        if (mappingState.savedValues[platform][platformData.categoryId]) {
                            mappingState.savedValues[platform][resolvedId] = mappingState.savedValues[platform][platformData.categoryId];
                            delete mappingState.savedValues[platform][platformData.categoryId];
                        }
                    }
                    if (resolvedName && selector) {
                        const currentOpt = selector.querySelector(`option[value="${resolvedId}"]`) || opt;
                        if (currentOpt) {
                            currentOpt.textContent = resolvedName;
                            currentOpt.dataset.name = resolvedName;
                        }
                        selector.value = resolvedId;
                    }
                }
                restoreAttributeValues(platform, platformData.attributes || {});
            }
            restoreConnections();
            initDragConnect();
            initMarketplaceReorder();
            // Salvăm conexiunile din DB și în memoria locală sub cheia combo curentă,
            // astfel că un switch accidental și revenire le va restaura din memorie.
            if (mappings.length) {
                mappingState.savedConnections[buildConnectionsKey()] =
                    mappings.map(({ path: _, ...c }) => c);
            }
        } finally {
            mappingState._suppressEmagMappingLookup = false;
        }

        // După restaurare: dacă produsul are eMAG salvat dar NU are salvare pe vreo altă
        // platformă, declanșăm lookup-ul de mapări ca să pre-populăm dropdown-urile de pe
        // celelalte platforme (feature cerut explicit: auto-mapping pe baza eMAG la page load).
        const emagId = listingData.emag?.categoryId;
        const otherPlatforms = MARKETPLACES.map(m => m.id).filter(id => id !== 'emag');
        const missingTarget = emagId && otherPlatforms.some(p => !listingData[p]?.categoryId);
        if (missingTarget) {
            await applyCategoryMappings(String(emagId));
        }
    } catch (err) {
        console.error('Eroare la încărcarea atributelor:', err);
    }
}

export function handleAllCategoriesToggle(checkbox) {
    const platform = checkbox.dataset.platform;
    const searchBox = document.getElementById(`all-categories-${platform}`);
    if (!searchBox) return;
    searchBox.classList.toggle('hidden', !checkbox.checked);
    if (checkbox.checked) {
        const input = document.getElementById(`cat-search-${platform}`);
        if (input) { input.value = ''; input.focus(); }
        renderCategoryResults(platform, []);
    }
}

export function handleCategorySearch(input) {
    const platform = input.dataset.platform;
    clearTimeout(mappingState.searchTimers[platform]);
    mappingState.searchTimers[platform] = setTimeout(async () => {
        const search = input.value.trim();
        try {
            const res = await fetch(ALL_CATEGORIES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, search })
            });
            if (!res.ok) return;
            const data = await res.json();
            renderCategoryResults(platform, data.categories || []);
        } catch {
            renderCategoryResults(platform, []);
        }
    }, 300);
}

// Helper HTML escape pentru atribute și text
function escapeHtmlAttr(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

// Format display pentru o categorie: "Nume RO (Nume EN)" sau doar EN dacă nu e tradus.
// Folosit atât în rezultate de search cât și ca textContent al <option>.
function formatCategoryLabel(cat) {
    const en = cat.name || '';
    const ro = (cat.nameRo || '').trim();
    if (ro && ro.toLowerCase() !== en.toLowerCase()) {
        return `${ro} (${en})`;
    }
    return en;
}

function renderCategoryResults(platform, categories) {
    const container = document.getElementById(`cat-results-${platform}`);
    if (!container) return;
    if (!categories.length) {
        container.innerHTML = '<p class="px-2 py-1 text-gray-400 italic">Niciun rezultat</p>';
        return;
    }
    container.innerHTML = categories.map(cat => {
        const en = escapeHtmlAttr(cat.name || '');
        const ro = escapeHtmlAttr(cat.nameRo || '');
        const id = escapeHtmlAttr(cat.id);
        // Display: RO îngroșat + EN gri în paranteză, sau doar EN dacă nu există traducere
        const display = (cat.nameRo && cat.nameRo.trim() && cat.nameRo.trim().toLowerCase() !== (cat.name || '').toLowerCase())
            ? `<span class="font-medium text-gray-800">${ro}</span> <span class="text-gray-400">(${en})</span>`
            : `<span>${en}</span>`;
        return `<div class="px-2 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 cat-result-item"
              data-platform="${platform}" data-id="${id}" data-name="${en}" data-name-ro="${ro}">
            ${display}
         </div>`;
    }).join('');
    container.querySelectorAll('.cat-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const catPlatform = item.dataset.platform;
            const catId = item.dataset.id;
            const catName = item.dataset.name;
            const catNameRo = item.dataset.nameRo || '';
            // Format option text identic cu rezultatele: "Nume RO (Nume EN)" sau doar EN
            const optionLabel = formatCategoryLabel({ name: catName, nameRo: catNameRo });
            const selector = document.getElementById(`category-selector-${catPlatform}`);
            if (selector) {
                let existing = selector.querySelector(`option[value="${catId}"]`);
                if (!existing) {
                    existing = document.createElement('option');
                    existing.value = catId;
                    selector.appendChild(existing);
                }
                existing.textContent = optionLabel;
                existing.dataset.nameRo = catNameRo;
                selector.value = catId;
            }
            // Ascunde search box + debifează checkbox
            const checkbox = document.getElementById(`show-all-${catPlatform}`);
            if (checkbox) checkbox.checked = false;
            document.getElementById(`all-categories-${catPlatform}`)?.classList.add('hidden');
            handleCategoryChange(catPlatform, catId);
        });
    });
}

export async function handleAiFillAttributes(button) {
    const orig = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

    const asin = document.getElementById('product-asin')?.value || '';
    const title = state.editedProductData?.title || '';
    const description = state.editedProductData?.description || '';
    const images = (state.editedProductData?.images || []).slice(0, 3);

    const platforms = MARKETPLACES.map(m => m.id).filter(p => mappingState.categories[p]);
    if (!platforms.length) {
        alert('Selectează mai întâi o categorie pe cel puțin o platformă.');
        button.disabled = false;
        button.innerHTML = orig;
        return;
    }

    let anySuccess = false;
    const workflowErrors = [];
    try {
        for (const platform of platforms) {
            const categoryId = mappingState.categories[platform];
            try {
                const res = await fetch(AI_FILL_ATTRIBUTES_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ asin, platform, categoryId, title, description, images })
                });
                if (!res.ok) {
                    workflowErrors.push(`${platform}: HTTP ${res.status}`);
                    continue;
                }
                const data = await res.json();
                // Workflow-ul poate returna un _error chiar cu HTTP 200 (ex: Gemini key lipsă)
                if (data?._error) {
                    workflowErrors.push(`${platform}: ${data._error}`);
                }
                const filled = data?.attributes?.[platform] || {};
                let filledCount = 0;
                Object.entries(filled).forEach(([attrId, value]) => {
                    const safeId = String(attrId).replace(/[^a-zA-Z0-9_-]/g, '_');
                    const input = document.querySelector(
                        `.attr-value-input[data-platform="${platform}"][data-attr-id="${safeId}"]`
                    );
                    if (input) {
                        input.value = value;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        filledCount++;
                    }
                });
                if (filledCount > 0) anySuccess = true;
            } catch (innerErr) {
                console.error(`Eroare AI fill pentru ${platform}:`, innerErr);
                workflowErrors.push(`${platform}: ${innerErr.message || innerErr}`);
            }
        }
        if (!anySuccess) {
            const detail = workflowErrors.length
                ? '\n\nDetalii:\n' + workflowErrors.join('\n')
                : '';
            alert('Nu s-a completat nicio caracteristică. Verifică webhook-ul n8n (v2-ai-fill-attributes) și GEMINI_API_KEY.' + detail);
        }
    } catch (err) {
        console.error('Eroare la completare AI:', err);
        alert('Eroare la completarea AI. Verifică consola.');
    } finally {
        button.disabled = false;
        button.innerHTML = orig;
    }
}
