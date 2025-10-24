document.addEventListener('DOMContentLoaded', () => {

    // --- ADAUGĂ ACEASTĂ VERIFICARE LA ÎNCEPUT ---
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html'; // Trimite la login dacă nu e autentificat
        return; 
    }
    // --- SFÂRȘITUL VERIFICĂRII ---

    // --- CONSTANTE ȘI SELECTORI GENERALI ---
    const N8N_UPLOAD_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/d92efbca-eaf1-430e-8748-cc6466c82c6e'; // URL pt upload
    // ... restul codului tău ...
});
