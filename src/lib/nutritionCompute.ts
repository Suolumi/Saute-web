import type {Ingredient} from "$lib/recipes";
import {getToolboxUnits, type ToolboxUnit} from "$lib/toolbox";
import {
    getIngredientNutritionLinks, getUnitAliases,
    type IngredientNutrition, type IngredientNutritionLink, type RecipeNutrition, type UnitAlias
} from "$lib/nutrition";
import {foodMatcher, getFoods, type Food} from "$lib/foods";

// Client-side port of Saute-api's GetRecipeNutrition/computeRecipeNutrition
// (internal/recipe_service/nutrition.go), used by the edit page's live
// preview so an unsaved draft gets the same numbers the published recipe
// will. Keep the arithmetic order identical to the Go code: both are held to
// the same expected values by src/lib/testdata/nutrition_cases.json.

export type NutritionReferenceData = {
    units: {id: string, name: string, symbol: string, kind: string, to_base: number}[]
    unit_aliases: {alias: string, unit_id: string}[]
    links: Pick<IngredientNutritionLink, 'id' | 'name' | 'food_id' | 'g_per_100ml' | 'grams_per_unit'>[]
    foods: Food[]
}

// LoadedNutritionReferenceData is NutritionReferenceData as the API returns it.
export type LoadedNutritionReferenceData = {
    units: ToolboxUnit[]
    unit_aliases: UnitAlias[]
    links: IngredientNutritionLink[]
    foods: Food[]
}

type NutritionIngredientInput = Pick<Ingredient, 'name' | 'quantity' | 'unit' | 'recipe_ref'>

type Unit = NutritionReferenceData['units'][number]

// loadNutritionReferenceData fetches every public list the computation
// needs. Resolves to null if any request fails.
export async function loadNutritionReferenceData(): Promise<LoadedNutritionReferenceData | null> {
    let results
    try {
        results = await Promise.all([getToolboxUnits(), getUnitAliases(), getIngredientNutritionLinks(), getFoods()])
    } catch {
        return null
    }
    const [units, aliases, links, foods] = results
    if (!units.response.ok || !aliases.response.ok || !links.response.ok || !foods.response.ok)
        return null
    if (!units.data || !aliases.data || !links.data || !foods.data)
        return null
    return {units: units.data.items, unit_aliases: aliases.data.items, links: links.data.items, foods: foods.data.items}
}

// withLink returns data with link added, replacing any link with the same id.
export function withLink<T extends NutritionReferenceData>(data: T, link: T['links'][number]): T {
    const index = data.links.findIndex(l => l.id === link.id)
    const links = index === -1 ? [...data.links, link] : data.links.map((l, i) => i === index ? link : l)
    return {...data, links}
}

type Totals = {kcal: number, protein: number, carbs: number, fat: number, salt: number, sugar: number}

const zeroTotals: Totals = {kcal: 0, protein: 0, carbs: 0, fat: 0, salt: 0, sugar: 0}

function round1(v: number): number {
    return Math.round(v * 10) / 10
}

function scaleRound1(t: Totals, factor: number): Totals {
    return {
        kcal: round1(t.kcal * factor), protein: round1(t.protein * factor), carbs: round1(t.carbs * factor),
        fat: round1(t.fat * factor), salt: round1(t.salt * factor), sugar: round1(t.sugar * factor),
    }
}

function firstByKey<T>(items: T[], key: (item: T) => string): Map<string, T> {
    const map = new Map<string, T>()
    for (const item of items) {
        const k = key(item)
        if (!map.has(k)) map.set(k, item)
    }
    return map
}

// computeRecipeNutrition mirrors GetRecipeNutrition for an in-memory
// ingredient list written in locale: totals for `servings` (<= 0 means
// baseQuantity), with one line per ingredient at the same index.
export function computeRecipeNutrition(
    ingredients: NutritionIngredientInput[],
    baseQuantity: number,
    servings: number,
    data: NutritionReferenceData,
    locale?: string | null,
): RecipeNutrition {
    if (servings <= 0) servings = baseQuantity
    let ratio = 1
    if (baseQuantity > 0) ratio = servings / baseQuantity

    const foods = foodMatcher(data.foods, data.links, locale)
    const aliasesByLower = firstByKey(data.unit_aliases, a => a.alias.toLowerCase())

    function resolveUnit(text: string): Unit | null {
        const q = text.toLowerCase()
        const direct = data.units.find(u => u.name.toLowerCase() === q || u.symbol.toLowerCase() === q)
        if (direct) return direct
        const alias = aliasesByLower.get(q)
        if (!alias) return null
        return data.units.find(u => u.id === alias.unit_id) ?? null
    }

    function resolveGrams(ingredient: NutritionIngredientInput, gPer100ml: number | null, gramsPerPiece: number | null): number | null {
        if (!(ingredient.quantity > 0)) return null
        const unitText = (ingredient.unit ?? '').trim()
        if (unitText !== '') {
            const unit = resolveUnit(unitText)
            if (unit) {
                if (unit.kind === 'weight') return ingredient.quantity * unit.to_base
                if (gPer100ml === null) return null
                return ingredient.quantity * unit.to_base * gPer100ml / 100
            }
        }
        if (gramsPerPiece !== null)
            return ingredient.quantity * gramsPerPiece
        return null
    }

    let totals = zeroTotals
    let matched = 0
    const lines: Totals[] = ingredients.map(() => zeroTotals)
    const matchedLines: boolean[] = ingredients.map(() => false)

    ingredients.forEach((ingredient, i) => {
        if (ingredient.recipe_ref || (ingredient.name ?? '').trim() === '') return
        const match = foods.match(ingredient.name)
        if (!match) return
        const grams = resolveGrams(ingredient, match.g_per_100ml, match.grams_per_piece)
        if (grams === null) return
        const food = match.food
        matched++
        const factor = grams / 100
        const line: Totals = {
            kcal: factor * food.kcal_per_100g, protein: factor * food.protein_g_per_100g,
            carbs: factor * food.carbs_g_per_100g, fat: factor * food.fat_g_per_100g,
            salt: factor * food.salt_g_per_100g, sugar: factor * food.sugar_g_per_100g,
        }
        lines[i] = line
        matchedLines[i] = true
        totals = {
            kcal: totals.kcal + line.kcal, protein: totals.protein + line.protein,
            carbs: totals.carbs + line.carbs, fat: totals.fat + line.fat,
            salt: totals.salt + line.salt, sugar: totals.sugar + line.sugar,
        }
    })

    const scaledLines: IngredientNutrition[] = lines.map((line, i) => {
        const scaled = scaleRound1(line, ratio)
        return {
            matched: matchedLines[i], kcal: scaled.kcal, protein_g: scaled.protein, carbs_g: scaled.carbs,
            fat_g: scaled.fat, salt_g: scaled.salt, sugar_g: scaled.sugar,
        }
    })
    const scaledTotals = scaleRound1(totals, ratio)

    return {
        servings, kcal: scaledTotals.kcal, protein_g: scaledTotals.protein, carbs_g: scaledTotals.carbs,
        fat_g: scaledTotals.fat, salt_g: scaledTotals.salt, sugar_g: scaledTotals.sugar,
        matched_count: matched, total_count: ingredients.length, ingredients: scaledLines,
    }
}
