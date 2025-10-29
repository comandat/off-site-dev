import { state } from './state.js';
import { renderView } from './viewRenderer.js';
import { initGlobalListeners } from './lightbox.js';
import { sendReadyToList, handleUploadSubmit, handleAsinUpdate } from './api.js';
import { AppState, fetchDataAndSyncState } from './data.js'; 
import { templates } from './templates.js';
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
    handleDescriptionRefresh // <-- MODIFICARE AICI
} from './product-details.js';
import { 
    handleExportPreliminar, 
    handleExportStocReal, 
    convertToCSV, 
    downloadCSV 
} from './export.js';

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
        const palletCard = target.closest('[data-manifest-sku]');
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
                
                // state.currentView va fi setat de renderView
                
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
                
                // --- MODIFICARE AICI ---
                // Verificăm pagina ANTERIOARĂ, nu cea curentă
                const cameFromExport = state.previousView === 'exportDate';
                
                if (cameFromExport) {
                // --- SFÂRȘIT MODIFICARE ---
                    await renderView('exportDate');
                    
                    const select = document.getElementById('export-command-select');
                    if (select && state.currentCommandId) { 
                        select.value = state.currentCommandId;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        const prelimBtn = document.getElementById('export-preliminar-btn');
                        if(prelimBtn) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                            await handleExportPreliminar(state.currentCommandId, prelimBtn);
                        }
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
                        
                        if (!saveSuccess) {
                            alert('A apărut o eroare la salvarea modificărilor. Acțiunea "Gata de listat" a fost anulată.');
                        } else {
                             console.log("Salvare automată reușită. Se continuă cu marcarea...");
                        }
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
            
            // --- MODIFICARE AICI ---
            if (action === 'refresh-ro-description') {
                await handleDescriptionRefresh(actionButton);
            }
            // --- SFÂRȘIT MODIFICARE ---

            if (action === 'save-product') {
                const success = await handleProductSave(actionButton);
                if (success) {
                    // --- MODIFICARE AICI ---
                    // Verificăm pagina ANTERIOARĂ
                    const cameFromExport = state.previousView === 'exportDate';
                    if (cameFromExport) {
                    // --- SFÂRȘIT MODIFICARE ---
                        await renderView('exportDate');
                        
                        const select = document.getElementById('export-command-select');
                        if (select && state.currentCommandId) {
                            select.value = state.currentCommandId;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            
                            const prelimBtn = document.getElementById('export-preliminar-btn');
                            if(prelimBtn) {
                                await new Promise(resolve => setTimeout(resolve, 0));
                                await handleExportPreliminar(state.currentCommandId, prelimBtn);
                            }
                        }
                    } else {
                        await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
                    }
                }
            }
            
            if (action === 'translate-ai-images') {
                const currentTabKey = state.activeVersionKey; 
                
                const asin = document.getElementById('product-asin')?.value;
                if (!asin) {
                    alert('Eroare: Nu s-a putut găsi ASIN-ul produsului.');
                    return;
                }

                const success = await handleImageTranslation(actionButton);
                
                if (success) {
                    AppState.clearProductCache(asin); 
                    await fetchDataAndSyncState(); 
                    
                    await renderView('produs-detaliu', {
                        commandId: state.currentCommandId,
                        productId: state.currentProductId
                    });
                    
                    loadTabData(currentTabKey);
                }
                return;
            }
            
            if (['delete-image', 'add-image-url', 'copy-origin-images'].includes(action)) {
                handleImageActions(action, actionButton);
            }

            if (action === 'export-preliminar') {
                const commandId = document.getElementById('export-command-select')?.value;
                if (commandId) {
                    await handleExportPreliminar(commandId, actionButton);
                } else {
                    alert('Vă rugăm selectați o comandă.');
                }
            }
            if (action === 'export-stoc-real') {
                const commandId = document.getElementById('export-command-select')?.value;
                 if (commandId) {
                    handleExportStocReal(commandId, actionButton);
                } else {
                    alert('Vă rugăm selectați o comandă.');
                }
            }
            if (action === 'download-preliminar') {
                if (state.lastExportData && state.lastExportData.length > 0) {
                    const csvString = convertToCSV(state.lastExportData);
                    const commandId = document.getElementById('export-command-select')?.value || 'export';
                    downloadCSV(csvString, `export_preliminar_${commandId.substring(0, 8)}.csv`);
                } else {
                    alert("Eroare: Nu există date de descărcat. Generați mai întâi lista.");
                }
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
        
        else if (event.target.id === 'financiar-total-fara-tva') {
            const totalFaraTVA = parseFloat(event.target.value) || 0;
            const totalCuTVA = totalFaraTVA * 1.21;
            const tvaField = document.getElementById('financiar-total-cu-tva');
            if (tvaField) {
                tvaField.value = totalCuTVA.toFixed(2);
            }
        }
    });

    mainContent.addEventListener('change', async (event) => {
        if (event.target.id === 'financiar-command-select') {
            const commandId = event.target.value;
            const detailsContainer = document.getElementById('financiar-details-container');
            if (!detailsContainer) return;

            if (!commandId) {
                detailsContainer.innerHTML = templates.financiarDetails(null);
                return;
            }

            console.log(`TODO: Se încarcă datele financiare pentru Comanda ${commandId}`);
            
            const simulatedData = {
                id: commandId,
                orderdate: "2025-10-28", 
                totalordercostwithoutvat: 1234.50, 
                transportcost: 150, 
                discount: 25, 
                currency: "EUR", 
                exchangerate: 1.0 
            };
            
            detailsContainer.innerHTML = templates.financiarDetails(simulatedData);
        }

        if (event.target.id === 'export-command-select') {
            const commandId = event.target.value;
            // Păstrează ID-ul comenzii în state
            state.currentCommandId = commandId || null; 
            
            const actionsContainer = document.getElementById('export-actions-container');
            const placeholder = document.getElementById('export-placeholder');
            const previewContainer = document.getElementById('export-preview-container');

            if (previewContainer) previewContainer.innerHTML = '';
            state.lastExportData = null; 

            if (commandId) {
                if (actionsContainer) actionsContainer.classList.remove('hidden');
                if (placeholder) placeholder.classList.add('hidden');
            } else {
                if (actionsContainer) actionsContainer.classList.add('hidden');
                if (placeholder) placeholder.classList.remove('hidden');
            }
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
    
    // Logica de pornire (pentru refresh-uri de pagină)
    if (lastView === 'exportDate' && state.currentCommandId) {
        await renderView('exportDate');
        
        const select = document.getElementById('export-command-select');
        if (select) {
            select.value = state.currentCommandId;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            
            const prelimBtn = document.getElementById('export-preliminar-btn');
            if (prelimBtn) {
                await new Promise(resolve => setTimeout(resolve, 0));
                await handleExportPreliminar(state.currentCommandId, prelimBtn);
            }
        }
    } else {
        renderView(lastView);
    }
});
