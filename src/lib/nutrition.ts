import {apiFetchJson} from "$lib/api";
import type {ToolboxUnit} from "$lib/toolbox";

export type NutritionIngredient = {
    id: string
    name: string
    names: Record<string, string>
    kcal_per_100g: number
    protein_g_per_100g: number
    carbs_g_per_100g: number
    fat_g_per_100g: number
    salt_g_per_100g: number
    sugar_g_per_100g: number
    created_at: string
}

// IngredientNutrition is one recipe ingredient's own contribution, at the
// same index as the recipe's `ingredients` array (translation preserves
// positional correspondence, so this zips against either the canonical or a
// locale-displayed ingredient list). matched is false when this line
// contributed nothing to the total (no link, no quantity, no density, or -
// for a recipe_ref line - the referenced recipe itself had nothing
// matched) - its numbers are 0 in that case, not omitted.
export type IngredientNutrition = {
    matched: boolean
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    salt_g: number
    sugar_g: number
}

export type RecipeNutrition = {
    servings: number
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    salt_g: number
    sugar_g: number
    matched_count: number
    total_count: number
    ingredients: IngredientNutrition[]
}

export function getNutritionIngredients() {
    return apiFetchJson<{ items: NutritionIngredient[] }>('/nutrition/ingredients')
}

export type IngredientNutritionLink = {
    id: string
    name: string
    nutrition_id: string
    g_per_100ml?: number
    grams_per_unit?: number
    created_at: string
}

export function getIngredientNutritionLinks() {
    return apiFetchJson<{ items: IngredientNutritionLink[] }>('/nutrition/ingredient-links')
}

export type UnitAlias = {
    id: string
    alias: string
    unit_id: string
    created_at: string
}

export function getUnitAliases() {
    return apiFetchJson<{ items: UnitAlias[] }>('/nutrition/unit-aliases')
}

export function getRecipeNutrition(recipeId: string, servings?: number) {
    return apiFetchJson<RecipeNutrition>(`/recipes/${recipeId}/nutrition`, 'GET', null, servings ? {servings} : null)
}

export type NutritionLinkSuggestionRequest = {
    ingredient_name: string
    // ingredient_unit is the current recipe ingredient's own unit text (may
    // be blank for a bare count) - the backend uses it to decide whether
    // g_per_100ml or grams_per_unit is required for the link to actually
    // resolve (see requiredNutritionField below, which mirrors that same
    // decision client-side). Never itself persisted.
    ingredient_unit?: string
    nutrition_id: string
    g_per_100ml?: number
    grams_per_unit?: number
    unit_alias?: string
    unit_id?: string
    note?: string
}

// requiredNutritionField mirrors the backend's unit-aware requirement
// (Service.validateIngredientUnitRequirement): a weight unit needs neither
// field to resolve to grams, a volume unit needs a density, and a blank or
// unrecognized unit needs a per-unit weight. Only a direct case-insensitive
// match against a unit's own name/symbol is checked here (unlike the
// backend, this doesn't consult unit aliases) - an unmatched unit falls
// back to 'grams_per_unit', the same conservative default the backend uses
// for "blank or unrecognized". The backend remains the authoritative gate
// regardless of what this returns.
export function requiredNutritionField(unitText: string, units: ToolboxUnit[]): 'density' | 'grams_per_unit' | null {
    const text = unitText.trim().toLowerCase()
    if (text) {
        const unit = units.find(u => u.name.toLowerCase() === text || u.symbol.toLowerCase() === text)
        if (unit) return unit.kind === 'weight' ? null : 'density'
    }
    return 'grams_per_unit'
}

export type NutritionSuggestion = {
    id: string
    status: 'pending' | 'approved' | 'rejected'
}

// SubmitNutritionLinkResult mirrors the backend's SubmitNutritionLinkResponse:
// applied is true when the ingredient (and bundled unit alias, if any) had
// no existing link/alias, so it went live immediately (link is set);
// false means it was a correction to something already linked, which
// becomes a pending suggestion instead (suggestion is set) - see
// CLAUDE.md's Nutrition Info entry.
export type SubmitNutritionLinkResult = {
    applied: boolean
    link?: IngredientNutritionLink
    suggestion?: NutritionSuggestion
}

export function submitNutritionLinkSuggestion(body: NutritionLinkSuggestionRequest) {
    return apiFetchJson<SubmitNutritionLinkResult>('/nutrition/ingredient-links', 'POST', body)
}
