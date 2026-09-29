<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import Modal from './Modal.svelte';
    import Button from './Button.svelte';
    import Label from './Label.svelte';
    import Input from './Input.svelte';
    import IngredientCombobox from './toolbox/IngredientCombobox.svelte';
    import SuggestUnitModal from './toolbox/SuggestUnitModal.svelte';
    import type {ToolboxUnit} from '$lib/toolbox';
    import {
        submitNutritionLinkSuggestion, requiredNutritionField, parsePositiveNumberInput,
        type NutritionIngredient, type IngredientNutritionLink, type SubmitNutritionLinkResult
    } from '$lib/nutrition';
    import {toastError, toastSuccess} from '$lib/utils';
    import {apiErrorMessage} from '$lib/api';

    // NutritionFixModal is the self-service "help complete this recipe's
    // nutrition data" entry point on the recipe detail page's Nutrition
    // panel (see RecipeNutritionPanel.svelte) - any authenticated viewer,
    // not just the recipe's author, can open this for one unmatched
    // ingredient, whether it has no link at all yet or already has a link
    // that's just missing the field its unit needs (existingLink covers
    // both: undefined for the former). Submission goes through the same
    // Service.SubmitNutritionLinkSuggestion endpoint (and the same
    // apply-directly-vs-review rule) as the authoring flow's
    // NutritionLinkSuggestion.svelte.
    let {
        open,
        onClose,
        ingredientName,
        ingredientUnit,
        nutritionIngredients,
        existingLink,
        toolboxUnits,
        onResult
    }: {
        open: boolean
        onClose: () => void
        ingredientName: string
        ingredientUnit: string
        nutritionIngredients: NutritionIngredient[]
        existingLink?: IngredientNutritionLink
        toolboxUnits: ToolboxUnit[]
        onResult: (result: SubmitNutritionLinkResult) => void
    } = $props();

    let nutritionId = $state('');
    // comboboxOpen tracks whether the ingredient search's dropdown is
    // currently shown, so the layout space it needs (see the template
    // below) is only reserved while it's actually open, not permanently.
    let comboboxOpen = $state(false);
    // Declared/initialized as a string, but bind:value on the number input
    // below silently turns this into an actual number once typed into (see
    // parsePositiveNumberInput) - never call string-only methods on it.
    let fieldValue: string | number = $state('');
    let submitting = $state(false);

    const requiredField = $derived(requiredNutritionField(ingredientUnit, toolboxUnits));
    const fieldValueNumber = $derived(parsePositiveNumberInput(fieldValue));
    const fieldValueValid = $derived(requiredField === null || (fieldValueNumber !== null && fieldValueNumber > 0));
    const canSubmit = $derived(!!nutritionId && fieldValueValid && !submitting);

    // See NutritionLinkSuggestion.svelte's identical note: only unrecognized
    // unit *text* (not a genuinely blank unit) is worth offering to
    // register as a real Toolbox unit.
    const unknownUnitText = $derived(requiredField === 'grams_per_unit' ? ingredientUnit.trim() : '');
    let suggestingUnit = $state(false);

    // Reset the form to this ingredient's current state every time the
    // modal opens - existingLink pre-fills the nutrition entry (and
    // whichever field it already has, if any) so a viewer completing a
    // partially-linked ingredient isn't asked to redo what's already there.
    $effect(() => {
        if (!open) return;
        nutritionId = existingLink?.nutrition_id ?? '';
        const current = requiredField === 'density' ? existingLink?.g_per_100ml : existingLink?.grams_per_unit;
        fieldValue = current != null ? String(current) : '';
    });

    function displayName(item: NutritionIngredient): string {
        return item.names?.[$locale ?? ''] ?? item.name;
    }

    const localizedNutritionIngredients = $derived(nutritionIngredients.map(n => ({id: n.id, name: displayName(n)})));

    async function submit() {
        if (!canSubmit) return;
        submitting = true;
        const {response, data} = await submitNutritionLinkSuggestion({
            ingredient_name: ingredientName, ingredient_unit: ingredientUnit, nutrition_id: nutritionId,
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
        {#if existingLink}
            <p class="text-xs text-muted-foreground">{$_('recipe.nutrition.fix.alreadyLinkedTo', {values: {name: displayName(nutritionIngredients.find(n => n.id === existingLink!.nutrition_id) ?? {name: existingLink.name} as NutritionIngredient)}})}</p>
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
            <IngredientCombobox id="fix-nutrition-entry" ingredients={localizedNutritionIngredients} bind:value={nutritionId} bind:open={comboboxOpen} placeholder={$_('edit.ingredients.nutritionLink.searchPlaceholder')} />
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
                {#if unknownUnitText}
                    <button type="button" onclick={() => suggestingUnit = true} class="mt-1.5 text-xs text-primary hover:underline hover:cursor-pointer">
                        {$_('edit.ingredients.nutritionLink.suggestUnit', {values: {unit: unknownUnitText}})}
                    </button>
                {/if}
            </div>
        {/if}
        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={onClose} disabled={submitting}>{$_('edit.ingredients.nutritionLink.cancel')}</Button>
            <Button type="button" disabled={!canSubmit} onclick={submit}>{$_('recipe.nutrition.fix.submit')}</Button>
        </div>
    </div>
</Modal>

<SuggestUnitModal bind:open={suggestingUnit} units={toolboxUnits} initialName={unknownUnitText} />
