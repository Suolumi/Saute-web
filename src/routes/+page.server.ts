import { redirect } from '@sveltejs/kit'
import { locales } from '$lib/i18n'
import type { PageServerLoad } from './$types'

const supported = locales.map(l => l.code)

function preferredLocale(acceptLanguage: string | null): string {
    for (const part of (acceptLanguage ?? '').split(',')) {
        const primary = part.split(';')[0].trim().split('-')[0].toLowerCase()
        if (supported.includes(primary)) return primary
    }
    return 'en'
}

export const load: PageServerLoad = ({ request, url }) => {
    redirect(307, `/${preferredLocale(request.headers.get('accept-language'))}/home${url.search}`)
}
