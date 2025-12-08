// scripts/api.js
import { 
    N8N_UPLOAD_WEBHOOK_URL, 
    READY_TO_LIST_WEBHOOK_URL, 
    ASIN_UPDATE_WEBHOOK_URL,
    SAVE_FINANCIAL_WEBHOOK_URL,
    GENERATE_NIR_WEBHOOK_URL 
} from './constants.js';
import { fetchDataAndSyncState, AppState, fetchProductDetailsInBulk } from './data.js';
import { state } from './state.js';

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

// --- Generare NIR (PDF in Browser) ---
export async function generateNIR(commandId, buttonElement) {
    const originalHTML = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

    try {
        // 1. Verificări preliminare: Trebuie să avem date calculate
        if (!state.financialCalculations || !state.financialCalculations[commandId]) {
            throw new Error("Nu există calcule financiare pentru această comandă. Vă rugăm rulați 'Rulează Calcule' în tab-ul Financiar înainte de a genera NIR-ul.");
        }

        const command = AppState.getCommands().find(c => c.id === commandId);
        if (!command) throw new Error('Comanda nu a fost găsită.');

        // Asigurăm că avem detaliile (titlurile) pentru produse
        const asins = command.products.map(p => p.asin);
        const detailsMap = await fetchProductDetailsInBulk(asins);
        
        const financials = state.financialCalculations[commandId];
        const rows = [];
        let grandTotalValoare = 0;
        let grandTotalTVA = 0;

        // 2. Construire Date Tabel
        command.products.forEach(p => {
            const calcData = financials[p.uniqueId];
            // Ignorăm produsele care nu au fost recepționate sau calculate
            if (!calcData || calcData.totalCost <= 0) return;

            const unitCost = calcData.unitCost;
            const details = detailsMap[p.asin] || {};
            const roTitle = (details.other_versions?.['romanian']?.title || details.title || "N/A").trim();

            // Definim condițiile pentru a sparge rândurile (exact ca în Apps Script)
            // CN = Ca Nou (BN), FB = Foarte Bun (VG), B = Bun (G)
            const conditions = [
                { qty: p.bncondition, suffix: " - CN" },
                { qty: p.vgcondition, suffix: " - FB" },
                { qty: p.gcondition,  suffix: " - B" }
            ];

            conditions.forEach(cond => {
                if (cond.qty > 0) {
                    const valoare = cond.qty * unitCost;
                    const tva = valoare * 0.21; // TVA 21%

                    grandTotalValoare += valoare;
                    grandTotalTVA += tva;

                    rows.push([
                        p.asin,                     // Cod Articol
                        roTitle + cond.suffix,      // Denumire + Sufix
                        "buc",                      // U.M.
                        cond.qty,                   // Cantitate
                        unitCost.toFixed(2),        // Pret Unitar (RON)
                        valoare.toFixed(2),         // Valoare
                        tva.toFixed(2)              // TVA (21%)
                    ]);
                }
            });
        });

        if (rows.length === 0) {
            throw new Error("Nu există produse valide recepționate pentru a genera NIR.");
        }

        // 3. Generare PDF cu jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // --- Header ---
        doc.setFontSize(10);
        doc.text("T&G SHOP AND BUSINESS S.R.L.", 14, 15);
        
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("NOTA DE RECEPTIE SI CONSTATARE DE DIFERENTE", 105, 25, { align: "center" });
        doc.line(14, 27, 196, 27); // Linie sub titlu

        // --- Info Comandă ---
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        const today = new Date().toLocaleDateString('ro-RO');
        const infoY = 35;
        
        doc.text(`Numar Factura: ${command.name}`, 14, infoY);
        doc.text(`Data: ${today}`, 14, infoY + 5);
        doc.text(`Gestiune: Principal`, 14, infoY + 10);
        
        doc.text(`Furnizor: JLI Trading Limited`, 120, infoY);
        doc.text(`Cod Fiscal: PL5263222338`, 120, infoY + 5);

        // --- Tabel Produse ---
        doc.autoTable({
            startY: 55,
            head: [['Cod Articol', 'Denumire', 'U.M.', 'Cant', 'Pret Unitar', 'Valoare', 'TVA (21%)']],
            body: rows,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 25 }, // Cod
                1: { cellWidth: 'auto' }, // Denumire (auto)
                2: { cellWidth: 10 }, // UM
                3: { cellWidth: 12, halign: 'center' }, // Cant
                4: { cellWidth: 20, halign: 'right' }, // Pret
                5: { cellWidth: 20, halign: 'right' }, // Valoare
                6: { cellWidth: 20, halign: 'right' }  // TVA
            },
            foot: [[
                { content: 'TOTAL:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: grandTotalValoare.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: grandTotalTVA.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }
            ]],
        });

        // --- Total General ---
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        const totalGeneral = grandTotalValoare + grandTotalTVA;
        doc.text(`TOTAL GENERAL (Valoare + TVA): ${totalGeneral.toFixed(2)} RON`, 196, finalY, { align: "right" });

        // --- Footer (Semnături) ---
        const footerY = finalY + 20;
        doc.setDrawColor(200);
        doc.line(14, footerY, 196, footerY); // Linie delimitare
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        
        // Coloane semnături
        doc.text("COMISIA DE RECEPTIE", 30, footerY + 10, { align: "center" });
        doc.text("PRIMIT IN GESTIUNE", 170, footerY + 10, { align: "center" });
        
        doc.text("Nume si Prenume: ________________", 30, footerY + 25, { align: "center" });
        doc.text("Semnatura: ________________", 30, footerY + 35, { align: "center" });
        
        doc.text("Semnatura: ________________", 170, footerY + 35, { align: "center" });

        // Salvare
        doc.save(`NIR_${command.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
        alert("NIR generat cu succes!");

    } catch (error) {
        console.error('Eroare la generarea NIR:', error);
        alert(`Eroare: ${error.message}`);
    } finally {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalHTML;
    }
}
