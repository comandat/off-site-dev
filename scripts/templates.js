financiarProductTable: (products, detailsMap, commandId, calculatedData = null) => {
        if (!products || products.length === 0) return '';

        const processedProducts = products.map(p => {
            // Formula: Total Recepționat - Broken
            const totalReceived = (p.bncondition || 0) + (p.vgcondition || 0) + (p.gcondition || 0) + (p.broken || 0);
            const displayQty = totalReceived - (p.broken || 0);

            if (displayQty <= 0) return null;

            const details = detailsMap[p.asin] || {};
            const roData = details.other_versions?.['romanian'] || {};
            
            const title = (roData.title || '').trim();
            const mainImage = (roData.images && roData.images[0]) ? roData.images[0] : ((details.images && details.images[0]) ? details.images[0] : '');
            const price = parseFloat(details.price) || 0;
            const manifestSku = p.manifestsku || '';

            const errors = [];
            if (!manifestSku) errors.push("Lipsește ManifestSKU");
            if (!title || title === "N/A" || title.length < 10) errors.push("Titlu RO lipsă sau invalid");
            if (price <= 0) errors.push("Preț estimat <= 0");

            // Date calculate
            const calc = calculatedData ? calculatedData[p.uniqueId] : null;

            return {
                ...p,
                displayTitle: title || 'N/A',
                displayImage: mainImage,
                displayPrice: price,
                displayQty: displayQty,
                manifestSku: manifestSku,
                errors: errors,
                hasErrors: errors.length > 0,
                calcPercent: calc ? calc.percentDisplay : '-',
                calcUnitCost: calc ? calc.unitCost.toFixed(2) : '-',
                calcTotalCost: calc ? calc.totalCost.toFixed(2) : '-'
            };
        }).filter(p => p !== null);

        processedProducts.sort((a, b) => {
            if (a.hasErrors && !b.hasErrors) return -1;
            if (!a.hasErrors && b.hasErrors) return 1;
            return 0;
        });

        // --- CALCUL TOTAL FINAL ---
        const totalSum = processedProducts.reduce((sum, p) => {
            const val = parseFloat(p.calcTotalCost);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
        // --------------------------

        const rowsHTML = processedProducts.map(p => {
            const rowClass = p.hasErrors ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' : 'hover:bg-gray-50';
            
            let warningIcon = '';
            if (p.hasErrors) {
                const errorMsg = p.errors.join(', ');
                warningIcon = `
                    <div class="relative group flex items-center justify-center">
                        <span class="material-icons text-red-600 cursor-help">error</span>
                        <div class="absolute left-6 top-0 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-normal">
                            ${errorMsg}
                        </div>
                    </div>
                `;
            }

            const colManifest = `
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    <div class="flex items-center space-x-2">
                        ${warningIcon}
                        <span>${p.manifestSku || '<span class="text-red-500 italic">Lipsă</span>'}</span>
                    </div>
                </td>`;

            const colAsin = `
                <td class="px-4 py-4 whitespace-nowrap text-sm">
                    <button data-action="go-to-product" 
                            data-command-id="${commandId}" 
                            data-product-id="${p.uniqueId}" 
                            class="text-blue-600 hover:text-blue-900 font-bold hover:underline">
                        ${p.asin}
                    </button>
                </td>`;

            const colImage = `
                <td class="px-4 py-4 whitespace-nowrap">
                    <div class="h-16 w-16 flex-shrink-0">
                         <img class="h-16 w-16 rounded object-cover border border-gray-200" src="${p.displayImage || 'https://placehold.co/64x64?text=No+Img'}" alt="Produs">
                    </div>
                </td>`;

            const colTitle = `
                <td class="px-4 py-4 text-sm text-gray-500">
                    <div class="line-clamp-2 max-w-xs" title="${p.displayTitle}">${p.displayTitle}</div>
                </td>`;

            const priceClass = p.displayPrice <= 0 ? 'text-red-600 font-bold' : 'text-gray-900';
            const colPrice = `
                <td class="px-4 py-4 whitespace-nowrap text-sm ${priceClass}">
                    ${p.displayPrice.toFixed(2)}
                </td>`;

            const colQty = `
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-bold">
                    ${p.displayQty}
                </td>`;

            const colPercent = `
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-center bg-yellow-50">
                    ${p.calcPercent !== '-' ? p.calcPercent : '-'}
                </td>`;
            
            const colUnitCost = `
                <td class="px-4 py-4 whitespace-nowrap text-sm text-blue-800 font-bold text-right bg-yellow-50">
                    ${p.calcUnitCost}
                </td>`;

            const colTotalCost = `
                <td class="px-4 py-4 whitespace-nowrap text-sm text-green-800 font-bold text-right bg-yellow-50">
                    ${p.calcTotalCost}
                </td>`;

            return `<tr class="${rowClass}">${colManifest}${colAsin}${colImage}${colTitle}${colPrice}${colQty}${colPercent}${colUnitCost}${colTotalCost}</tr>`;
        }).join('');

        return `
            <div class="mt-8">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Lista Produse Recepționate</h3>
                <div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg" style="overflow-y: visible;"> 
                    <table class="min-w-full divide-y divide-gray-300">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manifest SKU</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ASIN</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagine</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titlu (RO)</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preț Est.</th>
                                <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-yellow-100">Procent Palet</th>
                                <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider bg-yellow-100">Cost Unitar</th>
                                <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-green-800 uppercase tracking-wider bg-yellow-100">Cost Total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                            ${rowsHTML}
                        </tbody>
                        <tfoot class="bg-gray-100 font-bold border-t-2 border-gray-300">
                            <tr>
                                <td colspan="8" class="px-4 py-3 text-right text-gray-700 uppercase">Total Calculat:</td>
                                <td class="px-4 py-3 text-right text-green-800 text-lg">${totalSum.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    },
