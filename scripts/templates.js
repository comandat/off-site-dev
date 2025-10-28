// scripts/templates.js
import { state } from './state.js';
import { languages, languageNameToCodeMap } from './constants.js';

// --- HELPERS PENTRU TEMPLATES ---

export function initializeSortable() {
    const thumbsContainer = document.getElementById('thumbnails-container');
    
    // --- MODIFICARE ---
    // Întâi distruge instanța veche, dacă există.
    if (state.sortableInstance) {
        state.sortableInstance.destroy();
        state.sortableInstance = null; // Important: resetează starea
    }
    
    // Doar dacă noul container există, creează o instanță nouă.
    if (thumbsContainer) {
    // --- SFÂRȘIT MODIFICARE ---
        state.sortableInstance = new Sortable(thumbsContainer, {
            animation: 150,
            ghostClass: 'bg-blue-100',
            forceFallback: true,
            onEnd: () => {
                // Import saveCurrentTabData from product-details.js and call it
                // This creates a circular dependency, so we'll call it from the event handler instead.
                // For now, we rely on the main save function.
                // A better way would be to dispatch a custom event 'images-sorted'
                document.dispatchEvent(new CustomEvent('images-sorted'));
            }
        });
    }
}

export function renderCompetitionStars(ratingString) {
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

export function renderImageGallery(images) {
    
    // --- MODIFICARE ---
    // Verificăm dacă 'images' este null, undefined, SAU un array care conține doar valori "falsy" (ex: "")
    const isEffectivelyEmpty = (
        images === undefined || 
        images === null || 
        (Array.isArray(images) && images.every(img => !img))
    );
    
    if (isEffectivelyEmpty) {
    // --- SFÂRȘIT MODIFICARE ---
    
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

    // Filtrăm valorile goale (null, undefined, "") din array înainte de a-l folosi
    const filteredImages = images.filter(img => img);
    
    // Folosim array-ul filtrat pentru a afișa
    const uniqueImages = [...new Set(filteredImages)];
    const imagesToRender = uniqueImages;
    const mainImageSrc = imagesToRender[0] || '';
    
    let thumbnailsHTML = '';

    for (let i = 0; i < 5; i++) {
        // Folosim array-ul de-duplicat și filtrat
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
    // Verificăm lungimea array-ului filtrat și de-duplicat
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


// --- OBIECTUL PRINCIPAL DE TEMPLATES ---

export const templates = {
    comenzi: (commands) => {
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

    import: () => `<div class="p-6 sm:p-8"><h2 class="text-3xl font-bold text-gray-800 mb-6">Import Comandă Nouă</h2><div class="max-w-md bg-white p-8 rounded-lg shadow-md"><form id="upload-form"><div class="mb-5"><label for="zip-file" class="block mb-2 text-sm font-medium">Manifest (.zip):</label><input type="file" id="zip-file" name="zipFile" accept=".zip" required class="w-full text-sm border-gray-300 rounded-lg cursor-pointer bg-gray-50"></div><div class="mb-6"><label for="pdf-file" class="block mb-2 text-sm font-medium">Factura (.pdf):</label><input type="file" id="pdf-file" name="pdfFile" accept=".pdf" required class="w-full text-sm border-gray-300 rounded-lg cursor-pointer bg-gray-50"></div><p id="upload-status" class="mt-4 text-center text-sm font-medium min-h-[20px]"></p><button id="upload-button" type="submit" class="w-full mt-2 flex justify-center items-center px-4 py-3 text-lg font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"><span class="button-text">Trimite fișierele 🚀</span><div class="button-loader hidden w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div></button></form></div></div>`,

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
            const firstImage = (firstProductDetails?.images || []).filter(img => img)[0] || ''; // Ia prima imagine validă
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
                <input id="product-search-input" type="text" placeholder="Caută după titlu sau ASIN..." class="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" value="${state.currentSearchQuery}">
            </div>
        </header>
        <div class="p-6 sm:p-8"><div class="flex flex-wrap gap-4">${noResultsHTML}</div></div>`;
    },

    produse: (command, details, manifestSKU) => {
         let productsToShow = command.products.filter(p => {
             const sku = p.manifestsku || 'No ManifestSKU';
             return sku === manifestSKU;
         });

         productsToShow.sort((a, b) => (a.listingReady === b.listingReady) ? 0 : a.listingReady ? 1 : -1);

        const productsHTML = productsToShow.map(p => {
            const d = details[p.asin];
            const firstImage = (d?.images || []).filter(img => img)[0] || ''; // Ia prima imagine validă
            const readyClass = p.listingReady ? 'bg-green-50' : 'bg-white';
            const readyIcon = p.listingReady ? '<span class="material-icons text-green-500" title="Gata de listat">task_alt</span>' : '';

            return `<div class="flex items-center gap-4 ${readyClass} p-3 rounded-md shadow-sm cursor-pointer hover:bg-gray-50" data-product-id="${p.uniqueId}">
                        <img src="${firstImage}" class="w-16 h-16 object-cover rounded-md bg-gray-200">
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
                <input id="product-search-input" type="text" placeholder="Caută după titlu sau ASIN..." class="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" value="${state.currentSearchQuery}">
            </div>
        </header>
        <div class="p-4 space-y-2">${noResultsHTML}</div>`;
    },

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

        const isProductReady = product.listingReady === true;
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
