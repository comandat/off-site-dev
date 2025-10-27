// scripts/lightbox.js
import { getCurrentImagesArray } from './product-details.js';

function openLightbox(imgElement) {
    const mainImageSrc = imgElement ? imgElement.src : null;
    if (!mainImageSrc) return;
    
    const lightbox = document.getElementById('image-lightbox');
    const mainImageEl = document.getElementById('lightbox-main-image');
    const thumbsContainer = document.getElementById('lightbox-thumbs-container');
    const copyBtn = document.getElementById('lightbox-copy-btn');
    const copyText = document.getElementById('lightbox-copy-text');
    
    copyText.textContent = 'Copiază Link';
    mainImageEl.src = mainImageSrc;
    copyBtn.dataset.src = mainImageSrc;
    
    const currentImages = [...new Set(getCurrentImagesArray() || [])];
    let thumbsHTML = '';
    currentImages.forEach(img => {
        const isSelected = img === mainImageSrc;
        thumbsHTML += `<img data-action="select-lightbox-thumbnail" data-src="${img}" src="${img}" class="w-full h-16 object-cover rounded-md cursor-pointer lightbox-thumbnail border-2 ${isSelected ? 'border-blue-600' : 'border-gray-500'}">`;
    });
    
    thumbsContainer.innerHTML = thumbsHTML;
    lightbox.classList.remove('hidden');
}

function closeLightbox() {
    document.getElementById('image-lightbox').classList.add('hidden');
}

function selectLightboxThumbnail(thumbnail) {
    const src = thumbnail.dataset.src;
    if (!src) return;
    
    document.getElementById('lightbox-main-image').src = src;
    document.getElementById('lightbox-copy-btn').dataset.src = src;
    document.getElementById('lightbox-copy-text').textContent = 'Copiază Link';
    
    document.querySelectorAll('.lightbox-thumbnail').forEach(thumb => {
        thumb.classList.toggle('border-blue-600', thumb.dataset.src === src);
        thumb.classList.toggle('border-gray-500', thumb.dataset.src !== src);
    });
}

function copyLightboxLink(copyButton) {
    const src = copyButton.dataset.src;
    navigator.clipboard.writeText(src).then(() => {
        document.getElementById('lightbox-copy-text').textContent = 'Copiat!';
    }, () => {
        alert('Eroare la copiere link.');
    });
}

export function initGlobalListeners() {
    document.addEventListener('click', (event) => {
        const target = event.target;
        const actionButton = target.closest('[data-action]');
        const lightboxThumbnail = target.closest('[data-action="select-lightbox-thumbnail"]');
        
        // --- GESTIONARE DROPDOWN ---
        const dropdownToggle = target.closest('.dropdown-toggle');
        if (dropdownToggle) {
            const dropdownMenu = dropdownToggle.nextElementSibling;
            const allMenus = document.querySelectorAll('.dropdown-menu');
            allMenus.forEach(menu => { if (menu !== dropdownMenu) { menu.classList.add('hidden'); } });
            dropdownMenu.classList.toggle('hidden');
        } else if (!target.closest('.dropdown')) {
             if (!target.closest('.dropdown-menu a')) { // Nu închide dacă se dă click pe linkul din meniu
               document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
            }
        }
        
        // --- GESTIONARE LIGHTBOX ---
        if (lightboxThumbnail) {
            selectLightboxThumbnail(lightboxThumbnail);
            return;
        }

        if (actionButton) {
            const action = actionButton.dataset.action;
            if (action === 'open-lightbox') {
                const imgElement = actionButton.tagName === 'IMG' ? actionButton : actionButton.querySelector('img');
                openLightbox(imgElement);
            }
            if (action === 'close-lightbox') {
                closeLightbox();
            }
            if (action === 'copy-lightbox-link') {
                copyLightboxLink(actionButton);
            }
        }
    }, true);
}
