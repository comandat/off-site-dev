import { AppState, fetchProductDetailsInBulk } from './data.js';
import { state } from './state.js';

function toggleButtonLoader(button, isLoading) {
    if (!button) return;
    const btnText = button.querySelector('.button-text');
    const btnLoader = button.querySelector('.button-loader');
    
    button.disabled = isLoading;
    if (btnText) btnText.classList.toggle('hidden', isLoading);
    if (btnLoader) btnLoader.classList.toggle('hidden', !isLoading);
}

export function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : row[header];
            cell = String(cell);
            cell = cell.replace(/"/g, '""');
            if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
                cell = `"${cell}"`;
            }
            return cell;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

export function downloadCSV(csvString, fileName) {
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

function generateEAN() {
    if (eanPrefixIndex >= eanPrefixes.length) {
        eanPrefixIndex = 0;
    }
    var prefix = eanPrefixes[eanPrefixIndex];
    eanPrefixIndex++;

    var randomNumber = Math.floor(Math.random() * 900000000) + 100000000;
    var base12 = prefix + randomNumber.toString();
    
    var oddSum = 0;
    var evenSum = 0;

    for (var i = 0; i < base12.length; i++) {
        var digit = parseInt(base12[i], 10);
        if ((i + 1) % 2 !== 0) {
            oddSum += digit;
        } else {
            evenSum += digit;
        }
    }

    var totalSum = oddSum + (evenSum * 3);
    var checkDigit = (10 - (totalSum % 10)) % 10;
    
    var finalEAN = base12 + checkDigit.toString();
    return finalEAN;
}

function removeDiacritics(str) {
    if (typeof str !== 'string') return str;
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isLikelyEnglish(str) {
    if (!str || str.length < 10) return false;
    const commonWords = /\b(the|and|is|are|you|of|in|to)\b/gi;
    const matches = (str.match(commonWords) || []).length;
    
    const romanianChars = /[ăâîșț]/i;
    
    if (matches > 2 && !romanianChars.test(str)) {
        return true;
    }
    return false;
}

export async function handleExportPreliminar(commandId, button) {
    toggleButtonLoader(button, true);
    eanPrefixIndex = 0; 
    const previewContainer = document.getElementById('export-preview-container');
    if (!previewContainer) return;
    previewContainer.innerHTML = '<p class="text-center text-gray-500">Se validează datele...</p>';

    try {
        const command = AppState.getCommands().find(c => c.id === commandId);
        if (!command) throw new Error('Comanda nu a fost găsită.');

        const productsToExport = command.products.filter(p => p.listingReady === true);
        if (productsToExport.length === 0) {
            alert('Nu există produse marcate "Gata de listat" (listingready=true) în această comandă.');
            previewContainer.innerHTML = '';
            toggleButtonLoader(button, false);
            return;
        }

        const asins = productsToExport.map(p => p.asin);
        const detailsMap = await fetchProductDetailsInBulk(asins);
        
        let validatedData = [];
        let errorList = [];

        for (const product of productsToExport) {
            const details = detailsMap[product.asin];
            const productErrors = [];
            
            if (!details) {
                console.warn(`Lipsesc detaliile pentru ASIN ${product.asin}, acest produs va fi omis.`);
                continue;
            }

            const roData = details.other_versions?.['romanian'] || {};
            
            let name = (roData.title || details.title || '').trim();
            let description = (roData.description || details.description || '').trim();
            const brand = details.brand || '';
            const basePrice = parseFloat(details.price) || 0;
            
            let roImages = roData.images || details.images || [];
            if (!Array.isArray(roImages)) roImages = [];
            roImages = roImages.filter(img => img); 

            const stockCode = product.stockcode || generateRandomStockCode(); 
            const unitWeight = product.unitweight || 1; 
            const taxRate = 0; 
            
            if (basePrice === 0) {
                productErrors.push("Preț 0 sau inexistent. (Verifică 'Preț estimat' în pagina produsului)");
            }
            
            if (roImages.length === 0) {
                productErrors.push("Nu există nicio poză (pentru tab-ul RO sau 'Origin').");
            }
            
            if (stockCode.length !== 12) {
                productErrors.push(`Codul de stoc generat/existent are ${stockCode.length} caractere (așteptat 12).`);
            }
            
            if (!name) {
                productErrors.push("Titlul lipsește.");
            } else if (name.length < 10) {
                productErrors.push(`Titlul este prea scurt (${name.length} caractere).`);
            } else {
                if (name.toLowerCase().includes('titlu')) {
                    productErrors.push("Titlul conține cuvântul 'titlu'.");
                }
                if (name.toLowerCase() === 'nu!') {
                    productErrors.push("Titlul este 'NU!'.");
                }
                if (/[`"']/.test(name)) {
                    productErrors.push("Titlul conține ghilimele (` \" ').");
                }
            }
            
            if (!description) {
                productErrors.push("Descrierea lipsește.");
            } else if (description.length < 10) {
                productErrors.push(`Descrierea este prea scurtă (${description.length} caractere).`);
            } else if (isLikelyEnglish(description)) {
                productErrors.push("Descrierea pare a fi în engleză, nu în română.");
            }

            if (productErrors.length > 0) {
                errorList.push({
                    asin: product.asin,
                    uniqueId: product.uniqueId,
                    commandId: command.id,
                    name: name || 'Fără Titlu',
                    errors: productErrors
                });
            }
            
            name = removeDiacritics(name);
            description = removeDiacritics(description);
            
            const salePriceWithTax = basePrice * 1.10; 
            const salePriceWithoutTax = (100 - taxRate) / 100 * salePriceWithTax;
            const fullPriceWithTax = 2 * salePriceWithTax;
            const fullPriceWithoutTax = 2 * salePriceWithoutTax;

            validatedData.push({
                "SKU": `${product.asin}CN`,
                "Name": name,
                "Brand": brand,
                "EAN": generateEAN(),
                "Description": description,
                "Stock": 1,
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
        
        if (errorList.length === 0) {
            state.lastExportData = validatedData;
        } else {
            state.lastExportData = null; 
        }
        
        previewContainer.innerHTML = renderPreview(errorList, validatedData);

    } catch (error) {
        console.error('Eroare la generarea exportului preliminar:', error);
        alert(`A apărut o eroare: ${error.message}`);
        previewContainer.innerHTML = `<p class="text-red-500">Eroare: ${error.message}</p>`;
    } finally {
        toggleButtonLoader(button, false);
    }
}

function renderPreview(errors, data) {
    let errorsHTML = '';
    const hasErrors = errors.length > 0;

    if (hasErrors) {
        errorsHTML = `
            <div class="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
                <h3 class="text-lg font-bold text-red-800">S-au găsit ${errors.length} produse cu erori:</h3>
                <p class="text-red-700 mb-4">Rezolvați aceste probleme înainte de a putea descărca fișierul CSV.</p>
                <div class="max-h-64 overflow-y-auto border rounded-md bg-white p-4 mt-4">
                    <ul class="list-disc pl-5 space-y-2">
        `;
        for (const item of errors) {
            errorsHTML += `
                <li class="text-sm">
                    <a href="#" 
                       class="font-bold text-blue-600 hover:underline"
                       data-action="go-to-product"
                       data-command-id="${item.commandId}"
                       data-product-id="${item.uniqueId}">
                        ${item.asin}
                    </a> (${item.name.substring(0, 30)}...):
                    <ul class="list-circle pl-5 text-red-700">
                        ${item.errors.map(e => `<li>${e}</li>`).join('')}
                    </ul>
                </li>
            `;
        }
        errorsHTML += '</ul></div></div>';
    } else {
        errorsHTML = `
            <div class="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
                <h3 class="text-lg font-bold text-green-800">Validare completă!</h3>
                <p class="text-green-700">Nu s-au găsit erori. Puteți descărca fișierul CSV.</p>
            </div>
        `;
    }

    const headers = Object.keys(data[0] || {});
    let tableHTML = `
        <div class="flex justify-end mb-4">
            <button data-action="download-preliminar" 
                    class="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg ${hasErrors ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}"
                    ${hasErrors ? 'disabled' : ''}>
                <span class="material-icons text-base mr-2" style="font-size: 18px; vertical-align: middle;">download</span>
                Download CSV
            </button>
        </div>
        <div class="overflow-x-auto bg-white rounded-lg shadow" style="max-height: 600px;">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50 sticky top-0">
                    <tr>
                        ${headers.map(h => `<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    for (const row of data) {
        tableHTML += `<tr>`;
        for (const header of headers) {
            let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
            if (header === 'Description' || header === 'Name' || header === 'Images') {
                cell = cell.substring(0, 50) + (cell.length > 50 ? '...' : '');
            }
            tableHTML += `<td class="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">${cell}</td>`;
        }
        tableHTML += '</tr>';
    }

    tableHTML += '</tbody></table></div>';
    
    return errorsHTML + tableHTML;
}

export function handleExportStocReal(commandId, button) {
    toggleButtonLoader(button, true);

    try {
        const command = AppState.getCommands().find(c => c.id === commandId);
        if (!command) throw new Error('Comanda nu a fost găsită.');
        
        const productsToExport = command.products.filter(
            p => p.listingReady === true && (p.verificationready === true || p.verificationready === undefined) 
        );
        
        if (command.products.some(p => p.verificationready === undefined) && productsToExport.length > 0) {
             console.warn("Se pare că 'verificationready' nu este disponibil în datele produselor. Se continuă filtrarea doar după 'listingReady=true'...");
             
             if (productsToExport.length > 0) {
                alert("Atenție: Câmpul 'verificationready' nu a fost găsit. Exportul va conține TOATE produsele cu 'listingready=true', dar stocul 'bncondition' poate fi 0 pentru cele neverificate.");
             }
        }
        
        if (productsToExport.length === 0) {
            alert('Nu există produse marcate "Gata de listat" (listingready=true) în această comandă.');
            toggleButtonLoader(button, false);
            return;
        }

        const csvData = productsToExport.map(product => ({
            "SKU": `${product.asin}CN`,
            "Stock": product.bncondition || 0 
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
