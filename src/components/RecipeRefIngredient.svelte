<script lang="ts">
    import {getFamily, getIngredientName, getReferenceQuantity, getRecipe, groupIngredients, type Ingredient, type Recipe, type RecipePreview} from '$lib/recipes';
    import {locale, _} from 'svelte-i18n';
    import {ChevronDown, ChevronUp} from '@lucide/svelte';

    // ratio is the parent recipe's servings ratio (selectedServings / recipe.quantity)
    // - the reference's own quantity/unit already scales with it, same as any
    // other ingredient row.
    let {ingredient, ratio = 1}: { ingredient: Ingredient, ratio?: number } = $props();

    let expanded = $state(false);
    let loading = $state(false);
    let familyRoot: Recipe | null = $state(null);
    let familyVariations: RecipePreview[] = $state([]);
    let selectedId: string | null = $state(null);
    let selectedRecipe = $state<Recipe | null>(null);
    let variantChosen = $state(false);

    const refId = $derived(ingredient.recipe_ref!);
    const displayId = $derived(variantChosen && selectedId ? selectedId : refId);
    const displayTitle = $derived(
        variantChosen && selectedRecipe ? selectedRecipe.title : (ingredient.ref_label || ingredient.resolved_ref_title)
    );
    const displayQuantity = $derived(getReferenceQuantity(ingredient, ratio));

    async function toggle() {
        expanded = !expanded;
        if (expanded && !familyRoot)
            await load();
    }

    async function load() {
        loading = true;
        try {
            const {root, variations} = await getFamily(refId, $locale ?? undefined);
            if (root.response.ok && root.data) {
                familyRoot = root.data;
                selectedId = root.data.id;
                selectedRecipe = root.data;
            }
            if (variations.response.ok && variations.data)
                familyVariations = variations.data.items;
        } finally {
            loading = false;
        }
    }

    async function selectVariant(id: string) {
        variantChosen = true;
        if (id === selectedId)
            return;
        selectedId = id;
        if (familyRoot && id === familyRoot.id) {
            selectedRecipe = familyRoot;
            return;
        }
        selectedRecipe = null;
        const {response, data} = await getRecipe(id, $locale ?? undefined);
        if (response.ok && data)
            selectedRecipe = data;
    }

    // When the reference has a unit (e.g. "20g of sauce"), that amount is
    // a portion of the sub-recipe, not a multiple of it - there's no
    // weight/yield on a recipe to divide by, so the sub-recipe's own
    // ingredients just scale with the parent's serving scaler like any
    // other ingredient, same as if the reference had no quantity at all.
    // Without a unit, quantity is a count of whole batches (e.g. "2" sauce
    // recipes) - scale by that count against the sub-recipe's own base yield.
    const subRatio = $derived.by(() => {
        if (ingredient.unit && ingredient.unit !== '')
            return ratio;
        if (!selectedRecipe || !ingredient.quantity || ingredient.quantity <= 0 || selectedRecipe.quantity <= 0)
            return 1;
        return (ingredient.quantity * ratio) / selectedRecipe.quantity;
    });

    const previewGroups = $derived.by(() => {
        const sel = selectedRecipe;
        return sel ? groupIngredients(sel.ingredients) : [];
    });
</script>

<div class="flex-1 min-w-0">
    <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-card-foreground">
            {#if displayQuantity}{displayQuantity}{/if}
            <a href={`/${$locale}/recipes/${displayId}`} class="text-primary hover:underline font-medium">{displayTitle}</a>
            <button
                    type="button"
                    onclick={toggle}
                    class="inline-flex items-center align-middle text-xs text-muted-foreground hover:text-foreground transition-colors hover:cursor-pointer"
                    aria-label={$_(expanded ? 'recipe.referenceCollapse' : 'recipe.referenceExpand')}
            >
                {#if expanded}<ChevronUp class="w-3.5 h-3.5" />{:else}<ChevronDown class="w-3.5 h-3.5" />{/if}
            </button>
        </span>
    </div>

    {#if expanded}
        <div class="mt-2 pl-3 pt-2 border-l-2 border-t-2 border-border">
            {#if loading}
                <p class="text-xs text-muted-foreground">…</p>
            {:else if familyRoot}
                {#if familyVariations.length > 0}
                    <div class="mb-2">
                        <div class="flex flex-wrap gap-1.5">
                            <button
                                    type="button"
                                    onclick={() => selectVariant(familyRoot!.id)}
                                    class="text-xs px-2 py-0.5 rounded-full border transition-colors hover:cursor-pointer {selectedId === familyRoot.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}"
                            >
                                {familyRoot.title}
                            </button>
                            {#each familyVariations as variation (variation.id)}
                                <button
                                        type="button"
                                        onclick={() => selectVariant(variation.id)}
                                        class="text-xs px-2 py-0.5 rounded-full border transition-colors hover:cursor-pointer {selectedId === variation.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}"
                                >
                                    {variation.title}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if selectedRecipe}
                    <ul class="space-y-1">
                        {#each previewGroups as group}
                            {#each group.items as sub}
                                <li class="text-sm text-muted-foreground">
                                    {#if sub.recipe_ref}
                                        {getReferenceQuantity(sub, subRatio)}
                                        <a href={`/${$locale}/recipes/${sub.recipe_ref}`} class="text-primary hover:underline">{sub.ref_label || sub.resolved_ref_title}</a>
                                    {:else}
                                        {getIngredientName(sub, subRatio)}
                                    {/if}
                                </li>
                            {/each}
                        {/each}
                    </ul>
                {/if}
            {/if}
        </div>
    {/if}
</div>
