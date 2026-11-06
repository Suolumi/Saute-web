<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import Modal from './Modal.svelte';
    import Button from './Button.svelte';
    import Label from './Label.svelte';
    import Input from './Input.svelte';
    import IngredientCombobox from './toolbox/IngredientCombobox.svelte';
    import type {ToolboxUnit} from '$lib/toolbox';
    import {
        submitNutritionLinkSuggestion, requiredNutritionField, parsePositiveNumberInput,
        type IngredientNutritionLink, type SubmitNutritionLinkResult, type UnitAlias
    } from '$lib/nutrition';
    import {foodKeywords, foodName, type Food} from '$lib/foods';
    import {toastError, toastSuccess} from '$lib/utils';
    import {apiErrorMessage} from '$lib/api';

    // NutritionFixModal is the self-service "help complete this recipe's
    // nutrition data" entry point on the recipe detail page's Nutrition
    // panel (see RecipeNutritionPanel.svelte) - any authenticated viewer,
    // not just the recipe's author, can open this for one unmatched
    // ingredient, whether it has no link at all yet or already has a link
    // that's just missing the field its unit needs (existingLink covers
    // both: undefined for the former). matchedFood is the food the name
    // already matches without a link, pre-selected. Submission goes through the same
    // Service.SubmitNutritionLinkSuggestion endpoint (and the same
    // apply-directly-vs-review rule) as the authoring flow's
    // NutritionLinkSuggestion.svelte.
    let {
        open,
        onClose,
        ingredientName,
        ingredientUnit,
        foods,
        existingLink,
        matchedFood,
        toolboxUnits,
        unitAliases = [],
        onResult
    }: {
        open: boolean
        onClose: () => void
        ingredientName: string
        ingredientUnit: string
        foods: Food[]
        existingLink?: IngredientNutritionLink
        matchedFood?: Food
        toolboxUnits: ToolboxUnit[]
        unitAliases?: UnitAlias[]
        onResult: (result: SubmitNutritionLinkResult) => void
    } = $props();

    let foodId = $state('');
    // comboboxOpen tracks whether the ingredient search's dropdown is
    // currently shown, so the layout space it needs (see the template
    // below) is only reserved while it's actually open, not permanently.
    let comboboxOpen = $state(false);
    // Declared/initialized as a string, but bind:value on the number input
    // below silently turns this into an actual number once typed into (see
    // parsePositiveNumberInput) - never call string-only methods on it.
    let fieldValue: string | number = $state('');
    let submitting = $state(false);

    const selectedFood = $derived(foods.find(f => f.id === foodId));
    // The link's own overrides stay on a resubmitted link (the API merges
    // them), so they count as defaults here too.
    const requiredField = $derived(requiredNutritionField(ingredientUnit, toolboxUnits, {
        g_per_100ml: existingLink?.g_per_100ml ?? selectedFood?.g_per_100ml,
        grams_per_piece: existingLink?.grams_per_unit ?? selectedFood?.grams_per_piece,
    }, unitAliases));
    const fieldValueNumber = $derived(parsePositiveNumberInput(fieldValue));
    const fieldValueValid = $derived(requiredField === null || (fieldValueNumber !== null && fieldValueNumber > 0));
    const canSubmit = $derived(!!foodId && fieldValueValid && !submitting);

    // Reset the form every time the modal opens, pre-selecting the food the
    // ingredient already resolves to.
    $effect(() => {
        if (!open) return;
        foodId = existingLink?.food_id ?? matchedFood?.id ?? '';
        fieldValue = '';
    });

    const currentFood = $derived(foods.find(f => f.id === (existingLink?.food_id ?? matchedFood?.id)));
    const localizedFoods = $derived(foods.map(f => ({id: f.id, name: foodName(f, $locale), keywords: foodKeywords(f)})));

    async function submit() {
        if (!canSubmit) return;
        submitting = true;
        const {response, data} = await submitNutritionLinkSuggestion({
            ingredient_name: ingredientName, ingredient_unit: ingredientUnit, food_id: foodId,
            g_per_100ml: requiredField === 'density' && fieldValueNumber != null ? fieldValueNumber : undefined,
            grams_per_unit: requiredField === 'grams_per_unit' && fieldValueNumber != null ? fieldValueNumber : undefined,
        });
        submitting = false;
        if (response.ok && data) {
            toastSuccess($_(data.applied ? 'recipe.nutrition.fix.appliedSuccess' : 'recipe.nutrition.fix.reviewSuccess'));
            onResult(data);
            onClose();
        } else {
            toastError(apiErrorMessage(data, $_('recipe.nutrition.fix.error')));
        }
    }
</script>

<Modal {open} {onClose} title={$_('recipe.nutrition.fix.modalTitle', {values: {name: ingredientName}})}>
    <div class="space-y-4">
        {#if currentFood}
            <p class="text-xs text-muted-foreground">{$_('recipe.nutrition.fix.alreadyLinkedTo', {values: {name: foodName(currentFood, $locale)}})}</p>
        {/if}
        <!-- min-height reserves enough room for the combobox's open dropdown
             (roughly 7-8 rows at its own max-h-64) so the modal's box is
             never too short to show them - without it, a modal with nothing
             else below this field (a weight-unit ingredient needing no
             density/grams-per-unit) sized itself to just the label+input,
             and the dropdown - an absolutely-positioned descendant that
             doesn't contribute to that auto-height - got clipped by the
             modal's own overflow-hidden/auto ancestors the moment it opened.
             Only applied while comboboxOpen (the dropdown is actually
             showing) - reserving it unconditionally left dead space below
             the field whenever the dropdown was closed. -->
        <div class={comboboxOpen ? 'min-h-[21rem]' : ''}>
            <Label for="fix-nutrition-entry" required>{$_('recipe.nutrition.fix.searchLabel')}</Label>
            <IngredientCombobox id="fix-nutrition-entry" ingredients={localizedFoods} bind:value={foodId} bind:open={comboboxOpen} placeholder={$_('edit.ingredients.nutritionLink.searchPlaceholder')} />
        </div>
        {#if requiredField !== null}
            <div>
                <Label for="fix-field">
                    {$_(requiredField === 'density' ? 'edit.ingredients.nutritionLink.densityLabel' : 'edit.ingredients.nutritionLink.gramsPerUnitLabel')}
                </Label>
                <Input id="fix-field" type="number" min={0} step="any" bind:value={fieldValue} class="mt-1" />
                <p class="mt-1 text-xs text-muted-foreground">
                    {$_(requiredField === 'density' ? 'edit.ingredients.nutritionLink.densityHelp' : 'edit.ingredients.nutritionLink.gramsPerUnitHelp')}
                </p>
            </div>
        {/if}
        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={onClose} disabled={submitting}>{$_('edit.ingredients.nutritionLink.cancel')}</Button>
            <Button type="button" disabled={!canSubmit} onclick={submit}>{$_('recipe.nutrition.fix.submit')}</Button>
        </div>
    </div>
</Modal>

