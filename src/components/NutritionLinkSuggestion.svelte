<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import {X, Search, Check} from '@lucide/svelte';
    import {submitNutritionLinkSuggestion, requiredNutritionField, parsePositiveNumberInput, type IngredientNutritionLink, type UnitAlias} from '$lib/nutrition';
    import {foodKeywords, foodName, type Food, type FoodMatcher} from '$lib/foods';
    import type {ToolboxUnit} from '$lib/toolbox';
    import {toastError, toastSuccess} from '$lib/utils';
    import {apiErrorMessage} from '$lib/api';
    import IngredientCombobox from './toolbox/IngredientCombobox.svelte';
    import Button from './Button.svelte';
    import Input from './Input.svelte';

    // NutritionLinkSuggestion shows, under one ingredient row while
    // authoring, which food the ingredient resolves to - same dismissible,
    // non-blocking posture as DuplicateNudge. An ingredient named like a food
    // (matcher, built from the food list in the draft's language) needs no
    // link; one that isn't gets a best-guess food to accept or a search.
    // Linking a not-yet-linked name applies immediately; relinking one that
    // already has a link submits a correction for admin review (see
    // Service.SubmitNutritionLinkSuggestion). A density or per-piece weight
    // is asked for only when the row's unit needs one and the chosen food
    // has no default (requiredNutritionField). ingredientQuantity gates the
    // whole component: an ingredient with no amount never resolves to grams.
    let {
        ingredientName,
        ingredientUnit,
        ingredientQuantity,
        foods,
        matcher,
        existingLinks,
        toolboxUnits,
        unitAliases,
        onApplied = () => {}
    }: {
        ingredientName: string
        ingredientUnit: string
        ingredientQuantity: number
        foods: Food[]
        matcher: FoodMatcher
        existingLinks: Record<string, IngredientNutritionLink>
        toolboxUnits: ToolboxUnit[]
        unitAliases: UnitAlias[]
        onApplied?: (link: IngredientNutritionLink) => void
    } = $props();

    let dismissedKey: string | null = $state(null);
    let submittedFor: string | null = $state(null);
    // justAppliedLink is set once this component itself applies a link, so
    // the "linked" chip shows without waiting for the parent's list.
    let justAppliedLink: IngredientNutritionLink | null = $state(null);
    let searching = $state(false);
    let searchValue = $state('');
    let submitting = $state(false);

    // awaitingField holds the food once "Accept" was clicked but a density
    // or per-piece weight still has to be collected before submitting.
    let awaitingField: Food | null = $state(null);
    // Declared/initialized as a string, but bind:value on the number input
    // below silently turns this into an actual number once typed into (see
    // parsePositiveNumberInput) - never call string-only methods on it.
    let fieldValue: string | number = $state('');

    const trimmedName = $derived(ingredientName.trim());

    function fieldFor(food: Food | undefined) {
        return requiredNutritionField(ingredientUnit, toolboxUnits, food, unitAliases);
    }

    const effectiveLink = $derived(justAppliedLink ?? existingLinks[trimmedName.toLowerCase()]);
    const effectiveLinkTarget = $derived(effectiveLink ? foods.find(f => f.id === effectiveLink.food_id) : undefined);
    // autoFood is the food the name already matches with no link.
    const autoFood = $derived(effectiveLink ? undefined : matcher.match(trimmedName)?.food);

    // Best guess when nothing matches: the shortest food name in the site's
    // language that contains the typed name, or is contained in it.
    const bestGuess = $derived.by(() => {
        const q = trimmedName.toLowerCase();
        if (q.length < 3) return null;
        let best: Food | null = null;
        let bestName = '';
        for (const candidate of foods) {
            const name = foodName(candidate, $locale).toLowerCase();
            if (!(name.includes(q) || q.includes(name))) continue;
            if (!best || name.length < bestName.length) {
                best = candidate;
                bestName = name;
            }
        }
        return best;
    });
    // suggested is what the pill offers: the matched food when it still
    // lacks the number this row's unit needs, else the best guess.
    const suggested = $derived(autoFood ?? bestGuess);

    const searchFood = $derived(foods.find(f => f.id === searchValue));
    const requiredField = $derived(fieldFor(awaitingField ?? (searching ? searchFood : suggested) ?? undefined));
    const fieldValueNumber = $derived(parsePositiveNumberInput(fieldValue));
    const fieldValueValid = $derived(requiredField === null || (fieldValueNumber !== null && fieldValueNumber > 0));

    const visible = $derived(
        !effectiveLink &&
        trimmedName.length >= 3 &&
        suggested !== null &&
        submittedFor !== trimmedName &&
        dismissedKey !== `${trimmedName}:${suggested?.id}`
    );

    const localizedFoods = $derived(foods.map(f => ({id: f.id, name: foodName(f, $locale), keywords: foodKeywords(f)})));

    function dismiss() {
        if (suggested) dismissedKey = `${trimmedName}:${suggested.id}`;
    }

    async function accept() {
        if (!suggested) return;
        if (fieldFor(suggested) !== null) {
            awaitingField = suggested;
            fieldValue = '';
            return;
        }
        await submit(suggested);
    }

    async function confirmAwaitingField() {
        if (!awaitingField || !fieldValueValid) return;
        await submit(awaitingField, fieldValueNumber);
        awaitingField = null;
    }

    async function submit(food: Food, value?: number | null) {
        const field = fieldFor(food);
        submitting = true;
        const {response, data} = await submitNutritionLinkSuggestion({
            ingredient_name: trimmedName, ingredient_unit: ingredientUnit, food_id: food.id,
            g_per_100ml: field === 'density' && value != null ? value : undefined,
            grams_per_unit: field === 'grams_per_unit' && value != null ? value : undefined,
        });
        submitting = false;
        if (response.ok && data) {
            searching = false;
            if (data.applied && data.link) {
                justAppliedLink = data.link;
                onApplied(data.link);
                toastSuccess($_('edit.ingredients.nutritionLink.linkedSuccess'));
            } else {
                submittedFor = trimmedName;
                toastSuccess($_('edit.ingredients.nutritionLink.success'));
            }
        } else {
            toastError(apiErrorMessage(data, $_('edit.ingredients.nutritionLink.error')));
        }
    }

    function openSearch() {
        searching = true;
        searchValue = '';
        fieldValue = '';
        awaitingField = null;
    }

    async function confirmSearch() {
        if (searchFood && fieldValueValid) await submit(searchFood, fieldValueNumber);
    }
</script>

{#snippet fieldInput()}
    <div class="mt-1.5">
        <label class="block text-xs font-medium text-foreground" for="nutrition-field-{trimmedName}">
            {$_(requiredField === 'density' ? 'edit.ingredients.nutritionLink.densityLabel' : 'edit.ingredients.nutritionLink.gramsPerUnitLabel')}
        </label>
        <Input id="nutrition-field-{trimmedName}" type="number" min={0} step="any" bind:value={fieldValue} class="mt-1 w-40 !py-1.5" />
        <p class="mt-1 text-[11px] text-muted-foreground max-w-xs">
            {$_(requiredField === 'density' ? 'edit.ingredients.nutritionLink.densityHelp' : 'edit.ingredients.nutritionLink.gramsPerUnitHelp')}
        </p>
    </div>
{/snippet}

{#if ingredientQuantity > 0}
{#if submittedFor === trimmedName}
    <div class="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
        {$_('edit.ingredients.nutritionLink.submittedChip')}
    </div>
{:else if awaitingField}
    <div class="mt-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p class="text-xs text-foreground">{$_('edit.ingredients.nutritionLink.suggestion', {values: {name: foodName(awaitingField, $locale)}})}</p>
        {@render fieldInput()}
        <div class="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" disabled={!fieldValueValid || submitting} onclick={confirmAwaitingField}>{$_('edit.ingredients.nutritionLink.link')}</Button>
            <Button type="button" size="sm" variant="outline" onclick={() => awaitingField = null}>{$_('edit.ingredients.nutritionLink.cancel')}</Button>
        </div>
    </div>
{:else if searching}
    <div class="mt-1.5 rounded-lg border border-border p-3">
        <div class="flex items-center gap-2">
            <div class="flex-1 max-w-xs">
                <IngredientCombobox ingredients={localizedFoods} bind:value={searchValue} placeholder={$_('edit.ingredients.nutritionLink.searchPlaceholder')} />
            </div>
            <Button type="button" size="sm" disabled={!searchValue || !fieldValueValid || submitting} onclick={confirmSearch}>{$_('edit.ingredients.nutritionLink.link')}</Button>
            <Button type="button" size="sm" variant="outline" onclick={() => searching = false}>{$_('edit.ingredients.nutritionLink.cancel')}</Button>
        </div>
        {#if requiredField !== null}
            {@render fieldInput()}
        {/if}
    </div>
{:else if effectiveLink || (autoFood && fieldFor(autoFood) === null)}
    <div class="mt-1.5 inline-flex items-center gap-1.5 flex-wrap rounded-full border border-border bg-muted/50 pl-3 pr-1.5 py-1 text-xs">
        <Check class="w-3 h-3 text-primary" />
        <span class="text-foreground">{$_('edit.ingredients.nutritionLink.linkedTo', {values: {name: effectiveLinkTarget ? foodName(effectiveLinkTarget, $locale) : autoFood ? foodName(autoFood, $locale) : effectiveLink?.name ?? ''}})}</span>
        <button type="button" onclick={openSearch} aria-label={$_('edit.ingredients.nutritionLink.linkDifferently')} title={$_('edit.ingredients.nutritionLink.linkDifferently')} class="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent hover:cursor-pointer">
            <Search class="w-3 h-3" />
        </button>
    </div>
{:else if visible && suggested}
    <div class="mt-1.5 inline-flex items-center gap-1.5 flex-wrap rounded-full border border-primary/30 bg-primary/5 pl-3 pr-1.5 py-1 text-xs">
        <span class="text-foreground">{$_('edit.ingredients.nutritionLink.suggestion', {values: {name: foodName(suggested, $locale)}})}</span>
        <button type="button" disabled={submitting} onclick={accept} class="font-semibold text-primary hover:underline hover:cursor-pointer">
            {$_('edit.ingredients.nutritionLink.accept')}
        </button>
        <button type="button" onclick={openSearch} aria-label={$_('edit.ingredients.nutritionLink.linkDifferently')} title={$_('edit.ingredients.nutritionLink.linkDifferently')} class="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent hover:cursor-pointer">
            <Search class="w-3 h-3" />
        </button>
        <button type="button" onclick={dismiss} aria-label={$_('edit.ingredients.nutritionLink.dismiss')} class="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent hover:cursor-pointer">
            <X class="w-3 h-3" />
        </button>
    </div>
{:else if trimmedName.length >= 3 && submittedFor !== trimmedName}
    <button type="button" onclick={openSearch} class="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:cursor-pointer">
        <Search class="w-3 h-3" />
        {$_('edit.ingredients.nutritionLink.linkDifferently')}
    </button>
{/if}
{/if}

