// scripts/api.js
import { 
    N8N_UPLOAD_WEBHOOK_URL, 
    READY_TO_LIST_WEBHOOK_URL, 
    ASIN_UPDATE_WEBHOOK_URL,
    SAVE_FINANCIAL_WEBHOOK_URL 
} from './constants.js';
import { fetchDataAndSyncState, AppState } from './data.js';

/**
 * Trimite starea "Gata de listat" pentru un produs sau o comandă întreagă.
 */
export async function sendReadyToList(payload, buttonElement) {
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
        console.log("Sending payload to ready-to-list webhook:", payload);
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

        await response.json();
        await fetchDataAndSyncState(); // Re-fetch data
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

/**
 * Gestionează submiterea formularului de upload.
 */
export async function handleUploadSubmit(event) {
    event.preventDefault();
    const uploadBtn = document.getElementById('upload-button');
    const btnText = uploadBtn.querySelector('.button-text');
    const btnLoader = uploadBtn.querySelector('.button-loader');
    const statusEl = document.getElementById('upload-status');
    const formData = new FormData(event.target);

    if (!formData.get('zipFile')?.size || !formData.get('pdfFile')?.size) { 
        statusEl.textContent = 'Selectează ambele fișiere.'; 
        statusEl.className = 'text-red-600'; 
        return false; 
    }
    
    uploadBtn.disabled = true; 
    btnText.classList.add('hidden'); 
    btnLoader.classList.remove('hidden'); 
    statusEl.textContent = 'Se trimit fișierele...'; 
    statusEl.className = '';
    
    try {
        const response = await fetch(N8N_UPLOAD_WEBHOOK_URL, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);
        
        const resData = await response.json();
        if (resData.status === 'success') { 
            statusEl.textContent = 'Comanda a fost importată!'; 
            statusEl.className = 'text-green-600'; 
            event.target.reset(); 
            return true; // Succes
        } else {
            throw new Error('Eroare server.');
        }
    } catch (error) { 
        statusEl.textContent = 'A apărut o eroare.'; 
        statusEl.className = 'text-red-600'; 
        return false; // Eșec
    } finally { 
        uploadBtn.disabled = false; 
        btnText.classList.remove('hidden'); 
        btnLoader.classList.add('hidden'); 
    }
}

/**
 * Gestionează actualizarea ASIN-ului.
 */
export async function handleAsinUpdate(actionButton) {
    const productsku = actionButton.dataset.productsku;
    const oldAsin = actionButton.dataset.oldAsin;
    const orderId = actionButton.dataset.orderId;
    const manifestSku = actionButton.dataset.manifestSku;

    const newAsin = prompt("Introduceți noul ASIN:", oldAsin);

    if (!newAsin || newAsin.trim() === '' || newAsin.trim() === oldAsin) {
        return false;
    }

    const confirmation = confirm("Atenție!\n\nSchimbarea ASIN-ului va reîncărca datele acestui produs și poate modifica titlul, pozele sau descrierea. Datele nesalvate se vor pierde.\n\nSigur doriți să continuați?");

    if (!confirmation) {
        return false;
    }

    const payload = {
        productsku: productsku,
        asin_vechi: oldAsin,
        asin_nou: newAsin.trim(),
        orderId: orderId,
        manifestsku: manifestSku
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
            await fetchDataAndSyncState(); 
            return true; // Succes
        } else {
            alert(`Eroare la actualizare: ${result.message || 'Răspuns invalid de la server.'}`);
            return false;
        }
    } catch (error) {
        console.error('Eroare la actualizarea ASIN-ului:', error);
        alert(`A apărut o eroare de rețea: ${error.message}`);
        return false;
    }
}

// --- NOU: Salvare Date Financiare ---
export async function saveFinancialDetails(payload, buttonElement) {
    const originalHTML = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

    try {
        // Folosim POST conform discuției
        const response = await fetch(SAVE_FINANCIAL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Eroare HTTP: ${response.status}. ${errorText}`);
        }

        // După salvare reușită, actualizăm AppState LOCAL pentru a reflecta modificările
        // fără a face un nou request GET.
        const currentData = AppState.getFinancialData();
        
        let found = false;
        const updatedData = currentData.map(item => {
            if (item.orderid === payload.orderid) {
                found = true;
                // Îmbinăm datele existente cu cele noi salvate
                return { ...item, ...payload };
            }
            return item;
        });

        // Dacă cumva nu exista în lista locală (deși puțin probabil), îl adăugăm
        if (!found) {
            updatedData.push(payload);
        }
        
        // Salvăm în cache-ul local (SessionStorage prin AppState)
        AppState.setFinancialData(updatedData);

        alert('Datele financiare au fost salvate cu succes!');
        return true;

    } catch (error) {
        console.error('Eroare la salvarea datelor financiare:', error);
        alert(`Eroare la salvare: ${error.message}`);
        return false;
    } finally {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalHTML;
    }
}
