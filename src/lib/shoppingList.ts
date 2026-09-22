import {persisted} from 'svelte-persisted-store';
import type {Ingredient} from '$lib/recipes';
import {formatScaledQuantity} from '$lib/recipes';
import {jsonParser} from '$lib/stores';

// One entry per (recipe, ingredient) added to the list. Entries are the
// source of truth; the merged/grouped view shown on the shopping-list page
// (buildShoppingListGroups) is computed from them at render time, so
// removing a recipe or editing its servings just changes entries and the
// merged view recomputes automatically - no separate "merged" state to
// keep in sync.
export type ShoppingListEntry = {
    id: string
    recipeId: string
    recipeTitle: string
    // recipeQuantity is the recipe's own base servings count (Recipe.quantity
    // at add-time) - paired with `servings` below the same way the recipe
    // detail page's servings stepper works (selectedServings / recipe.quantity)
    // to compute this entry's scaling ratio.
    recipeQuantity: number
    // recipePicture is the recipe's first picture filename at add-time (if
    // it has one) - shown as a thumbnail in the "Recipes in this list"
    // panel, same source as RecipeCard's own image.
    recipePicture?: string
    ingredient: Ingredient
    servings: number
    checked: boolean
}

export const shoppingList = persisted<ShoppingListEntry[]>('shoppingList', [], {
    syncTabs: true,
    serializer: jsonParser,
})

export function entryRatio(entry: ShoppingListEntry): number {
    return entry.recipeQuantity > 0 ? entry.servings / entry.recipeQuantity : 1
}

// addRecipeToShoppingList replaces any existing entries for this recipe -
// re-adding a recipe already on the list overwrites its prior entries
// rather than duplicating them. In practice the recipe picker hides
// recipes already on the list, so this mostly matters as a safety net.
export function addRecipeToShoppingList(recipeId: string, recipeTitle: string, recipeQuantity: number, recipePicture: string | undefined, ingredients: Ingredient[]) {
    shoppingList.update(entries => [
        ...entries.filter(e => e.recipeId !== recipeId),
        ...ingredients.map(ingredient => ({
            id: crypto.randomUUID(),
            recipeId,
            recipeTitle,
            recipeQuantity,
            recipePicture,
            ingredient,
            servings: recipeQuantity,
            checked: false,
        })),
    ])
}

export function removeRecipeFromShoppingList(recipeId: string) {
    shoppingList.update(entries => entries.filter(e => e.recipeId !== recipeId))
}

export function setRecipeServings(recipeId: string, servings: number) {
    shoppingList.update(entries => entries.map(e => e.recipeId === recipeId ? {...e, servings} : e))
}

export function setLineChecked(entryIds: string[], checked: boolean) {
    const ids = new Set(entryIds)
    shoppingList.update(entries => entries.map(e => ids.has(e.id) ? {...e, checked} : e))
}

export function clearCheckedFromShoppingList() {
    shoppingList.update(entries => entries.filter(e => !e.checked))
}

export function clearShoppingList() {
    shoppingList.set([])
}

export type ShoppingListRecipeSummary = {
    recipeId: string
    recipeTitle: string
    recipeQuantity: number
    recipePicture?: string
    servings: number
}

// One row per recipe contributing to the list, in the order each was first
// added - backs the "Recipes in this list" panel (servings editing, bulk
// remove).
export function buildRecipeSummaries(entries: ShoppingListEntry[]): ShoppingListRecipeSummary[] {
    const summaries = new Map<string, ShoppingListRecipeSummary>()
    for (const entry of entries) {
        if (!summaries.has(entry.recipeId))
            summaries.set(entry.recipeId, {
                recipeId: entry.recipeId,
                recipeTitle: entry.recipeTitle,
                recipeQuantity: entry.recipeQuantity,
                recipePicture: entry.recipePicture,
                servings: entry.servings,
            })
    }
    return [...summaries.values()]
}

// capitalizeIngredientHeading normalizes a group heading's casing (shown
// above its sub-lines when an ingredient has more than one unit variant,
// e.g. "Flour" over "2 cups" / "4dl") - first letter uppercase, the rest
// lowercase, regardless of how each contributing recipe typed the name.
export function capitalizeIngredientHeading(name: string): string {
    return name.length === 0 ? name : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

export type ShoppingListSubLine = {
    key: string
    // text is just the quantity+unit portion (e.g. "2 cups"), used when a
    // group has more than one unit variant and renders a shared heading
    // above each sub-line instead.
    text: string
    checked: boolean
    entryIds: string[]
    recipes: { recipeId: string; recipeTitle: string }[]
    isReference: boolean
    referenceId?: string
}

export type ShoppingListGroup = {
    key: string
    // name is the ingredient name - rendered as a heading above subLines
    // when there's more than one unit variant, or next to the single
    // subLine's quantity badge otherwise (see the shopping-list page).
    name: string
    subLines: ShoppingListSubLine[]
}

// formatSubQuantity mirrors the recipe detail page's own scaled-quantity
// formatting (fractions under 1, otherwise a 2-decimal max via
// formatScaledQuantity) - a sub-line's quantity is always a computed sum
// (possibly across recipes and servings ratios), never a single authored
// value, so unlike getIngredientName/getReferenceQuantity it always runs
// through formatScaledQuantity, even when the effective ratio is 1.
function formatSubQuantity(hasQuantity: boolean, quantity: number, unit: string): string {
    if (!hasQuantity)
        return ''
    const formatted = formatScaledQuantity(quantity)
    return unit ? `${formatted} ${unit}` : formatted
}

function groupKey(entry: ShoppingListEntry): string {
    // Reference ingredients are never merged with anything, even each
    // other - their blank `name` would otherwise collide across unrelated
    // references. Keying by entry id keeps every reference its own group.
    if (entry.ingredient.recipe_ref)
        return `ref:${entry.id}`
    return `name:${entry.ingredient.name.trim().toLowerCase()}`
}

// buildShoppingListGroups merges entries with the exact same ingredient
// name+unit (case-insensitive) into one summed line - "2 cups flour" from
// two recipes becomes one "4 cups flour" line. Same name, different unit
// is not converted/summed (true unit conversion is out of scope); instead
// it's grouped under one heading, e.g. "Flour" with "2 cups" / "4dl" listed
// beneath. Groups are ordered by when the ingredient was first added.
export function buildShoppingListGroups(entries: ShoppingListEntry[]): ShoppingListGroup[] {
    const firstSeenAt = new Map<string, number>()
    entries.forEach((entry, index) => {
        const key = groupKey(entry)
        if (!firstSeenAt.has(key))
            firstSeenAt.set(key, index)
    })

    type BuildingSubLine = {
        key: string
        quantity: number
        hasQuantity: boolean
        unit: string
        checked: boolean
        entryIds: string[]
        recipes: { recipeId: string; recipeTitle: string }[]
        isReference: boolean
        referenceId?: string
    }
    type BuildingGroup = { name: string; subLines: Map<string, BuildingSubLine> }

    const groups = new Map<string, BuildingGroup>()

    for (const entry of entries) {
        const isReference = !!entry.ingredient.recipe_ref
        const key = groupKey(entry)
        let group = groups.get(key)
        if (!group) {
            group = {
                name: isReference
                    ? (entry.ingredient.ref_label || entry.ingredient.resolved_ref_title || '')
                    : entry.ingredient.name.trim(),
                subLines: new Map(),
            }
            groups.set(key, group)
        }

        const unitKey = isReference ? entry.id : (entry.ingredient.unit || '').trim().toLowerCase()
        let sub = group.subLines.get(unitKey)
        if (!sub) {
            sub = {
                key: unitKey,
                quantity: 0,
                hasQuantity: false,
                unit: entry.ingredient.unit,
                checked: true,
                entryIds: [],
                recipes: [],
                isReference,
                referenceId: isReference ? entry.ingredient.recipe_ref : undefined,
            }
            group.subLines.set(unitKey, sub)
        }

        if (entry.ingredient.quantity && entry.ingredient.quantity > 0) {
            sub.quantity += entry.ingredient.quantity * entryRatio(entry)
            sub.hasQuantity = true
        }
        sub.checked = sub.checked && entry.checked
        sub.entryIds.push(entry.id)
        if (!sub.recipes.some(r => r.recipeId === entry.recipeId))
            sub.recipes.push({recipeId: entry.recipeId, recipeTitle: entry.recipeTitle})
    }

    return [...groups.entries()]
        .sort(([a], [b]) => (firstSeenAt.get(a) ?? 0) - (firstSeenAt.get(b) ?? 0))
        .map(([key, group]) => ({
            key,
            name: group.name,
            subLines: [...group.subLines.values()].map(sub => ({
                key: sub.key,
                text: formatSubQuantity(sub.hasQuantity, sub.quantity, sub.unit),
                checked: sub.checked,
                entryIds: sub.entryIds,
                recipes: sub.recipes,
                isReference: sub.isReference,
                referenceId: sub.referenceId,
            })),
        }))
}
