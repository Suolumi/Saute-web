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

export function getToolboxIngredients(locale?: string | null, f: FetchFn = fetch) {
    return apiFetchJson<{ items: ToolboxIngredient[] }>('/toolbox/ingredients', 'GET', undefined, {locale}, undefined, f)
}

export function getToolboxUnits(locale?: string | null, f: FetchFn = fetch) {
    return apiFetchJson<{ items: ToolboxUnit[] }>('/toolbox/units', 'GET', undefined, {locale}, undefined, f)
}
