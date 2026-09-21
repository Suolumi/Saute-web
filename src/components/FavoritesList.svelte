<script lang="ts">
    import { untrack } from 'svelte';
    import RecipeCard from './RecipeCard.svelte';
    import RecipeFilters from './RecipeFilters.svelte';
    import {getRecipes, type GetRecipesRequest, type RecipeCategory, type RecipePreview, type RecipeType, type TimePreset} from "$lib/recipes";
    import { _, locale } from 'svelte-i18n';
    import { Heart } from '@lucide/svelte';

    const PAGE_SIZE = 24;

    interface Props {
        category: RecipeCategory;
        showKind?: boolean;
        showTime?: boolean;
        searchPlaceholder: string;
        ingredientsLabel: string;
        ingredientsPlaceholder: string;
    }

    let {
        category,
        showKind = true,
        showTime = true,
        searchPlaceholder,
        ingredientsLabel,
        ingredientsPlaceholder,
    }: Props = $props();

    let searchTerm = $state('');
    let selectedType = $state('all');
    let author = $state('');
    let ingredients: string[] = $state([]);
    let timeBasis: 'prep' | 'total' = $state('total');
    let timeTarget: TimePreset = $state('any');

    let recipes: RecipePreview[] = $state([])
    let totalCount: number | undefined = $state(undefined);
    let hasMore = $state(true);
    let loading = $state(false);
    let sentinel: HTMLDivElement | undefined = $state();

    let requestId = 0;

    function buildRequest(offset: number): GetRecipesRequest {
        const request: GetRecipesRequest = {favorites_only: true, category}
        if (showKind && selectedType !== 'all')
            request.kind = selectedType as RecipeType
        if (searchTerm.length > 0)
            request.title = searchTerm
        if (author.length > 0)
            request.author = author
        if (ingredients.length > 0)
            request.ingredients = ingredients
        if (showTime && timeTarget === 'quick') {
            if (timeBasis === 'prep')
                request.quickest_prep = true
            else
                request.quickest_total = true
        } else if (showTime && timeTarget !== 'any') {
            const minutes = Number(timeTarget)
            if (timeBasis === 'prep')
                request.preparation_time = minutes
            else
                request.total_time = minutes
        }
        request.locale = $locale ?? 'en'
        request.search_locale = $locale ?? 'en'
        request.limit = PAGE_SIZE
        request.offset = offset
        return request
    }

    function fetchPage(offset: number, replace: boolean) {
        loading = true
        const id = ++requestId
        getRecipes(buildRequest(offset)).then(({response, data}) => {
            if (id !== requestId)
                return
            loading = false
            if (!response.ok || !data)
                return
            recipes = replace ? data.items : [...recipes, ...data.items]
            totalCount = data.length
            hasMore = recipes.length < data.length
            requestAnimationFrame(fillViewport)
        })
    }

    function loadMore() {
        if (loading || !hasMore)
            return
        fetchPage(recipes.length, false)
    }

    function fillViewport() {
        if (!sentinel || loading || !hasMore)
            return
        if (sentinel.getBoundingClientRect().top < window.innerHeight)
            loadMore()
    }

    // Unfavoriting a card while it's showing here removes it immediately -
    // this list only ever shows what's currently favorited.
    function onUnfavorited(recipeId: string) {
        recipes = recipes.filter(r => r.id !== recipeId)
        if (totalCount !== undefined)
            totalCount -= 1
    }

    $effect(() => {
        category; searchTerm; selectedType; $locale; author; ingredients; timeBasis; timeTarget;
        untrack(() => {
            recipes = []
            hasMore = true
            fetchPage(0, true)
        })
    })

    $effect(() => {
        if (!sentinel)
            return
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting)
                loadMore()
        })
        observer.observe(sentinel)
        return () => observer.disconnect()
    })
</script>

<RecipeFilters
        {showKind}
        {showTime}
        bind:searchTerm
        bind:selectedType
        bind:author
        bind:ingredients
        bind:timeBasis
        bind:timeTarget
        {searchPlaceholder}
        {ingredientsLabel}
        {ingredientsPlaceholder}
/>

{#if totalCount !== undefined}
    <p class="text-sm text-muted-foreground mb-4">{$_('home.resultCount', {values: {count: totalCount}})}</p>
{/if}

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each recipes as recipe (recipe.id)}
        <RecipeCard {recipe} onFavoriteChange={(favorite) => !favorite && onUnfavorited(recipe.id)} />
    {/each}
</div>

{#if recipes.length === 0 && !loading}
    <div class="text-center py-12">
        <Heart class="mx-auto w-16 h-16 text-muted-foreground mb-4" />
        <h3 class="text-xl font-semibold text-foreground mb-2">{$_('settings.favorites.empty.title')}</h3>
        <p class="text-muted-foreground">{$_('settings.favorites.empty.description')}</p>
    </div>
{/if}

{#if hasMore}
    <div bind:this={sentinel} class="h-10"></div>
{/if}

{#if loading}
    <div class="flex justify-center py-8">
        <div class="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin"></div>
    </div>
{/if}
