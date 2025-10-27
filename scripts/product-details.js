// scripts/product-details.js
import { state } from './state.js';
import { languageNameToCodeMap, COMPETITION_WEBHOOK_URL, TITLE_GENERATION_WEBHOOK_URL, TRANSLATION_WEBHOOK_URL } from './constants.js';
import { renderImageGallery, initializeSortable, templates } from './templates.js';
import { saveProductDetails } from './data.js';

// --- IMAGE HELPERS ---

export function getCurrentImagesArray() {
    const key = state.activeVersionKey;
    if (key === 'origin') {
        if (!state.editedProductData.images) {
            state.editedProductData.images = [];
        }
        return state.editedProductData.images;
    }

    if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
    if (!state.editedProductData.other_versions[key]) state.editedProductData.other_versions[key] = {};
    if (state.editedProductData.other_versions[key].images === undefined) {
        return null;
    }
    return state.editedProductData.other_versions[key].images;
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

// --- TAB DATA MANAGEMENT ---

export function saveCurrentTabData() {
    const titleEl = document.getElementById('product-title');
    if (!titleEl) return;

    const title = titleEl.value;

    let description = '';
    if (state.descriptionEditorMode === 'raw') {
        const rawEl = document.getElementById('product-description-raw');
        if(rawEl) description = rawEl.value;
    } else {
        const previewEl = document.getElementById('product-description-preview');
        if(previewEl) description = previewEl.innerHTML;
    }

    const key = state.activeVersionKey;

    // 1. Salvează titlul și descrierea
    if (key === 'origin') {
        state.editedProductData.title = title;
        state.editedProductData.description = description;
    } else {
        if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
        if (!state.editedProductData.other_versions[key]) state.editedProductData.other_versions[key] = {};

        state.editedProductData.other_versions[key].title = title;
        state.editedProductData.other_versions[key].description = description;
    }

    // 2. Salvează imaginile
    const thumbsContainer = document.getElementById('thumbnails-container');
    if (thumbsContainer) {
        let currentImages = [];
        thumbsContainer.querySelectorAll('[data-image-src]').forEach(el => {
            currentImages.push(el.dataset.imageSrc);
        });
        setCurrentImagesArray(currentImages);
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

    document.getElementById('product-title').value = dataToLoad.title || '';

    const description = dataToLoad.description || '';
    const rawEl = document.getElementById('product-description-raw');
    const previewEl = document.getElementById('product-description-preview');
    if (rawEl) rawEl.value = description;
    if (previewEl) previewEl.innerHTML = description;

    if (rawEl && previewEl) {
         rawEl.classList.remove('hidden');
         previewEl.classList.add('hidden');
         document.querySelector('.desc-mode-btn[data-mode="raw"]').classList.add('bg-blue-600', 'text-white');
         document.querySelector('.desc-mode-btn[data-mode="raw"]').classList.remove('hover:bg-gray-100');
         document.querySelector('.desc-mode-btn[data-mode="preview"]').classList.remove('bg-blue-600', 'text-white');
         document.querySelector('.desc-mode-btn[data-mode="preview"]').classList.add('hover:bg-gray-100');
         state.descriptionEditorMode = 'raw';
    }

    const galleryContainer = document.getElementById('image-gallery-container');
    if (galleryContainer) {
        galleryContainer.innerHTML = renderImageGallery(imagesToLoad);
        if (imagesToLoad !== undefined && imagesToLoad !== null) {
            initializeSortable();
        }
    }

    document.querySelectorAll('.version-btn').forEach(btn => btn.classList.toggle('bg-blue-600', btn.dataset.versionKey === versionKey));
    document.querySelectorAll('.version-btn').forEach(btn => btn.classList.toggle('text-white', btn.dataset.versionKey === versionKey));

    const refreshBtn = document.getElementById('refresh-title-btn');
    if (refreshBtn) {
        const isRomanianTab = languageNameToCodeMap[versionKey.toLowerCase()] === 'RO';
        refreshBtn.classList.toggle('hidden', !isRomanianTab);
    }
}

// --- API CALLS & HANDLERS ---

export async function fetchAndRenderCompetition(asin) {
    const container = document.getElementById('competition-container');
    if (!container) return;
    state.competitionDataCache = null;

    try {
        const response = await fetch(COMPETITION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asin: asin })
        });

        if (!response.ok) throw new Error('Eroare la preluarea datelor de competiție');

        const data = await response.json();
        state.competitionDataCache = data;
        container.innerHTML = templates.competition(data);
    } catch (error) {
        console.error('Eroare competiție:', error);
        container.innerHTML = `<div class="p-8 text-center text-red-500">Nu s-au putut încărca produsele concurente.</div>`;
    }
}

export async function handleProductSave(actionButton) {
    actionButton.textContent = 'Se salvează...';
    actionButton.disabled = true;
    saveCurrentTabData();
    state.editedProductData.brand = document.getElementById('product-brand').value;
    const priceValue = document.getElementById('product-price').value;
    state.editedProductData.price = priceValue.trim() === '' ? null : priceValue;
    
    const payload = JSON.parse(JSON.stringify(state.editedProductData));
    
    if (payload.other_versions) {
        const newOtherVersions = {};
        for (const [langName, langData] of Object.entries(payload.other_versions)) {
            const langCode = (languageNameToCodeMap[langName.toLowerCase()] || langName).toLowerCase();
            newOtherVersions[langCode] = langData;
        }
        payload.other_versions = newOtherVersions;
    }
    
    const asin = document.getElementById('product-asin').value;
    const success = await saveProductDetails(asin, payload);
    
    if (success) {
        alert('Salvat cu succes!');
        return true;
    } else {
        alert('Eroare la salvare!');
        actionButton.textContent = 'Salvează Modificările';
        actionButton.disabled = false;
        return false;
    }
}

export async function handleTitleRefresh(actionButton) {
    const refreshBtn = actionButton;
    const refreshIcon = refreshBtn.querySelector('.refresh-icon');
    const refreshSpinner = refreshBtn.querySelector('.refresh-spinner');
    const originTitle = state.editedProductData.title;
    const originDescription = state.editedProductData.description;
    const competitionCache = state.competitionDataCache;
    const currentAsin = document.getElementById('product-asin')?.value;
    
    if (!originTitle || !originDescription || !competitionCache || !currentAsin) {
        alert('Eroare: Datele necesare (inclusiv ASIN) nu sunt disponibile.');
        return;
    }
    
    refreshIcon.classList.add('hidden');
    refreshSpinner.classList.remove('hidden');
    refreshBtn.disabled = true;
    
    const payload = { asin: currentAsin, title: originTitle, description: originDescription };
    for (let i = 1; i <= 5; i++) { 
        payload[`competition_${i}_title`] = competitionCache[`productname_${i}`] || null; 
    }
    
    try {
        const response = await fetch(TITLE_GENERATION_WEBHOOK_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        if (!response.ok) { throw new Error(`Eroare HTTP: ${response.status}`); }
        
        const result = await response.json();
        
        if (result.output) {
            const newTitle = result.output;
            document.getElementById('product-title').value = newTitle;
            const roKey = 'romanian';
            if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
            if (!state.editedProductData.other_versions[roKey]) state.editedProductData.other_versions[roKey] = {};
            state.editedProductData.other_versions[roKey].title = newTitle;
        } else { 
            throw new Error('Răspuns invalid de la server.'); 
        }
    } catch (error) {
        console.error('Eroare la generarea titlului:', error);
        alert(`A apărut o eroare la generarea titlului: ${error.message}`);
    } finally {
        refreshIcon.classList.remove('hidden');
        refreshSpinner.classList.add('hidden');
        refreshBtn.disabled = false;
    }
}

export async function handleTranslationInit(languageOption) {
    const langCode = languageOption.dataset.langCode;
    const asin = document.getElementById('product-asin').value;
    
    try {
        const response = await fetch(TRANSLATION_WEBHOOK_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ asin: asin, language: langCode }) 
        });
        if (response.ok) { 
            alert(`Traducere pentru ${langCode.toUpperCase()} a fost inițiată.`); 
        } else { 
            alert('Eroare la inițierea traducerii.'); 
        }
    } catch (error) { 
        console.error('Eroare Webhook:', error); 
        alert('Eroare de rețea la inițierea traducerii.'); 
    }
}

// --- EVENT HANDLERS (PENTRU A FI APELATE DIN eventHandlers.js) ---

export function handleImageActions(action, actionButton) {
    let currentImages = getCurrentImagesArray();
    if (action === 'delete-image') {
        const imageSrc = actionButton.dataset.imageSrc;
        if (!imageSrc) return;
        if (!currentImages) currentImages = [];
        currentImages = currentImages.filter(img => img !== imageSrc);
    }
    else if (action === 'add-image-url') {
        if (!currentImages) currentImages = [];
        if (currentImages.length >= 5) {
            alert("Puteți adăuga maxim 5 imagini.");
            return;
        }
        const newImageUrl = prompt("Vă rugăm introduceți URL-ul noii imagini:");
        if (newImageUrl) {
            currentImages.push(newImageUrl);
        }
    }
    else if (action === 'copy-origin-images') {
        currentImages = [...(state.editedProductData.images || [])];
    }
    else if (action === 'translate-ai-images') {
        alert('Funcționalitatea de traducere AI a imaginilor va fi implementată curând.');
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
