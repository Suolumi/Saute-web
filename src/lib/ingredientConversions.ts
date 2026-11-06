import {formatScaledQuantity, type Ingredient} from "$lib/recipes";
import {getToolboxUnits, type ToolboxUnit} from "$lib/toolbox";
import {getIngredientNutritionLinks, getUnitAliases, type IngredientNutritionLink, type UnitAlias} from "$lib/nutrition";
import {foodMatcher, getFoods, type Food, type FoodMatcher} from "$lib/foods";

// ConversionData is what ingredientConversions needs; locale is the
// recipe's source locale, the language its canonical ingredient names are in.
export type ConversionData = {
    units: ToolboxUnit[]
    foods: Food[]
    unit_aliases: UnitAlias[]
    links: Pick<IngredientNutritionLink, 'name' | 'food_id' | 'g_per_100ml' | 'grams_per_unit'>[]
    locale: string | null
}

export type Conversion = {amount: number, unit: ToolboxUnit}

const KITCHEN_UNITS = ['cup', 'tbsp', 'tsp']

// loadConversionData fetches the lists ingredientConversions needs. Resolves
// to null if any request fails.
export async function loadConversionData(sourceLocale?: string | null): Promise<ConversionData | null> {
    let results
    try {
        results = await Promise.all([getToolboxUnits(), getFoods(), getUnitAliases(), getIngredientNutritionLinks()])
    } catch {
        return null
    }
    const [units, foods, aliases, links] = results
    if (!units.data || !foods.data || !aliases.data || !links.data)
        return null
    if (!units.response.ok || !foods.response.ok || !aliases.response.ok || !links.response.ok)
        return null
    return {
        units: units.data.items,
        foods: foods.data.items,
        unit_aliases: aliases.data.items,
        links: links.data.items,
        locale: sourceLocale ?? null,
    }
}

// One matcher per loaded data set: a recipe page asks once per ingredient.
const matchers = new WeakMap<ConversionData, FoodMatcher>()

function matcherFor(data: ConversionData): FoodMatcher {
    let matcher = matchers.get(data)
    if (!matcher) {
        matcher = foodMatcher(data.foods, data.links, data.locale)
        matchers.set(data, matcher)
    }
    return matcher
}

// ingredientConversions expresses quantity of unitText in grams, ml and one
// kitchen unit, crossing between weight and volume only when name matches a
// food with a density. Units and foods are resolved like nutrition does.
export function ingredientConversions(quantity: number, unitText: string, name: string, data: ConversionData): Conversion[] {
    const text = unitText.trim().toLowerCase()
    if (!(quantity > 0) || text === '')
        return []
    const source = resolveUnit(text, data)
    if (!source)
        return []

    const density = matcherFor(data).match(name)?.g_per_100ml

    const base = quantity * source.to_base
    const grams = source.kind === 'weight' ? base : density ? base * density / 100 : null
    const ml = source.kind === 'volume' ? base : density && grams !== null ? grams * 100 / density : null

    const bySymbol = (symbol: string) => data.units.find(u => u.symbol.toLowerCase() === symbol)
    const sourceSymbol = source.symbol.toLowerCase()
    const out: Conversion[] = []
    const g = bySymbol('g')
    if (grams !== null && g && sourceSymbol !== 'g')
        out.push({amount: grams, unit: g})
    const millilitre = bySymbol('ml')
    if (ml !== null && millilitre && sourceSymbol !== 'ml')
        out.push({amount: ml, unit: millilitre})
    if (ml !== null && !KITCHEN_UNITS.includes(sourceSymbol)) {
        const kitchen = KITCHEN_UNITS.map(bySymbol).filter((u): u is ToolboxUnit => !!u)
        const pick = kitchen.find(u => ml / u.to_base >= 1) ?? kitchen[kitchen.length - 1]
        if (pick)
            out.push({amount: ml / pick.to_base, unit: pick})
    }
    return out
}

// canonicalConversions formats the conversions of one ingredient of
// shown (the displayed, possibly translated, list), matching on the
// canonical copy's name and unit: the API translates both.
export function canonicalConversions(
    ingredient: Pick<Ingredient, 'name' | 'quantity' | 'unit'>,
    ratio: number,
    shown: Pick<Ingredient, 'name' | 'quantity' | 'unit'>[],
    canonical: Pick<Ingredient, 'name' | 'unit'>[] | undefined,
    data: ConversionData,
): string[] {
    const source = canonical?.[shown.indexOf(ingredient)] ?? ingredient
    return ingredientConversions(ingredient.quantity * ratio, source.unit, source.name, data).map(formatConversion)
}

// formatConversion renders "≈ 42 g"; kitchen units use friendly fractions.
export function formatConversion(c: Conversion): string {
    let amount: string
    if (KITCHEN_UNITS.includes(c.unit.symbol.toLowerCase()))
        amount = formatScaledQuantity(c.amount)
    else if (c.amount >= 10)
        amount = String(Math.round(c.amount))
    else
        amount = String(Number(c.amount.toFixed(1)))
    return `≈ ${amount} ${c.unit.symbol}`
}

function resolveUnit(text: string, data: ConversionData): ToolboxUnit | null {
    const direct = data.units.find(u => u.name.toLowerCase() === text || u.symbol.toLowerCase() === text)
    if (direct)
        return direct
    const alias = data.unit_aliases.find(a => a.alias.toLowerCase() === text)
    return alias ? data.units.find(u => u.id === alias.unit_id) ?? null : null
}
