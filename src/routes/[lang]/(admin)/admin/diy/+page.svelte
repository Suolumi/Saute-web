<script lang="ts">
    import { untrack } from 'svelte';
    import {_, locale} from 'svelte-i18n';
    import {goto} from '$app/navigation';
    import {Heart} from '@lucide/svelte';
    import Button from '../../../../../components/Button.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import RecipeFavoritesModal from '../../../../../components/RecipeFavoritesModal.svelte';
    import RecipeFilters from '../../../../../components/RecipeFilters.svelte';
    import {getAdminRecipes, retranslateRecipe} from '$lib/admin';
    import {deleteRecipe, type RecipePreview} from '$lib/recipes';
    import {serverUrl} from '$lib/stores';
    import {apiErrorMessage} from '$lib/api';
    import {toastError, toastSuccess} from '$lib/utils';

    const PAGE_SIZE = 20;

    let searchTerm = $state('');
    let author = $state('');
    let ingredients: string[] = $state([]);

    let recipes: RecipePreview[] = $state([]);
    let total = $state(0);
    let offset = $state(0);
    let deleteModal = $state({isOpen: false, id: '', title: ''});
    let favoritesModal = $state({isOpen: false, id: '', title: ''});

    function load() {
        getAdminRecipes({
            category: 'diy',
            title: searchTerm || undefined,
            author: author || undefined,
            ingredients: ingredients.length > 0 ? ingredients : undefined,
            limit: PAGE_SIZE, offset, locale: $locale ?? undefined,
        }).then(({response, data}) => {
            if (response.ok && data) {
                recipes = data.items;
                total = data.length;
            } else {
                toastError($_('admin.errors.loadDiy'));
            }
        });
    }

    $effect(() => {
        searchTerm; author; ingredients;
        untrack(() => {
            offset = 0;
            load();
        });
    });

    function editR(id: string) {
        goto(`/${$locale}/recipes/${id}/edit`);
    }

    function confirmDelete() {
        deleteRecipe(deleteModal.id).then(({response, data}) => {
            if (response.ok) {
                recipes = recipes.filter(r => r.id !== deleteModal.id);
                toastSuccess($_('admin.diy.deleted'));
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.deleteDiy')));
            }
        }).finally(() => {
            deleteModal = {isOpen: false, id: '', title: ''};
        });
    }

    function doRetranslate(recipe: RecipePreview) {
        retranslateRecipe(recipe.id).then(({response, data}) => {
            if (response.ok)
                toastSuccess($_('admin.recipes.retranslateScheduled'));
            else
                toastError(apiErrorMessage(data, $_('admin.errors.retranslate')));
        });
    }
</script>

<div class="space-y-4">
    <h1 class="text-2xl font-bold text-foreground">{$_('admin.diy.title')} ({total})</h1>

    <RecipeFilters
            showKind={false}
            showTime={false}
            bind:searchTerm
            bind:author
            bind:ingredients
            searchPlaceholder={$_('admin.diy.searchPlaceholder')}
            ingredientsLabel={$_('diyHome.materials')}
            ingredientsPlaceholder={$_('diyHome.materialsPlaceholder')}
    />

    <div class="bg-card rounded-lg border border-border divide-y divide-border">
        {#each recipes as recipe (recipe.id)}
            <div class="flex flex-wrap items-center gap-3 p-4">
                {#if recipe.pictures?.[0]}
                    <img src={`${$serverUrl}/recipe-pictures/${recipe.pictures[0]}`} alt={recipe.title} class="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                {:else}
                    <div class="w-10 h-10 rounded-md bg-muted flex-shrink-0"></div>
                {/if}

                <div class="min-w-0 flex-1">
                    <p class="font-medium text-card-foreground truncate">
                        {recipe.title}
                        {#if recipe.variation_of}
                            <span class="ml-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{$_('admin.recipes.variationBadge')}</span>
                        {/if}
                    </p>
                    <p class="text-xs text-muted-foreground truncate">{recipe.author?.username}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button
                            size="sm" variant="outline"
                            disabled={recipe.favorite_count === 0}
                            onclick={() => favoritesModal = {isOpen: true, id: recipe.id, title: recipe.title}}
                            aria-label={$_('admin.diy.favorites', {values: {count: recipe.favorite_count}})}
                    >
                        <Heart size="14" class="mr-1" />
                        {recipe.favorite_count}
                    </Button>
                    <Button size="sm" variant="outline" onclick={() => editR(recipe.id)}>
                        {$_('admin.diy.edit')}
                    </Button>
                    <Button size="sm" variant="outline" onclick={() => doRetranslate(recipe)}>
                        {$_('admin.diy.retranslate')}
                    </Button>
                    <Button size="sm" variant="destructive" onclick={() => deleteModal = {isOpen: true, id: recipe.id, title: recipe.title}}>
                        {$_('admin.diy.delete')}
                    </Button>
                </div>
            </div>
        {:else}
            <p class="p-4 text-muted-foreground">{$_('admin.diy.none')}</p>
        {/each}
    </div>

    <div class="flex justify-center gap-3">
        <Button variant="outline" size="sm" disabled={offset === 0} onclick={() => { offset = Math.max(0, offset - PAGE_SIZE); load(); }}>
            {$_('admin.diy.prev')}
        </Button>
        <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onclick={() => { offset += PAGE_SIZE; load(); }}>
            {$_('admin.diy.next')}
        </Button>
    </div>
</div>

<Modal open={deleteModal.isOpen} onClose={() => deleteModal.isOpen = false} title={$_('admin.diy.deleteConfirmTitle')} description={$_('admin.diy.deleteConfirmDescription', {values: {title: deleteModal.title}})}>
    <div class="flex justify-between">
        <Button variant="outline" onclick={() => deleteModal.isOpen = false}>
            {$_('admin.diy.cancel')}
        </Button>
        <Button variant="destructive" onclick={confirmDelete}>
            {$_('admin.diy.confirmDelete')}
        </Button>
    </div>
</Modal>

<RecipeFavoritesModal
        open={favoritesModal.isOpen}
        onClose={() => favoritesModal.isOpen = false}
        recipeId={favoritesModal.id}
        recipeTitle={favoritesModal.title}
/>
