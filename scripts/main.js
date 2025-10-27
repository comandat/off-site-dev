// scripts/main.js
import { state } from './state.js';
import { renderView } from './viewRenderer.js';
import { initGlobalListeners } from './lightbox.js';
import { sendReadyToList, handleUploadSubmit, handleAsinUpdate } from './api.js';
// --- MODIFICARE: Am importat AppState și fetchDataAndSyncState ---
import { AppState, fetchDataAndSyncState } from './data.js'; 
// --- SFÂRȘIT MODIFICARE ---
import { 
    loadTabData, 
    handleProductSave, 
    handleTitleRefresh, 
    handleTranslationInit, 
    handleImageActions, 
    handleDescriptionToggle,
    saveCurrentTabData,
    handleImageTranslation
} from './product-details.js';

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');

    // --- INIȚIALIZARE EVENT LISTENERS ---

    // Listener pentru click-uri pe acțiuni principale
    mainContent.addEventListener('click', async (event) => {
        const target = event.target;
        
        // --- Selectori ---
        const commandCard = target.closest('[data-command-id]:not([data-action])');
        const palletCard = target.closest('[data-manifest-sku]');
        const productCard = target.closest('[data-product-id]');
        const actionButton = target.closest('[data-action]');
        const versionButton = target.closest('.version-btn');
        const languageOption = target.closest('.language-option');
        const descModeButton = target.closest('[data-action="toggle-description-mode"]');
        const thumbnail = target.closest('[data-action="select-thumbnail"]');

        // --- Navigare ---
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
            
            // --- MODIFICARE: Logica de reîncărcare cu invalidarea cache-ului ---
            if (action === 'translate-ai-images') {
                const currentTabKey = state.activeVersionKey; 
                
                // Luăm ASIN-ul de pe pagină
                const asin = document.getElementById('product-asin')?.value;
                if (!asin) {
                    alert('Eroare: Nu s-a putut găsi ASIN-ul produsului.');
                    return;
                }

                const success = await handleImageTranslation(actionButton);
                
                if (success) {
                    // 1. Invalidează cache-ul pentru acest produs
                    AppState.clearProductCache(asin); 
                    
                    // 2. Reîmprospătează datele comenzilor (opțional, dar sigur)
                    await fetchDataAndSyncState(); 
                    
                    // 3. Re-randează pagina de detalii. Acum va forța un fetch nou.
                    await renderView('produs-detaliu', {
                        commandId: state.currentCommandId,
                        productId: state.currentProductId
                    });
                    
                    // 4. Re-selectează tab-ul pe care era utilizatorul
                    loadTabData(currentTabKey);
                }
                return; // Oprește execuția aici
            }
            // --- SFÂRȘIT MODIFICARE ---
            
            if (['delete-image', 'add-image-url', 'copy-origin-images'].includes(action)) {
                handleImageActions(action, actionButton);
            }
        }
    });

    // Listener pentru input (căutare, filtre)
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
                    // Mută cursorul la final
                    const val = searchInput.value;
                    searchInput.value = '';
                    searchInput.value = val;
                }
            }, 300);
        }
    });

    // Listener pentru submit (doar formularul de import)
    mainContent.addEventListener('submit', async (event) => {
        if (event.target.id === 'upload-form') {
            const success = await handleUploadSubmit(event);
            if (success) {
                await renderView('comenzi'); // Reîncarcă vizualizarea comenzilor
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
    renderView('comenzi');
});
