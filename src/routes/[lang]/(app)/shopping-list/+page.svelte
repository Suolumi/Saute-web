<script lang="ts">
    import PageMeta from '../../../../components/PageMeta.svelte';
    import Button from '../../../../components/Button.svelte';
    import RecipePickerModal from '../../../../components/RecipePickerModal.svelte';
    import Checkbox from '../../../../components/Checkbox.svelte';
    import {locale, _} from 'svelte-i18n';
    import {goto} from '$app/navigation';
    import {user} from '$lib/stores';
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
    } from '$lib/shoppingList';
    import {toastError} from '$lib/utils';
    import {ShoppingCart, Plus, Minus, Trash2} from '@lucide/svelte';

    let pickerOpen = $state(false);

    let recipes = $derived(buildRecipeSummaries($shoppingList));
    let groups = $derived(buildShoppingListGroups($shoppingList));
    let excludeRecipeIds = $derived(recipes.map(r => r.recipeId));
    let hasChecked = $derived($shoppingList.some(e => e.checked));

    async function handleConfirm(picked: RecipePreview[]) {
        const fetched = await Promise.all(picked.map(r => getRecipe(r.id, $locale ?? undefined)));
        for (const {response, data} of fetched) {
            if (response.ok && data)
                addRecipeToShoppingList(data.id, data.title, data.quantity, data.ingredients);
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
        <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 class="text-3xl font-bold text-foreground">{$_('shoppingList.title')}</h1>
            <div class="flex items-center gap-2">
                <Button onclick={() => pickerOpen = true} class="flex items-center gap-2">
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
            <div class="bg-card rounded-lg border border-border p-6 mb-6">
                <h2 class="text-lg font-semibold text-card-foreground mb-4">{$_('shoppingList.recipesTitle')}</h2>
                <ul class="space-y-3">
                    {#each recipes as recipe (recipe.recipeId)}
                        <li class="flex items-center justify-between gap-3">
                            <a href={`/${$locale}/recipes/${recipe.recipeId}`} class="text-card-foreground hover:text-primary hover:underline truncate">
                                {recipe.recipeTitle}
                            </a>
                            <div class="flex items-center gap-3 flex-shrink-0">
                                <div class="flex items-center gap-1">
                                    <button
                                            type="button"
                                            onclick={() => decreaseServings(recipe.recipeId, recipe.servings)}
                                            class="p-1 rounded hover:bg-muted hover:cursor-pointer"
                                            aria-label={$_('recipe.decreaseServings')}
                                    >
                                        <Minus class="w-4 h-4" />
                                    </button>
                                    <span class="text-sm text-muted-foreground w-6 text-center">{recipe.servings}</span>
                                    <button
                                            type="button"
                                            onclick={() => increaseServings(recipe.recipeId, recipe.servings)}
                                            class="p-1 rounded hover:bg-muted hover:cursor-pointer"
                                            aria-label={$_('recipe.increaseServings')}
                                    >
                                        <Plus class="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                        type="button"
                                        onclick={() => removeRecipeFromShoppingList(recipe.recipeId)}
                                        class="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted hover:cursor-pointer"
                                        aria-label={$_('shoppingList.removeRecipe')}
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>
                        </li>
                    {/each}
                </ul>
            </div>

            <div class="bg-card rounded-lg border border-border p-6">
                <div class="flex items-center justify-between mb-4">
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
                <ul class="space-y-3">
                    {#each groups as group (group.key)}
                        <li>
                            {#if group.subLines.length === 1 && !group.subLines[0].isReference}
                                {@const sub = group.subLines[0]}
                                <button
                                        type="button"
                                        onclick={() => setLineChecked(sub.entryIds, !sub.checked)}
                                        class="flex items-start gap-3 text-left w-full hover:cursor-pointer"
                                >
                                    <Checkbox checked={sub.checked} decorative class="mt-0.5" />
                                    <span class={sub.checked ? 'line-through text-muted-foreground' : 'text-card-foreground'}>
                                        {group.singleLineText}
                                    </span>
                                </button>
                            {:else if group.subLines.length === 1}
                                {@const sub = group.subLines[0]}
                                <div class="flex items-start gap-2">
                                    <button
                                            type="button"
                                            onclick={() => setLineChecked(sub.entryIds, !sub.checked)}
                                            class="flex items-center gap-3 text-left hover:cursor-pointer"
                                    >
                                        <Checkbox checked={sub.checked} decorative />
                                        {#if sub.text}
                                            <span class={sub.checked ? 'line-through text-muted-foreground' : 'text-card-foreground'}>{sub.text}</span>
                                        {/if}
                                    </button>
                                    <a
                                            href={`/${$locale}/recipes/${sub.referenceId}`}
                                            class="text-primary hover:underline {sub.checked ? 'line-through' : ''}"
                                    >
                                        {group.name}
                                    </a>
                                </div>
                            {:else}
                                <h3 class="font-semibold text-card-foreground text-sm mb-2">{group.name}</h3>
                                <ul class="space-y-2 pl-3 border-l-2 border-border">
                                    {#each group.subLines as sub (sub.key)}
                                        <li>
                                            <button
                                                    type="button"
                                                    onclick={() => setLineChecked(sub.entryIds, !sub.checked)}
                                                    class="flex items-start gap-3 text-left w-full hover:cursor-pointer"
                                            >
                                                <Checkbox checked={sub.checked} decorative class="mt-0.5" />
                                                <span class={sub.checked ? 'line-through text-muted-foreground' : 'text-card-foreground'}>{sub.text}</span>
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
