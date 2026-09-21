# Shopping list

Status: spec, not implemented.

## Summary

Let a user add one or more recipes' ingredients into a single checklist, merged and
deduplicated where possible, for grocery shopping. Nothing like this exists today — there
is no shopping-list model in the API and no aggregation logic on the site beyond a single
recipe's own `ingredientGroups` (`src/routes/[lang]/(app)/recipes/[id]/+page.svelte`).

## Scope decision: client-side only (v1)

Recommend building this **entirely client-side**, persisted in `localStorage` the same way
`createRecipeCache`/`darkMode` already are (`persisted(...)` from `svelte-persisted-store`,
`src/lib/stores.ts`) — no new API endpoints, no Mongo collection, no auth-surface change.
Tradeoff: the list is per-device, not synced across a phone and a laptop, and is lost if
the user clears site data. A server-persisted version (new `RECIPES_CFG`-adjacent Mongo
collection, `GET/POST/DELETE /api/v1/shopping-list`, synced like favorites) is a reasonable
v2 if the per-device limitation turns out to matter, but is real backend scope — call it
out as a deliberate v1/v2 split rather than build it now.

## User flow

1. From a recipe (detail page or `RecipeCard`), "Add to shopping list" — mirrors the
   existing favorite-toggle pattern (`toggleFavorite`/heart button,
   `+page.svelte:390-400`) but adds the recipe's ingredients to the list rather than
   flagging the recipe itself. Uses whatever `servingsRatio` is active on the page at the
   time, same as the ingredients already shown there.
2. A new page (e.g. `src/routes/[lang]/(app)/shopping-list/+page.svelte`, in the `(app)`
   group alongside `home`/`diy`, or under `(user)/settings/shopping-list` next to the
   existing `settings/favorites` tabs — pick based on whether this reads as "part of
   browsing recipes" or "part of my account"; `(user)/settings` fits the existing
   "My Recipes"/"My Favorites" tab row better) lists everything on the list:
   - Grouped by source recipe (collapsible per-recipe sections, each showing the recipe's
     title/link and its ingredients) — simplest to build, keeps provenance clear, no merge
     logic needed for v1.
   - Each line has a checkbox ("got it") and a remove control.
   - A "clear checked" / "clear all" action.
3. Optional v1.1 stretch: merge identical ingredients across recipes (same `name` +
   `unit`, case-insensitive, summing `quantity`) into one line instead of listing
   duplicates per recipe — flag as a stretch, not core v1, since it needs real decisions
   about fuzzy matching (see Edge cases).

## Data model (client-side)

```ts
// src/lib/shoppingList.ts
export type ShoppingListEntry = {
    recipeId: string
    recipeTitle: string
    ingredient: Ingredient   // from src/lib/recipes.ts — reuse as-is
    ratio: number            // servingsRatio at time of adding, for display via
                              // getIngredientName(ingredient, ratio)
    checked: boolean
}

export const shoppingList = persisted<ShoppingListEntry[]>('shoppingList', [], {
    syncTabs: true,
    serializer: jsonParser,
})
```

Reuse `getIngredientName`/`getReferenceQuantity`/`groupIngredients` from
`src/lib/recipes.ts` for display — no new formatting logic needed for the common case.

## Handling reference ingredients

An `Ingredient` with `recipe_ref` set (`SautéAPI/internal/models/recipes.go:343`) is not a
literal grocery item — it points at another recipe/family (e.g. "1 batch of Tart Dough").
Adding a recipe with a reference ingredient to the shopping list has two reasonable
behaviors:
- Naive (v1): add the reference line as-is (e.g. "1 batch - Tart Dough"), same as it
  displays on the recipe page via `RecipeRefIngredient.svelte`. The shopper decides
  whether that means "buy dough" or "go make it."
- Better, more work: recursively pull in the *referenced* recipe's own ingredients instead
  (or in addition). Needs a fetch per reference (`getRecipe` on `ingredient.recipe_ref`)
  and a cycle guard, since nothing stops a reference chain in the data model itself beyond
  normal recipe editing. Recommend leaving this as a v2 idea and shipping the naive
  behavior first.

## i18n

New top-level namespace, e.g. `shoppingList.*`, in
`src/lib/i18n/locales/{en,fr,fi}.json`: `shoppingList.title`, `shoppingList.empty`,
`shoppingList.addButton`/`shoppingList.addedToast`, `shoppingList.clearChecked`,
`shoppingList.clearAll`, `shoppingList.removeRecipe`. Plus a `recipeCard.addToShoppingList`
/ `recipeCard.removeFromShoppingList` pair alongside the existing
`recipeCard.favorite`/`recipeCard.unfavorite` keys, if the add action is exposed on
`RecipeCard.svelte` as well as the detail page.

## Edge cases

- Adding the same recipe twice: either no-op (already on the list) or replace its entries
  (re-adding at a different `servingsRatio` should probably replace, not duplicate, the
  recipe's prior entries) — replace-by-`recipeId` is the simpler, more predictable rule.
- Recipe deleted after being added: entries are a snapshot (`ingredient`/`recipeTitle`
  copied in at add-time), so this is naturally safe — no dangling fetch, but also no way to
  detect staleness. Fine for v1.
- Ingredient with no quantity (`quantity <= 0`, e.g. "salt to taste" —
  `getIngredientName` already special-cases this): still worth listing, just without a
  scaled amount.
- Merge logic (v1.1 stretch): "2 cups flour" vs "500g flour" are the same real-world item
  in different units — true unit conversion is out of scope; only exact `name`+`unit`
  matches should ever merge, everything else lists separately rather than guessing.

## Out of scope (v1)

- Server persistence / cross-device sync (see Scope decision above).
- Unit conversion.
- Manually adding arbitrary items not sourced from a recipe (e.g. "paper towels") — a
  freeform "add item" input is a natural extension but not needed for the core "shop for
  the recipes I picked" use case.
- Recursive reference-ingredient expansion (see above).

## Testing notes

Fully client-side and unauthenticated-data-free (no user-specific server state), so this
is straightforward Playwright coverage in the `client` vitest project: add a recipe's
ingredients from the detail page, verify the shopping-list page shows them grouped
correctly, check/uncheck, remove, clear-all, and that a page reload preserves the list
(`localStorage` persistence).
