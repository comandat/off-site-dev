// scripts/data.js
import { GET_FINANCIAL_WEBHOOK_URL } from './constants.js';

// --- CONFIGURARE WEBHOOKS ---
const DATA_FETCH_URL = 'https://automatizare.comandat.ro/webhook/5a447557-8d52-463e-8a26-5902ccee8177';
const PRODUCT_DETAILS_URL = 'https://automatizare.comandat.ro/webhook/39e78a55-36c9-4948-aa2d-d9301c996562-test';
const PRODUCT_UPDATE_URL = 'https://automatizare.comandat.ro/webhook/eecb8515-6092-47b0-af12-f10fb23407fa';

// Cache in-memorie pentru detalii produse
const productCache = {};

// --- MANAGEMENT STARE APLICAȚIE ---
export const AppState = {
    getCommands: () => JSON.parse(sessionStorage.getItem('liveCommandsData') || '[]'),
    setCommands: (commands) => sessionStorage.setItem('liveCommandsData', JSON.stringify(commands)),

    getProductDetails: (asin) => productCache[asin] || null,
    setProductDetails: (asin, data) => {
        productCache[asin] = data;
    },
    clearProductCache: (asin) => {
        if (asin && productCache[asin]) {
            delete productCache[asin];
            console.log(`Cache invalidat pentru ASIN: ${asin}`);
        }
    },

    getFinancialData: () => JSON.parse(sessionStorage.getItem('financialData') || '[]'),
    setFinancialData: (data) => sessionStorage.setItem('financialData', JSON.stringify(data)),
};

function processServerData(data) {
    if (!data) return [];
    return Object.keys(data).map(commandId => ({
        id: commandId,
        name: `Comanda #${commandId.substring(0, 12)}`,
        products: (data[commandId] || []).map(p => ({
            id: p.productsku,
            uniqueId: `${p.productsku}::${p.manifestsku || 'N/A'}`,
            asin: p.asin,
            expected: p.orderedquantity || 0,
            found: (p.bncondition || 0) + (p.vgcondition || 0) + (p.gcondition || 0) + (p.broken || 0),
            manifestsku: p.manifestsku || null,
            listingReady: p.listingready || false,
            bncondition: p.bncondition || 0,
            vgcondition: p.vgcondition || 0,
            gcondition: p.gcondition || 0,
            broken: p.broken || 0,
            stockcode: p.stockcode, 
            unitweight: p.unitweight,
            estimatedsalevaluewithvat: p.estimatedsalevaluewithvat,
            verificationready: p.verificationready
        }))
    }));
}

export async function fetchDataAndSyncState() {
    const accessCode = sessionStorage.getItem('lastAccessCode');
    if (!accessCode) return false;
    try {
        const response = await fetch(DATA_FETCH_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ code: accessCode }), cache: 'no-store' });
        if (!response.ok) throw new Error(`Eroare de rețea: ${response.status}`);
        
        const responseData = await response.json();
        if (responseData.status !== 'success' || !responseData.data) throw new Error('Răspuns invalid de la server');
        
        const processedData = processServerData(responseData.data);
        AppState.setCommands(processedData);
        return true;
    } catch (error) { console.error('Sincronizarea datelor a eșuat:', error); return false; }
}

export async function fetchProductDetailsInBulk(asins) {
    const results = {}, asinsToFetch = [];
    asins.forEach(asin => { const cachedData = AppState.getProductDetails(asin); if (cachedData) results[asin] = cachedData; else asinsToFetch.push(asin); });
    if (asinsToFetch.length === 0) return results;
    try {
        const response = await fetch(PRODUCT_DETAILS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asins: asinsToFetch }) });
        if (!response.ok) throw new Error(`Eroare la preluarea detaliilor`);
        const responseData = await response.json();
        const bulkData = responseData?.get_product_details_dynamically_test?.products || {};
        asinsToFetch.forEach(asin => {
            const productData = bulkData[asin] || { title: 'N/A', images: [], description: '', features: {}, brand: '', price: '', category: '', categoryId: null, other_versions: {} };
            AppState.setProductDetails(asin, productData);
            results[asin] = productData;
        });
    } catch (error) {
        console.error('Eroare la preluarea detaliilor produselor:', error);
        asinsToFetch.forEach(asin => { results[asin] = { title: 'Eroare', images: [], description: '', features: {}, brand: '', price: '', category: '', categoryId: null, other_versions: {} }; });
    }
    return results;
}

export async function saveProductDetails(asin, updatedData) {
    function makeQueryFriendly(str) { return str ? str.replace(/'/g, " ") : str; }
    const processedData = JSON.parse(JSON.stringify(updatedData));
    if (!processedData.features || typeof processedData.features !== 'object') processedData.features = {};
    if (processedData.other_versions) {
        for (const langCode in processedData.other_versions) {
            const version = processedData.other_versions[langCode];
            if (version && typeof version === 'object') {
                if (!version.features || typeof version.features !== 'object') version.features = {};
            }
        }
    }
    if (processedData.title) processedData.title = makeQueryFriendly(processedData.title);
    if (processedData.description) processedData.description = makeQueryFriendly(processedData.description);
    if (processedData.other_versions) {
        for (const langCode in processedData.other_versions) {
            const version = processedData.other_versions[langCode];
            if (version && version.title) version.title = makeQueryFriendly(version.title);
            if (version && version.description) version.description = makeQueryFriendly(version.description);
        }
    }
    const payload = { asin, updatedData: processedData };
    try {
        const response = await fetch(PRODUCT_UPDATE_URL, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!response.ok) { console.error(`Salvarea a eșuat:`, await response.text()); return false; }
        AppState.setProductDetails(asin, updatedData);
        return true;
    } catch (error) { console.error('Eroare de rețea la salvare:', error); return false; }
}

export async function fetchFinancialData() {
    try {
        const response = await fetch(GET_FINANCIAL_WEBHOOK_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);

        const data = await response.json();
        
        // --- CORECTIE PENTRU OBIECT UNIC vs ARRAY ---
        if (Array.isArray(data)) {
            AppState.setFinancialData(data);
            return true;
        } else if (data && typeof data === 'object' && (data.orderid || Object.keys(data).length > 0)) {
            console.warn("API-ul a returnat un singur obiect. Îl convertim în listă.");
            AppState.setFinancialData([data]);
            return true;
        } else {
            console.error("Format date financiare invalid:", data);
            return false;
        }
    } catch (error) {
        console.error('Eroare la preluarea datelor financiare:', error);
        return false;
    }
}
