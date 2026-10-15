<script lang="ts">
    import {_} from "svelte-i18n";
    import {Flame} from "@lucide/svelte";
    import {
        getRecipeNutrition, getNutritionIngredients, getIngredientNutritionLinks,
        type RecipeNutrition, type NutritionIngredient, type IngredientNutritionLink, type SubmitNutritionLinkResult
    } from "$lib/nutrition";
    import {computeRecipeNutrition, type LoadedNutritionReferenceData} from "$lib/nutritionCompute";
    import {getToolboxUnits, type ToolboxUnit} from "$lib/toolbox";
    import {user} from "$lib/stores";
    import type {Ingredient} from "$lib/recipes";
    import NutritionFixModal from "./NutritionFixModal.svelte";

    // Two sources for the same numbers:
    // - recipeId set: the published recipe's nutrition from the API (detail page).
    // - recipeId unset: computed client-side from `canonicalIngredients` (the
    //   edit page's live preview of an unsaved draft), with the port of the
    //   backend's algorithm in $lib/nutritionCompute. The caller owns
    //   referenceData (null while loading) and merges applied links into it
    //   via onLinkApplied; baseServings is the draft's own servings count.
    //
    // ingredients is used for DISPLAY only (it may be locale-translated, e.g.
    // the recipe detail page always fetches in the site's current language).
    // canonicalIngredients is what gets matched and what gets submitted when
    // linking/fixing an ingredient - nutrition always resolves against the
    // recipe's canonical (source-locale) text, so a translated name would
    // create a link that never matches. Both lists must be index-aligned with
    // the computed lines: the recipe's own saved list on the detail page, the
    // normalized draft list in the editor.
    let {
        recipeId,
        servings,
        baseServings = servings,
        ingredients,
        canonicalIngredients = ingredients,
        referenceData = null,
        referenceFailed = false,
        onLinkApplied = () => {}
    }: {
        recipeId?: string
        servings: number
        baseServings?: number
        ingredients: Ingredient[]
        canonicalIngredients?: Ingredient[]
        referenceData?: LoadedNutritionReferenceData | null
        referenceFailed?: boolean
        onLinkApplied?: (link: IngredientNutritionLink) => void
    } = $props();

    const live = $derived(!recipeId);

    let serverNutrition: RecipeNutrition | null = $state(null);
    let serverFailed = $state(false);
    let requestSeq = 0;

    function refetchNutrition() {
        const id = recipeId;
        if (!id) return;
        const seq = ++requestSeq;
        const apply = (data: RecipeNutrition | null) => {
            if (seq !== requestSeq) return;
            serverNutrition = data;
            serverFailed = data === null;
        };
        getRecipeNutrition(id, servings)
            .then(({response, data}) => apply(response.ok && data ? data : null))
            .catch(() => apply(null));
    }

    $effect(() => {
        recipeId; servings; // re-run when either changes
        refetchNutrition();
    });

    const nutrition: RecipeNutrition | null = $derived.by(() => {
        if (!live) return serverNutrition;
        if (!referenceData) return null;
        return computeRecipeNutrition(canonicalIngredients, baseServings, servings, referenceData);
    });
    const failed = $derived(live ? referenceFailed : serverFailed);

    // The self-service "help fix this" flow (see NutritionFixModal.svelte)
    // is only offered to a logged-in viewer. In live mode its lists come from
    // referenceData; otherwise they're only fetched when a viewer is present.
    let fetchedFoods: NutritionIngredient[] = $state([]);
    let fetchedLinks: IngredientNutritionLink[] = $state([]);
    let fetchedUnits: ToolboxUnit[] = $state([]);

    function refetchLinks() {
        getIngredientNutritionLinks().then(({response, data}) => {
            if (response.ok && data) fetchedLinks = data.items;
        });
    }

    $effect(() => {
        if (!$user || live) return;
        getNutritionIngredients().then(({response, data}) => {
            if (response.ok && data) fetchedFoods = data.items;
        });
        refetchLinks();
        getToolboxUnits().then(({response, data}) => {
            if (response.ok && data) fetchedUnits = data.items;
        });
    });

    const nutritionIngredients = $derived(live ? referenceData?.foods ?? [] : fetchedFoods);
    const toolboxUnits = $derived(live ? referenceData?.units ?? [] : fetchedUnits);
    const existingLinksByName: Record<string, IngredientNutritionLink> = $derived(
        Object.fromEntries((live ? referenceData?.links ?? [] : fetchedLinks).map(link => [link.name.toLowerCase(), link]))
    );

    let fixModalFor: {name: string, unit: string} | null = $state(null);

    function openFixModal(name: string, unit: string) {
        fixModalFor = {name, unit};
    }

    function onFixResult(result: SubmitNutritionLinkResult) {
        // A correction that needs review has no visible effect yet - the
        // ingredient stays in the unmatched list until an admin approves it.
        if (!result.applied) return;
        if (live) {
            if (result.link) onLinkApplied(result.link);
            return;
        }
        refetchNutrition();
        refetchLinks();
    }

    function ingredientLabel(ingredient: Ingredient): string {
        return ingredient.recipe_ref ? (ingredient.ref_label || ingredient.resolved_ref_title || '') : ingredient.name;
    }

    // breakdown zips nutrition.ingredients against the (possibly
    // locale-displayed) ingredients prop by index - see the props comment for
    // why they line up. Only matched lines are shown; the coverage note says
    // how many were left out.
    const breakdown = $derived.by(() => {
        const n = nutrition;
        if (!n) return [];
        return n.ingredients
            .map((line, i) => ({line, label: ingredients[i] ? ingredientLabel(ingredients[i]) : ''}))
            .filter(row => row.line.matched && row.label);
    });

    // The totals shown are the sum of the lines shown, so the breakdown
    // always adds up (it drifts from the exact total by rounding only).
    const shownTotals = $derived.by(() => {
        const sum = (pick: (line: RecipeNutrition['ingredients'][number]) => number) =>
            Math.round(breakdown.reduce((acc, row) => acc + pick(row.line), 0) * 10) / 10;
        return {
            kcal: breakdown.reduce((acc, row) => acc + Math.round(row.line.kcal), 0),
            protein: sum(line => line.protein_g), carbs: sum(line => line.carbs_g), fat: sum(line => line.fat_g),
            salt: sum(line => line.salt_g), sugar: sum(line => line.sugar_g),
        };
    });

    const rows = $derived([
        {label: $_('recipe.nutrition.kcal'), value: shownTotals.kcal},
        {label: $_('recipe.nutrition.protein'), value: `${shownTotals.protein} g`},
        {label: $_('recipe.nutrition.carbs'), value: `${shownTotals.carbs} g`},
        {label: $_('recipe.nutrition.fat'), value: `${shownTotals.fat} g`},
        {label: $_('recipe.nutrition.salt'), value: `${shownTotals.salt} g`},
        {label: $_('recipe.nutrition.sugar'), value: `${shownTotals.sugar} g`},
    ]);

    // unmatchedRows feeds the self-service fix-it list below - a recipe_ref
    // line is never counted in nutrition (so no link can fix it), a blank
    // name has nothing to link, and a quantity-less ingredient (e.g. "Salt",
    // entered with no amount) can never resolve to grams no matter what's
    // linked, so all three are excluded regardless of match status.
    const unmatchedRows = $derived.by(() => {
        const n = nutrition;
        if (!n || !$user) return [];
        return n.ingredients
            .map((line, i) => ({line, ingredient: ingredients[i], canonical: canonicalIngredients[i]}))
            .filter(row => !row.line.matched && row.ingredient && row.canonical && !row.canonical.recipe_ref && row.canonical.name.trim() && row.canonical.quantity > 0);
    });

    // Sub-recipes are never counted (their quantity has no reliable
    // conversion into a share of the referenced recipe), so name them rather
    // than let the totals look complete.
    const uncountedReferences = $derived(
        ingredients.filter(ingredient => ingredient.recipe_ref).map(ingredientLabel).filter(label => label)
    );

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
    {#if nutrition && !hasNoMatches}
        <p class="mt-1 text-sm text-muted-foreground">{$_('recipe.nutrition.forServings', {values: {count: nutrition.servings}})}</p>
    {/if}

    <div class="mt-6">
        {#if failed}
            <p class="text-muted-foreground">{$_('recipe.nutrition.unavailable')}</p>
        {:else if nutrition}
            {#if hasNoMatches}
                <p class="text-muted-foreground">{$_('recipe.nutrition.noMatch')}</p>
            {:else}
                <div class="grid grid-cols-2 @md:grid-cols-3 gap-4">
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
                {#if uncountedReferences.length > 0}
                    <p class="mt-1 text-sm text-muted-foreground">
                        {$_('recipe.nutrition.notCounted', {values: {names: uncountedReferences.join(', ')}})}
                    </p>
                {/if}
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
