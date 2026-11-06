import {apiFetchJson} from "$lib/api";

// Food is one generic food of the curated list (Saute-api models.FoodItem).
export type Food = {
    id: string
    names: Record<string, string>
    aliases: Record<string, string[]> | null
    grams_per_piece?: number | null
    g_per_100ml?: number | null
    // substitutes are what to use instead, one line each, per locale.
    substitutes?: Record<string, string[]> | null
    kcal_per_100g: number
    protein_g_per_100g: number
    carbs_g_per_100g: number
    fat_g_per_100g: number
    salt_g_per_100g: number
    sugar_g_per_100g: number
}

export function getFoods() {
    return apiFetchJson<{ items: Food[] }>('/foods')
}

// FOOD_LOCALES are the locales every food has a name in, in the order a
// recipe with no usable source locale tries them (models.FoodLocales).
const FOOD_LOCALES = ['en', 'fr', 'fi', 'zh']

// foodName is food's name in locale, else in English, else its id.
export function foodName(food: Food, locale: string | null | undefined): string {
    const base = (locale ?? '').split('-')[0]
    return food.names[base] || food.names.en || food.id
}

// foodSubstitutes is food's substitutes in locale, else in English.
export function foodSubstitutes(food: Food, locale: string | null | undefined): string[] {
    const base = (locale ?? '').split('-')[0]
    const own = food.substitutes?.[base] ?? []
    return own.length > 0 ? own : food.substitutes?.en ?? []
}

// foodKeywords is every name and alias of food, for search.
export function foodKeywords(food: Food): string[] {
    return [...Object.values(food.names), ...Object.values(food.aliases ?? {}).flat()]
}

type FoodLink = {name: string, food_id: string, g_per_100ml?: number | null, grams_per_unit?: number | null}

// IngredientFood is the food an ingredient resolves to, with its link's
// overrides applied over the food's defaults.
export type IngredientFood = {food: Food, g_per_100ml: number | null, grams_per_piece: number | null}

export type FoodMatcher = {
    food: (id: string) => Food | undefined
    match: (name: string) => IngredientFood | null
}

function nameKey(name: string): string {
    return name.trim().toLowerCase()
}

// foodMatcher mirrors Saute-api's matchIngredientFood: an ingredient's link
// first, else a food whose name or alias in locale is the ingredient name.
export function foodMatcher(foods: Food[], links: FoodLink[], locale: string | null | undefined): FoodMatcher {
    const byId = new Map(foods.map(f => [f.id, f]))
    const linksByName = new Map<string, FoodLink>()
    for (const link of links) {
        const key = nameKey(link.name)
        if (!linksByName.has(key)) linksByName.set(key, link)
    }
    const base = (locale ?? '').split('-')[0]
    const locales = FOOD_LOCALES.includes(base) ? [base] : FOOD_LOCALES
    const byName = new Map<string, Food>()
    const add = (name: string | undefined, food: Food) => {
        const key = nameKey(name ?? '')
        if (key !== '' && !byName.has(key)) byName.set(key, food)
    }
    for (const l of locales) {
        for (const food of foods) {
            add(food.names[l], food)
            for (const alias of food.aliases?.[l] ?? []) add(alias, food)
        }
    }
    return {
        food: id => byId.get(id),
        match(name) {
            const link = linksByName.get(nameKey(name))
            if (link) {
                const food = byId.get(link.food_id)
                if (!food) return null
                return {food, g_per_100ml: link.g_per_100ml ?? food.g_per_100ml ?? null, grams_per_piece: link.grams_per_unit ?? food.grams_per_piece ?? null}
            }
            const food = byName.get(nameKey(name))
            return food ? {food, g_per_100ml: food.g_per_100ml ?? null, grams_per_piece: food.grams_per_piece ?? null} : null
        },
    }
}
