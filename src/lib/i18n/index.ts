import { browser } from '$app/environment'
import { init, register } from 'svelte-i18n'

const defaultLocale = 'en'

export const locales = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'fi', label: 'Suomi', flag: '🇫🇮' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
];

locales.forEach(locale => {
    register(locale.code, () => import(`./locales/${locale.code}.json`))
})

// Function to get locale from URL
function getLocaleFromUrl(): string {
    if (!browser) return defaultLocale
    
    const pathSegments = window.location.pathname.split('/')
    const potentialLocale = pathSegments[1] // First segment after root
    
    // Check if it's a supported locale
    if (locales.map(e => e.code).includes(potentialLocale)) {
        return potentialLocale
    }
    
    return defaultLocale
}

init({
    fallbackLocale: defaultLocale,
    initialLocale: getLocaleFromUrl(),
})
