<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import {X, Search, Check} from '@lucide/svelte';
    import {submitNutritionLinkSuggestion, requiredNutritionField, type NutritionIngredient, type IngredientNutritionLink} from '$lib/nutrition';
    import type {ToolboxUnit} from '$lib/toolbox';
    import {toastError, toastSuccess} from '$lib/utils';
    import {apiErrorMessage} from '$lib/api';
    import IngredientCombobox from './toolbox/IngredientCombobox.svelte';
    import Button from './Button.svelte';

    // NutritionLinkSuggestion offers a best-effort match from the curated
    // Ciqual-derived reference list for one ingredient row while authoring -
    // same dismissible, non-blocking posture as DuplicateNudge. existingLinks
    // (fetched once by the caller from GET /nutrition/ingredient-links) is
    // what lets this tell "already linked" from "no link yet". Accepting a
    // match for a not-yet-linked ingredient applies immediately (no review);
    // accepting one for an ingredient that already has a link submits a
    // correction for admin review instead - see
    // Service.SubmitNutritionLinkSuggestion's docs for why. ingredientUnit
    // (this row's own unit text, may be blank) decides via
    // requiredNutritionField whether a density or a per-unit weight must
    // also be collected before a link can be submitted at all - a weight
    // unit needs neither.
    let {
        ingredientName,
        ingredientUnit,
        nutritionIngredients,
        existingLinks,
        toolboxUnits
    }: {
        ingredientName: string
        ingredientUnit: string
        nutritionIngredients: NutritionIngredient[]
        existingLinks: Record<string, IngredientNutritionLink>
        toolboxUnits: ToolboxUnit[]
    } = $props();

    let dismissedKey: string | null = $state(null);
    let submittedFor: string | null = $state(null);
    // justAppliedLink is set once this component itself applies a link
    // directly (Applied response) - merged with the existingLinks prop so
    // the "linked" chip shows immediately without waiting for the parent to
    // refetch GET /nutrition/ingredient-links.
    let justAppliedLink: IngredientNutritionLink | null = $state(null);
    let searching = $state(false);
    let searchValue = $state('');
    let submitting = $state(false);

    // awaitingFieldFor holds the nutrition entry id once "Accept" has been
    // clicked but a required density/grams-per-unit value still needs
    // collecting first (see requiredField below) - the inline expand shows
    // a number input for it instead of submitting immediately.
    let awaitingFieldFor: string | null = $state(null);
    let fieldValue = $state('');

    const requiredField = $derived(requiredNutritionField(ingredientUnit, toolboxUnits));
    const fieldValueNumber = $derived(fieldValue.trim() === '' ? null : Number(fieldValue));
    const fieldValueValid = $derived(requiredField === null || (fieldValueNumber !== null && fieldValueNumber > 0));

    const trimmedName = $derived(ingredientName.trim());

    // displayName resolves a curated entry's name in the site's current
    // language - NutritionIngredient.name is always Ciqual's own French
    // name; .names holds the en/fi translations baked in at import (see
    // CLAUDE.md's Nutrition Info entry). Falls back to the French name for
    // fr itself (not present in .names, since it *is* the canonical name)
    // or if a translation is somehow missing.
    function displayName(item: NutritionIngredient): string {
        return item.names?.[$locale ?? ''] ?? item.name;
    }

    const effectiveLink = $derived(justAppliedLink ?? existingLinks[trimmedName.toLowerCase()]);
    const effectiveLinkTarget = $derived(effectiveLink ? nutritionIngredients.find(n => n.id === effectiveLink.nutrition_id) : undefined);

    // Best match: shortest curated name (in the site's current language) that
    // contains the typed ingredient name, or vice versa, case-insensitively.
    // Matching only against the current locale's own display name (rather
    // than merging in the other languages' names too) is what keeps an
    // English "Flour" from matching via some unrelated entry's French name -
    // and keeps the shortest-name tie-break comparing like with like. Exact
    // matching is what the backend actually uses to resolve nutrition later;
    // this is only a starting suggestion for the author to accept or search
    // past.
    const bestMatch = $derived.by(() => {
        const q = trimmedName.toLowerCase();
        if (q.length < 3) return null;
        let best: NutritionIngredient | null = null;
        let bestName = '';
        for (const candidate of nutritionIngredients) {
            const name = displayName(candidate).toLowerCase();
            if (!(name.includes(q) || q.includes(name))) continue;
            if (!best || name.length < bestName.length) {
                best = candidate;
                bestName = name;
            }
        }
        return best;
    });

    const visible = $derived(
        !effectiveLink &&
        trimmedName.length >= 3 &&
        bestMatch !== null &&
        submittedFor !== trimmedName &&
        dismissedKey !== `${trimmedName}:${bestMatch?.id}`
    );

    // localizedNutritionIngredients feeds IngredientCombobox's search list -
    // it only takes a plain {id, name}[] shape, so the locale resolution
    // happens here rather than inside that (locale-agnostic, shared with
    // Toolbox) component.
    const localizedNutritionIngredients = $derived(nutritionIngredients.map(n => ({id: n.id, name: displayName(n)})));

    function dismiss() {
        if (bestMatch) dismissedKey = `${trimmedName}:${bestMatch.id}`;
    }

    async function accept() {
        if (!bestMatch) return;
        if (requiredField !== null) {
            awaitingFieldFor = bestMatch.id;
            fieldValue = '';
            return;
        }
        await submit(bestMatch.id);
    }

    async function confirmAwaitingField() {
        if (!awaitingFieldFor || !fieldValueValid) return;
        await submit(awaitingFieldFor, fieldValueNumber);
        awaitingFieldFor = null;
    }

    async function submit(nutritionId: string, value?: number | null) {
        submitting = true;
        const {response, data} = await submitNutritionLinkSuggestion({
            ingredient_name: trimmedName, ingredient_unit: ingredientUnit, nutrition_id: nutritionId,
            g_per_100ml: requiredField === 'density' && value != null ? value : undefined,
            grams_per_unit: requiredField === 'grams_per_unit' && value != null ? value : undefined,
        });
        submitting = false;
        if (response.ok && data) {
            searching = false;
            if (data.applied && data.link) {
                justAppliedLink = data.link;
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
        awaitingFieldFor = null;
    }

    async function confirmSearch() {
        if (searchValue && fieldValueValid) await submit(searchValue, fieldValueNumber);
    }
</script>

{#snippet fieldInput()}
    <div class="mt-1.5">
        <label class="block text-xs font-medium text-foreground" for="nutrition-field-{trimmedName}">
            {$_(requiredField === 'density' ? 'edit.ingredients.nutritionLink.densityLabel' : 'edit.ingredients.nutritionLink.gramsPerUnitLabel')}
        </label>
        <input id="nutrition-field-{trimmedName}" type="number" min="0" step="any" bind:value={fieldValue}
               class="mt-1 w-40 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
        <p class="mt-1 text-[11px] text-muted-foreground max-w-xs">
            {$_(requiredField === 'density' ? 'edit.ingredients.nutritionLink.densityHelp' : 'edit.ingredients.nutritionLink.gramsPerUnitHelp')}
        </p>
    </div>
{/snippet}

{#if submittedFor === trimmedName}
    <div class="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
        {$_('edit.ingredients.nutritionLink.submittedChip')}
    </div>
{:else if awaitingFieldFor}
    <div class="mt-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p class="text-xs text-foreground">{$_('edit.ingredients.nutritionLink.suggestion', {values: {name: bestMatch ? displayName(bestMatch) : ''}})}</p>
        {@render fieldInput()}
        <div class="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" disabled={!fieldValueValid || submitting} onclick={confirmAwaitingField}>{$_('edit.ingredients.nutritionLink.link')}</Button>
            <Button type="button" size="sm" variant="outline" onclick={() => awaitingFieldFor = null}>{$_('edit.ingredients.nutritionLink.cancel')}</Button>
        </div>
    </div>
{:else if searching}
    <div class="mt-1.5 rounded-lg border border-border p-3">
        <div class="flex items-center gap-2">
            <div class="flex-1 max-w-xs">
                <IngredientCombobox ingredients={localizedNutritionIngredients} bind:value={searchValue} placeholder={$_('edit.ingredients.nutritionLink.searchPlaceholder')} />
            </div>
            <Button type="button" size="sm" disabled={!searchValue || !fieldValueValid || submitting} onclick={confirmSearch}>{$_('edit.ingredients.nutritionLink.link')}</Button>
            <Button type="button" size="sm" variant="outline" onclick={() => searching = false}>{$_('edit.ingredients.nutritionLink.cancel')}</Button>
        </div>
        {#if requiredField !== null}
            {@render fieldInput()}
        {/if}
    </div>
{:else if effectiveLink}
    <div class="mt-1.5 inline-flex items-center gap-1.5 flex-wrap rounded-full border border-border bg-muted/50 pl-3 pr-1.5 py-1 text-xs">
        <Check class="w-3 h-3 text-primary" />
        <span class="text-foreground">{$_('edit.ingredients.nutritionLink.linkedTo', {values: {name: effectiveLinkTarget ? displayName(effectiveLinkTarget) : effectiveLink.name}})}</span>
        <button type="button" onclick={openSearch} aria-label={$_('edit.ingredients.nutritionLink.linkDifferently')} title={$_('edit.ingredients.nutritionLink.linkDifferently')} class="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent hover:cursor-pointer">
            <Search class="w-3 h-3" />
        </button>
    </div>
{:else if visible && bestMatch}
    <div class="mt-1.5 inline-flex items-center gap-1.5 flex-wrap rounded-full border border-primary/30 bg-primary/5 pl-3 pr-1.5 py-1 text-xs">
        <span class="text-foreground">{$_('edit.ingredients.nutritionLink.suggestion', {values: {name: displayName(bestMatch)}})}</span>
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
