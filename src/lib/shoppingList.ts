import {persisted} from 'svelte-persisted-store';
import type {Ingredient} from '$lib/recipes';
import {getIngredientName, getReferenceQuantity} from '$lib/recipes';
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
export function addRecipeToShoppingList(recipeId: string, recipeTitle: string, recipeQuantity: number, ingredients: Ingredient[]) {
    shoppingList.update(entries => [
        ...entries.filter(e => e.recipeId !== recipeId),
        ...ingredients.map(ingredient => ({
            id: crypto.randomUUID(),
            recipeId,
            recipeTitle,
            recipeQuantity,
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
                servings: entry.servings,
            })
    }
    return [...summaries.values()]
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
    // name is the heading text, only shown when subLines.length > 1.
    name: string
    // singleLineText is the fully-formatted single line ("2 cups flour"),
    // set only when there's exactly one non-reference unit variant for this
    // ingredient - avoids a redundant heading + one sub-line for the common
    // case. null for reference ingredients (rendered with a recipe link
    // instead) or when multiple unit variants exist (rendered as a heading).
    singleLineText: string | null
    subLines: ShoppingListSubLine[]
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
        referenceIngredient?: Ingredient
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
                referenceIngredient: isReference ? entry.ingredient : undefined,
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
        .map(([key, group]) => {
            const rawSubLines = [...group.subLines.values()]
            const subLines: ShoppingListSubLine[] = rawSubLines.map(sub => ({
                key: sub.key,
                text: sub.isReference
                    ? getReferenceQuantity({...sub.referenceIngredient!, quantity: sub.hasQuantity ? sub.quantity : 0}, 1)
                    : getReferenceQuantity({name: '', label: '', unit: sub.unit, quantity: sub.hasQuantity ? sub.quantity : 0}, 1),
                checked: sub.checked,
                entryIds: sub.entryIds,
                recipes: sub.recipes,
                isReference: sub.isReference,
                referenceId: sub.referenceId,
            }))
            const single = rawSubLines.length === 1 ? rawSubLines[0] : null
            return {
                key,
                name: group.name,
                singleLineText: single && !single.isReference
                    ? getIngredientName({name: group.name, label: '', unit: single.unit, quantity: single.hasQuantity ? single.quantity : 0}, 1)
                    : null,
                subLines,
            }
        })
}
