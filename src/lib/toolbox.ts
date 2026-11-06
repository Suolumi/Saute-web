import {apiFetchJson} from "$lib/api";

type FetchFn = typeof fetch;

export type ToolboxUnit = {
    id: string
    name: string
    symbol: string
    kind: 'weight' | 'volume'
    to_base: number
    created_at: string
}

export function getToolboxUnits(locale?: string | null, f: FetchFn = fetch) {
    return apiFetchJson<{ items: ToolboxUnit[] }>('/toolbox/units', 'GET', undefined, {locale}, undefined, f)
}
