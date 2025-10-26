// scripts/data.js

// --- CONFIGURARE WEBHOOKS ---
// ...

// Noul cache in-memorie pentru detalii produse
const productCache = {};
const DATA_FETCH_URL = 'https://automatizare.comandat.ro/webhook/5a447557-8d52-463e-8a26-5902ccee8177';
const PRODUCT_DETAILS_URL = 'https://automatizare.comandat.ro/webhook/39e78a55-36c9-4948-aa2d-d9301c996562';
const PRODUCT_UPDATE_URL = 'https://automatizare.comandat.ro/webhook/eecb8515-6092-47b0-af12-f10fb23407fa';

// --- MANAGEMENT STARE APLICAȚIE ---
export const AppState = {
    getCommands: () => JSON.parse(sessionStorage.getItem('liveCommandsData') || '[]'),
    setCommands: (commands) => sessionStorage.setItem('liveCommandsData', JSON.stringify(commands)),

    // --- Modificat ---
    // Citește din cache-ul in-memorie
    getProductDetails: (asin) => productCache[asin] || null,

    // --- Modificat ---
    // Scrie în cache-ul in-memorie, nu în sessionStorage
    setProductDetails: (asin, data) => {
        productCache[asin] = data;
    },
};

function processServerData(data) {
    if (!data) return [];
    return Object.keys(data).map(commandId => ({
        id: commandId,
        name: `Comanda #${commandId.substring(0, 12)}`,
        products: (data[commandId] || []).map(p => ({
            id: p.productsku,
            asin: p.asin,
            expected: p.orderedquantity || 0,
            found: (p.bncondition || 0) + (p.vgcondition || 0) + (p.gcondition || 0) + (p.broken || 0),
            manifestsku: p.manifestsku || null,
            listingReady: p.listingReady || false // <-- MODIFICARE: Am adăugat listingReady
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
        AppState.setCommands(processServerData(responseData.data));
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
        const bulkData = responseData?.get_product_details_dynamically?.products || {};
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

// --- MODIFICAT: Funcția saveProductDetails ---
export async function saveProductDetails(asin, updatedData) {

    // --- MODIFICARE: Funcția de "escapare" ---
    function makeQueryFriendly(str) {
        // Înlocuiește fiecare apostrof cu un spațiu
        // Verifică dacă str este null sau undefined înainte de a apela replace
        return str ? str.replace(/'/g, " ") : str;
    }

    // Creăm o copie profundă pentru a nu modifica obiectul original din state/cache
    const processedData = JSON.parse(JSON.stringify(updatedData));

    // --- ÎNCEPUTUL REZOLVĂRII PENTRU EROAREA 'non-object' (ADĂUGAT) ---
    
    // 1. Verifică și corectează câmpul 'features' de la rădăcină (pentru 'origin')
    // Dacă 'features' este null, undefined, sau orice altceva ce nu e un obiect,
    // îl setăm ca un obiect gol '{}'.
    if (!processedData.features || typeof processedData.features !== 'object') {
        processedData.features = {};
    }

    // 2. Verifică și corectează câmpul 'features' pentru fiecare traducere din 'other_versions'
    if (processedData.other_versions) {
        for (const langCode in processedData.other_versions) {
            const version = processedData.other_versions[langCode];
            
            // Asigură-te că versiunea în sine este un obiect valid
            if (version && typeof version === 'object') {
                // Dacă 'features' lipsește, este null sau nu este un obiect, îl setăm ca '{}'
                if (!version.features || typeof version.features !== 'object') {
                    version.features = {};
                }
            }
        }
    }
    // --- SFÂRȘITUL REZOLVĂRII ---


    // Procesează titlul și descrierea principală (dacă există)
    if (processedData.title) {
        processedData.title = makeQueryFriendly(processedData.title);
    }
    if (processedData.description) {
        processedData.description = makeQueryFriendly(processedData.description);
    }

    // Procesează titlurile și descrierile din other_versions (dacă există)
    if (processedData.other_versions) {
        for (const langCode in processedData.other_versions) {
            const version = processedData.other_versions[langCode];
            // Verificăm dacă 'version' există înainte de a accesa proprietățile
            if (version && version.title) {
                version.title = makeQueryFriendly(version.title);
            }
            if (version && version.description) {
                version.description = makeQueryFriendly(version.description);
            }
        }
    }
    // --- SFÂRȘIT MODIFICARE ---

    // Trimitem datele procesate
    const payload = {
        asin,
        updatedData: processedData // Folosim datele procesate și corectate
    };

    try {
        const response = await fetch(PRODUCT_UPDATE_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            console.error(`Salvarea a eșuat:`, await response.text());
            return false;
        }

        // Salvăm în cache datele ORIGINALE, ne-modificate
        AppState.setProductDetails(asin, updatedData);

        return true;
    } catch (error) {
        console.error('Eroare de rețea la salvare:', error);
        return false;
    }
}
// --- SFÂRȘITUL FUNCȚIEI saveProductDetails ---
