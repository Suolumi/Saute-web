<script lang="ts">
    import { untrack } from 'svelte';
    import RecipeCard from '../../../../components/RecipeCard.svelte';
    import RecipeFilters from '../../../../components/RecipeFilters.svelte';
    import Button from '../../../../components/Button.svelte';
    import PageMeta from '../../../../components/PageMeta.svelte';
    import {getRecipes, type GetRecipesRequest, type RecipePreview} from "$lib/recipes";
    import { _, locale } from 'svelte-i18n';
    import { goto } from '$app/navigation';
    import { Plus, SearchX } from '@lucide/svelte';

    const PAGE_SIZE = 24;

    let searchTerm = $state('');
    let author = $state('');
    let ingredients: string[] = $state([]);
    let popular = $state(false);

    let recipes: RecipePreview[] = $state([])
    let totalCount: number | undefined = $state(undefined);
    let hasMore = $state(true);
    let loading = $state(false);
    let sentinel: HTMLDivElement | undefined = $state();

    let requestId = 0;

    function buildRequest(offset: number): GetRecipesRequest {
        const request: GetRecipesRequest = {category: 'diy'}
        if (searchTerm.length > 0)
            request.title = searchTerm
        if (author.length > 0)
            request.author = author
        if (ingredients.length > 0)
            request.ingredients = ingredients
        if (popular)
            request.popular = true
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
            hasMore = data.items.length === PAGE_SIZE
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

    $effect(() => {
        searchTerm; $locale; author; ingredients; popular;
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

<PageMeta title={$_('diyHome.meta.title')} description={$_('diyHome.meta.description')} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
            <h1 class="text-4xl font-bold text-foreground mb-4 text-balance">{$_('diyHome.mainText')}</h1>
            <p class="text-xl text-muted-foreground text-pretty">{$_('diyHome.secondaryText')}</p>
        </div>
        <Button onclick={() => goto(`/${$locale}/create?category=diy`)} class="flex items-center gap-2 whitespace-nowrap">
            <Plus class="w-4 h-4" />
            {$_('diyHome.createProject')}
        </Button>
    </div>

    <RecipeFilters
            showKind={false}
            showTime={false}
            bind:searchTerm
            bind:author
            bind:ingredients
            bind:popular
            searchPlaceholder={$_('home.search')}
            ingredientsLabel={$_('diyHome.materials')}
            ingredientsPlaceholder={$_('diyHome.materialsPlaceholder')}
    />

    {#if totalCount !== undefined}
        <p class="text-sm text-muted-foreground mb-4">{$_('home.resultCount', {values: {count: totalCount}})}</p>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each recipes as recipe (recipe.id)}
            <RecipeCard {recipe} />
        {/each}
    </div>

    {#if recipes.length === 0 && !loading}
        <div class="text-center py-12">
            <SearchX class="mx-auto w-16 h-16 text-muted-foreground mb-4" />
            <h3 class="text-xl font-semibold text-foreground mb-2">{$_('diyHome.notFound')}</h3>
            <p class="text-muted-foreground">{$_('diyHome.adjustSearch')}</p>
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
</div>
