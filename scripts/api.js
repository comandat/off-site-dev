// scripts/api.js
import { 
    N8N_UPLOAD_WEBHOOK_URL, 
    READY_TO_LIST_WEBHOOK_URL, 
    ASIN_UPDATE_WEBHOOK_URL,
    SAVE_FINANCIAL_WEBHOOK_URL,
    GENERATE_NIR_WEBHOOK_URL 
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

// --- Salvare Date Financiare ---
export async function saveFinancialDetails(payload, buttonElement) {
    const originalHTML = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

    try {
        const response = await fetch(SAVE_FINANCIAL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Eroare HTTP: ${response.status}. ${errorText}`);
        }

        // Actualizăm cache-ul local
        const currentData = AppState.getFinancialData();
        let found = false;
        const updatedData = currentData.map(item => {
            if (item.orderid === payload.orderid) {
                found = true;
                return { ...item, ...payload };
            }
            return item;
        });

        if (!found) {
            updatedData.push(payload);
        }
        
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

// --- Generare NIR ---
export async function generateNIR(commandId, buttonElement) {
    const originalHTML = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

    try {
        const command = AppState.getCommands().find(c => c.id === commandId);
        if (!command) throw new Error('Comanda nu a fost găsită în memorie.');

        const products = command.products;
        const productsPayload = [];
        let hasErrors = false;

        // Validăm produsele înainte de a trimite
        for (const p of products) {
            const receivedQty = (p.bncondition || 0) + (p.vgcondition || 0) + (p.gcondition || 0);
            
            // Ignorăm produsele care nu au fost recepționate (cantitate 0)
            if (receivedQty <= 0) continue;

            const details = AppState.getProductDetails(p.asin) || {};
            const roData = details.other_versions?.['romanian'] || {};
            const title = (roData.title || '').trim();
            const price = parseFloat(details.price) || 0;
            const manifestSku = p.manifestsku || '';

            // Criterii de eroare:
            // 1. Lipsă ManifestSKU
            // 2. Titlu RO lipsă, "N/A" sau prea scurt
            // 3. Preț <= 0
            if (!manifestSku || !title || title === "N/A" || title.length < 10 || price <= 0) {
                hasErrors = true;
                console.warn(`Produs cu eroare: ${p.asin}`, { manifestSku, title, price });
                break; // Ne oprim la prima eroare
            }

            productsPayload.push({
                asin: p.asin,
                manifestSku: manifestSku,
                title: title,
                price: price,
                quantity: receivedQty,
                uniqueId: p.uniqueId
            });
        }

        if (hasErrors) {
            alert("Nu se poate genera NIR-ul!\n\nExistă produse recepționate care au erori (ManifestSKU lipsă, Titlu RO invalid/scurt sau Preț 0).\n\nVerificați tabelul pentru rândurile marcate cu roșu.");
            return false;
        }

        if (productsPayload.length === 0) {
            alert("Nu există produse recepționate (cantitate > 0) pentru a genera NIR.");
            return false;
        }

        const payload = {
            commandId: commandId,
            products: productsPayload
        };

        const response = await fetch(GENERATE_NIR_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Eroare HTTP: ${response.status}. ${errorText}`);
        }

        // Verificăm tipul răspunsului. Dacă e JSON (probabil eroare sau link), tratăm corespunzător.
        // Dacă e Blob (PDF), îl descărcăm.
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
             const jsonRes = await response.json();
             if(jsonRes.status === 'error') {
                 throw new Error(jsonRes.message || 'Eroare necunoscută la generare.');
             }
             // Dacă serverul returnează un URL
             if (jsonRes.url) {
                 window.open(jsonRes.url, '_blank');
                 alert('NIR generat cu succes!');
                 return true;
             }
        }

        // Fallback: Presupunem că e fișier (blob)
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `NIR_${commandId}.pdf`; 
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

        alert('NIR generat și descărcat cu succes!');
        return true;

    } catch (error) {
        console.error('Eroare la generarea NIR:', error);
        alert(`Eroare: ${error.message}`);
        return false;
    } finally {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalHTML;
    }
}
