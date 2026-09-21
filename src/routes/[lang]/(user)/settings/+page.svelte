<script lang="ts">
    import Button from '../../../../components/Button.svelte';
    import RecipeCard from '../../../../components/RecipeCard.svelte';
    import RecipeFilters from '../../../../components/RecipeFilters.svelte';
    import RecipePickerModal from '../../../../components/RecipePickerModal.svelte';
    import {goto} from "$app/navigation";
    import {getRecipes, linkRecipeVariation, type GetRecipesRequest, type RecipeCategory, type RecipePreview, type RecipeType, type TimePreset} from "$lib/recipes";
    import {user} from "$lib/stores";
    import { SquarePen, Trash, MoreVertical, Link2, SearchX } from '@lucide/svelte';
    import {toastError, toastSuccess} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";
    import {locale, _} from "svelte-i18n";
    import Modal from "../../../../components/Modal.svelte";
    import {deleteRecipe} from "$lib/recipes";

    let userRecipes: RecipePreview[] = $state([])
    let loading = $state(false)
    let searchTerm = $state('')
    let selectedType = $state('all')
    let ingredients: string[] = $state([])
    let timeBasis: 'prep' | 'total' = $state('total')
    let timeTarget: TimePreset = $state('any')
    let popular = $state(false)
    let categoryFilter: 'all' | RecipeCategory = $state('all')
    // The backend's own_recipes listing only narrows server-side for an
    // explicit "diy" category (see GetRecipesRequest.Category) - "food"
    // still needs a client-side pass, since a recipe predating the category
    // field counts as food (matching the backend's own $ne-based default-
    // listing filter) and the server has no way to express that as a query.
    const matchesCategoryFilter = (r: RecipePreview) =>
        categoryFilter !== 'food' || !r.category || r.category === 'food'
    let filteredRecipes = $derived(userRecipes.filter(matchesCategoryFilter))
    let modal = $state({
        isOpen: false,
        recipeId: ""
    });

    // openMenuId tracks which recipe's "..." action menu is currently open -
    // only one at a time, closed by picking an action, clicking elsewhere, or
    // toggling it again.
    let openMenuId: string | null = $state(null);

    let linkPicker = $state({isOpen: false, recipe: null as RecipePreview | null});
    let linkConfirm = $state({isOpen: false, recipe: null as RecipePreview | null, target: null as RecipePreview | null});
    let linking = $state(false);

    function toggleMenu(id: string) {
        openMenuId = openMenuId === id ? null : id;
    }

    function closeMenu() {
        openMenuId = null;
    }

    function openLinkPicker(recipe: RecipePreview) {
        closeMenu();
        linkPicker = {isOpen: true, recipe};
    }

    function onLinkTargetPicked(target: RecipePreview) {
        linkConfirm = {isOpen: true, recipe: linkPicker.recipe, target};
    }

    function confirmLinkVariation() {
        const {recipe, target} = linkConfirm;
        if (!recipe || !target)
            return;
        linking = true;
        linkRecipeVariation(recipe.id, target.id).then(({response, data}) => {
            if (response.ok) {
                toastSuccess($_('settings.linkVariation.success'));
                userRecipes = userRecipes.map(r =>
                    r.id === recipe.id ? {...r, variation_of: target.id} : r
                );
                linkConfirm = {isOpen: false, recipe: null, target: null};
            } else {
                toastError(apiErrorMessage(data, $_('settings.linkVariation.error')));
            }
        }).finally(() => {
            linking = false;
        });
    }

    function deleteR(id: string) {
        deleteRecipe(id).then(({response}) => {
            if (response.ok) {
                toastSuccess($_('settings.delete.success'))
                userRecipes = userRecipes.filter(e => e.id !== id)
            } else {
                toastError($_('settings.errors.delete'));
            }
        }).catch(err => {
            console.log(err)
            toastError($_('settings.errors.delete'));
        }).finally(() => {
            modal.isOpen = false
        })
    }

    function buildRequest(): GetRecipesRequest {
        const request: GetRecipesRequest = {
            author: $user?.username ?? '',
            own_recipes: true,
            // Only "diy" narrows server-side (see matchesCategoryFilter) -
            // "all"/"food" both fetch every category and let the client
            // filter handle "food".
            category: categoryFilter === 'diy' ? 'diy' : undefined,
        }
        if (selectedType !== 'all')
            request.kind = selectedType as RecipeType
        if (searchTerm.length > 0)
            request.title = searchTerm
        if (ingredients.length > 0)
            request.ingredients = ingredients
        if (popular) {
            request.popular = true
        } else if (timeTarget === 'quick') {
            if (timeBasis === 'prep')
                request.quickest_prep = true
            else
                request.quickest_total = true
        } else if (timeTarget !== 'any') {
            const minutes = Number(timeTarget)
            if (timeBasis === 'prep')
                request.preparation_time = minutes
            else
                request.total_time = minutes
        }
        request.locale = $locale ?? 'en'
        request.search_locale = $locale ?? 'en'
        request.limit = 100
        return request
    }

    $effect(() => {
        categoryFilter; searchTerm; selectedType; ingredients; timeBasis; timeTarget; popular; $locale;
        loading = true
        getRecipes(buildRequest()).then(({response, data}) => {
            loading = false
            if (response.ok && data)
                userRecipes = data.items
            else
                toastError($_('settings.errors.getRecipes'))
        })
    })

    function editRecipe(id: string) {
        goto(`/${$locale}/recipes/${id}/edit`)
    }
</script>

<svelte:window onclick={closeMenu} />

<div class="inline-flex rounded-lg border border-border p-1 mb-6">
    {#each [['all', 'settings.filterAll'], ['food', 'settings.filterFood'], ['diy', 'settings.filterDiy']] as [value, key] (value)}
        <button
                type="button"
                onclick={() => categoryFilter = value as 'all' | RecipeCategory}
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:cursor-pointer {categoryFilter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        >
            {$_(key)}
        </button>
    {/each}
</div>

<RecipeFilters
        bind:searchTerm
        bind:selectedType
        bind:ingredients
        bind:timeBasis
        bind:timeTarget
        bind:popular
        author=""
        showAuthor={false}
        searchPlaceholder={$_('home.search')}
        ingredientsLabel={$_('home.ingredients')}
        ingredientsPlaceholder={$_('home.ingredientsPlaceholder')}
/>

{#if !loading}
    <p class="text-sm text-muted-foreground mb-4">{$_('home.resultCount', {values: {count: filteredRecipes.length}})}</p>
{/if}

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each filteredRecipes as recipe}
        <div class="relative h-full">
            <RecipeCard {recipe} disabled={false} />
            <div class="absolute top-2 right-2">
                <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); toggleMenu(recipe.id); }}
                        class="p-2 rounded-lg bg-card/90 hover:bg-card border border-border hover:cursor-pointer"
                        aria-label={$_('settings.actions.menu')}
                >
                    <MoreVertical class="text-black dark:text-white" size="16" />
                </button>
                {#if openMenuId === recipe.id}
                    <div class="absolute right-0 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg py-1 z-10">
                        <button
                                type="button"
                                onclick={() => { closeMenu(); editRecipe(recipe.id); }}
                                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-card-foreground hover:bg-muted hover:cursor-pointer"
                        >
                            <SquarePen size="16" />
                            {$_('settings.actions.edit')}
                        </button>
                        <button
                                type="button"
                                onclick={() => openLinkPicker(recipe)}
                                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-card-foreground hover:bg-muted hover:cursor-pointer"
                        >
                            <Link2 size="16" />
                            {$_('settings.actions.linkAsVariation')}
                        </button>
                        <button
                                type="button"
                                onclick={() => { closeMenu(); modal = {isOpen: true, recipeId: recipe.id}; }}
                                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted hover:cursor-pointer"
                        >
                            <Trash size="16" />
                            {$_('settings.actions.remove')}
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    {/each}
</div>

{#if !loading && filteredRecipes.length === 0}
    {#if userRecipes.length === 0 && searchTerm.length === 0 && categoryFilter === 'all'}
        <div class="text-center py-12">
            <p class="text-muted-foreground mb-4">{$_('settings.noRecipes')}</p>
            <Button onclick={() => goto(`/${$locale}/create`)}>
                {$_('settings.createRecipe')}
            </Button>
        </div>
    {:else}
        <div class="text-center py-12">
            <SearchX class="mx-auto w-16 h-16 text-muted-foreground mb-4" />
            <h3 class="text-xl font-semibold text-foreground mb-2">{$_('home.notFound')}</h3>
            <p class="text-muted-foreground">{$_('home.adjustSearch')}</p>
        </div>
    {/if}
{/if}

{#if loading}
    <div class="flex justify-center py-8">
        <div class="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin"></div>
    </div>
{/if}

<Modal open={modal.isOpen} onClose={() => modal.isOpen = false} title={$_('settings.delete.title')}>
    <div class="flex justify-between">
        <Button
                variant="outline"
                size="md"
                onclick={() => modal.isOpen = false}
                class="bg-red-800"
        >
            {$_('settings.delete.cancel')}
        </Button>
        <Button
                variant="outline"
                size="md"
                onclick={() => deleteR(modal.recipeId)}
                class="bg-primary"
        >
            {$_('settings.delete.confirm')}
        </Button>
    </div>
</Modal>

<RecipePickerModal
        open={linkPicker.isOpen}
        excludeFamily={linkPicker.recipe?.variation_of ?? linkPicker.recipe?.id}
        category={linkPicker.recipe?.category}
        title={$_('settings.linkVariation.pickerTitle')}
        description={$_('settings.linkVariation.pickerDescription')}
        onClose={() => linkPicker = {isOpen: false, recipe: null}}
        onSelect={onLinkTargetPicked}
/>

<Modal
        open={linkConfirm.isOpen}
        title={$_('settings.linkVariation.confirmTitle', {values: {title: linkConfirm.recipe?.title ?? '', target: linkConfirm.target?.title ?? ''}})}
        description={$_('settings.linkVariation.confirmDescription', {values: {target: linkConfirm.target?.title ?? ''}})}
        onClose={() => linkConfirm = {isOpen: false, recipe: null, target: null}}
>
    <div class="flex justify-between">
        <Button
                variant="outline"
                size="md"
                onclick={() => linkConfirm = {isOpen: false, recipe: null, target: null}}
        >
            {$_('settings.linkVariation.cancel')}
        </Button>
        <Button
                variant="primary"
                size="md"
                disabled={linking}
                onclick={confirmLinkVariation}
        >
            {$_('settings.linkVariation.confirm')}
        </Button>
    </div>
</Modal>
