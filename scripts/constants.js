// scripts/constants.js

export const N8N_UPLOAD_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/d92efbca-eaf1-430e-8748-cc6466c82c6e';
export const COMPETITION_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/db241e9f-fe67-40bf-89ae-d06f13b90d09';
export const TITLE_GENERATION_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/0bc8e16e-2ba8-4c3d-ba66-9eb8898ac0ef';
export const ASIN_UPDATE_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/5f107bd7-cc2b-40b7-8bbf-5e3a48667405';
export const READY_TO_LIST_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/124682e2-5f91-4c0a-adf6-4cedf16c2c19';
export const TRANSLATION_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/43760233-f351-44ea-8966-6f470e063ae7';

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
