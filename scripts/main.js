// scripts/main.js
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
    handleImageTranslation
} from './product-details.js';

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');

    // --- INIȚIALIZARE EVENT LISTENERS ---

    // --- MODIFICARE: Listener nou pentru Sidebar ---
    // Folosim document.body pentru a prinde click-urile pe sidebar,
    // deoarece sidebar-ul este ÎN AFARA 'mainContent'.
    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        const sidebarBtn = target.closest('.sidebar-btn');

        // --- Navigare Sidebar ---
        if (sidebarBtn) {
            const view = sidebarBtn.dataset.view;
            if (view) {
                // Previne dubla-procesare de către alți listeneri
                event.stopPropagation(); 
                await renderView(view);
                return;
            }
        }
    });
    // --- SFÂRȘIT MODIFICARE ---


    // Listener pentru click-uri pe acțiuni principale (DOAR ÎN mainContent)
    mainContent.addEventListener('click', async (event) => {
        const target = event.target;
        
        // --- Selectori ---
        // --- MODIFICARE: Am scos 'sidebarBtn' de aici ---
        const commandCard = target.closest('[data-command-id]:not([data-action])');
        // --- SFÂRȘIT MODIFICARE ---
        const palletCard = target.closest('[data-manifest-sku]');
        const productCard = target.closest('[data-product-id]');
        const actionButton = target.closest('[data-action]');
        const versionButton = target.closest('.version-btn');
        const languageOption = target.closest('.language-option');
        const descModeButton = target.closest('[data-action="toggle-description-mode"]');
        const thumbnail = target.closest('[data-action="select-thumbnail"]');

        // --- MODIFICARE: Am scos logica 'sidebarBtn' de aici ---

        // --- Navigare Conținut ---
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

        // --- Tab-uri și UI Produs ---
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

        // --- Acțiuni (Butoane) ---
        if (actionButton) {
            const action = actionButton.dataset.action;

            // Navigare "Back"
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
                await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
            }

            // Acțiuni API "Ready to List"
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

            // Acțiuni Pagină Produs
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
            if (action === 'save-product') {
                const success = await handleProductSave(actionButton);
                if (success) {
                    await renderView('produse', { commandId: state.currentCommandId, manifestSKU: state.currentManifestSKU });
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
        }
    });

    // Listener pentru input (căutare, filtre, și calcul TVA)
    mainContent.addEventListener('input', async (event) => {
        
        // Căutare limbă (dropdown traduceri)
        if (event.target.id === 'language-search') {
            const filter = event.target.value.toLowerCase();
            document.querySelectorAll('#language-list .language-option').forEach(link => {
                link.style.display = link.textContent.toLowerCase().includes(filter) ? '' : 'none';
            });
        }
        // Căutare produs (paginile paleti/produse)
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
        
        // Calcul dinamic TVA pe pagina Financiar
        else if (event.target.id === 'financiar-total-fara-tva') {
            const totalFaraTVA = parseFloat(event.target.value) || 0;
            const totalCuTVA = totalFaraTVA * 1.21;
            const tvaField = document.getElementById('financiar-total-cu-tva');
            if (tvaField) {
                tvaField.value = totalCuTVA.toFixed(2);
            }
        }
    });

    // Listener nou pentru 'change' (selectorul de comandă)
    mainContent.addEventListener('change', async (event) => {
        if (event.target.id === 'financiar-command-select') {
            const commandId = event.target.value;
            const detailsContainer = document.getElementById('financiar-details-container');
            if (!detailsContainer) return;

            if (!commandId) {
                detailsContainer.innerHTML = templates.financiarDetails(null);
                return;
            }

            // TODO: Înlocuiește cu un fetch real pentru datele financiare
            // Deocamdată, folosim date simulate și ID-ul comenzii
            console.log(`TODO: Se încarcă datele financiare pentru Comanda ${commandId}`);
            
            // Simulare date - acestea vor veni de la un API
            const simulatedData = {
                id: commandId,
                orderdate: "2025-10-28", // Simulat
                totalordercostwithoutvat: 1234.50, // Simulat
                transportcost: 150, // Simulat
                discount: 25, // Simulat
                currency: "EUR", // Simulat
                exchangerate: 1.0 // Simulat
            };
            
            detailsContainer.innerHTML = templates.financiarDetails(simulatedData);
        }
    });

    // Listener pentru submit (doar formularul de import)
    mainContent.addEventListener('submit', async (event) => {
        if (event.target.id === 'upload-form') {
            const success = await handleUploadSubmit(event);
            if (success) {
                await renderView('comenzi');
            }
        }
    });

    // Listener pentru sortarea imaginilor (eveniment custom)
    document.addEventListener('images-sorted', () => {
        console.log("Images sorted, saving tab data...");
        saveCurrentTabData();
    });

    // Inițializează listener-ii globali (dropdowns, lightbox)
    initGlobalListeners();

    // --- PORNIRE APLICAȚIE ---
    // Verifică dacă există o vizualizare salvată (de ex. după un refresh)
    const lastView = state.currentView || 'comenzi';
    renderView(lastView);
});
