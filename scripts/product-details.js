// scripts/product-details.js
import { state } from './state.js';
// --- MODIFICAT: Am adăugat IMAGE_TRANSLATION_WEBHOOK_URL ---
import { languageNameToCodeMap, COMPETITION_WEBHOOK_URL, TITLE_GENERATION_WEBHOOK_URL, TRANSLATION_WEBHOOK_URL, IMAGE_TRANSLATION_WEBHOOK_URL } from './constants.js';
// --- SFÂRȘIT MODIFICARE ---
import { renderImageGallery, initializeSortable, templates } from './templates.js';
import { saveProductDetails } from './data.js';

// ... (funcțiile getCurrentImagesArray, setCurrentImagesArray, saveCurrentTabData, loadTabData, fetchAndRenderCompetition, handleProductSave, handleTitleRefresh, handleTranslationInit rămân neschimbate) ...


// --- NOU: Funcție pentru a gestiona traducerea imaginilor ---
/**
 * Inițiază traducerea AI a imaginilor
 * @param {HTMLElement} button - Butonul care a fost apăsat
 */
export async function handleImageTranslation(button) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

    try {
        const asin = document.getElementById('product-asin')?.value;
        const originImages = state.editedProductData.images || []; // Luăm imaginile de pe 'origin'
        const activeKey = state.activeVersionKey; // ex: "romanian"
        
        // Găsește codul scurt (ex: "ro")
        const langCode = (languageNameToCodeMap[activeKey.toLowerCase()] || activeKey).toLowerCase();

        if (!asin) {
            throw new Error("ASIN-ul produsului nu a fost găsit.");
        }
        if (!langCode || langCode === 'origin') {
            throw new Error("Limba selectată este invalidă pentru traducere.");
        }
        if (originImages.length === 0) {
            throw new Error("Nu există imagini 'origin' de tradus. Copiați-le mai întâi.");
        }
        if (IMAGE_TRANSLATION_WEBHOOK_URL.includes('URL_WEBHOOK_TRADUCERE_IMAGINI')) {
             throw new Error("URL-ul pentru traducerea imaginilor nu a fost configurat în constants.js");
        }

        // Construiește payload-ul
        const payloadData = {
            asin: asin,
            lang: langCode
        };

        originImages.forEach((url, index) => {
            if (index < 5) { // Limitat la 5 imagini
                payloadData[`image${index + 1}`] = url;
            }
        });
        
        // Payload-ul final este un array cu un obiect, conform cerinței
        const payload = [payloadData];
        
        console.log("Trimitere payload pentru traducere imagini:", payload);

        const response = await fetch(IMAGE_TRANSLATION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Eroare HTTP: ${response.status}. ${errorText}`);
        }

        alert('Traducerea imaginilor a fost inițiată cu succes!');

    } catch (error) {
        console.error('Eroare la inițierea traducerii imaginilor:', error);
        alert(`A apărut o eroare: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}
// --- SFÂRȘIT NOU ---


// --- MODIFICAT: Am scos 'translate-ai-images' din această funcție ---
export function handleImageActions(action, actionButton) {
    let currentImages = getCurrentImagesArray();
    if (action === 'delete-image') {
        const imageSrc = actionButton.dataset.imageSrc;
        if (!imageSrc) return;
        if (!currentImages) currentImages = [];
        currentImages = currentImages.filter(img => img !== imageSrc);
    }
    else if (action === 'add-image-url') {
        if (!currentImages) currentImages = [];
        if (currentImages.length >= 5) {
            alert("Puteți adăuga maxim 5 imagini.");
            return;
        }
        const newImageUrl = prompt("Vă rugăm introduceți URL-ul noii imagini:");
        if (newImageUrl) {
            currentImages.push(newImageUrl);
        }
    }
    else if (action === 'copy-origin-images') {
        currentImages = [...(state.editedProductData.images || [])];
    }
    // CAZUL 'translate-ai-images' A FOST ELIMINAT DE AICI

    setCurrentImagesArray(currentImages);
    const galleryContainer = document.getElementById('image-gallery-container');
    if (galleryContainer) {
        galleryContainer.innerHTML = renderImageGallery(currentImages);
        initializeSortable();
    }
}
// --- SFÂRȘIT MODIFICARE ---

export function handleDescriptionToggle(descModeButton) {
    // ... (cod neschimbat)
}
