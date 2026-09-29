<script lang="ts">
    import {_} from "svelte-i18n";
    import {Flame} from "@lucide/svelte";
    import {getRecipeNutrition, type RecipeNutrition} from "$lib/nutrition";
    import type {Ingredient} from "$lib/recipes";

    // recipeId is optional: the edit wizard's live-preview column mounts
    // this for a brand-new, not-yet-saved recipe too (any non-diy category
    // shows the card - see the caller) - there's no endpoint to compute
    // nutrition for a recipe that doesn't exist yet, so this shows its own
    // "save first" state instead of fetching.
    let {
        recipeId,
        servings,
        ingredients
    }: {
        recipeId?: string
        servings: number
        ingredients: Ingredient[]
    } = $props();

    let nutrition: RecipeNutrition | null = $state(null);

    $effect(() => {
        const id = recipeId;
        const count = servings;
        if (!id) {
            nutrition = null;
            return;
        }
        getRecipeNutrition(id, count).then(({response, data}) => {
            if (response.ok && data)
                nutrition = data;
        });
    });

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
            {/if}
        {/if}
    </div>
</div>
