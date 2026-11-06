import {formatScaledQuantity} from "$lib/recipes";
import {getToolboxIngredients, getToolboxUnits, type ToolboxUnit} from "$lib/toolbox";
import {getIngredientNutritionLinks, getUnitAliases, type UnitAlias} from "$lib/nutrition";

export type ConversionData = {
    units: ToolboxUnit[]
    densities: {name: string, g_per_100ml: number}[]
    unit_aliases: UnitAlias[]
    links: {name: string, g_per_100ml?: number | null}[]
}

export type Conversion = {amount: number, unit: ToolboxUnit}

const KITCHEN_UNITS = ['cup', 'tbsp', 'tsp']

// loadConversionData fetches the lists ingredientConversions needs. Toolbox
// ingredients come twice, canonical and in sourceLocale, so a density
// matches the recipe's own wording too. Resolves to null if any request fails.
export async function loadConversionData(sourceLocale?: string | null): Promise<ConversionData | null> {
    let results
    try {
        results = await Promise.all([
            getToolboxUnits(), getToolboxIngredients(), getToolboxIngredients(sourceLocale ?? null),
            getUnitAliases(), getIngredientNutritionLinks(),
        ])
    } catch {
        return null
    }
    const [units, ingredients, translated, aliases, links] = results
    if (!units.data || !ingredients.data || !translated.data || !aliases.data || !links.data)
        return null
    if (!units.response.ok || !ingredients.response.ok || !translated.response.ok || !aliases.response.ok || !links.response.ok)
        return null
    return {
        units: units.data.items,
        densities: [...ingredients.data.items, ...translated.data.items],
        unit_aliases: aliases.data.items,
        links: links.data.items,
    }
}

// ingredientConversions expresses quantity of unitText in grams, ml and one
// kitchen unit, crossing between weight and volume only when name has a
// known density. Units are resolved like the nutrition computation does.
export function ingredientConversions(quantity: number, unitText: string, name: string, data: ConversionData): Conversion[] {
    const text = unitText.trim().toLowerCase()
    if (!(quantity > 0) || text === '')
        return []
    const source = resolveUnit(text, data)
    if (!source)
        return []

    const nameLower = name.trim().toLowerCase()
    const density = data.links.find(l => l.name.toLowerCase() === nameLower && (l.g_per_100ml ?? 0) > 0)?.g_per_100ml
        ?? data.densities.find(d => d.name.toLowerCase() === nameLower)?.g_per_100ml

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
