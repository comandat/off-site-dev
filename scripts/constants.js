const BASE = 'https://automatizare.comandat.ro/webhook';

export const N8N_UPLOAD_WEBHOOK_URL = `${BASE}/d92efbca-eaf1-430e-8748-cc6466c82c6e`;
export const COMPETITION_WEBHOOK_URL = `${BASE}/v2-competition`;
export const TITLE_GENERATION_WEBHOOK_URL = `${BASE}/v2-ai-title`;
export const ASIN_UPDATE_WEBHOOK_URL = `${BASE}/v2-register-product`;
export const READY_TO_LIST_WEBHOOK_URL = `${BASE}/124682e2-5f91-4c0a-adf6-4cedf16c2c19`;
export const TRANSLATION_WEBHOOK_URL = `${BASE}/v2-multilang-generate`;
export const DESCRIPTION_GENERATION_WEBHOOK_URL = `${BASE}/v2-remake-description`;
export const IMAGE_TRANSLATION_WEBHOOK_URL = `${BASE}/v2-image-translation`;

export const GET_FINANCIAL_WEBHOOK_URL = `${BASE}/get-financial`;
export const SAVE_FINANCIAL_WEBHOOK_URL = `${BASE}/save-financial`;
export const GENERATE_NIR_WEBHOOK_URL = `${BASE}/generate-nir`;
export const GET_PALLETS_WEBHOOK_URL = `${BASE}/get-pallets`;
export const INSERT_BALANCE_WEBHOOK_URL = `${BASE}/insert-balanta`;

export const languages = {
    'bg': 'Bulgarian', 'de': 'German', 'ro': 'Romanian', 'hu': 'Hungarian',
    'el': 'Greek', 'sq': 'Albanian', 'be': 'Belarusian', 'bs': 'Bosnian',
    'ca': 'Catalan', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish',
    'nl': 'Dutch', 'en': 'English', 'et': 'Estonian', 'fi': 'Finnish',
    'fr': 'French', 'ga': 'Irish', 'it': 'Italian', 'lv': 'Latvian',
    'lt': 'Lithuanian', 'lb': 'Luxembourgish', 'mk': 'Macedonian', 'mt': 'Maltese',
    'mo': 'Moldovan', 'no': 'Norwegian', 'pl': 'Polish', 'pt': 'Portuguese',
    'ru': 'Russian', 'sr': 'Serbian', 'sk': 'Slovak', 'sl': 'Slovenian',
    'es': 'Spanish', 'sv': 'Swedish', 'tr': 'Turkish', 'uk': 'Ukrainian', 'cy': 'Welsh'
};

export const languageNameToCodeMap = Object.entries(languages).reduce((acc, [code, name]) => {
    acc[name.toLowerCase()] = code.toUpperCase();
    return acc;
}, {});
