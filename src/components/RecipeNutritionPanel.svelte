<script lang="ts">
    import {_} from "svelte-i18n";
    import {Flame} from "@lucide/svelte";
    import {
        getRecipeNutrition, getNutritionIngredients, getIngredientNutritionLinks,
        type RecipeNutrition, type NutritionIngredient, type IngredientNutritionLink, type SubmitNutritionLinkResult
    } from "$lib/nutrition";
    import {getToolboxUnits, type ToolboxUnit} from "$lib/toolbox";
    import {user} from "$lib/stores";
    import type {Ingredient} from "$lib/recipes";
    import NutritionFixModal from "./NutritionFixModal.svelte";

    // recipeId is optional: the edit wizard's live-preview column mounts
    // this for a brand-new, not-yet-saved recipe too (any non-diy category
    // shows the card - see the caller) - there's no endpoint to compute
    // nutrition for a recipe that doesn't exist yet, so this shows its own
    // "save first" state instead of fetching.
    //
    // ingredients is used for DISPLAY only (it may be locale-translated,
    // e.g. the recipe detail page always fetches in the site's current
    // language). canonicalIngredients is what actually gets submitted when
    // linking/fixing an ingredient - nutrition matching always resolves
    // against the recipe's canonical (source-locale) text server-side
    // (GetRecipeNutrition), so submitting a translated name creates a link
    // that can never match this recipe's own ingredients. Defaults to
    // ingredients when omitted, which is correct for the edit wizard's
    // live-preview column (formData.ingredients is already canonical there
    // - the author edits raw stored values, no translation involved) but
    // NOT for the recipe detail page, which must pass the real thing.
    let {
        recipeId,
        servings,
        ingredients,
        canonicalIngredients = ingredients
    }: {
        recipeId?: string
        servings: number
        ingredients: Ingredient[]
        canonicalIngredients?: Ingredient[]
    } = $props();

    let nutrition: RecipeNutrition | null = $state(null);

    function refetchNutrition() {
        const id = recipeId;
        if (!id) {
            nutrition = null;
            return;
        }
        getRecipeNutrition(id, servings).then(({response, data}) => {
            if (response.ok && data)
                nutrition = data;
        });
    }

    $effect(() => {
        recipeId; servings; // re-run when either changes
        refetchNutrition();
    });

    // The self-service "help fix this" flow (see NutritionFixModal.svelte)
    // is only offered to a logged-in viewer - these lists are only fetched
    // when one is present, both to save the requests for an anonymous
    // visitor and because the fix-it UI itself is hidden for them entirely.
    let nutritionIngredients: NutritionIngredient[] = $state([]);
    let existingLinksByName: Record<string, IngredientNutritionLink> = $state({});
    let toolboxUnits: ToolboxUnit[] = $state([]);

    function refetchLinks() {
        getIngredientNutritionLinks().then(({response, data}) => {
            if (response.ok && data) existingLinksByName = Object.fromEntries(data.items.map(link => [link.name.toLowerCase(), link]));
        });
    }

    $effect(() => {
        if (!$user) return;
        getNutritionIngredients().then(({response, data}) => {
            if (response.ok && data) nutritionIngredients = data.items;
        });
        refetchLinks();
        getToolboxUnits().then(({response, data}) => {
            if (response.ok && data) toolboxUnits = data.items;
        });
    });

    let fixModalFor: {name: string, unit: string} | null = $state(null);

    function openFixModal(name: string, unit: string) {
        fixModalFor = {name, unit};
    }

    function onFixResult(result: SubmitNutritionLinkResult) {
        if (result.applied) {
            // The link is now live - re-fetch both so the totals/coverage
            // and the unmatched list itself reflect it immediately.
            refetchNutrition();
            refetchLinks();
        }
        // A correction that needs review has no visible effect yet - the
        // ingredient stays in the unmatched list until an admin approves it.
    }

    const rows = $derived.by(() => {
        const n = nutrition;
        if (!n) return [];
        return [
            {label: $_('recipe.nutrition.kcal'), value: Math.round(n.kcal)},
            {label: $_('recipe.nutrition.protein'), value: `${n.protein_g} g`},
            {label: $_('recipe.nutrition.carbs'), value: `${n.carbs_g} g`},
            {label: $_('recipe.nutrition.fat'), value: `${n.fat_g} g`},
            {label: $_('recipe.nutrition.salt'), value: `${n.salt_g} g`},
            {label: $_('recipe.nutrition.sugar'), value: `${n.sugar_g} g`},
        ];
    });

    function ingredientLabel(ingredient: Ingredient): string {
        return ingredient.recipe_ref ? (ingredient.ref_label || ingredient.resolved_ref_title || '') : ingredient.name;
    }

    // breakdown zips nutrition.ingredients against the (locale-displayed)
    // ingredients prop by index - the backend always computes against the
    // recipe's canonical text, but the two arrays stay index-for-index
    // regardless of locale (translation is positional). Only matched lines
    // are shown - an unmatched line has nothing to contribute, and the
    // coverage note below already says how many were left out.
    const breakdown = $derived.by(() => {
        const n = nutrition;
        if (!n) return [];
        return n.ingredients
            .map((line, i) => ({line, label: ingredients[i] ? ingredientLabel(ingredients[i]) : ''}))
            .filter(row => row.line.matched && row.label);
    });

    // unmatchedRows feeds the self-service fix-it list below - a recipe_ref
    // line is never fixable this way (it recurses into another recipe
    // rather than resolving through a name link, see
    // Service.computeRecipeRefLine), a blank name has nothing to link, and a
    // quantity-less ingredient (e.g. "Salt", entered with no amount) can
    // never resolve to grams no matter what's linked -
    // resolveIngredientGrams bails immediately on Quantity <= 0 - so all
    // three are excluded regardless of match status: there's nothing a fix
    // could actually do for them.
    const unmatchedRows = $derived.by(() => {
        const n = nutrition;
        if (!n || !$user) return [];
        return n.ingredients
            .map((line, i) => ({line, ingredient: ingredients[i], canonical: canonicalIngredients[i]}))
            .filter(row => !row.line.matched && row.ingredient && row.canonical && !row.canonical.recipe_ref && row.canonical.name.trim() && row.canonical.quantity > 0);
    });

    const incomplete = $derived.by(() => {
        const n = nutrition;
        return n !== null && n.matched_count < n.total_count;
    });
    const hasNoMatches = $derived.by(() => {
        const n = nutrition;
        return n !== null && n.matched_count === 0;
    });
</script>

<!-- This card itself is always rendered once mounted - the caller (recipe
     detail page / RecipeEdit's live preview) is what decides whether to show
     it at all (gated on category !== 'diy'), never this component. While
     `nutrition` hasn't loaded yet, or once loaded with nothing matched, the
     card stays visible with its header and an empty/explanatory body rather
     than disappearing outright - "no data yet" is not the same as "hidden." -->
<div class="bg-card rounded-lg border border-border p-6 mt-8">
    <h2 class="text-2xl font-semibold text-card-foreground flex items-center">
        <Flame class="mr-3 text-primary" />
        {$_('recipe.nutrition.title')}
    </h2>

    <div class="mt-6">
        {#if !recipeId}
            <p class="text-muted-foreground">{$_('recipe.nutrition.saveFirst')}</p>
        {:else if nutrition}
            {#if hasNoMatches}
                <p class="text-muted-foreground">{$_('recipe.nutrition.noMatch')}</p>
            {:else}
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {#each rows as row}
                        <div class="rounded-lg bg-muted/50 px-4 py-3">
                            <p class="text-xs text-muted-foreground">{row.label}</p>
                            <p class="text-lg font-semibold text-card-foreground">{row.value}</p>
                        </div>
                    {/each}
                </div>

                {#if breakdown.length > 0}
                    <div class="mt-6">
                        <h3 class="text-sm font-semibold text-card-foreground mb-2">{$_('recipe.nutrition.perIngredient')}</h3>
                        <ul class="divide-y divide-border rounded-lg border border-border overflow-hidden">
                            {#each breakdown as row}
                                <li class="flex items-center justify-between gap-3 px-4 py-2.5">
                                    <span class="text-sm text-card-foreground truncate">{row.label}</span>
                                    <div class="text-right shrink-0">
                                        <span class="text-sm font-medium text-card-foreground">{Math.round(row.line.kcal)} {$_('recipe.nutrition.kcalShort')}</span>
                                        <p class="text-xs text-muted-foreground">
                                            {row.line.protein_g}{$_('recipe.nutrition.gShort')} {$_('recipe.nutrition.proteinShort')} ·
                                            {row.line.carbs_g}{$_('recipe.nutrition.gShort')} {$_('recipe.nutrition.carbsShort')} ·
                                            {row.line.fat_g}{$_('recipe.nutrition.gShort')} {$_('recipe.nutrition.fatShort')}
                                        </p>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            {/if}
            {#if incomplete}
                <p class="mt-4 text-sm text-muted-foreground">
                    {$_('recipe.nutrition.coverageNote', {values: {matched: nutrition.matched_count, total: nutrition.total_count}})}
                </p>
                {#if $user && unmatchedRows.length > 0}
                    <div class="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                        <p class="text-xs text-muted-foreground">{$_('recipe.nutrition.fix.explanation')}</p>
                        <ul class="mt-2 divide-y divide-border">
                            {#each unmatchedRows as row}
                                <li class="flex items-center justify-between gap-3 py-1.5">
                                    <span class="text-sm text-card-foreground truncate">{ingredientLabel(row.ingredient)}</span>
                                    <button type="button" onclick={() => openFixModal(row.canonical.name, row.canonical.unit)}
                                            class="shrink-0 text-xs font-semibold text-primary hover:underline hover:cursor-pointer">
                                        {$_('recipe.nutrition.fix.button')}
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            {/if}
        {/if}
    </div>
</div>

{#if fixModalFor}
    <NutritionFixModal
            open={!!fixModalFor}
            onClose={() => fixModalFor = null}
            ingredientName={fixModalFor.name}
            ingredientUnit={fixModalFor.unit}
            {nutritionIngredients}
            existingLink={existingLinksByName[fixModalFor.name.toLowerCase()]}
            {toolboxUnits}
            onResult={onFixResult}
    />
{/if}
