import {RecipeTypes, TIME_PRESETS, type TimePreset} from "$lib/recipes";

// The home and DIY listing filters, persisted per browser (homeFilters and
// diyFilters in stores.ts). The search term is left out on purpose.
export interface RecipeListFilters {
    selectedType: string;
    author: string;
    ingredients: string[];
    tags: string[];
    timeBasis: 'prep' | 'total';
    timeTarget: TimePreset;
    popular: boolean;
}

export const defaultRecipeListFilters: RecipeListFilters = {
    selectedType: 'all',
    author: '',
    ingredients: [],
    tags: [],
    timeBasis: 'total',
    timeTarget: 'any',
    popular: false,
}

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(v => typeof v === 'string')

// restoreRecipeListFilters turns a saved value into a full set of filters,
// falling back to the default for any field that is missing or invalid (an
// older save, or a value edited by hand).
export function restoreRecipeListFilters(saved: unknown): RecipeListFilters {
    const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
    const d = defaultRecipeListFilters
    return {
        selectedType: s.selectedType === 'all' || RecipeTypes.includes(s.selectedType as never) ? s.selectedType as string : d.selectedType,
        author: typeof s.author === 'string' ? s.author : d.author,
        ingredients: isStringArray(s.ingredients) ? s.ingredients : [...d.ingredients],
        tags: isStringArray(s.tags) ? s.tags : [...d.tags],
        timeBasis: s.timeBasis === 'prep' || s.timeBasis === 'total' ? s.timeBasis : d.timeBasis,
        timeTarget: TIME_PRESETS.includes(s.timeTarget as never) ? s.timeTarget as TimePreset : d.timeTarget,
        popular: typeof s.popular === 'boolean' ? s.popular : d.popular,
    }
}

// knownTags drops slugs that no longer exist (a tag deleted since the filters
// were saved), which would otherwise match no recipe. An empty map means the
// tags haven't loaded, so nothing is dropped.
export function knownTags(slugs: string[], known: Map<string, unknown>): string[] {
    if (known.size === 0)
        return slugs
    return slugs.filter(slug => known.has(slug))
}
