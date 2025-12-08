// scripts/viewRenderer.js
import { AppState, fetchDataAndSyncState, fetchProductDetailsInBulk, fetchFinancialData } from './data.js'; 
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
    
    if (viewId !== state.currentView) {
        state.previousView = state.currentView;
    }

    state.currentView = viewId;
    let html = '';
    let foundProduct = null; 
    mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se încarcă...</div>`;
    setActiveView(viewId);

    try {
        switch(viewId) {
            case 'comenzi':
                await fetchDataAndSyncState();
                html = templates.comenzi(AppState.getCommands());
                break;
            case 'import':
                html = templates.import();
                break;
            case 'financiar':
                // 1. Sincronizăm lista de comenzi
                await fetchDataAndSyncState();
                
                // 2. Verificăm dacă avem datele financiare în cache
                const storedFinancialData = AppState.getFinancialData();
                
                if (!storedFinancialData || storedFinancialData.length === 0) {
                    mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se preiau datele financiare...</div>`;
                    await fetchFinancialData();
                }

                // 3. Randăm shell-ul (dropdown + container gol pt detalii)
                html = templates.financiar(AppState.getCommands());
                break;

            case 'paleti':
                const commandForPaleti = AppState.getCommands().find(c => c.id === context.commandId);
                if (commandForPaleti) {
                    mainContent.innerHTML = `
                        <header class="sticky top-0 z-10 bg-white shadow-sm p-4 flex items-center space-x-4">
                            <button data-action="back-to-comenzi" class="p-2 rounded-full hover:bg-gray-100"><span class="material-icons">arrow_back</span></button>
                            <h1 class="text-xl font-bold text-gray-800 whitespace-nowrap">${commandForPaleti.name}</h1>
                            <div class="flex-1 relative">
                                <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                                <input id="product-search-input" type="text" placeholder="Caută după titlu sau ASIN..." class="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" value="${state.currentSearchQuery}">
                            </div>
                        </header>
                        <div class="flex justify-center items-center h-64">
                            <img src="loading-dog.gif" alt="Loading..." class="w-32 h-32"/>
                        </div>`;

                    const asinsForPaleti = commandForPaleti.products.map(p => p.asin);
                    const detailsForPaleti = await fetchProductDetailsInBulk(asinsForPaleti);

                    let commandToRender = commandForPaleti;
                    const query = state.currentSearchQuery.toLowerCase().trim();
                    if (query) {
                        const filteredProducts = commandForPaleti.products.filter(p =>
                            fuzzySearch(query, detailsForPaleti[p.asin]?.title || '') ||
                            fuzzySearch(query, p.asin)
                        );
                        commandToRender = { ...commandForPaleti, products: filteredProducts };
                    }
                    html = templates.paleti(commandToRender, detailsForPaleti);
                } else {
                     html = '<div class="p-6 text-red-500">Eroare: Comanda nu a fost găsită.</div>';
                }
                break;
            case 'produse':
                const command = AppState.getCommands().find(c => c.id === context.commandId);
                if (command && context.manifestSKU) {
                     mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se încarcă detaliile produselor...</div>`;

                    const relevantAsins = command.products
                        .filter(p => (p.manifestsku || 'No ManifestSKU') === context.manifestSKU)
                        .map(p => p.asin);
                    const uniqueAsins = [...new Set(relevantAsins)]; 
                    
                    const details = await fetchProductDetailsInBulk(uniqueAsins);

                    let commandToRender = command;
                    const query = state.currentSearchQuery.toLowerCase().trim();
                    if (query) {
                        const filteredProducts = command.products.filter(p => {
                            const skuMatches = (p.manifestsku || 'No ManifestSKU') === context.manifestSKU;
                            if (!skuMatches) return false;
                            return fuzzySearch(query, details[p.asin]?.title || '') || fuzzySearch(query, p.asin);
                         });
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
                foundProduct = null; 
                if (cmd) {
                   foundProduct = cmd.products.find(p => p.uniqueId === context.productId);
                }

                if (foundProduct) {
                    const detailsMap = await fetchProductDetailsInBulk([foundProduct.asin]);
                    const productDetails = detailsMap[foundProduct.asin];

                    if (!productDetails) {
                         html = `<div class="p-6 text-red-500">Eroare: Nu s-au putut încărca detaliile pentru ASIN ${foundProduct.asin}. Verificați consola.</div>`;
                         break; 
                    }

                    if (!productDetails.images || !Array.isArray(productDetails.images)) {
                        productDetails.images = [];
                    }

                    productDetails.images = productDetails.images.filter(img => img);

                    state.editedProductData = JSON.parse(JSON.stringify(productDetails));
                    state.activeVersionKey = 'origin';

                    html = templates.produsDetaliu(foundProduct, state.editedProductData, context.commandId);
                } else {
                     html = `<div class="p-6 text-red-500">Eroare: Produsul nu a fost găsit (ID: ${context.productId}). Verificați consola.</div>`;
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
        html = '<div class="p-6 text-red-500">Eroare internă la generarea conținutului.</div>';
    }

    mainContent.innerHTML = html;

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

    if (viewId === 'produs-detaliu' && foundProduct) {
        const galleryContainer = document.getElementById('image-gallery-container');
        if (galleryContainer) {
            galleryContainer.innerHTML = renderImageGallery(state.editedProductData.images);
             initializeSortable();
        }
        fetchAndRenderCompetition(foundProduct.asin);
    }
}
