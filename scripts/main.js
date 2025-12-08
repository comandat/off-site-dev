// scripts/main.js
import { state } from './state.js';
import { renderView } from './viewRenderer.js';
import { initGlobalListeners } from './lightbox.js';
import { sendReadyToList, handleUploadSubmit, handleAsinUpdate, saveFinancialDetails, generateNIR } from './api.js'; 
import { AppState, fetchDataAndSyncState, fetchProductDetailsInBulk } from './data.js';
import { templates } from './templates.js';
import { GET_PALLETS_WEBHOOK_URL } from './constants.js'; // Import constanta pentru paleți
import { 
    loadTabData, 
    handleProductSave, 
    handleTitleRefresh, 
    handleTranslationInit, 
    handleImageActions, 
    handleDescriptionToggle,
    saveCurrentTabData,
    saveProductCoreData,
    handleImageTranslation,
    handleDescriptionRefresh
} from './product-details.js';

// --- FUNCȚIE HELPER PENTRU PALEȚI ---
async function fetchPalletsData(commandId) {
    try {
        const response = await fetch(GET_PALLETS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandId: commandId })
        });
        
        if (!response.ok) {
            console.error(`Eroare la preluarea paleților: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        // Presupunem că webhook-ul returnează un array sau un obiect cu cheia 'pallets'
        return Array.isArray(data) ? data : (data.pallets || []);
    } catch (error) {
        console.error("Eroare network paleți:", error);
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const mainContent = document.getElementById('main-content');

    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        const sidebarBtn = target.closest('.sidebar-btn');

        if (sidebarBtn) {
            const view = sidebarBtn.dataset.view;
            if (view) {
                event.stopPropagation(); 
                await renderView(view);
                return;
            }
        }
    });

    mainContent.addEventListener('click', async (event) => {
        const target = event.target;
        
        const commandCard = target.closest('[data-command-id]:not([data-action])');
        const palletCard = target.closest('[data-manifest-sku]:not([data-action])');
        const productCard = target.closest('[data-product-id]:not([data-action="go-to-product"])');
        const actionButton = target.closest('[data-action]');
        const versionButton = target.closest('.version-btn');
        const languageOption = target.closest('.language-option');
        const descModeButton = target.closest('[data-action="toggle-description-mode"]');
        const thumbnail = target.closest('[data-action="select-thumbnail"]');

        if (commandCard) {
            state.currentSearchQuery = '';
            state.currentCommandId = commandCard.dataset.commandId;
            state.currentManifestSKU = null;
            state.currentProductId = null;
            await renderView('paleti', { commandId: state.currentCommandId });
            return;
        }
        if (palletCard) {
            state.currentManifestSKU = palletCard.dataset.manifestSku;
            state.currentProductId = null;
            await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
            return;
        }
        if (productCard) {
            state.productScrollPosition = mainContent.scrollTop;
            state.currentProductId = productCard.dataset.productId;
            await renderView('produs-detaliu', {
                commandId: state.currentCommandId,
                productId: state.currentProductId
            });
            return;
        }

        if (versionButton) {
            loadTabData(versionButton.dataset.versionKey);
            return;
        }
        if (descModeButton) {
            handleDescriptionToggle(descModeButton);
            return;
        }
        if (thumbnail) {
            const newImageSrc = thumbnail.dataset.src;
            if (!newImageSrc) return;
            const mainImg = document.getElementById('main-image');
            if (mainImg) mainImg.src = newImageSrc;
            
            document.querySelectorAll('.thumbnail-image').forEach(img => {
                const parent = img.closest('[data-image-src]');
                const isSelected = parent && parent.dataset.imageSrc === newImageSrc;
                img.classList.toggle('border-2', isSelected);
                img.classList.toggle('border-blue-600', isSelected);
            });
            return;
        }
        if (languageOption) {
            event.preventDefault();
            handleTranslationInit(languageOption);
            return;
        }

        if (actionButton) {
            const action = actionButton.dataset.action;

            if (action === 'go-to-product') {
                event.preventDefault(); 
                const commandId = actionButton.dataset.commandId;
                const productId = actionButton.dataset.productId; 

                if (!commandId || !productId) {
                    alert('Eroare: ID-ul comenzii sau al produsului lipsește.');
                    return;
                }
                
                state.previousView = state.currentView; 
                
                const command = AppState.getCommands().find(c => c.id === commandId);
                const product = command?.products.find(p => p.uniqueId === productId);

                if (product) {
                    state.currentCommandId = commandId;
                    state.currentManifestSKU = product.manifestsku || 'No ManifestSKU';
                    state.currentProductId = productId;
                    
                    await renderView('produs-detaliu', {
                        commandId: state.currentCommandId,
                        productId: state.currentProductId
                    });
                } else {
                    alert('Eroare: Nu s-a putut găsi produsul pentru navigare.');
                }
                return; 
            }
            
            if (action === 'save-financial') {
                const orderId = document.getElementById('financiar-order-id').value;
                const totalNoVat = document.getElementById('financiar-total-fara-tva').value;
                const totalWithVat = document.getElementById('financiar-total-cu-tva').value;
                const transport = document.getElementById('financiar-cost-transport').value;
                const discount = document.getElementById('financiar-reducere').value;
                const currency = document.getElementById('financiar-moneda').value;
                const rate = document.getElementById('financiar-rata-schimb').value;

                const payload = {
                    orderid: orderId,
                    totalordercostwithoutvat: totalNoVat,
                    totalordercostwithvat: totalWithVat,
                    transportcost: transport,
                    discount: discount,
                    currency: currency,
                    exchangerate: rate,
                };

                await saveFinancialDetails(payload, actionButton);
            }

            // --- ACȚIUNE NOUĂ: GENERARE NIR ---
            if (action === 'generate-nir') {
                if (!state.currentCommandId) {
                    alert('Selectați o comandă mai întâi.');
                    return;
                }
                await generateNIR(state.currentCommandId, actionButton);
            }
            // -----------------------------------

            if (action === 'back-to-comenzi') {
                state.currentCommandId = null;
                state.currentManifestSKU = null;
                state.currentProductId = null;
                state.currentSearchQuery = '';
                await renderView('comenzi');
            }
            if (action === 'back-to-paleti') {
                state.currentManifestSKU = null;
                state.currentProductId = null;
                await renderView('paleti', { commandId: state.currentCommandId });
            }
            if (action === 'back-to-produse') {
                state.currentProductId = null;
                
                if (state.previousView === 'financiar') {
                    await renderView('financiar');
                    const select = document.getElementById('financiar-command-select');
                    if (select && state.currentCommandId) {
                        select.value = state.currentCommandId;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
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
                    
                    let saveSuccess = true;
                    if (setReadyStatus === true) { 
                        console.log("Marcare Gata: Se salvează automat modificările...");
                        saveSuccess = await saveProductCoreData();
                        if (!saveSuccess) alert('A apărut o eroare la salvarea modificărilor. Acțiunea "Gata de listat" a fost anulată.');
                    }

                    if (saveSuccess) {
                        const payload = { orderId, pallet: palletSku || 'N/A', asin, setReadyStatus };
                        const success = await sendReadyToList(payload, actionButton);
                        if (success) {
                            state.currentSearchQuery = '';
                            await renderView('produs-detaliu', {
                                commandId: state.currentCommandId,
                                productId: state.currentProductId
                            });
                        }
                    }
                }
            }
            if (action === 'ready-to-list-command') {
                event.preventDefault();
                const commandId = actionButton.dataset.commandId;
                const currentStatus = actionButton.dataset.currentStatus === 'true';
                const setReadyStatus = !currentStatus;
                const confirmAction = setReadyStatus ? "marcați TOATĂ" : "anulați marcajul pentru TOATĂ";
                
                if (confirm(`Sigur doriți să ${confirmAction} comanda?`)) {
                    const payload = { orderId: commandId, setReadyStatus: setReadyStatus };
                    const success = await sendReadyToList(payload, actionButton);
                    if (success) {
                        state.currentSearchQuery = '';
                        await renderView('comenzi');
                    }
                }
                actionButton.closest('.dropdown-menu')?.classList.add('hidden');
            }

            if (action === 'edit-asin') {
                event.preventDefault(); 
                event.stopPropagation(); 
                
                const success = await handleAsinUpdate(actionButton);
                if (success) {
                    await renderView('produs-detaliu', {
                        commandId: state.currentCommandId,
                        productId: state.currentProductId
                    });
                }
            }

            if (action === 'refresh-ro-title') {
                await handleTitleRefresh(actionButton);
            }
            
            if (action === 'refresh-ro-description') {
                await handleDescriptionRefresh(actionButton);
            }

            if (action === 'save-product') {
                const success = await handleProductSave(actionButton);
                if (success) {
                    if (state.previousView === 'financiar') {
                        await renderView('financiar');
                        const select = document.getElementById('financiar-command-select');
                        if (select && state.currentCommandId) {
                            select.value = state.currentCommandId;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    } else {
                        await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
                    }
                }
            }
            
            if (action === 'translate-ai-images') {
                const currentTabKey = state.activeVersionKey; 
                const asin = document.getElementById('product-asin')?.value;
                if (!asin) { alert('Eroare: Nu s-a putut găsi ASIN-ul produsului.'); return; }

                const success = await handleImageTranslation(actionButton);
                
                if (success) {
                    AppState.clearProductCache(asin); 
                    await fetchDataAndSyncState(); 
                    await renderView('produs-detaliu', { commandId: state.currentCommandId, productId: state.currentProductId });
                    loadTabData(currentTabKey);
                }
                return;
            }
            
            if (['delete-image', 'add-image-url', 'copy-origin-images'].includes(action)) {
                handleImageActions(action, actionButton);
            }
        }
    });

    mainContent.addEventListener('input', async (event) => {
        
        if (event.target.id === 'language-search') {
            const filter = event.target.value.toLowerCase();
            document.querySelectorAll('#language-list .language-option').forEach(link => {
                link.style.display = link.textContent.toLowerCase().includes(filter) ? '' : 'none';
            });
        }
        else if (event.target.id === 'product-search-input') {
            state.currentSearchQuery = event.target.value;
            state.productScrollPosition = 0;

            if (state.searchTimeout) {
                clearTimeout(state.searchTimeout);
            }

            state.searchTimeout = setTimeout(async () => {
                if (state.currentView === 'paleti') {
                    await renderView('paleti', { commandId: state.currentCommandId });
                } else if (state.currentView === 'produse') {
                    await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
                }
                const searchInput = document.getElementById('product-search-input');
                if (searchInput) {
                    searchInput.focus();
                    const val = searchInput.value;
                    searchInput.value = '';
                    searchInput.value = val;
                }
            }, 300);
        }

        // --- CALCUL AUTOMAT TVA 21% ---
        else if (event.target.id === 'financiar-total-fara-tva') {
            const totalFaraTVA = parseFloat(event.target.value) || 0;
            const totalCuTVA = totalFaraTVA * 1.21; // 21%
            
            const tvaField = document.getElementById('financiar-total-cu-tva');
            if (tvaField) {
                tvaField.value = totalCuTVA.toFixed(2);
            }
        }
    });

    mainContent.addEventListener('change', async (event) => {
        if (event.target.id === 'financiar-command-select') {
            const selectedCommandId = event.target.value;
            state.currentCommandId = selectedCommandId; 

            const detailsContainer = document.getElementById('financiar-details-container');
            const saveBtn = document.getElementById('save-financial-btn');
            const nirBtn = document.getElementById('generate-nir-btn');
            
            if (!detailsContainer) return;

            // Resetăm butoanele
            if (saveBtn) saveBtn.disabled = !selectedCommandId;
            if (nirBtn) nirBtn.disabled = !selectedCommandId;

            if (!selectedCommandId) {
                detailsContainer.innerHTML = templates.financiarDetails(null, null, null, null);
                return;
            }

            detailsContainer.innerHTML = '<div class="text-center p-8 text-gray-500">Se încarcă datele, produsele și paleții...</div>';

            const commandData = AppState.getCommands().find(c => c.id === selectedCommandId);
            
            const financialDataList = AppState.getFinancialData();
            let matchedFinancial = financialDataList.find(item => item.orderid === selectedCommandId);

            if (!matchedFinancial) {
                console.warn(`Nu s-au găsit date financiare pentru comanda ${selectedCommandId}.`);
                matchedFinancial = { orderid: selectedCommandId };
            }

            // --- FETCH PALEȚI ---
            const palletsData = await fetchPalletsData(selectedCommandId);
            // -------------------

            const asins = commandData.products.map(p => p.asin);
            const detailsMap = await fetchProductDetailsInBulk(asins);

            detailsContainer.innerHTML = templates.financiarDetails(commandData, matchedFinancial, detailsMap, palletsData);
        }
    });

    mainContent.addEventListener('submit', async (event) => {
        if (event.target.id === 'upload-form') {
            const success = await handleUploadSubmit(event);
            if (success) {
                await renderView('comenzi');
            }
        }
    });

    document.addEventListener('images-sorted', () => {
        console.log("Images sorted, saving tab data...");
        saveCurrentTabData();
    });

    initGlobalListeners();

    const lastView = state.currentView || 'comenzi';
    
    if (lastView === 'financiar') {
        await renderView('financiar');
        if (state.currentCommandId) {
             const select = document.getElementById('financiar-command-select');
             if (select) {
                 select.value = state.currentCommandId;
                 select.dispatchEvent(new Event('change', { bubbles: true }));
             }
        }
    } else {
        renderView(lastView);
    }
});
