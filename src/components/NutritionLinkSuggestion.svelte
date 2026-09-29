<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import {X, Search, Check} from '@lucide/svelte';
    import {submitNutritionLinkSuggestion, type NutritionIngredient, type IngredientNutritionLink} from '$lib/nutrition';
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
    // Service.SubmitNutritionLinkSuggestion's docs for why.
    let {
        ingredientName,
        nutritionIngredients,
        existingLinks
    }: {
        ingredientName: string
        nutritionIngredients: NutritionIngredient[]
        existingLinks: Record<string, IngredientNutritionLink>
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
        await submit(bestMatch.id);
    }

    async function submit(nutritionId: string) {
        submitting = true;
        const {response, data} = await submitNutritionLinkSuggestion({ingredient_name: trimmedName, nutrition_id: nutritionId});
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
    }

    async function confirmSearch() {
        if (searchValue) await submit(searchValue);
    }
</script>

{#if submittedFor === trimmedName}
    <div class="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
        {$_('edit.ingredients.nutritionLink.submittedChip')}
    </div>
{:else if searching}
    <div class="mt-1.5 flex items-center gap-2">
        <div class="flex-1 max-w-xs">
            <IngredientCombobox ingredients={localizedNutritionIngredients} bind:value={searchValue} placeholder={$_('edit.ingredients.nutritionLink.searchPlaceholder')} />
        </div>
        <Button type="button" size="sm" disabled={!searchValue || submitting} onclick={confirmSearch}>{$_('edit.ingredients.nutritionLink.link')}</Button>
        <Button type="button" size="sm" variant="outline" onclick={() => searching = false}>{$_('edit.ingredients.nutritionLink.cancel')}</Button>
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
