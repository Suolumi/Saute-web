import type {Food} from "$lib/foods";
import {parsePositiveNumberInput} from "$lib/nutrition";

export const FOOD_LOCALES = ['en', 'fr', 'fi', 'zh'] as const

const NUTRIENTS = ['kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g', 'fat_g_per_100g', 'salt_g_per_100g', 'sugar_g_per_100g'] as const

// AdminFoodRequest is the body of POST /admin/foods and PUT /admin/foods/:id.
export type AdminFoodRequest = Omit<Food, 'aliases' | 'substitutes' | 'grams_per_piece' | 'g_per_100ml'> & {
    aliases: Record<string, string[]>
    substitutes: Record<string, string[]>
    grams_per_piece: number | null
    g_per_100ml: number | null
}

// FoodForm is the admin edit form: aliases as comma-separated text,
// substitutes one per line, and
// numbers as whatever a number input's bind:value holds.
export type FoodForm = {
    id: string
    names: Record<string, string>
    aliases: Record<string, string>
    substitutes: Record<string, string>
    grams_per_piece: number | string
    g_per_100ml: number | string
} & Record<typeof NUTRIENTS[number], number | string>

// parseAliases reads comma-separated aliases, trimmed, without blanks or
// case-insensitive repeats.
export function parseAliases(text: string): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const part of text.split(',')) {
        const alias = part.trim()
        if (alias === '' || seen.has(alias.toLowerCase())) continue
        seen.add(alias.toLowerCase())
        out.push(alias)
    }
    return out
}

export function foodToForm(food?: Food): FoodForm {
    const form = {
        id: food?.id ?? '',
        names: Object.fromEntries(FOOD_LOCALES.map(l => [l, food?.names[l] ?? ''])),
        aliases: Object.fromEntries(FOOD_LOCALES.map(l => [l, (food?.aliases?.[l] ?? []).join(', ')])),
        substitutes: Object.fromEntries(FOOD_LOCALES.map(l => [l, (food?.substitutes?.[l] ?? []).join('\n')])),
        grams_per_piece: food?.grams_per_piece ?? '',
        g_per_100ml: food?.g_per_100ml ?? '',
    } as FoodForm
    for (const n of NUTRIENTS) form[n] = food?.[n] ?? ''
    return form
}

export function formToRequest(form: FoodForm): AdminFoodRequest {
    const req = {
        id: form.id.trim(),
        names: Object.fromEntries(FOOD_LOCALES.map(l => [l, (form.names[l] ?? '').trim()])),
        aliases: Object.fromEntries(FOOD_LOCALES.map(l => [l, parseAliases(form.aliases[l] ?? '')])),
        substitutes: Object.fromEntries(FOOD_LOCALES.map(l => [l, (form.substitutes[l] ?? '').split('\n').map(s => s.trim()).filter(s => s !== '')])),
        grams_per_piece: parsePositiveNumberInput(form.grams_per_piece),
        g_per_100ml: parsePositiveNumberInput(form.g_per_100ml),
    } as AdminFoodRequest
    for (const n of NUTRIENTS) req[n] = parsePositiveNumberInput(form[n]) ?? 0
    return req
}
