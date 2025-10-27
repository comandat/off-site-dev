// scripts/main.js
import { state } from './state.js';
import { renderView } from './viewRenderer.js';
import { initGlobalListeners } from './lightbox.js';
import { sendReadyToList, handleUploadSubmit, handleAsinUpdate } from './api.js';
// --- MODIFICAT: Am importat handleImageTranslation ---
import { 
    loadTabData, 
    handleProductSave, 
    handleTitleRefresh, 
    handleTranslationInit, 
    handleImageActions, 
    handleDescriptionToggle,
    saveCurrentTabData,
    handleImageTranslation // <-- IMPORT NOU
} from './product-details.js';
// --- SFÂRȘIT MODIFICARE ---

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');

    // --- INIȚIALIZARE EVENT LISTENERS ---

    // Listener pentru click-uri pe acțiuni principale
    mainContent.addEventListener('click', async (event) => {
        const target = event.target;
        
        // --- Selectori ---
        // ... (cod neschimbat)
        const actionButton = target.closest('[data-action]');
        // ... (cod neschimbat)

        // --- Navigare ---
        // ... (cod neschimbat)

        // --- Tab-uri și UI Produs ---
        // ... (cod neschimbat)

        // --- Acțiuni (Butoane) ---
        if (actionButton) {
            const action = actionButton.dataset.action;

            // Navigare "Back"
            // ... (cod neschimbat)

            // Acțiuni API "Ready to List"
            // ... (cod neschimbat)

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
            
            // --- NOU: Handler specific pentru traducere imagini ---
            if (action === 'translate-ai-images') {
                await handleImageTranslation(actionButton);
                return; // Oprește execuția aici
            }
            // --- SFÂRȘIT NOU ---
            
            // --- MODIFICAT: Scoatem 'translate-ai-images' din lista generică ---
            if (['delete-image', 'add-image-url', 'copy-origin-images'].includes(action)) {
                handleImageActions(action, actionButton);
            }
            // --- SFÂRȘIT MODIFICARE ---
        }
    });

    // Listener pentru input (căutare, filtre)
    // ... (cod neschimbat)

    // Listener pentru submit (doar formularul de import)
    // ... (cod neschimbat)

    // Listener pentru sortarea imaginilor (eveniment custom)
    // ... (cod neschimbat)

    // Inițializează listener-ii globali (dropdowns, lightbox)
    initGlobalListeners();

    // --- PORNIRE APLICAȚIE ---
    renderView('comenzi');
});
