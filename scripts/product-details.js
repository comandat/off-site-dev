import { state } from './state.js';
import {
    languageNameToCodeMap,
    COMPETITION_WEBHOOK_URL,
    TITLE_GENERATION_WEBHOOK_URL,
    TRANSLATION_WEBHOOK_URL,
    IMAGE_TRANSLATION_WEBHOOK_URL,
    DESCRIPTION_GENERATION_WEBHOOK_URL,
    CATEGORY_ATTRIBUTES_WEBHOOK_URL,
    AI_FILL_ATTRIBUTES_WEBHOOK_URL
} from './constants.js';
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
        const response = await fetch(TRANSLATION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asin, language: langCode })
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
    currentCategoryId: null
};

export function populateCategorySelector() {
    const selector = document.getElementById('category-selector');
    if (!selector) return;
    const categories = [...(state.competitionDataCache?.suggested_categories || [])];
    categories.sort((a, b) => (b.count || 0) - (a.count || 0));
    if (categories.length === 0) {
        selector.innerHTML = '<option value="">Nu există categorii disponibile</option>';
        return;
    }
    selector.innerHTML = categories.map((cat, i) =>
        `<option value="${cat.id}"${i === 0 ? ' selected' : ''}>${cat.name} (${cat.count || 0})</option>`
    ).join('');
    handleCategoryChange(String(categories[0].id));
}

export async function handleCategoryChange(categoryId) {
    if (!categoryId) return;
    mappingState.currentCategoryId = categoryId;
    clearAllConnections();
    const platforms = ['emag', 'trendyol', 'temu'];
    platforms.forEach(p => {
        const el = document.getElementById(`${p}-attributes`);
        if (el) el.innerHTML = '<p class="text-xs text-gray-400 italic">Se încarcă...</p>';
    });
    await Promise.all(platforms.map(p => fetchAndRenderAttributes(p, categoryId)));
    restoreConnections();
    initDragConnect();
}

async function fetchAndRenderAttributes(platform, categoryId) {
    const container = document.getElementById(`${platform}-attributes`);
    if (!container) return;
    try {
        const response = await fetch(CATEGORY_ATTRIBUTES_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, categoryId })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const attrs = Array.isArray(data.attributes) ? data.attributes : [];
        container.innerHTML = attrs.length
            ? attrs.map(attr => renderAttributeRow(attr, platform)).join('')
            : '<p class="text-xs text-gray-400 italic">Nu există caracteristici pentru această categorie</p>';
    } catch {
        container.innerHTML = '<p class="text-xs text-red-400 italic">Caracteristicile vor fi disponibile după configurarea webhook-ului</p>';
    }
}

function renderAttributeRow(attr, platform) {
    const attrId = String(attr.id ?? attr.name ?? '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `<div class="attr-row flex items-center gap-1" data-attr-id="${attrId}" data-platform="${platform}">
        <div class="connector-dot bg-gray-300" data-side="left" data-platform="${platform}" data-attr-id="${attrId}"></div>
        <div class="flex-1 flex items-center gap-1.5 bg-gray-50 rounded px-2 py-1 min-w-0">
            <span class="text-xs text-gray-600 font-medium flex-shrink-0 truncate" style="width:45%" title="${attr.name}">${attr.name}</span>
            <input type="text" class="attr-value-input flex-1 text-xs bg-transparent border-0 border-b border-gray-300 focus:border-blue-400 focus:outline-none px-0 min-w-0"
                   data-attr-id="${attrId}" data-platform="${platform}" placeholder="Valoare..." value="${attr.value || ''}">
        </div>
        <div class="connector-dot bg-gray-300" data-side="right" data-platform="${platform}" data-attr-id="${attrId}"></div>
    </div>`;
}

function getDotPos(dot) {
    const area = document.getElementById('attributes-mapping-area');
    const areaRect = area.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    return {
        x: dotRect.left + dotRect.width / 2 - areaRect.left,
        y: dotRect.top + dotRect.height / 2 - areaRect.top
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

function initDragConnect() {
    const area = document.getElementById('attributes-mapping-area');
    if (!area) return;
    if (area._dragHandler) area.removeEventListener('mousedown', area._dragHandler);

    const handler = e => {
        const dot = e.target.closest('.connector-dot');
        if (!dot) return;
        e.preventDefault();

        const pos = getDotPos(dot);
        const svg = document.getElementById('connections-svg');
        const tempPath = makeSvgPath(bezierPath(pos.x, pos.y, pos.x, pos.y), '#3b82f6', true);
        svg.appendChild(tempPath);
        dot.style.backgroundColor = '#3b82f6';

        const onMove = ev => {
            const areaRect = document.getElementById('attributes-mapping-area').getBoundingClientRect();
            const ex = ev.clientX - areaRect.left;
            const ey = ev.clientY - areaRect.top;
            tempPath.setAttribute('d', bezierPath(pos.x, pos.y, ex, ey));
        };

        const onUp = ev => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            dot.style.backgroundColor = '';

            const targetDot = ev.target.closest('.connector-dot');
            if (targetDot && targetDot !== dot && targetDot.dataset.platform !== dot.dataset.platform) {
                const endPos = getDotPos(targetDot);
                tempPath.setAttribute('d', bezierPath(pos.x, pos.y, endPos.x, endPos.y));
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
                mappingState.connections.push(conn);
                dot.style.backgroundColor = '#16a34a';
                targetDot.style.backgroundColor = '#16a34a';
                tempPath.addEventListener('click', () => removeConnection(conn));
                saveConnections();
            } else {
                tempPath.remove();
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    area.addEventListener('mousedown', handler);
    area._dragHandler = handler;
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

function saveConnections() {
    const asin = document.getElementById('product-asin')?.value;
    if (!asin || !mappingState.currentCategoryId) return;
    const key = `attr_conn_${asin}_${mappingState.currentCategoryId}`;
    localStorage.setItem(key, JSON.stringify(mappingState.connections.map(c => ({
        fromPlatform: c.fromPlatform, fromAttrId: c.fromAttrId, fromSide: c.fromSide,
        toPlatform: c.toPlatform, toAttrId: c.toAttrId, toSide: c.toSide
    }))));
}

function restoreConnections() {
    const asin = document.getElementById('product-asin')?.value;
    if (!asin || !mappingState.currentCategoryId) return;
    const key = `attr_conn_${asin}_${mappingState.currentCategoryId}`;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const svg = document.getElementById('connections-svg');
    if (!svg) return;
    saved.forEach(c => {
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

export async function handleAiFillAttributes(button) {
    const orig = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;
    const asin = document.getElementById('product-asin')?.value;
    const categoryId = mappingState.currentCategoryId;
    const title = state.editedProductData?.title || '';
    const description = state.editedProductData?.description || '';
    const images = state.editedProductData?.images || [];
    try {
        const response = await fetch(AI_FILL_ATTRIBUTES_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asin, categoryId, title, description, images })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const filled = data.attributes || {};
        Object.entries(filled).forEach(([platform, attrs]) => {
            Object.entries(attrs).forEach(([attrId, value]) => {
                const input = document.querySelector(`.attr-value-input[data-platform="${platform}"][data-attr-id="${attrId}"]`);
                if (input) input.value = value;
            });
        });
    } catch {
        alert('Funcția de completare AI va fi disponibilă după configurarea webhook-ului n8n.');
    } finally {
        button.disabled = false;
        button.innerHTML = orig;
    }
}
