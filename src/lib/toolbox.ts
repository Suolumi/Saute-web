import {apiFetchJson} from "$lib/api";

type FetchFn = typeof fetch;

export type ToolboxIngredient = {
    id: string
    name: string
    g_per_100ml: number
    note?: string
    created_at: string
}

export type ToolboxUnit = {
    id: string
    name: string
    symbol: string
    kind: 'weight' | 'volume'
    to_base: number
    created_at: string
}

export type ToolboxSubstitution = {
    id: string
    problem: string
    solution: string
    tag?: string
    created_at: string
}

export type ToolboxSuggestion = {
    id: string
    kind: 'ingredient' | 'unit' | 'substitution'
    status: 'pending' | 'approved' | 'rejected'
}

export function getToolboxIngredients(locale?: string | null, f: FetchFn = fetch) {
    return apiFetchJson<{ items: ToolboxIngredient[] }>('/toolbox/ingredients', 'GET', undefined, {locale}, undefined, f)
}

export function getToolboxUnits(locale?: string | null, f: FetchFn = fetch) {
    return apiFetchJson<{ items: ToolboxUnit[] }>('/toolbox/units', 'GET', undefined, {locale}, undefined, f)
}

export function getToolboxSubstitutions(locale?: string | null, f: FetchFn = fetch) {
    return apiFetchJson<{ items: ToolboxSubstitution[] }>('/toolbox/substitutions', 'GET', undefined, {locale}, undefined, f)
}

export type IngredientSuggestionRequest = {
    name: string
    g_per_100ml: number
    note?: string
}

export function submitIngredientSuggestion(body: IngredientSuggestionRequest) {
    return apiFetchJson<ToolboxSuggestion>('/toolbox/ingredient-suggestions', 'POST', body)
}

export type UnitSuggestionRequest = {
    name: string
    symbol: string
    kind: 'weight' | 'volume'
    to_base: number
    note?: string
}

export function submitUnitSuggestion(body: UnitSuggestionRequest) {
    return apiFetchJson<ToolboxSuggestion>('/toolbox/unit-suggestions', 'POST', body)
}

export type SubstitutionSuggestionRequest = {
    problem: string
    solution: string
    tag?: string
    note?: string
}

export function submitSubstitutionSuggestion(body: SubstitutionSuggestionRequest) {
    return apiFetchJson<ToolboxSuggestion>('/toolbox/substitution-suggestions', 'POST', body)
}

// convertQuantity converts `amount` of fromUnit into toUnit. ingredient's
// density is only used when the two units are different kinds (one weight,
// one volume) - it cancels out of the math for a same-kind conversion, so a
// missing ingredient there doesn't matter and falls back to water-like 100
// (g per 100ml) harmlessly.
export function convertQuantity(amount: number, fromUnit: ToolboxUnit, toUnit: ToolboxUnit, ingredient?: ToolboxIngredient): number {
    const density = ingredient?.g_per_100ml ?? 100
    const fromBase = amount * fromUnit.to_base
    const grams = fromUnit.kind === 'volume' ? fromBase * density / 100 : fromBase
    const toBaseAmount = toUnit.kind === 'volume' ? grams / (density / 100) : grams
    return toBaseAmount / toUnit.to_base
}
