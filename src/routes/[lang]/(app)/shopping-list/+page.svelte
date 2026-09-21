<script lang="ts">
    import PageMeta from '../../../../components/PageMeta.svelte';
    import Button from '../../../../components/Button.svelte';
    import RecipePickerModal from '../../../../components/RecipePickerModal.svelte';
    import Checkbox from '../../../../components/Checkbox.svelte';
    import {locale, _} from 'svelte-i18n';
    import {goto} from '$app/navigation';
    import {serverUrl, user} from '$lib/stores';
    import {getRecipe, type RecipePreview} from '$lib/recipes';
    import {
        shoppingList,
        addRecipeToShoppingList,
        removeRecipeFromShoppingList,
        setRecipeServings,
        setLineChecked,
        clearCheckedFromShoppingList,
        clearShoppingList,
        buildRecipeSummaries,
        buildShoppingListGroups,
        capitalizeIngredientHeading,
    } from '$lib/shoppingList';
    import {toastError} from '$lib/utils';
    import {ShoppingCart, Plus, Minus, X, ChefHat} from '@lucide/svelte';

    let pickerOpen = $state(false);

    let recipes = $derived(buildRecipeSummaries($shoppingList));
    let groups = $derived(buildShoppingListGroups($shoppingList));
    let excludeRecipeIds = $derived(recipes.map(r => r.recipeId));
    let hasChecked = $derived($shoppingList.some(e => e.checked));

    async function handleConfirm(picked: RecipePreview[]) {
        const fetched = await Promise.all(picked.map(r => getRecipe(r.id, $locale ?? undefined)));
        for (const {response, data} of fetched) {
            if (response.ok && data)
                addRecipeToShoppingList(data.id, data.title, data.quantity, data.pictures[0]?.filename, data.ingredients);
            else
                toastError($_('shoppingList.addError'));
        }
    }

    function decreaseServings(recipeId: string, servings: number) {
        if (servings > 1)
            setRecipeServings(recipeId, servings - 1);
    }

    function increaseServings(recipeId: string, servings: number) {
        setRecipeServings(recipeId, servings + 1);
    }
</script>

<PageMeta title={$_('shoppingList.meta.title')} description={$_('shoppingList.meta.description')} />

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if !$user}
        <div class="max-w-md mx-auto text-center py-24">
            <h1 class="text-2xl font-bold text-foreground mb-2">{$_('shoppingList.unauthorized.title')}</h1>
            <p class="text-muted-foreground mb-4">{$_('shoppingList.unauthorized.description')}</p>
            <Button onclick={() => goto(`/${$locale}/login`)}>{$_('header.login')}</Button>
        </div>
    {:else}
        <div class="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                    <ShoppingCart class="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                    <h1 class="text-3xl font-bold text-foreground">{$_('shoppingList.title')}</h1>
                    {#if recipes.length > 0}
                        <p class="text-sm text-muted-foreground mt-0.5">
                            {$_('shoppingList.summary', {values: {recipes: recipes.length, items: groups.length}})}
                        </p>
                    {/if}
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Button
                        onclick={() => pickerOpen = true}
                        class="flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                    <Plus class="w-4 h-4" />
                    {$_('shoppingList.addRecipes')}
                </Button>
                {#if $shoppingList.length > 0}
                    <Button variant="outline" onclick={clearShoppingList}>{$_('shoppingList.clearAll')}</Button>
                {/if}
            </div>
        </div>

        {#if $shoppingList.length === 0}
            <div class="text-center py-12">
                <ShoppingCart class="mx-auto w-16 h-16 text-muted-foreground mb-4" />
                <h3 class="text-xl font-semibold text-foreground mb-2">{$_('shoppingList.empty.title')}</h3>
                <p class="text-muted-foreground">{$_('shoppingList.empty.description')}</p>
            </div>
        {:else}
            <div class="mb-6">
                <h2 class="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">{$_('shoppingList.recipesTitle')}</h2>
                <div class="flex gap-3.5 overflow-x-auto pb-1">
                    {#each recipes as recipe (recipe.recipeId)}
                        <div class="w-52 flex-shrink-0 rounded-2xl border border-border overflow-hidden bg-card relative">
                            <a href={`/${$locale}/recipes/${recipe.recipeId}`} class="block h-24 bg-muted flex items-center justify-center">
                                {#if recipe.recipePicture}
                                    <img
                                            src={`${$serverUrl}/recipe-pictures/${recipe.recipePicture}`}
                                            alt={recipe.recipeTitle}
                                            class="w-full h-full object-cover"
                                    />
                                {:else}
                                    <ChefHat class="w-7 h-7 text-primary" />
                                {/if}
                            </a>
                            <button
                                    type="button"
                                    onclick={() => removeRecipeFromShoppingList(recipe.recipeId)}
                                    class="absolute top-2 right-2 w-6.5 h-6.5 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center hover:cursor-pointer"
                                    aria-label={$_('shoppingList.removeRecipe')}
                            >
                                <X class="w-3.5 h-3.5" />
                            </button>
                            <div class="p-3">
                                <a
                                        href={`/${$locale}/recipes/${recipe.recipeId}`}
                                        class="block text-sm font-semibold text-card-foreground hover:text-primary truncate mb-2"
                                >
                                    {recipe.recipeTitle}
                                </a>
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-muted-foreground">{$_('recipe.servings')}</span>
                                    <div class="flex items-center gap-2">
                                        <button
                                                type="button"
                                                onclick={() => decreaseServings(recipe.recipeId, recipe.servings)}
                                                class="w-5.5 h-5.5 rounded-full border border-border flex items-center justify-center hover:bg-muted hover:cursor-pointer"
                                                aria-label={$_('recipe.decreaseServings')}
                                        >
                                            <Minus class="w-3 h-3" />
                                        </button>
                                        <span class="text-xs font-bold text-card-foreground w-3 text-center">{recipe.servings}</span>
                                        <button
                                                type="button"
                                                onclick={() => increaseServings(recipe.recipeId, recipe.servings)}
                                                class="w-5.5 h-5.5 rounded-full border border-border flex items-center justify-center hover:bg-muted hover:cursor-pointer"
                                                aria-label={$_('recipe.increaseServings')}
                                        >
                                            <Plus class="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            {#snippet pill(sub: {text: string, checked: boolean})}
                {#if sub.text}
                    <span class="text-xs font-bold rounded-full px-2.5 py-0.5 flex-shrink-0 {sub.checked ? 'bg-muted text-muted-foreground line-through' : 'bg-primary/10 text-primary'}">
                        {sub.text}
                    </span>
                {/if}
            {/snippet}

            <div class="bg-card rounded-lg border border-border p-6">
                <div class="flex items-center justify-between mb-2">
                    <h2 class="text-lg font-semibold text-card-foreground">{$_('shoppingList.ingredientsTitle')}</h2>
                    {#if hasChecked}
                        <button
                                type="button"
                                onclick={clearCheckedFromShoppingList}
                                class="text-sm text-muted-foreground hover:text-foreground transition-colors hover:cursor-pointer"
                        >
                            {$_('shoppingList.clearChecked')}
                        </button>
                    {/if}
                </div>
                <ul>
                    {#each groups as group (group.key)}
                        <li class="border-b border-dashed border-border last:border-b-0">
                            {#if group.subLines.length === 1 && !group.subLines[0].isReference}
                                {@const sub = group.subLines[0]}
                                <button
                                        type="button"
                                        onclick={() => setLineChecked(sub.entryIds, !sub.checked)}
                                        class="flex items-center gap-3 text-left w-full py-2.5 hover:cursor-pointer"
                                >
                                    <Checkbox checked={sub.checked} decorative />
                                    {@render pill(sub)}
                                    <span class={sub.checked ? 'line-through text-muted-foreground' : 'text-card-foreground'}>
                                        {group.name}
                                    </span>
                                </button>
                            {:else if group.subLines.length === 1}
                                {@const sub = group.subLines[0]}
                                <div class="flex items-center gap-2 py-2.5">
                                    <button
                                            type="button"
                                            onclick={() => setLineChecked(sub.entryIds, !sub.checked)}
                                            class="flex items-center gap-3 text-left hover:cursor-pointer"
                                    >
                                        <Checkbox checked={sub.checked} decorative />
                                        {@render pill(sub)}
                                    </button>
                                    <a
                                            href={`/${$locale}/recipes/${sub.referenceId}`}
                                            class="text-primary hover:underline {sub.checked ? 'line-through' : ''}"
                                    >
                                        {group.name}
                                    </a>
                                </div>
                            {:else}
                                <h3 class="font-semibold text-card-foreground text-sm pt-3 mb-1">{capitalizeIngredientHeading(group.name)}</h3>
                                <ul class="pb-1">
                                    {#each group.subLines as sub (sub.key)}
                                        <li>
                                            <button
                                                    type="button"
                                                    onclick={() => setLineChecked(sub.entryIds, !sub.checked)}
                                                    class="flex items-center gap-3 text-left w-full py-1.5 hover:cursor-pointer"
                                            >
                                                <Checkbox checked={sub.checked} decorative />
                                                {@render pill(sub)}
                                            </button>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        <RecipePickerModal
                open={pickerOpen}
                multiSelect
                excludeRecipeIds={excludeRecipeIds}
                title={$_('shoppingList.picker.title')}
                description={$_('shoppingList.picker.description')}
                onClose={() => pickerOpen = false}
                onConfirm={handleConfirm}
        />
    {/if}
</div>
