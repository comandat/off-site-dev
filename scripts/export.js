// scripts/export.js
import { AppState, fetchProductDetailsInBulk } from './data.js';

// --- FUNCȚII HELPER ---

/**
 * Afișează/Ascunde loader-ul unui buton
 */
function toggleButtonLoader(button, isLoading) {
    if (!button) return;
    const btnText = button.querySelector('.button-text');
    const btnLoader = button.querySelector('.button-loader');
    
    button.disabled = isLoading;
    if (btnText) btnText.classList.toggle('hidden', isLoading);
    if (btnLoader) btnLoader.classList.toggle('hidden', !isLoading);
}

/**
 * Convertește un array de obiecte în string CSV
 */
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : row[header];
            cell = String(cell);
            // Escape quotes
            cell = cell.replace(/"/g, '""');
            // Wrap in quotes if it contains comma, newline, or quote
            if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
                cell = `"${cell}"`;
            }
            return cell;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

/**
 * Forțează descărcarea unui fișier CSV
 */
function downloadCSV(csvString, fileName) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

/**
 * Generează un string alfanumeric random
 */
function generateRandomStockCode(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const eanPrefixes = ['615', '603', '617', '865', '529', '535', '479', '470', '390'];
let eanPrefixIndex = 0;

/**
 * Generează EAN-13 conform funcției cerute.
 */
function generateEAN() {
    // 1. Definim prefixul, alternând
    if (eanPrefixIndex >= eanPrefixes.length) {
        eanPrefixIndex = 0;
    }
    var prefix = eanPrefixes[eanPrefixIndex];
    eanPrefixIndex++;

    // 2. Generăm 9 cifre aleatorii
    var randomNumber = Math.floor(Math.random() * 900000000) + 100000000;
    var base12 = prefix + randomNumber.toString();
    
    var oddSum = 0;
    var evenSum = 0;

    // 3. Calculăm suma
    for (var i = 0; i < base12.length; i++) {
        var digit = parseInt(base12[i], 10);
        if ((i + 1) % 2 !== 0) {
            oddSum += digit;
        } else {
            evenSum += digit;
        }
    }

    // 4. Calculăm cifra de control
    var totalSum = oddSum + (evenSum * 3);
    var checkDigit = (10 - (totalSum % 10)) % 10;
    
    // 5. Formăm codul final
    var finalEAN = base12 + checkDigit.toString();
    return finalEAN;
}

// --- FUNCȚII PRINCIPALE DE EXPORT ---

/**
 * Handler pentru "Listare Preliminara"
 */
export async function handleExportPreliminar(commandId, button) {
    toggleButtonLoader(button, true);
    eanPrefixIndex = 0; // Resetează indexul EAN la fiecare generare

    try {
        const command = AppState.getCommands().find(c => c.id === commandId);
        if (!command) throw new Error('Comanda nu a fost găsită.');

        const productsToExport = command.products.filter(p => p.listingReady === true);
        if (productsToExport.length === 0) {
            alert('Nu există produse marcate "Gata de listat" (listingready=true) în această comandă.');
            return;
        }

        const asins = productsToExport.map(p => p.asin);
        const detailsMap = await fetchProductDetailsInBulk(asins);
        
        const csvData = [];

        for (const product of productsToExport) {
            const details = detailsMap[product.asin];
            if (!details) {
                console.warn(`Lipsesc detaliile pentru ASIN ${product.asin}, acest produs va fi omis.`);
                continue;
            }

            const roData = details.other_versions?.['romanian'] || {};
            const roTitle = roData.title || details.title || 'N/A'; // Fallback la titlul 'origin'
            const roDescription = roData.description || details.description || ''; // Fallback la descrierea 'origin'
            
            let roImages = roData.images || details.images || [];
            // Asigură-te că imaginile sunt un array și filtrează valorile goale
            if (!Array.isArray(roImages)) roImages = [];
            roImages = roImages.filter(img => img); 

            // --- Datele care lipsesc (placeholder-uri) ---
            // TODO: Înlocuiește 'product.estimatedsalevaluewithvat' cu câmpul corect când va fi disponibil
            const estimatedSaleValue = product.estimatedsalevaluewithvat || 0; 
            // TODO: Înlocuiește 'product.unitweight' cu câmpul corect când va fi disponibil
            const unitWeight = product.unitweight || 1; // Fallback 1
            // TODO: Înlocuiește 'product.stockcode' cu câmpul corect când va fi disponibil
            const stockCode = product.stockcode || generateRandomStockCode(); // Fallback la generare
            // ---

            const taxRate = 0; // Valoare fixă
            // ATENȚIE: 'estimatedSaleValue * 1.10' este interpretarea cerinței 'produsului * 10%' (am presupus +10%)
            const salePriceWithTax = estimatedSaleValue * 1.10; 
            const salePriceWithoutTax = (100 - taxRate) / 100 * salePriceWithTax;
            const fullPriceWithTax = 2 * salePriceWithTax;
            const fullPriceWithoutTax = 2 * salePriceWithoutTax;

            csvData.push({
                "SKU": `${product.asin}CN`,
                "Name": roTitle,
                "Brand": details.brand || '',
                "EAN": generateEAN(),
                "Description": roDescription,
                "Stock": 1, // Valoare fixă
                "Stock Code": stockCode,
                "Weight": unitWeight,
                "Sale Price Without Tax": salePriceWithoutTax.toFixed(2),
                "Sale Price With Tax": salePriceWithTax.toFixed(2),
                "Full Price Without Tax": fullPriceWithoutTax.toFixed(2),
                "Full Price With Tax": fullPriceWithTax.toFixed(2),
                "Tax Rate": taxRate,
                "Images": roImages.join(','),
            });
        }
        
        if (csvData.length > 0) {
            const csvString = convertToCSV(csvData);
            downloadCSV(csvString, `export_preliminar_${commandId.substring(0, 8)}.csv`);
        } else {
             alert('Nu s-au putut genera date pentru niciun produs.');
        }

    } catch (error) {
        console.error('Eroare la generarea exportului preliminar:', error);
        alert(`A apărut o eroare: ${error.message}`);
    } finally {
        toggleButtonLoader(button, false);
    }
}

/**
 * Handler pentru "Update cu Stoc Real"
 */
export function handleExportStocReal(commandId, button) {
    toggleButtonLoader(button, true);

    try {
        const command = AppState.getCommands().find(c => c.id === commandId);
        if (!command) throw new Error('Comanda nu a fost găsită.');
        
        const productsToExport = command.products.filter(
            // TODO: Câmpul 'verificationready' trebuie să vină din webhook
            p => p.listingReady === true && p.verificationready === true
        );
        
        // --- FALLBACK ---
        // Acest bloc rulează dacă 'verificationready' nu este definit în datele primite
        if (command.products.some(p => p.verificationready === undefined) && productsToExport.length === 0) {
             console.warn("Se pare că 'verificationready' nu este disponibil în datele produselor. Se încearcă filtrarea doar după 'listingReady=true'...");
             
             const fallbackProducts = command.products.filter(p => p.listingReady === true);
             
             if (fallbackProducts.length > 0) {
                alert("Atenție: Câmpul 'verificationready' nu a fost găsit. Exportul va conține TOATE produsele cu 'listingready=true', dar stocul 'bncondition' poate fi 0 pentru cele neverificate.");
             }
             
             const csvDataFallback = fallbackProducts.map(product => ({
                "SKU": `${product.asin}CN`,
                "Stock": product.bncondition || 0
            }));
             
             if (csvDataFallback.length === 0) {
                alert('Nu există produse marcate "Gata de listat" (listingready=true) în această comandă.');
                toggleButtonLoader(button, false); // Oprește loader-ul aici
                return;
             }
             
             const csvString = convertToCSV(csvDataFallback);
             downloadCSV(csvString, `update_stoc_real_FALLBACK_${commandId.substring(0, 8)}.csv`);
             toggleButtonLoader(button, false); // Oprește loader-ul aici
             return;
        }
        // --- SFÂRȘIT FALLBACK ---
        
        if (productsToExport.length === 0) {
            alert('Nu există produse care să îndeplinească ambele condiții: "listingready=true" ȘI "verificationready=true".');
            toggleButtonLoader(button, false);
            return;
        }

        const csvData = productsToExport.map(product => ({
            "SKU": `${product.asin}CN`,
            "Stock": product.bncondition || 0 // Folosim stocul 'bncondition'
        }));

        const csvString = convertToCSV(csvData);
        downloadCSV(csvString, `update_stoc_real_${commandId.substring(0, 8)}.csv`);

    } catch (error) {
        console.error('Eroare la generarea update-ului de stoc:', error);
        alert(`A apărut o eroare: ${error.message}`);
    } finally {
        toggleButtonLoader(button, false);
    }
}
