// scripts/main.js
import { AppState, fetchDataAndSyncState, fetchProductDetailsInBulk, saveProductDetails } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const sidebarButtons = document.querySelectorAll('.sidebar-btn');
    const N8N_UPLOAD_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/d92efbca-eaf1-430e-8748-cc6466c82c6e';
    const COMPETITION_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/db241e9f-fe67-40bf-89ae-d06f13b90d09';
    // --- NOU: URL pentru generare titlu ---
    const TITLE_GENERATION_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/0bc8e16e-2ba8-4c3d-ba66-9eb8898ac0ef';
    // --- NOU: URL pentru update ASIN ---
    const ASIN_UPDATE_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/5f107bd7-cc2b-40b7-8bbf-5e3a48667405';
    // --- NOU: URL pentru Gata de Listat ---
    const READY_TO_LIST_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/124682e2-5f91-4c0a-adf6-4cedf16c2c19';


    const state = {
        currentCommandId: null,
        currentManifestSKU: null,
        currentProductId: null,
        editedProductData: {},
        activeVersionKey: 'origin',
        descriptionEditorMode: 'raw',
        sortableInstance: null,
        competitionDataCache: null,
        productScrollPosition: 0,
        currentSearchQuery: '',
        currentView: 'comenzi',
        searchTimeout: null
    };

    const languages = {
        'bg': 'Bulgarian', 'de': 'German', 'ro': 'Romanian', 'hu': 'Hungarian',
        'el': 'Greek', 'sq': 'Albanian', 'be': 'Belarusian', 'bs': 'Bosnian',
        'ca': 'Catalan', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish',
        'nl': 'Dutch', 'en': 'English', 'et': 'Estonian', 'fi': 'Finnish',
        'fr': 'French', 'ga': 'Irish', 'it': 'Italian', 'lv': 'Latvian',
        'lt': 'Lithuanian', 'lb': 'Luxembourgish', 'mk': 'Macedonian', 'mt': 'Maltese',
        'mo': 'Moldovan', 'no': 'Norwegian', 'pl': 'Polish', 'pt': 'Portuguese',
        'ru': 'Russian', 'sr': 'Serbian', 'sk': 'Slovak', 'sl': 'Slovenian',
        'es': 'Spanish', 'sv': 'Swedish', 'tr': 'Turkish', 'uk': 'Ukrainian', 'cy': 'Welsh'
    };

    const languageNameToCodeMap = {};
    for (const [code, name] of Object.entries(languages)) {
        languageNameToCodeMap[name.toLowerCase()] = code.toUpperCase();
    }

    // --- Funcțiile getLevenshteinDistance, fuzzySearch, etc. rămân neschimbate ---
    function getLevenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; }
        for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; }

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }
        return matrix[b.length][a.length];
    }

    function fuzzySearch(query, target) {
        if (!query) return true;
        if (!target) return false;

        const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 0);
        const targetText = target.toLowerCase();
        const targetWords = targetText.split(' ').filter(w => w.length > 0);

        targetWords.push(targetText);

        return queryWords.every(queryWord => {
            return targetWords.some(targetWord => {
                const distance = getLevenshteinDistance(queryWord, targetWord);

                let tolerance = 0;
                if (queryWord.length <= 2) tolerance = 0;
                else if (queryWord.length <= 4) tolerance = 1;
                else tolerance = 2;

                if (targetWord.includes(queryWord)) {
                    return true;
                }
                return distance <= tolerance;
            });
        });
    }

    function initializeSortable() {
        const thumbsContainer = document.getElementById('thumbnails-container');
        if (state.sortableInstance) {
            state.sortableInstance.destroy();
        }
        if (thumbsContainer) {
            state.sortableInstance = new Sortable(thumbsContainer, {
                animation: 150,
                ghostClass: 'bg-blue-100',
                forceFallback: true,
                onEnd: () => {
                    saveCurrentTabData();
                }
            });
        }
    }

    function renderCompetitionStars(ratingString) {
        const rating = parseFloat(ratingString) || 0;
        let starsHTML = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                starsHTML += '<span class="material-icons text-yellow-400" style="font-size: 16px;">star</span>';
            } else if (i - 0.5 <= rating) {
                starsHTML += '<span class="material-icons text-yellow-400" style="font-size: 16px;">star_half</span>';
            } else {
                starsHTML += '<span class="material-icons text-gray-300" style="font-size: 16px;">star_border</span>';
            }
        }
        return `<div class="flex items-center">${starsHTML}</div>`;
    }

    function renderImageGallery(images) {
        if (images === undefined || images === null) {
            let buttonsHTML = `
                <button data-action="add-image-url" class="mt-4 w-full flex items-center justify-center space-x-2 p-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                    <span class="material-icons text-base">add_link</span>
                    <span>Adaugă Imagine (URL)</span>
                </button>
            `;

            if (state.activeVersionKey !== 'origin') {
                buttonsHTML += `
                    <div class="mt-2 grid grid-cols-2 gap-2">
                        <button data-action="copy-origin-images" class="p-2 text-sm text-center text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">
                            Copiaza pozele din Origin
                        </button>
                        <button data-action="translate-ai-images" class="p-2 text-sm text-center text-white bg-gray-500 rounded-lg hover:bg-gray-600 transition-colors">
                            Adauga poze cu Traducere AI
                        </button>
                    </div>
                `;
            }

            return `
                <div class="flex flex-col items-center justify-center h-48 text-gray-500">
                    <span class="material-icons text-4xl">photo_library</span>
                    <p class="mt-2">Nu ai stabilit niste poze pentru aceasta tara.</p>
                </div>
                ${buttonsHTML}
            `;
        }

        const uniqueImages = [...new Set(images)];
        const mainImageSrc = uniqueImages[0] || '';
        let thumbnailsHTML = '';

        for (let i = 0; i < 5; i++) {
            const img = uniqueImages[i];
            if (img) {
                thumbnailsHTML += `
                    <div class="relative group aspect-square" data-image-src="${img}">
                        <img src="${img}"
                             class="w-full h-full object-cover rounded-md thumbnail-image ${mainImageSrc === img ? 'border-2 border-blue-600' : ''}">
                        <div data-action="select-thumbnail" data-src="${img}" class="absolute inset-0 cursor-pointer z-0"></div>
                        <button data-action="delete-image" data-image-src="${img}"
                                class="absolute top-0 right-0 -mt-1 -mr-1 p-0.5 bg-red-600 text-white rounded-full hidden group-hover:block hover:bg-red-700 transition-all opacity-90 hover:opacity-100 z-10">
                            <span class="material-icons" style="font-size: 16px;">close</span>
                        </button>
                    </div>
                `;
            } else {
                thumbnailsHTML += `
                    <div class="aspect-square border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center">
                        <span class="material-icons text-gray-300">add</span>
                    </div>
                `;
            }
        }

        let addButtonHTML = '';
        if (uniqueImages.length < 5) {
            addButtonHTML = `
                <button data-action="add-image-url" class="mt-4 w-full flex items-center justify-center space-x-2 p-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                    <span class="material-icons text-base">add_link</span>
                    <span>Adaugă Imagine (URL)</span>
                </button>
            `;
        }

        return `
            <img id="main-image" data-action="open-lightbox" alt="Imaginea principală" class="w-[85%] mx-auto h-auto object-cover rounded-lg aspect-[4/3] cursor-pointer" src="${mainImageSrc}">
            <div id="thumbnails-container" class="grid grid-cols-5 gap-2 mt-4">${thumbnailsHTML}</div>
            ${addButtonHTML}
        `;
    }

    function getCurrentImagesArray() {
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

    function setCurrentImagesArray(imagesArray) {
        const key = state.activeVersionKey;
        if (key === 'origin') {
            state.editedProductData.images = imagesArray;
            return;
        }

        if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
        if (!state.editedProductData.other_versions[key]) state.editedProductData.other_versions[key] = {};

        state.editedProductData.other_versions[key].images = imagesArray;
    }


    function setActiveView(viewId) {
        let parentView = viewId;
        if (['paleti', 'produse', 'produs-detaliu'].includes(viewId)) {
            parentView = 'comenzi';
        }
        sidebarButtons.forEach(btn => btn.classList.toggle('active-tab', btn.dataset.view === parentView));
    }


    const templates = {
        // ... template comenzi (actualizat anterior) ...
        comenzi: () => {
            const commands = AppState.getCommands();
            const commandsHTML = commands.length > 0
                ? commands.map(cmd => {
                    const allProductsReady = cmd.products.length > 0 && cmd.products.every(p => p.listingReady);
                    const actionText = allProductsReady ? "Anulează Marcaj Toate" : "Marchează Toate Gata";
                    const iconClass = allProductsReady ? "text-yellow-600" : "text-green-600";
                    const iconName = allProductsReady ? "cancel" : "task_alt";

                    return `
                        <div class="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow relative">
                            <div class="cursor-pointer" data-command-id="${cmd.id}">
                                <h3 class="font-bold text-gray-800 pr-10">${cmd.name}</h3>
                                <p class="text-sm text-gray-500">${cmd.products.length} produse</p>
                            </div>

                            <div class="absolute top-2 right-2 dropdown command-options-dropdown">
                                <button class="p-2 rounded-full hover:bg-gray-200 dropdown-toggle">
                                    <span class="material-icons text-gray-600">more_vert</span>
                                </button>
                                <div class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl hidden dropdown-menu z-20 border border-gray-200">
                                    <a href="#"
                                       data-action="ready-to-list-command"
                                       data-command-id="${cmd.id}"
                                       data-current-status="${allProductsReady}" class="flex items-center space-x-2 block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <span class="material-icons text-base ${iconClass}">${iconName}</span>
                                        <span>${actionText}</span>
                                    </a>
                                    </div>
                            </div>
                        </div>`;
                 }).join('')
                : `<p class="col-span-full text-gray-500">Nu există comenzi de afișat.</p>`;
            return `<div class="p-6 sm:p-8"><h2 class="text-3xl font-bold text-gray-800 mb-6">Panou de Comenzi</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${commandsHTML}</div></div>`;
        },
        // ... template import (neschimbat) ...
        import: () => `<div class="p-6 sm:p-8"><h2 class="text-3xl font-bold text-gray-800 mb-6">Import Comandă Nouă</h2><div class="max-w-md bg-white p-8 rounded-lg shadow-md"><form id="upload-form"><div class="mb-5"><label for="zip-file" class="block mb-2 text-sm font-medium">Manifest (.zip):</label><input type="file" id="zip-file" name="zipFile" accept=".zip" required class="w-full text-sm border-gray-300 rounded-lg cursor-pointer bg-gray-50"></div><div class="mb-6"><label for="pdf-file" class="block mb-2 text-sm font-medium">Factura (.pdf):</label><input type="file" id="pdf-file" name="pdfFile" accept=".pdf" required class="w-full text-sm border-gray-300 rounded-lg cursor-pointer bg-gray-50"></div><p id="upload-status" class="mt-4 text-center text-sm font-medium min-h-[20px]"></p><button id="upload-button" type="submit" class="w-full mt-2 flex justify-center items-center px-4 py-3 text-lg font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"><span class="button-text">Trimite fișierele 🚀</span><div class="button-loader hidden w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div></button></form></div></div>`,
        // ... template paleti (actualizat anterior) ...
        paleti: (command, details) => {
            const paleti = {};
            command.products.forEach(p => {
                const sku = p.manifestsku || 'No ManifestSKU';
                if (!paleti[sku]) paleti[sku] = { products: [], allReady: true };
                paleti[sku].products.push(p);
                if (!p.listingReady) {
                    paleti[sku].allReady = false;
                }
            });

            const sortedPaletiEntries = Object.entries(paleti).sort(([, palletA], [, palletB]) => {
                return (palletA.allReady === palletB.allReady) ? 0 : palletA.allReady ? 1 : -1;
            });

            const paletiHTML = sortedPaletiEntries.map(([sku, palletData]) => {
                const { products, allReady } = palletData;
                const firstProduct = products[0];
                const firstProductDetails = firstProduct ? details[firstProduct.asin] : null;
                const firstImage = firstProductDetails?.images?.[0] || '';
                const readyClass = allReady ? 'bg-green-50' : 'bg-white';
                const readyIcon = allReady ? '<span class="material-icons text-green-500 absolute top-2 right-2" title="Palet Gata">task_alt</span>' : '';

                return `
                <div class="relative ${readyClass} p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow w-40 flex flex-col items-center" data-manifest-sku="${sku}">
                    ${readyIcon}
                    <img src="${firstImage}" alt="Imagine palet" class="w-32 h-32 object-contain rounded-md bg-gray-200 mb-4">
                    <h3 class="font-bold text-gray-800 text-center">${sku}</h3>
                    <p class="text-sm text-gray-500">${products.length} produse</p>
                </div>`;
            }).join('');

            const noResultsHTML = paletiHTML.length === 0 ? `<p class="col-span-full text-gray-500">Nu s-au găsit produse care să corespundă căutării.</p>` : paletiHTML;

            return `
            <header class="sticky top-0 z-10 bg-white shadow-sm p-4 flex items-center space-x-4">
                <button data-action="back-to-comenzi" class="p-2 rounded-full hover:bg-gray-100"><span class="material-icons">arrow_back</span></button>
                <h1 class="text-xl font-bold text-gray-800 whitespace-nowrap">${command.name}</h1>
                <div class="flex-1 relative">
                    <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input id="product-search-input" type="text" placeholder="Caută după titlu sau ASIN..." class="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition">
                </div>
            </header>
            <div class="p-6 sm:p-8"><div class="flex flex-wrap gap-4">${noResultsHTML}</div></div>`;
        },
        // ... template produse (actualizat anterior) ...
        produse: (command, details, manifestSKU) => {
             let productsToShow = command.products.filter(p => {
                 const sku = p.manifestsku || 'No ManifestSKU';
                 return sku === manifestSKU;
             });

             productsToShow.sort((a, b) => {
                 console.log(`Comparing ${a.asin} (${a.listingReady}) with ${b.asin} (${b.listingReady})`); // Log comparison
                 return (a.listingReady === b.listingReady) ? 0 : a.listingReady ? 1 : -1;
             });
             console.log("Sorted products:", productsToShow); // Log sorted list

             const productsHTML = productsToShow.map(p => {
                const d = details[p.asin];
                const readyClass = p.listingReady ? 'bg-green-50' : 'bg-white';
                const readyIcon = p.listingReady ? '<span class="material-icons text-green-500" title="Gata de listat">task_alt</span>' : '';

                return `<div class="flex items-center gap-4 ${readyClass} p-3 rounded-md shadow-sm cursor-pointer hover:bg-gray-50" data-product-id="${p.id}">
                            <img src="${d?.images?.[0] || ''}" class="w-16 h-16 object-cover rounded-md bg-gray-200">
                            <div class="flex-1">
                                <p class="font-semibold line-clamp-2">${d?.title || 'N/A'}</p>
                                <p class="text-sm text-gray-500">${p.asin}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-lg">${p.found}/${p.expected}</p>
                            </div>
                            ${readyIcon}
                            <span class="material-icons text-gray-400">chevron_right</span>
                        </div>`;
            }).join('');

            const noResultsHTML = productsToShow.length === 0 ? `<p class="col-span-full text-gray-500">Nu s-au găsit produse care să corespundă căutării.</p>` : productsHTML;

            return `
            <header class="sticky top-0 z-10 bg-white shadow-sm p-4 flex items-center space-x-4">
                <button data-action="back-to-paleti" class="p-2 rounded-full hover:bg-gray-100"><span class="material-icons">arrow_back</span></button>
                <h1 class="text-xl font-bold text-gray-800 whitespace-nowrap">Produse din ${manifestSKU}</h1>
                <div class="flex-1 relative">
                    <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input id="product-search-input" type="text" placeholder="Caută după titlu sau ASIN..." class="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition">
                </div>
            </header>
            <div class="p-4 space-y-2">${noResultsHTML}</div>`;
        },
        // ... template competition (neschimbat) ...
        competition: (competitionData) => {
            let cardsHTML = '';
            for (let i = 1; i <= 5; i++) {
                const name = competitionData[`productname_${i}`];
                if (!name) break;

                const image = competitionData[`productimage_${i}`] || '';
                const url = competitionData[`producturl_${i}`] || '#';
                const rating = competitionData[`rating_${i}`];
                const reviews = competitionData[`reviewscount_${i}`] || '';
                const oldPrice = competitionData[`oldprice_${i}`];
                const currentPrice = competitionData[`currentprice_${i}`] || '';
                const promoLabel = competitionData[`promotionlabel_${i}`];
                const dealLabel = competitionData[`dealtype_${i}`];

                let labelHTML = '';
                const labelText = promoLabel || dealLabel;
                if (labelText) {
                    labelHTML = `<span class="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">${labelText}</span>`;
                }

                let priceHTML = '';
                if (oldPrice) {
                    priceHTML += `<p class="text-sm text-gray-500 line-through">${oldPrice}</p>`;
                }
                priceHTML += `<p class="text-xl font-bold text-red-600">${currentPrice}</p>`;

                cardsHTML += `
                    <div class="w-full max-w-xs bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
                        <div class="relative w-full h-48">
                            <img src="${image}" alt="${name}" class="w-full h-full object-contain p-2">
                            ${labelHTML}
                        </div>
                        <div class="p-4 flex-1 flex flex-col justify-between">
                            <div>
                                <div class="flex items-center space-x-1 mb-1">
                                    ${renderCompetitionStars(rating)}
                                    <span class="text-sm text-gray-500">${reviews}</span>
                                </div>
                                <h3 data-competition-title="${i}" class="font-semibold text-gray-800 text-sm h-20 overflow-hidden line-clamp-3">${name}</h3>
                            </div>
                            <div>
                                <div class="mt-2 mb-3">
                                    ${priceHTML}
                                </div>
                                <a href="${url}" target="_blank" rel="noopener noreferrer"
                                   class="block w-full text-center px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                                   Vezi Produsul
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }

            return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">${cardsHTML}</div>`;
        },
        // ... template produsDetaliu (actualizat anterior) ...
        produsDetaliu: (product, details, commandId) => {

            const languageButtons = Object.entries(languages).map(([code, name]) =>
                `<a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 language-option" data-lang-code="${code}">${code.toUpperCase()}</a>`
            ).join('');

            const otherVersions = details.other_versions || {};

            const versionsButtons = Object.keys(otherVersions).map(key => {
                const displayText = languageNameToCodeMap[key.toLowerCase()] || key.toUpperCase();
                return `<button data-version-key="${key}" class="px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-md version-btn">${displayText}</button>`;
            }).join('');

            state.descriptionEditorMode = 'raw';

            // --- MODIFICARE: Determină starea butonului "Marchează Gata" ---
            console.log("Rendering product details, product.listingReady:", product.listingReady); // Log status before rendering button
            const isProductReady = product.listingReady === true; // Comparatie stricta cu boolean
            const readyButtonText = isProductReady ? "Anulează Marcaj Gata" : "Marchează Gata";
            const readyButtonIcon = isProductReady ? "cancel" : "task_alt";
            const readyButtonBgColor = isProductReady ? "bg-yellow-500 hover:bg-yellow-600" : "bg-green-600 hover:bg-green-700";

            return `
            <header class="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-white sticky top-0 z-10">
                <div class="flex items-center space-x-4"><button data-action="back-to-produse" class="text-gray-600"><span class="material-icons">arrow_back</span></button><h2 class="text-lg font-semibold">Detalii Produs</h2></div>
                <div class="flex items-center space-x-4">
                    <div class="relative group dropdown">
                        <button class="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors dropdown-toggle">
                            <span class="material-icons text-base">translate</span>
                            <span class="text-sm">Traduceți</span>
                            <span class="material-icons text-base">expand_more</span>
                        </button>
                        <div class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl hidden dropdown-menu z-20 border border-gray-200">
                            <input type="text" id="language-search" placeholder="Caută o limbă..." class="w-full px-4 py-2 border-b border-gray-200 focus:outline-none">
                            <div id="language-list" class="max-h-60 overflow-y-auto">
                                ${languageButtons}
                            </div>
                        </div>
                    </div>

                    <button data-action="ready-to-list-single"
                            data-asin="${product.asin}"
                            data-order-id="${commandId}"
                            data-pallet-sku="${product.manifestsku}"
                            data-current-status="${isProductReady}" class="px-4 py-2 ${readyButtonBgColor} text-white rounded-lg font-semibold text-sm flex items-center space-x-2 transition-colors">
                        <span class="material-icons text-base">${readyButtonIcon}</span>
                        <span>${readyButtonText}</span>
                    </button>

                    <button data-action="save-product" class="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Salvează Modificările</button>
                </div>
            </header>
            <div class="p-6 lg:p-8 flex-1">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div class="lg:col-span-1 space-y-6">
                        <div id="image-gallery-container" class="bg-white p-4 rounded-xl shadow-sm"></div>
                        <div class="bg-white p-4 rounded-xl shadow-sm space-y-4">
                            <div><label class="text-sm font-medium text-gray-500">Brand</label><input id="product-brand" class="mt-1 block w-full bg-transparent p-0 border-0 border-b-2" type="text" value="${details.brand || ''}"></div>
                            <div><label class="text-sm font-medium text-gray-500">Preț estimat</label><input id="product-price" class="mt-1 block w-full bg-transparent p-0 border-0 border-b-2" type="text" value="${details.price || ''}"></div>

                            <div>
                                <div class="flex justify-between items-center">
                                    <label for="product-asin" class="text-sm font-medium text-gray-500">ASIN</label>
                                    <button data-action="edit-asin" data-productsku="${product.id}" data-old-asin="${product.asin}"
                                            class="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors">
                                        Editează ASIN
                                    </button>
                                </div>
                                <input id="product-asin" class="mt-1 block w-full bg-gray-100 p-2 border-0 rounded-md text-gray-700" type="text" value="${product.asin}" readonly>
                            </div>

                        </div>
                    </div>

                    <div class="lg:col-span-2 bg-white rounded-xl shadow-sm">
                         <div class="flex items-center justify-between p-4 border-b border-gray-200"><div id="version-selector" class="flex space-x-1 border rounded-lg p-1"><button data-version-key="origin" class="px-4 py-1.5 text-sm font-semibold rounded-md bg-blue-600 text-white version-btn">Origin</button>${versionsButtons}</div></div>
                         <div class="p-6 space-y-6">
                            <div class="flex items-center space-x-2">
                                <div class="flex-1">
                                    <label for="product-title" class="text-sm font-medium text-gray-500">Titlu</label>
                                    <input id="product-title" class="mt-1 block w-full text-xl font-semibold bg-transparent p-0 border-0 border-b-2" type="text" value="${details.title || ''}">
                                </div>
                                <button id="refresh-title-btn" data-action="refresh-ro-title" class="hidden mt-6 p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span class="material-icons refresh-icon">refresh</span>
                                    <div class="refresh-spinner hidden w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                </button>
                            </div>
                            <div>
                                <div class="flex justify-between items-center mb-1">
                                    <label for="product-description-raw" class="text-sm font-medium text-gray-500">Descriere</label>
                                    <div class="flex items-center space-x-1 rounded-lg p-1 border">
                                        <button data-action="toggle-description-mode" data-mode="raw" class="desc-mode-btn bg-blue-600 text-white rounded-md p-1.5">
                                            <span class="material-icons text-base">code</span>
                                        </button>
                                        <button data-action="toggle-description-mode" data-mode="preview" class="desc-mode-btn hover:bg-gray-100 rounded-md p-1.5">
                                            <span class="material-icons text-base">visibility</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="product-description-raw" rows="12" class="mt-1 block w-full bg-gray-50 border rounded-lg p-3 font-mono">${details.description || ''}</textarea>
                                <div id="product-description-preview" contenteditable="true" class="prose prose-sm max-w-none hidden mt-1 block w-full h-[278px] overflow-y-auto bg-gray-50 border rounded-lg p-3"></div>
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-3 mt-8">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">Competiție</h2>
                        <div id="competition-container">
                            <div class="p-8 text-center text-gray-500">Se încarcă...</div>
                        </div>
                    </div>
                </div>
            </div>`;
        }
    };


    // --- Funcțiile saveCurrentTabData, loadTabData, sendReadyToList, fetchAndRenderCompetition rămân neschimbate ---
      function saveCurrentTabData() {
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

        // 2. Salvează imaginile DOAR dacă containerul de thumbnails există
        const thumbsContainer = document.getElementById('thumbnails-container');
        if (thumbsContainer) {
            let currentImages = [];
            thumbsContainer.querySelectorAll('[data-image-src]').forEach(el => {
                currentImages.push(el.dataset.imageSrc);
            });
            setCurrentImagesArray(currentImages);
        }
    }

    function loadTabData(versionKey) {
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

     /**
     * --- MODIFICAT: Funcția helper acceptă acum un obiect 'payload' ---
     * @param {object} payload - Obiectul de trimis ca JSON (ex: {asin, orderId, pallet, setReadyStatus} sau {orderId, setReadyStatus})
     * @param {HTMLElement} buttonElement - Butonul sau elementul (ex. span din link) care a inițiat acțiunea
     */
    async function sendReadyToList(payload, buttonElement) {
        if (!payload) {
            alert('Nu există date de trimis.');
            return false;
        }

        let originalHTML = '';
        let targetElement = buttonElement;

        if (buttonElement && buttonElement.tagName === 'A') {
            targetElement = buttonElement.querySelector('span:last-child');
        }

        if (targetElement) {
            originalHTML = targetElement.innerHTML;
            if (buttonElement) buttonElement.style.pointerEvents = 'none';
            targetElement.innerHTML = '<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto"></div>';
        }


        try {
            console.log("Sending payload to ready-to-list webhook:", payload); // Log payload
            const response = await fetch(READY_TO_LIST_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error("Webhook Error Response:", errorText);
                 throw new Error(`Eroare HTTP: ${response.status}. ${errorText}`);
            }

            const result = await response.json();
             console.log("Webhook success response:", result); // Log success response

            // --- NOU: Șterge query-ul de căutare înainte de refresh ---
            state.currentSearchQuery = '';
            const searchInput = document.getElementById('product-search-input');
            if (searchInput) searchInput.value = '';
            // --- SFÂRȘIT NOU ---

            await fetchDataAndSyncState(); // Re-fetch data

            const actionMessage = payload.setReadyStatus ? 'marcat' : 'demarcat';
            // alert(`Acțiune (${actionMessage}) realizată cu succes!`); // Poate fi deranjant, o scoatem deocamdată
            return true;

        } catch (error) {
            console.error('Eroare la trimiterea "Marchează/Anulează Marcaj Gata":', error);
            alert(`A apărut o eroare: ${error.message}`);
             if (targetElement) targetElement.innerHTML = originalHTML; // Restore only on error
            return false;
        } finally {
             if (buttonElement) buttonElement.style.pointerEvents = 'auto'; // Re-enable button/link
        }
    }

    async function fetchAndRenderCompetition(asin) {
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


    // --- Funcția renderView (actualizată anterior cu GIF loader) ---
     async function renderView(viewId, context = {}) {
        state.currentView = viewId;
        let html = '';
        let product = null;
        mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se încarcă...</div>`;
        setActiveView(viewId);

        try {
            switch(viewId) {
                case 'comenzi':
                    await fetchDataAndSyncState();
                    html = templates.comenzi();
                    break;
                case 'import':
                    html = templates.import();
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
                         // Afișăm loader-ul standard text înainte de fetch
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
                         console.log("Products to render in 'produse' view:", commandToRender.products.filter(p => (p.manifestsku || 'No ManifestSKU') === context.manifestSKU)); // Log products for this pallet
                        html = templates.produse(commandToRender, details, context.manifestSKU);
                    } else {
                         console.error('Eroare: commandId sau manifestSKU lipsă');
                         html = '<div class="p-6 text-red-500">Eroare: Datele pentru afișarea produselor sunt incomplete.</div>';
                    }
                    break;
                case 'produs-detaliu':
                    // Afișăm loader-ul standard text înainte de fetch
                     mainContent.innerHTML = `<div class="p-8 text-center text-gray-500">Se încarcă detaliile produsului...</div>`;
                    state.competitionDataCache = null;
                    const cmd = AppState.getCommands().find(c => c.id === context.commandId);
                    if (cmd) {
                       product = cmd.products.find(p => p.id === context.productId);
                    }

                    if (product) {
                         console.log("Found product in state for details view:", product); // Log product found
                        const detailsMap = await fetchProductDetailsInBulk([product.asin]);
                        const productDetails = detailsMap[product.asin];

                        if (!productDetails.images || !Array.isArray(productDetails.images)) {
                            productDetails.images = [];
                        }
                        productDetails.images = [...new Set(productDetails.images)];

                        state.editedProductData = JSON.parse(JSON.stringify(productDetails));
                        state.activeVersionKey = 'origin';

                        html = templates.produsDetaliu(product, state.editedProductData, context.commandId);
                    } else {
                         console.log("Product not found for details view", context); // Log if product not found
                         html = '<div class="p-6 text-red-500">Eroare: Produsul nu a fost găsit.</div>';
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

        if (viewId === 'produs-detaliu' && product) {
            const galleryContainer = document.getElementById('image-gallery-container');
            if (galleryContainer) {
                galleryContainer.innerHTML = renderImageGallery(state.editedProductData.images);
                 if (state.editedProductData.images && state.editedProductData.images.length > 0) {
                    initializeSortable();
                 }
            }
            fetchAndRenderCompetition(product.asin);
        }
    }


    // --- Event listener pentru 'mainContent' click (actualizat anterior) ---
     mainContent.addEventListener('click', async (event) => {
        const target = event.target;

        const commandCard = target.closest('[data-command-id]:not([data-action])');
        const palletCard = target.closest('[data-manifest-sku]');
        const productCard = target.closest('[data-product-id]');
        const actionButton = target.closest('[data-action]');
        const versionButton = target.closest('.version-btn');
        const languageOption = target.closest('.language-option');
        const dropdownToggle = target.closest('.dropdown-toggle');
        const descModeButton = target.closest('[data-action="toggle-description-mode"]');
        const thumbnail = target.closest('[data-action="select-thumbnail"]');

        if (commandCard) {
            state.currentSearchQuery = '';
            state.currentCommandId = commandCard.dataset.commandId;
            state.currentManifestSKU = null;
            state.currentProductId = null;
            await renderView('paleti', { commandId: state.currentCommandId });

        } else if (palletCard) {
            // state.currentSearchQuery = ''; // Nu resetăm căutarea când intrăm într-un palet
            state.currentManifestSKU = palletCard.dataset.manifestSku;
            state.currentProductId = null;
            await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });

        } else if (productCard) {
            state.productScrollPosition = mainContent.scrollTop;
            state.currentProductId = productCard.dataset.productId;
            await renderView('produs-detaliu', {
                commandId: state.currentCommandId,
                productId: state.currentProductId
            });

        } else if (versionButton) {
            loadTabData(versionButton.dataset.versionKey);

        } else if (descModeButton) {
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

        } else if (thumbnail) {
            const newImageSrc = thumbnail.dataset.src;
            if (!newImageSrc) return;

            const mainImage = document.getElementById('main-image');
            if (mainImage) mainImage.src = newImageSrc;

            document.querySelectorAll('.thumbnail-image').forEach(img => {
                const parent = img.closest('[data-image-src]');
                const isSelected = parent && parent.dataset.imageSrc === newImageSrc;
                img.classList.toggle('border-2', isSelected);
                img.classList.toggle('border-blue-600', isSelected);
            });

        } else if (actionButton) {
            const action = actionButton.dataset.action;

            if (action === 'back-to-comenzi') {
                state.currentCommandId = null;
                state.currentManifestSKU = null;
                state.currentProductId = null;
                state.currentSearchQuery = ''; // Resetăm căutarea la ieșire
                await renderView('comenzi');
             }
            if (action === 'back-to-paleti') {
                state.currentManifestSKU = null;
                state.currentProductId = null;
                 // state.currentSearchQuery = ''; // NU resetăm căutarea când ne întoarcem la paleți
                await renderView('paleti', { commandId: state.currentCommandId });
            }
            if (action === 'back-to-produse') {
                state.currentProductId = null;
                 // state.currentSearchQuery = ''; // NU resetăm căutarea când ne întoarcem la produse
                await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
            }

            if (action === 'edit-asin') {
                const productsku = actionButton.dataset.productsku;
                const oldAsin = actionButton.dataset.oldAsin;

                const newAsin = prompt("Introduceți noul ASIN:", oldAsin);

                if (!newAsin || newAsin.trim() === '' || newAsin.trim() === oldAsin) {
                    return;
                }

                const confirmation = confirm("Atenție!\n\nSchimbarea ASIN-ului va reîncărca datele acestui produs și poate modifica titlul, pozele sau descrierea. Datele nesalvate (titlu, descriere, etc.) se vor pierde.\n\nSigur doriți să continuați?");

                if (!confirmation) {
                    return;
                }

                const payload = {
                    productsku: productsku,
                    asin_vechi: oldAsin,
                    asin_nou: newAsin.trim(),
                    orderId: state.currentCommandId
                };

                try {
                    const response = await fetch(ASIN_UPDATE_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`Eroare HTTP: ${response.status}`);
                    }

                    const result = await response.json();
                    if (result.status === 'success') {
                        alert("ASIN-ul a fost actualizat cu succes! Se reîncarcă datele...");
                        await fetchDataAndSyncState(); // Asigură preluarea datelor noi
                        await renderView('produs-detaliu', { // Re-randează cu datele actualizate
                            commandId: state.currentCommandId,
                            productId: state.currentProductId // ID-ul produsului rămâne același
                        });
                    } else {
                        alert(`Eroare la actualizare: ${result.message || 'Răspuns invalid de la server.'}`);
                    }
                } catch (error) {
                    console.error('Eroare la actualizarea ASIN-ului:', error);
                    alert(`A apărut o eroare de rețea: ${error.message}`);
                }
            }

             if (action === 'ready-to-list-single') {
                const asin = actionButton.dataset.asin;
                const orderId = actionButton.dataset.orderId;
                const palletSku = actionButton.dataset.palletSku;
                const currentStatus = actionButton.dataset.currentStatus === 'true';
                const setReadyStatus = !currentStatus;
                const confirmAction = setReadyStatus ? "marcați" : "anulați marcajul pentru";

                if (confirm(`Sigur doriți să ${confirmAction} acest produs (${asin}) ca "Gata pentru Listat"?`)) {
                    const payload = {
                        orderId: orderId,
                        pallet: palletSku || 'N/A',
                        asin: asin,
                        setReadyStatus: setReadyStatus
                    };
                    const success = await sendReadyToList(payload, actionButton);
                    if (success) {
                        // Re-randează view-ul curent DUPĂ ce datele au fost actualizate de sendReadyToList->fetchDataAndSyncState
                        await renderView('produs-detaliu', {
                            commandId: state.currentCommandId,
                            productId: state.currentProductId
                        });
                    }
                }
            }

             if (action === 'ready-to-list-command') {
                event.preventDefault();
                const commandId = actionButton.dataset.commandId;
                const currentStatus = actionButton.dataset.currentStatus === 'true';
                const setReadyStatus = !currentStatus;
                const confirmAction = setReadyStatus ? "marcați TOATĂ" : "anulați marcajul pentru TOATĂ";

                const command = AppState.getCommands().find(c => c.id === commandId);
                const commandName = command ? command.name : `Comanda ${commandId.substring(0, 6)}`;

                if (confirm(`Sigur doriți să ${confirmAction} comanda ${commandName} ca "Gata pentru Listat"?`)) {
                    const payload = {
                        orderId: commandId,
                        setReadyStatus: setReadyStatus
                    };
                    const success = await sendReadyToList(payload, actionButton); // Trimitem linkul <a> ca element
                    if (success) {
                        await renderView('comenzi'); // Re-randează view-ul DUPĂ update
                    }
                }
                const menu = actionButton.closest('.dropdown-menu');
                if(menu) menu.classList.add('hidden');
            }


            if (action === 'delete-image') {
                const imageSrc = actionButton.dataset.imageSrc;
                if (!imageSrc) return;
                let currentImages = getCurrentImagesArray();
                if (!currentImages) currentImages = [];
                currentImages = currentImages.filter(img => img !== imageSrc);
                setCurrentImagesArray(currentImages);
                const galleryContainer = document.getElementById('image-gallery-container');
                if (galleryContainer) {
                    galleryContainer.innerHTML = renderImageGallery(currentImages);
                    initializeSortable();
                }
            }
            if (action === 'add-image-url') {
                let currentImages = getCurrentImagesArray();
                if (!currentImages) currentImages = [];
                if (currentImages.length >= 5) {
                    alert("Puteți adăuga maxim 5 imagini.");
                    return;
                }
                const newImageUrl = prompt("Vă rugăm introduceți URL-ul noii imagini:");
                if (newImageUrl) {
                    currentImages.push(newImageUrl);
                    setCurrentImagesArray(currentImages);
                    const galleryContainer = document.getElementById('image-gallery-container');
                    if (galleryContainer) {
                        galleryContainer.innerHTML = renderImageGallery(currentImages);
                        initializeSortable();
                    }
                }
            }
            if (action === 'copy-origin-images') {
                const originImages = state.editedProductData.images || [];
                setCurrentImagesArray([...originImages]);
                const galleryContainer = document.getElementById('image-gallery-container');
                if (galleryContainer) {
                    galleryContainer.innerHTML = renderImageGallery(originImages);
                    initializeSortable();
                }
            }
            if (action === 'translate-ai-images') {
                alert('Funcționalitatea de traducere AI a imaginilor va fi implementată curând.');
            }

            if (action === 'refresh-ro-title') {
                const refreshBtn = actionButton;
                const refreshIcon = refreshBtn.querySelector('.refresh-icon');
                const refreshSpinner = refreshBtn.querySelector('.refresh-spinner');
                const originTitle = state.editedProductData.title;
                const originDescription = state.editedProductData.description;
                const competitionCache = state.competitionDataCache;
                const currentAsin = document.getElementById('product-asin')?.value;
                if (!originTitle || !originDescription || !competitionCache || !currentAsin || TITLE_GENERATION_WEBHOOK_URL === 'URL_AICI_PENTRU_GENERARE_TITLU') {
                    alert('Eroare: Datele necesare (inclusiv ASIN) nu sunt disponibile sau URL-ul webhook nu este configurat.');
                    return;
                }
                refreshIcon.classList.add('hidden');
                refreshSpinner.classList.remove('hidden');
                refreshBtn.disabled = true;
                const payload = { asin: currentAsin, title: originTitle, description: originDescription };
                for (let i = 1; i <= 5; i++) { payload[`competition_${i}_title`] = competitionCache[`productname_${i}`] || null; }
                try {
                    const response = await fetch(TITLE_GENERATION_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!response.ok) { throw new Error(`Eroare HTTP: ${response.status}`); }
                    const result = await response.json();
                    if (result.output) {
                        const newTitle = result.output;
                        document.getElementById('product-title').value = newTitle;
                        const roKey = 'romanian';
                        if (!state.editedProductData.other_versions) state.editedProductData.other_versions = {};
                        if (!state.editedProductData.other_versions[roKey]) state.editedProductData.other_versions[roKey] = {};
                        state.editedProductData.other_versions[roKey].title = newTitle;
                    } else { throw new Error('Răspuns invalid de la server.'); }
                } catch (error) {
                    console.error('Eroare la generarea titlului:', error);
                    alert(`A apărut o eroare la generarea titlului: ${error.message}`);
                } finally {
                    refreshIcon.classList.remove('hidden');
                    refreshSpinner.classList.add('hidden');
                    refreshBtn.disabled = false;
                }
            }

            if (action === 'save-product') {
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
                    await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
                } else {
                    alert('Eroare la salvare!');
                    actionButton.textContent = 'Salvează Modificările';
                    actionButton.disabled = false;
                }
            }

        } else if (languageOption) {
            event.preventDefault();
            const langCode = languageOption.dataset.langCode;
            const asin = document.getElementById('product-asin').value;
            const webhookUrl = 'https://automatizare.comandat.ro/webhook/43760233-f351-44ea-8966-6f470e063ae7';
            try {
                const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asin: asin, language: langCode }) });
                if (response.ok) { alert(`Traducere pentru ${langCode.toUpperCase()} a fost inițiată.`); } else { alert('Eroare la inițierea traducerii.'); }
            } catch (error) { console.error('Eroare Webhook:', error); alert('Eroare de rețea la inițierea traducerii.'); }
        }

        if (dropdownToggle) {
            const dropdownMenu = dropdownToggle.nextElementSibling;
            const allMenus = document.querySelectorAll('.dropdown-menu');
            allMenus.forEach(menu => { if (menu !== dropdownMenu) { menu.classList.add('hidden'); } });
            dropdownMenu.classList.toggle('hidden');
        } else if (!target.closest('.dropdown')) {
            if (!target.closest('.dropdown-menu a')) { // Nu închide dacă se dă click pe linkul din meniu
               document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
            }
        }
    });

    // --- Listener pentru input (neschimbat) ---
     mainContent.addEventListener('input', async (event) => {
        if (event.target.id === 'language-search') {
            const filter = event.target.value.toLowerCase();
            const links = document.querySelectorAll('#language-list .language-option');
            links.forEach(link => {
                const text = link.textContent.toLowerCase();
                link.style.display = text.includes(filter) ? '' : 'none';
            });
        }
        else if (event.target.id === 'product-search-input') {
            state.currentSearchQuery = event.target.value;
            state.productScrollPosition = 0;

            if (state.searchTimeout) {
                clearTimeout(state.searchTimeout);
            }

            state.searchTimeout = setTimeout(async () => {
                const currentView = state.currentView;

                if (currentView === 'paleti') {
                    await renderView('paleti', { commandId: state.currentCommandId });
                } else if (currentView === 'produse') {
                    await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
                }

                const searchInput = document.getElementById('product-search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
                }
            }, 300);
        }
    });

    // --- Listener pentru submit (neschimbat) ---
     mainContent.addEventListener('submit', async (event) => {
        if (event.target.id === 'upload-form') {
            event.preventDefault();
            const uploadBtn = document.getElementById('upload-button'), btnText = uploadBtn.querySelector('.button-text'), btnLoader = uploadBtn.querySelector('.button-loader'), statusEl = document.getElementById('upload-status'), formData = new FormData(event.target);
            if (!formData.get('zipFile')?.size || !formData.get('pdfFile')?.size) { statusEl.textContent = 'Selectează ambele fișiere.'; statusEl.className = 'text-red-600'; return; }
            uploadBtn.disabled = true; btnText.classList.add('hidden'); btnLoader.classList.remove('hidden'); statusEl.textContent = 'Se trimit fișierele...'; statusEl.className = '';
            try {
                const response = await fetch(N8N_UPLOAD_WEBHOOK_URL, { method: 'POST', body: formData });
                if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);
                const resData = await response.json();
                if (resData.status === 'success') { statusEl.textContent = 'Comanda a fost importată!'; statusEl.className = 'text-green-600'; event.target.reset(); await renderView('comenzi'); } else throw new Error('Eroare server.');
            } catch (error) { statusEl.textContent = 'A apărut o eroare.'; statusEl.className = 'text-red-600';
            } finally { uploadBtn.disabled = false; btnText.classList.remove('hidden'); btnLoader.classList.add('hidden'); }
        }
    });

    // --- Listener global pentru click (dropdown close & lightbox) (neschimbat) ---
    document.addEventListener('click', (event) => {
        const target = event.target;

        if (!target.closest('.dropdown') && !target.closest('.dropdown-menu a')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
        }

        const actionButton = target.closest('[data-action]');
        const lightboxThumbnail = target.closest('[data-action="select-lightbox-thumbnail"]');

        if (lightboxThumbnail) {
            const src = lightboxThumbnail.dataset.src;
            if (!src) return;
            document.getElementById('lightbox-main-image').src = src;
            document.getElementById('lightbox-copy-btn').dataset.src = src;
            document.getElementById('lightbox-copy-text').textContent = 'Copiază Link';
            document.querySelectorAll('.lightbox-thumbnail').forEach(thumb => {
                thumb.classList.toggle('border-blue-600', thumb.dataset.src === src);
                thumb.classList.toggle('border-gray-500', thumb.dataset.src !== src);
            });
            return;
        }

        if (actionButton) {
            const action = actionButton.dataset.action;
            if (action === 'open-lightbox') {
                const imgElement = actionButton.tagName === 'IMG' ? actionButton : actionButton.querySelector('img');
                const mainImageSrc = imgElement ? imgElement.src : null;
                if (!mainImageSrc) return;
                const lightbox = document.getElementById('image-lightbox');
                const mainImageEl = document.getElementById('lightbox-main-image');
                const thumbsContainer = document.getElementById('lightbox-thumbs-container');
                const copyBtn = document.getElementById('lightbox-copy-btn');
                const copyText = document.getElementById('lightbox-copy-text');
                copyText.textContent = 'Copiază Link';
                mainImageEl.src = mainImageSrc;
                copyBtn.dataset.src = mainImageSrc;
                const currentImages = [...new Set(getCurrentImagesArray() || [])];
                let thumbsHTML = '';
                currentImages.forEach(img => {
                    const isSelected = img === mainImageSrc;
                    thumbsHTML += `<img data-action="select-lightbox-thumbnail" data-src="${img}" src="${img}" class="w-full h-16 object-cover rounded-md cursor-pointer lightbox-thumbnail border-2 ${isSelected ? 'border-blue-600' : 'border-gray-500'}">`;
                });
                thumbsContainer.innerHTML = thumbsHTML;
                lightbox.classList.remove('hidden');
            }
            if (action === 'close-lightbox') { document.getElementById('image-lightbox').classList.add('hidden'); }
            if (action === 'copy-lightbox-link') {
                const src = actionButton.dataset.src;
                navigator.clipboard.writeText(src).then(() => { document.getElementById('lightbox-copy-text').textContent = 'Copiat!'; }, () => { alert('Eroare la copiere link.'); });
            }
        }
    }, true);

    renderView('comenzi');
});
