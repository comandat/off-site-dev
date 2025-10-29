// scripts/viewRenderer.js
import { AppState, fetchDataAndSyncState, fetchProductDetailsInBulk } from './data.js';
import { state } from './state.js';
import { fuzzySearch } from './utils.js';
import { templates, renderImageGallery, initializeSortable } from './templates.js';
import { fetchAndRenderCompetition } from './product-details.js';

const mainContent = document.getElementById('main-content');
const sidebarButtons = document.querySelectorAll('.sidebar-btn');

export function setActiveView(viewId) {
    let parentView = viewId;
    if (['paleti', 'produse', 'produs-detaliu'].includes(viewId)) {
        parentView = 'comenzi';
    }
    sidebarButtons.forEach(btn => btn.classList.toggle('active-tab', btn.dataset.view === parentView));
}

export async function renderView(viewId, context = {}) {
    state.currentView = viewId;
    let html = '';
    let product = null; // Renamed from 'product' to avoid conflict later
    mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se încarcă...</div>`;
    setActiveView(viewId);

    try {
        switch(viewId) {
            // ... (case 'comenzi', 'import', 'financiar', 'exportDate', 'paleti', 'produse' remain unchanged) ...
            case 'produse':
                const command = AppState.getCommands().find(c => c.id === context.commandId);
                if (command && context.manifestSKU) {
                     mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se încarcă detaliile produselor...</div>`;

                    const asins = command.products.map(p => p.asin);
                    const details = await fetchProductDetailsInBulk(asins);

                    let commandToRender = command;
                    const query = state.currentSearchQuery.toLowerCase().trim();
                    if (query) {
                        const filteredProducts = command.products.filter(p =>
                            fuzzySearch(query, details[p.asin]?.title || '') ||
                            fuzzySearch(query, p.asin)
                        );
                        commandToRender = { ...command, products: filteredProducts };
                    }
                    html = templates.produse(commandToRender, details, context.manifestSKU);
                } else {
                     html = '<div class="p-6 text-red-500">Eroare: Datele pentru afișarea produselor sunt incomplete.</div>';
                }
                break;
            case 'produs-detaliu':
                 mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se încarcă detaliile produsului...</div>`;
                state.competitionDataCache = null;
                const cmd = AppState.getCommands().find(c => c.id === context.commandId);
                let foundProduct = null; // Use a different variable name
                if (cmd) {
                   // --- MODIFICARE: Căutăm după uniqueId ---
                   foundProduct = cmd.products.find(p => p.uniqueId === context.productId);
                   // --- SFÂRȘIT MODIFICARE ---
                }
                if (foundProduct) { [cite: 13]
                    console.log(`%cFolosind uniqueId-ul ${context.productId}, am găsit următorul obiect 'product' în AppState:`, "color: green; font-weight: bold;", JSON.parse(JSON.stringify(foundProduct))); [cite: 13]
                    console.log(`%cSe va deschide pagina de detalii pentru ASIN: ${foundProduct.asin}`, "color: green; font-weight: bold;"); [cite: 13]
                } else {
                    console.error(`EROARE: Nu am găsit niciun produs cu uniqueId-ul ${context.productId} în comandă.`);
                }

                if (foundProduct) {
                    const detailsMap = await fetchProductDetailsInBulk([foundProduct.asin]);
                // --- SFÂRȘIT MODIFICARE ---
                    const productDetails = detailsMap[foundProduct.asin];

                    if (!productDetails.images || !Array.isArray(productDetails.images)) {
                        productDetails.images = [];
                    }

                    productDetails.images = productDetails.images.filter(img => img);

                    state.editedProductData = JSON.parse(JSON.stringify(productDetails));
                    state.activeVersionKey = 'origin';

                    // --- MODIFICARE: Trimitem foundProduct la template ---
                    html = templates.produsDetaliu(foundProduct, state.editedProductData, context.commandId);
                    // --- SFÂRȘIT MODIFICARE ---
                } else {
                     html = '<div class="p-6 text-red-500">Eroare: Produsul nu a fost găsit. Verificați consola.</div>';
                }
                break;
            default:
                 html = `<div class="p-6 text-orange-500">View necunoscut: ${viewId}</div>`;
        }
    } catch (error) {
         console.error(`Eroare în renderView pentru ${viewId}:`, error);
         html = `<div class="p-6 text-red-500">A apărut o eroare la randarea paginii. Verificați consola.</div>`;
    }

    if (typeof html !== 'string') {
        console.error(`renderView: Variabila 'html' nu este un string valid (este ${typeof html}). Folosind fallback.`);
        html = '<div class="p-6 text-red-500">Eroare internă la generarea conținutului.</div>';
    }

    mainContent.innerHTML = html;

    // --- LOGICĂ POST-RANDARE ---

    if (viewId === 'produse' && state.productScrollPosition > 0) {
        mainContent.scrollTop = state.productScrollPosition;
    } else if (viewId !== 'paleti') {
         mainContent.scrollTop = 0;
    }

    if (viewId !== 'produse' && viewId !== 'produs-detaliu') {
        state.productScrollPosition = 0;
    }

    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
        searchInput.value = state.currentSearchQuery;
         searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }

    // --- MODIFICARE: Folosim foundProduct ---
    if (viewId === 'produs-detaliu' && foundProduct) {
    // --- SFÂRȘIT MODIFICARE ---
        const galleryContainer = document.getElementById('image-gallery-container');
        if (galleryContainer) {
            galleryContainer.innerHTML = renderImageGallery(state.editedProductData.images);
             initializeSortable();
        }
        // --- MODIFICARE: Folosim foundProduct.asin ---
        fetchAndRenderCompetition(foundProduct.asin);
        // --- SFÂRȘIT MODIFICARE ---
    }
}
