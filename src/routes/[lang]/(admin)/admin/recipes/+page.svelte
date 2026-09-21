<script lang="ts">
    import { untrack } from 'svelte';
    import {_, locale} from 'svelte-i18n';
    import {goto} from '$app/navigation';
    import Button from '../../../../../components/Button.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import RecipeFilters from '../../../../../components/RecipeFilters.svelte';
    import {getAdminRecipes, retranslateRecipe} from '$lib/admin';
    import {deleteRecipe, type RecipePreview, type RecipeType, type TimePreset} from '$lib/recipes';
    import {serverUrl} from '$lib/stores';
    import {apiErrorMessage} from '$lib/api';
    import {toastError, toastSuccess} from '$lib/utils';

    const PAGE_SIZE = 20;

    let searchTerm = $state('');
    let selectedType = $state('all');
    let author = $state('');
    let ingredients: string[] = $state([]);
    let timeBasis: 'prep' | 'total' = $state('total');
    let timeTarget: TimePreset = $state('any');

    let recipes: RecipePreview[] = $state([]);
    let total = $state(0);
    let offset = $state(0);
    let deleteModal = $state({isOpen: false, id: '', title: ''});

    function load() {
        getAdminRecipes({
            title: searchTerm || undefined,
            author: author || undefined,
            kind: selectedType !== 'all' ? (selectedType as RecipeType) : undefined,
            ingredients: ingredients.length > 0 ? ingredients : undefined,
            quickest_prep: timeTarget === 'quick' && timeBasis === 'prep' ? true : undefined,
            quickest_total: timeTarget === 'quick' && timeBasis === 'total' ? true : undefined,
            preparation_time: timeTarget !== 'any' && timeTarget !== 'quick' && timeBasis === 'prep' ? Number(timeTarget) : undefined,
            total_time: timeTarget !== 'any' && timeTarget !== 'quick' && timeBasis === 'total' ? Number(timeTarget) : undefined,
            limit: PAGE_SIZE, offset, locale: $locale ?? undefined,
        }).then(({response, data}) => {
            if (response.ok && data) {
                recipes = data.items;
                total = data.length;
            } else {
                toastError($_('admin.errors.loadRecipes'));
            }
        });
    }

    $effect(() => {
        searchTerm; selectedType; author; ingredients; timeBasis; timeTarget;
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
                toastSuccess($_('admin.recipes.deleted'));
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.deleteRecipe')));
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
    <h1 class="text-2xl font-bold text-foreground">{$_('admin.recipes.title')} ({total})</h1>

    <RecipeFilters
            bind:searchTerm
            bind:selectedType
            bind:author
            bind:ingredients
            bind:timeBasis
            bind:timeTarget
            searchPlaceholder={$_('admin.recipes.searchPlaceholder')}
            ingredientsLabel={$_('home.ingredients')}
            ingredientsPlaceholder={$_('home.ingredientsPlaceholder')}
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
                    <p class="text-xs text-muted-foreground truncate">{recipe.author?.username} · {recipe.category}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onclick={() => editR(recipe.id)}>
                        {$_('admin.recipes.edit')}
                    </Button>
                    <Button size="sm" variant="outline" onclick={() => doRetranslate(recipe)}>
                        {$_('admin.recipes.retranslate')}
                    </Button>
                    <Button size="sm" variant="destructive" onclick={() => deleteModal = {isOpen: true, id: recipe.id, title: recipe.title}}>
                        {$_('admin.recipes.delete')}
                    </Button>
                </div>
            </div>
        {:else}
            <p class="p-4 text-muted-foreground">{$_('admin.recipes.none')}</p>
        {/each}
    </div>

    <div class="flex justify-center gap-3">
        <Button variant="outline" size="sm" disabled={offset === 0} onclick={() => { offset = Math.max(0, offset - PAGE_SIZE); load(); }}>
            {$_('admin.recipes.prev')}
        </Button>
        <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onclick={() => { offset += PAGE_SIZE; load(); }}>
            {$_('admin.recipes.next')}
        </Button>
    </div>
</div>

<Modal open={deleteModal.isOpen} onClose={() => deleteModal.isOpen = false} title={$_('admin.recipes.deleteConfirmTitle')} description={$_('admin.recipes.deleteConfirmDescription', {values: {title: deleteModal.title}})}>
    <div class="flex justify-between">
        <Button variant="outline" onclick={() => deleteModal.isOpen = false}>
            {$_('admin.recipes.cancel')}
        </Button>
        <Button variant="destructive" onclick={confirmDelete}>
            {$_('admin.recipes.confirmDelete')}
        </Button>
    </div>
</Modal>
