import type {User} from "$lib/user";
import {apiFetchJson} from "$lib/api";

type FetchFn = typeof fetch;

export type RecipeType = "breakfast" | "starter" | "dish" | "side-dish" | "sauce" | "baking" | "snack" | "plate" | "dessert" | "drink"

export const RecipeTypes: RecipeType[] = ["breakfast","starter","dish","side-dish","sauce","baking","snack","plate","dessert","drink"]

export type RecipeCategory = "food" | "diy"

export const RecipeCategories: RecipeCategory[] = ["food", "diy"]

// TIME_PRESETS/TimePreset back the "ready in" filter shared by the recipe
// search filter UI (home, diy, and the admin back-office's recipe browse).
export const TIME_PRESETS = ['any', '15', '30', '45', '60'] as const

export type TimePreset = typeof TIME_PRESETS[number]

export const recipeTypeColors: {
    [key: string]: string
} = {
    breakfast: "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300",
    starter: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300",
    dish: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
    "side-dish": "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    sauce: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
    baking: "bg-lime-100 text-lime-800 dark:bg-lime-900/20 dark:text-lime-300",
    snack: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
    plate: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    dessert: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300",
    drink: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
}

// RecipePicture is one picture on a recipe's detail view. added_by is only
// present for a contributor's picture (someone other than the recipe's
// author); absent means the recipe's own author added it - including every
// picture added before per-picture attribution existed.
export type RecipePicture = {
    filename: string
    added_by?: User
}

export type Step = {
    title: string
    description: string
    picture?: string
}

export type Ingredient = {
    name: string
    quantity: number
    unit: string
    label: string
    // recipe_ref, when set, makes this ingredient a reference to another
    // recipe's root/family instead of free text (name is then always empty).
    // Quantity/unit still mean "how much of that sub-recipe", scaling with
    // the parent's serving scaler like any other ingredient.
    recipe_ref?: string
    // ref_label is an optional custom display label for a reference
    // ingredient; blank falls back to the referenced recipe's live current
    // title (resolved_ref_title).
    ref_label?: string
    // resolved_ref_title is server-decorated, read-only - ref_label if set,
    // else the referenced recipe's live current title. Never send this back
    // on write.
    resolved_ref_title?: string
    // variation_count is carried over client-side from the RecipePreview
    // picked in RecipePickerModal - the server doesn't decorate it on
    // existing recipe_ref ingredients yet, so it's only known for a
    // reference picked during the current edit session.
    variation_count?: number
}

export type Recipe = {
    id: string
    title: string
    description: string
    author: User
    quantity: number
    preparation_time: number
    cooking_time: number
    resting_time: number
    kind: RecipeType
    category: RecipeCategory
    ingredients: Ingredient[]
    steps: Step[]
    pictures: RecipePicture[]
    favorite: boolean
    favorite_count: number
    // variation_of is the id of the recipe this one is a variation of, unset
    // for an original/root recipe. variation_count is how many variations a
    // root has (always 0 for a variation itself).
    variation_of?: string
    variation_count: number
}

export type RecipePreview = {
    id: string
    title: string
    description: string
    author: User
    quantity: number
    preparation_time: number
    cooking_time: number
    resting_time: number
    kind: RecipeType
    category: RecipeCategory
    pictures: string[]
    favorite: boolean
    favorite_count: number
    variation_of?: string
    variation_count: number
}

export type RecipeForm = {
    title: string
    description: string
    quantity: number
    kind: RecipeType
    category: RecipeCategory
    preparation_time: number
    cooking_time: number
    resting_time: number
    ingredients: Ingredient[]
    steps: Step[]
    pictures: string[]
}

export type GetRecipesRequest = {
    limit?: number
    offset?: number
    author?: string
    title?: string
    preparation_time?: number
    total_time?: number
    ingredients?: string[]
    kind?: RecipeType
    // category, omitted, lists the food feed (server excludes diy by
    // default); pass 'diy' for the DIY browse page. Ignored by
    // variation_of/own_recipes requests, which are category-agnostic.
    category?: RecipeCategory
    locale?: string
    search_locale?: string
    favorite?: boolean
    // variation_of lists only that recipe's variations, never the root.
    variation_of?: string
    // own_recipes lists every recipe matching author flatly (roots and
    // variations alike, no collapsing) - only the Settings "My Recipes" view
    // sets this.
    own_recipes?: boolean
    // exclude_family hides that root id from a listing - used by the "add
    // recipe as ingredient" picker so a recipe can't offer itself/its own
    // family as a reference target.
    exclude_family?: string
}

export type GetRecipesResponse = {
    length: number
    items: RecipePreview[]
}

export type IngredientGroup = {
    label: string | null
    items: Ingredient[]
}

// Groups ingredients by their (trimmed, case-insensitive) label. Unlabeled
// ingredients are pooled into one header-less group shown first; labeled
// groups follow in order of each label's first appearance.
export function groupIngredients(ingredients: Ingredient[]): IngredientGroup[] {
    const unlabeled: Ingredient[] = []
    const order: string[] = []
    const groups = new Map<string, IngredientGroup>()

    for (const ingredient of ingredients) {
        const label = ingredient.label.trim()
        if (!label) {
            unlabeled.push(ingredient)
            continue
        }
        const key = label.toLowerCase()
        let group = groups.get(key)
        if (!group) {
            group = {label, items: []}
            groups.set(key, group)
            order.push(key)
        }
        group.items.push(ingredient)
    }

    const result: IngredientGroup[] = []
    if (unlabeled.length > 0)
        result.push({label: null, items: unlabeled})
    for (const key of order)
        result.push(groups.get(key)!)
    return result
}

// NICE_FRACTIONS are the only fractional parts ever displayed as a fraction
// (e.g. "1/2") - only when the quantity is between 0 and 1 and its
// fractional part exactly matches one of these (no snapping to "close
// enough"). Anything else - a non-matching fraction like 3/8, or any
// quantity >= 1 even with a matching fraction - is shown as a plain
// 2-decimal number (e.g. "1.50", "0.38").
const NICE_FRACTIONS: [numerator: number, denominator: number][] = [
    [1, 4], [1, 3], [1, 2], [2, 3], [3, 4],
]
const NICE_FRACTION_EPSILON = 1e-9
const FRACTION_ROUND_EPSILON = 1 / 32

export function formatScaledQuantity(quantity: number): string {
    const whole = Math.floor(quantity)
    const frac = quantity - whole

    if (frac < FRACTION_ROUND_EPSILON)
        return String(whole)
    if (1 - frac < FRACTION_ROUND_EPSILON)
        return String(whole + 1)

    if (whole === 0) {
        for (const [numerator, denominator] of NICE_FRACTIONS) {
            if (Math.abs(frac - numerator / denominator) < NICE_FRACTION_EPSILON)
                return `${numerator}/${denominator}`
        }
    }

    return quantity.toFixed(2)
}

// formatDuration renders a minute count as "1h 40min" (or just "40min"
// under an hour). Math.floor keeps the hour part a whole number even when
// minutes isn't an exact multiple of 60 - the naive `minutes / 60` used to
// render as an unbounded repeating decimal (e.g. "1.6666666666666667h").
export function formatDuration(minutes: number, hourUnit: string, minuteUnit: string): string {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return hours > 0 ? `${hours}${hourUnit} ${remainder}${minuteUnit}` : `${remainder}${minuteUnit}`
}

// `ratio` scales the ingredient's stored quantity (e.g. selected servings /
// recipe's default servings). At ratio 1 (the default), formatting is
// unchanged from the recipe's authored quantity; away from 1, the quantity
// is scaled and rounded to a friendly fraction. Ingredients with no
// quantity (quantity <= 0, e.g. "salt to taste") are never scaled.
export function getIngredientName(ingredient: Ingredient, ratio: number = 1): string {
    if (ingredient.quantity && ingredient.quantity > 0) {
        const quantity = ratio === 1 ? ingredient.quantity : formatScaledQuantity(ingredient.quantity * ratio)
        if (ingredient.unit && ingredient.unit !== '') {
            return `${quantity} ${ingredient.unit} - ${ingredient.name}`
        }
        return `${quantity} ${ingredient.name}`
    }
    return ingredient.name
}

// getReferenceQuantity formats just the quantity/unit portion of a
// reference ingredient row (e.g. "1 batch"), reusing the same
// friendly-fraction scaling as getIngredientName; the title/link is
// rendered separately since it needs to be a clickable element, not plain
// text. Returns '' when the ingredient has no quantity (e.g. "use the whole
// recipe").
export function getReferenceQuantity(ingredient: Ingredient, ratio: number = 1): string {
    if (ingredient.quantity && ingredient.quantity > 0) {
        const quantity = ratio === 1 ? ingredient.quantity : formatScaledQuantity(ingredient.quantity * ratio)
        return ingredient.unit && ingredient.unit !== '' ? `${quantity} ${ingredient.unit}` : String(quantity)
    }
    return ''
}

export function getRecipe(id: string, locale?: string, f: FetchFn = fetch) {
    return apiFetchJson<Recipe>(`/recipes/${id}?locale=${locale ?? ''}`, "GET", undefined, undefined, undefined, f)
}

export function getRecipes(params: GetRecipesRequest) {
    return apiFetchJson<GetRecipesResponse>('/recipes', "GET", null, params)
}

// getFamily fetches rootId's recipe and its variations (never rootId itself)
// together, for the detail page's Variations panel and the variation picker
// modal. Callers must already have resolved rootId (recipe.variation_of ??
// recipe.id) - a variation's own id here would return an empty family.
export async function getFamily(rootId: string, locale?: string) {
    const [root, variations] = await Promise.all([
        getRecipe(rootId, locale),
        getRecipes({variation_of: rootId, locale}),
    ])
    return {root, variations}
}

function recipeBody(recipe: RecipeForm, keepPictureIDs?: string[]) {
    const {pictures, ...fields} = recipe
    return keepPictureIDs === undefined ? fields : {...fields, keep_picture_ids: keepPictureIDs}
}

// newStepPictures is keyed by a step's final (post-reorder) index in
// recipe.steps; each entry becomes a `step_picture_<index>` file field the
// backend correlates back to that step.
function multipartRecipeBody(recipe: object, files: File[], stepFiles: Record<number, File>) {
    const formData = new FormData()
    formData.append('recipe', JSON.stringify(recipe))
    for (const file of files)
        formData.append('pictures', file)
    for (const [index, file] of Object.entries(stepFiles))
        formData.append(`step_picture_${index}`, file)
    return formData
}

export function createRecipe(recipe: RecipeForm, newPictures: File[] = [], locale?: string, newStepPictures: Record<number, File> = {}, variationOf?: string) {
    const body = recipeBody(recipe) as Record<string, unknown>
    if (locale) {
        body.locale = locale
    }
    if (variationOf) {
        body.variation_of = variationOf
    }
    const hasFiles = newPictures.length > 0 || Object.keys(newStepPictures).length > 0
    const payload = hasFiles ? multipartRecipeBody(body, newPictures, newStepPictures) : body
    return apiFetchJson<Recipe>('/recipes', "POST", payload, null, {'Idempotency-Key': crypto.randomUUID()})
}

export function editRecipe(recipe: RecipeForm, id: string, newPictures: File[] = [], newStepPictures: Record<number, File> = {}) {
    const body = recipeBody(recipe, recipe.pictures)
    const hasFiles = newPictures.length > 0 || Object.keys(newStepPictures).length > 0
    const payload = hasFiles ? multipartRecipeBody(body, newPictures, newStepPictures) : body
    return apiFetchJson<Recipe>(`/recipes/${id}`, "PATCH", payload, null, {'Idempotency-Key': crypto.randomUUID()})
}

export function deleteRecipe(id: string) {
    return apiFetchJson<Recipe>(`/recipes/${id}`, "DELETE", null)
}

// linkRecipeVariation turns an existing standalone recipe the caller owns
// (or, for an admin, any recipe) into a variation of variationOf - a genuine
// root, never auto-flattened server-side (unlike createRecipe's
// variation_of). Irreversible through the website; only the admin console
// can detach a recipe back to standalone.
export function linkRecipeVariation(id: string, variationOf: string) {
    return apiFetchJson<Recipe>(`/recipes/${id}/variation-of`, "PATCH", {variation_of: variationOf})
}

// PICTURE_CAP_PER_CONTRIBUTOR mirrors the backend's per-contributor limit
// (recipe_service.PictureCapPerContributor) - used client-side only to hide
// the "add a photo" affordance once a contributor has reached it; the
// server enforces the real limit.
export const PICTURE_CAP_PER_CONTRIBUTOR = 3

export function addRecipePicture(id: string, file: File) {
    const formData = new FormData()
    formData.append('picture', file)
    return apiFetchJson<Recipe>(`/recipes/${id}/pictures`, "POST", formData)
}

export function removeRecipePicture(id: string, filename: string) {
    return apiFetchJson<Recipe>(`/recipes/${id}/pictures/${encodeURIComponent(filename)}`, "DELETE", null)
}

export function favoriteRecipe(id: string) {
    return apiFetchJson<{ message: string }>(`/recipes/${id}/favorite`, "POST", null)
}

export function unfavoriteRecipe(id: string) {
    return apiFetchJson<{ message: string }>(`/recipes/${id}/favorite`, "DELETE", null)
}
