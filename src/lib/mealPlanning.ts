import {persisted} from 'svelte-persisted-store';
import {jsonParser} from '$lib/stores';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

// One entry per (date, mealType) a recipe has been planned for - same
// entry-list-is-the-source-of-truth shape as shoppingList.ts's
// ShoppingListEntry. `date` is a local YYYY-MM-DD string (not a Date or
// timestamp) so entries compare/sort without timezone drift; a plan is
// about calendar days, not instants.
export type MealPlanEntry = {
    id: string
    date: string
    mealType: MealType
    recipeId: string
    recipeTitle: string
    // recipeQuantity is the recipe's own base servings count at plan-time -
    // paired with the effective servings (see effectiveServings) to compute
    // a scaling ratio, same convention as ShoppingListEntry.recipeQuantity.
    recipeQuantity: number
    recipePicture?: string
    // servings is a per-meal override only - undefined means this meal
    // follows the day/week cascade (see effectiveServings) rather than
    // having its own number.
    servings?: number
}

export const mealPlan = persisted<MealPlanEntry[]>('mealPlan', [], {
    syncTabs: true,
    serializer: jsonParser,
})

// mealPlanDefaultServings is a single global "usual household size" -
// carries over across every week until changed, not reset per week. `null`
// means it was never set, in which case a freshly-planned meal falls all
// the way back to the recipe's own base servings count (see
// effectiveServings).
export const mealPlanDefaultServings = persisted<number | null>('mealPlanDefaultServings', null, {
    syncTabs: true,
    serializer: jsonParser,
})

// mealPlanDayOverrides holds one optional servings number per calendar date
// (YYYY-MM-DD), sitting between the week default and a per-meal override in
// the cascade - e.g. "this Saturday is for 4" without touching every other
// day.
export const mealPlanDayOverrides = persisted<Record<string, number>>('mealPlanDayOverrides', {}, {
    syncTabs: true,
    serializer: jsonParser,
})

// effectiveServings resolves the live cascade for one meal: its own
// override, else its day's override, else the week default, else the
// recipe's own base servings count. Most-specific wins, and nothing here is
// ever "snapshotted" - it's recomputed from current store values every time.
export function effectiveServings(entry: MealPlanEntry, dayOverrides: Record<string, number>, weekDefault: number | null): number {
    return entry.servings ?? dayOverrides[entry.date] ?? weekDefault ?? entry.recipeQuantity
}

// planMeal replaces any existing entry for this exact (date, mealType) slot
// - a slot holds at most one recipe. The new entry has no servings override
// of its own, so it immediately follows the day/week cascade.
export function planMeal(date: string, mealType: MealType, recipeId: string, recipeTitle: string, recipeQuantity: number, recipePicture: string | undefined) {
    mealPlan.update(entries => [
        ...entries.filter(e => !(e.date === date && e.mealType === mealType)),
        {
            id: crypto.randomUUID(),
            date,
            mealType,
            recipeId,
            recipeTitle,
            recipeQuantity,
            recipePicture,
        },
    ])
}

export function unplanMeal(date: string, mealType: MealType) {
    mealPlan.update(entries => entries.filter(e => !(e.date === date && e.mealType === mealType)))
}

// setMealServings gives one specific meal its own override, taking it out of
// the day/week cascade until clearMealServings is called.
export function setMealServings(date: string, mealType: MealType, servings: number) {
    mealPlan.update(entries => entries.map(e => (e.date === date && e.mealType === mealType) ? {...e, servings} : e))
}

// clearMealServings drops a meal's own override, handing it back to the
// day/week cascade.
export function clearMealServings(date: string, mealType: MealType) {
    mealPlan.update(entries => entries.map(e => {
        if (e.date !== date || e.mealType !== mealType)
            return e
        const {servings: _servings, ...rest} = e
        return rest
    }))
}

// setDayServings gives one calendar date its own override, taking every meal
// on that date without its own override (see effectiveServings) out of the
// week default's cascade.
export function setDayServings(date: string, servings: number) {
    mealPlanDayOverrides.update(overrides => ({...overrides, [date]: servings}))
}

// clearDayServings drops a date's override, handing its meals back to the
// week default (unless they have their own per-meal override, which always
// wins regardless).
export function clearDayServings(date: string) {
    mealPlanDayOverrides.update(overrides => {
        const {[date]: _removed, ...rest} = overrides
        return rest
    })
}

export function findMeal(entries: MealPlanEntry[], date: string, mealType: MealType): MealPlanEntry | undefined {
    return entries.find(e => e.date === date && e.mealType === mealType)
}

// --- Local-date helpers (no timezone conversion - a plan is calendar days) ---

export function toISODate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export function addDays(d: Date, days: number): Date {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    copy.setDate(copy.getDate() + days)
    return copy
}

// getWeekStart returns the Monday on/before `d` (weeks run Monday-Sunday).
export function getWeekStart(d: Date): Date {
    const day = d.getDay() // 0 Sun .. 6 Sat
    const diff = day === 0 ? -6 : 1 - day
    return addDays(d, diff)
}

export function getWeekDates(weekStart: Date): string[] {
    return Array.from({length: 7}, (_, i) => toISODate(addDays(weekStart, i)))
}

export function entriesForWeek(entries: MealPlanEntry[], weekDates: string[]): MealPlanEntry[] {
    const set = new Set(weekDates)
    return entries.filter(e => set.has(e.date))
}
