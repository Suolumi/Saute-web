<script lang="ts">
    import Modal from './Modal.svelte';
    import {getRecipes, type RecipeCategory, type RecipePreview} from '$lib/recipes';
    import {serverUrl} from '$lib/stores';
    import {locale, _} from 'svelte-i18n';
    import {toastError} from '$lib/utils';

    interface Props {
        open: boolean;
        // excludeFamily is this recipe's own root id (if it has one yet) -
        // a recipe can't offer itself or its own family as a reference
        // target. UX nicety only; the server is the authoritative check.
        excludeFamily?: string;
        // category, when set, restricts results to that category (e.g. the
        // "link as variation" flow only offers same-category targets). Also
        // a UX nicety - the server is the authoritative check wherever one
        // applies.
        category?: RecipeCategory;
        // title/description override the default ingredient-picker copy for
        // a caller using this same picker for a different purpose (e.g.
        // linking a recipe as a variation).
        title?: string;
        description?: string;
        onClose: () => void;
        onSelect: (recipe: RecipePreview) => void;
    }

    let {open, excludeFamily, category, title, description, onClose, onSelect}: Props = $props();

    let query = $state('');
    let results: RecipePreview[] = $state([]);
    let loading = $state(false);
    let searched = $state(false);
    let searchId = 0;

    $effect(() => {
        if (!open)
            return;
        const term = query.trim();
        const id = ++searchId;
        loading = true;
        const timeout = setTimeout(() => {
            getRecipes({title: term || undefined, exclude_family: excludeFamily, category, locale: $locale ?? undefined, limit: 20})
                .then(({response, data}) => {
                    if (id !== searchId)
                        return;
                    loading = false;
                    searched = true;
                    if (response.ok && data)
                        results = data.items;
                    else
                        toastError($_('edit.ingredients.recipePicker.error'));
                });
        }, 250);
        return () => clearTimeout(timeout);
    });

    function select(recipe: RecipePreview) {
        onSelect(recipe);
        onClose();
    }
</script>

<Modal
        {open}
        title={title ?? $_('edit.ingredients.recipePicker.title')}
        description={description ?? $_('edit.ingredients.recipePicker.description')}
        {onClose}
>
    <input
            type="text"
            bind:value={query}
            placeholder={$_('edit.ingredients.recipePicker.searchPlaceholder')}
            class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
    <div class="mt-3 max-h-[50vh] overflow-y-auto flex flex-col gap-1">
        {#if loading}
            <div class="py-8 text-center text-muted-foreground">…</div>
        {:else if searched && results.length === 0}
            <div class="py-8 text-center text-muted-foreground">{$_('edit.ingredients.recipePicker.noResults')}</div>
        {:else}
            {#each results as recipe (recipe.id)}
                <button
                        type="button"
                        onclick={() => select(recipe)}
                        class="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-muted transition-colors hover:cursor-pointer"
                >
                    {#if recipe.pictures?.[0]}
                        <img
                                src={`${$serverUrl}/recipe-pictures/${recipe.pictures[0]}`}
                                alt={recipe.title}
                                class="w-12 h-12 rounded-md object-cover flex-shrink-0"
                        />
                    {:else}
                        <div class="w-12 h-12 rounded-md bg-muted flex-shrink-0"></div>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <p class="font-medium text-card-foreground truncate">{recipe.title}</p>
                        <p class="text-xs text-muted-foreground truncate">{$_('recipeCard.by')} {recipe.author?.username}</p>
                    </div>
                    {#if !recipe.variation_of && recipe.variation_count > 0}
                        <span class="ml-auto flex-shrink-0 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                            {$_('recipeCard.variationCount', {values: {count: recipe.variation_count}})}
                        </span>
                    {/if}
                </button>
            {/each}
        {/if}
    </div>
</Modal>
