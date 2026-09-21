<script lang="ts">
    import {searchUsers, type User as AuthorUser} from "$lib/user";
    import {serverUrl} from "$lib/stores";
    import {recipeTypeColors, RecipeTypes, TIME_PRESETS, type RecipeType, type TimePreset} from "$lib/recipes";
    import {_} from 'svelte-i18n';
    import {Search, SlidersHorizontal, ChevronDown, User, X, Flame} from '@lucide/svelte';

    interface Props {
        searchTerm: string;
        // selectedType is only read/written when showKind is true.
        selectedType?: string;
        author: string;
        ingredients: string[];
        // timeBasis/timeTarget are only read/written when showTime is true.
        timeBasis?: 'prep' | 'total';
        timeTarget?: TimePreset;
        // popular sorts by favorite count descending instead of newest-first.
        // Mutually exclusive with the ready-in time sort (see togglePopular/
        // selectTimeTarget) - both are single "what order are results in"
        // choices, so only one can be active.
        popular?: boolean;
        // showKind hides the kind-pill row entirely when false (the diy
        // browse page doesn't filter by kind).
        showKind?: boolean;
        // showTime hides the "ready in" time filter entirely when false (the
        // diy browse page has no time filter - see current-state notes).
        showTime?: boolean;
        // showAuthor hides the author sub-filter entirely when false - Settings'
        // "My Recipes" always narrows to the caller's own username server-side,
        // so exposing a free-text author filter there would let it be pointed at
        // someone else's recipes while still showing owner-only actions (edit/
        // remove/link) that only work on the caller's own.
        showAuthor?: boolean;
        searchPlaceholder: string;
        ingredientsLabel: string;
        ingredientsPlaceholder: string;
    }

    let {
        searchTerm = $bindable(''),
        selectedType = $bindable('all'),
        author = $bindable(''),
        ingredients = $bindable([]),
        timeBasis = $bindable('total'),
        timeTarget = $bindable('any'),
        popular = $bindable(false),
        showKind = true,
        showTime = true,
        showAuthor = true,
        searchPlaceholder,
        ingredientsLabel,
        ingredientsPlaceholder,
    }: Props = $props();

    let filtersOpen = $state(false);
    let selectedAuthorUser: AuthorUser | undefined = $state(undefined);
    let authorSuggestions: AuthorUser[] = $state([]);
    let showAuthorSuggestions = $state(false);
    let authorFieldRef: HTMLDivElement | undefined = $state();
    let authorSearchId = 0;
    let ingredientInput = $state('');

    const hasActiveFilters = $derived(
        (showKind && selectedType !== 'all') || (showAuthor && author.length > 0) || ingredients.length > 0 || (showTime && timeTarget !== 'any') || popular
    );

    function togglePopular() {
        popular = !popular
        if (popular)
            timeTarget = 'any'
    }

    function selectTimeTarget(preset: TimePreset) {
        timeTarget = preset
        popular = false
    }

    function timeLabel(preset: TimePreset): string {
        if (preset === 'any') return $_('home.timeAny')
        if (preset === 'quick') return $_('home.timeQuick')
        if (preset === '60') return $_('home.timeHour')
        return $_('home.timeMinutes', {values: {minutes: preset}})
    }

    function onIngredientKeyDown(e: KeyboardEvent) {
        if (e.key !== 'Enter') return
        e.preventDefault()
        const value = ingredientInput.trim()
        if (!value) {
            return
        }
        if (!ingredients.some(i => i.toLowerCase() === value.toLowerCase()))
            ingredients = [...ingredients, value]
        ingredientInput = ''
    }

    function removeIngredient(ingredient: string) {
        ingredients = ingredients.filter(i => i !== ingredient)
    }

    function selectAuthor(user: AuthorUser) {
        author = user.username
        selectedAuthorUser = user
        showAuthorSuggestions = false
    }

    function onAuthorInput() {
        selectedAuthorUser = undefined
        showAuthorSuggestions = true
    }

    function clearAuthor() {
        author = ''
        selectedAuthorUser = undefined
    }

    function clearAllFilters() {
        if (showKind)
            selectedType = 'all'
        if (showAuthor)
            clearAuthor()
        ingredients = []
        ingredientInput = ''
        if (showTime)
            timeTarget = 'any'
        popular = false
    }

    $effect(() => {
        const query = author.trim()
        const id = ++authorSearchId
        if (!query) {
            authorSuggestions = []
            return
        }
        const timeout = setTimeout(() => {
            searchUsers(query, 5).then(({response, data}) => {
                if (id !== authorSearchId)
                    return
                if (!response.ok || !data)
                    return
                authorSuggestions = data.items.slice(0, 5)
            })
        }, 250)
        return () => clearTimeout(timeout)
    })

    $effect(() => {
        if (!authorFieldRef)
            return
        function onClickOutside(e: MouseEvent) {
            if (authorFieldRef && !authorFieldRef.contains(e.target as Node))
                showAuthorSuggestions = false
        }
        document.addEventListener('click', onClickOutside)
        return () => document.removeEventListener('click', onClickOutside)
    })

    const recipeTypes = $derived([{
        value: 'all',
        label: $_('recipes.types.all'),
    }, ...RecipeTypes.map(e => ({value: e, label: $_('recipes.types.' + e)}))]);
</script>

<div class="bg-card rounded-lg border border-border p-6 mb-8">
    <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1 relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
                    type="text"
                    placeholder={searchPlaceholder}
                    bind:value={searchTerm}
                    class="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
        </div>

        <button
                type="button"
                onclick={togglePopular}
                class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium whitespace-nowrap transition-colors
                    {popular ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground'}"
        >
            <Flame class="w-4 h-4" />
            {$_('home.mostPopular')}
        </button>

        <button
                type="button"
                onclick={() => filtersOpen = !filtersOpen}
                class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors
                    {filtersOpen ? 'border-primary text-primary bg-background' : 'border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground'}"
        >
            <SlidersHorizontal class="w-4 h-4" />
            {$_('home.moreFilters')}
            <ChevronDown class="w-4 h-4 transition-transform {filtersOpen ? 'rotate-180' : ''}" />
        </button>
    </div>

    {#if showKind}
        <div class="flex flex-wrap gap-2 mt-4">
            {#each recipeTypes as type}
                <button
                        type="button"
                        onclick={() => selectedType = type.value}
                        class="flex-none px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-colors
                            {type.value === 'all'
                                ? (selectedType === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border')
                                : (recipeTypeColors[type.value] + (selectedType === type.value ? ' border-current' : ' border-transparent'))}"
                >
                    {type.label}
                </button>
            {/each}
        </div>
    {/if}

    {#if filtersOpen}
        <div class="mt-4 pt-4 border-t border-border flex flex-wrap gap-6">
            {#if showAuthor}
            <div class="flex flex-col gap-2 min-w-[220px] flex-1">
                <label class="text-sm font-medium text-foreground" for="author-filter">{$_('home.author')}</label>
                <div class="relative" bind:this={authorFieldRef}>
                    {#if selectedAuthorUser}
                        {#if selectedAuthorUser.picture}
                            <img
                                    src={`${$serverUrl}/pictures/${selectedAuthorUser.picture}`}
                                    alt="{selectedAuthorUser.username} profile"
                                    class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full object-cover pointer-events-none"
                            />
                        {:else}
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-medium pointer-events-none">
                                {selectedAuthorUser.username.charAt(0) || "?"}
                            </div>
                        {/if}
                    {:else}
                        <User class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    {/if}
                    <input
                            id="author-filter"
                            type="text"
                            autocomplete="off"
                            placeholder={$_('home.authorPlaceholder')}
                            bind:value={author}
                            oninput={onAuthorInput}
                            class="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                    {#if showAuthorSuggestions && authorSuggestions.length > 0}
                        <div class="relative mt-2 bg-card border border-border rounded-lg shadow-lg py-1 z-50 overflow-hidden">
                            {#each authorSuggestions as suggestion (suggestion.id)}
                                <button
                                        type="button"
                                        onclick={() => selectAuthor(suggestion)}
                                        class="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-gray-200 dark:hover:bg-gray-800"
                                >
                                    {#if suggestion.picture}
                                        <img
                                                src={`${$serverUrl}/pictures/${suggestion.picture}`}
                                                alt="{suggestion.username} profile"
                                                class="w-6 h-6 rounded-full object-cover flex-none"
                                        />
                                    {:else}
                                        <div class="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium flex-none">
                                            {suggestion.username.charAt(0) || "?"}
                                        </div>
                                    {/if}
                                    <span class="truncate">{suggestion.username}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
            {/if}

            <div class="flex flex-col gap-2 min-w-[220px] flex-1">
                <label class="text-sm font-medium text-foreground" for="ingredient-filter">{ingredientsLabel}</label>
                <input
                        id="ingredient-filter"
                        type="text"
                        placeholder={ingredientsPlaceholder}
                        bind:value={ingredientInput}
                        onkeydown={onIngredientKeyDown}
                        class="w-full px-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                {#if ingredients.length > 0}
                    <div class="flex flex-wrap gap-2 mt-1">
                        {#each ingredients as ingredient}
                            <span class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-input border border-border text-sm text-foreground">
                                {ingredient}
                                <button type="button" onclick={() => removeIngredient(ingredient)} class="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground">
                                    <X class="w-3.5 h-3.5" />
                                </button>
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if showTime}
            <div class="flex flex-col gap-2 min-w-[220px] flex-1">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium text-foreground">{$_('home.readyIn')}</span>
                    <div class="relative inline-flex border border-border rounded-full p-0.5 gap-0.5">
                        <div
                                class="absolute top-0.5 bottom-0.5 left-0.5 w-[92px] bg-foreground rounded-full transition-transform duration-200 ease-out"
                                style="transform: translateX({timeBasis === 'total' ? '94px' : '0'})"
                        ></div>
                        <button
                                type="button"
                                onclick={() => timeBasis = 'prep'}
                                class="relative z-10 w-[92px] py-1 rounded-full text-xs font-medium text-center transition-colors {timeBasis === 'prep' ? 'text-background' : 'text-muted-foreground'}"
                        >
                            {$_('home.prepTime')}
                        </button>
                        <button
                                type="button"
                                onclick={() => timeBasis = 'total'}
                                class="relative z-10 w-[92px] py-1 rounded-full text-xs font-medium text-center transition-colors {timeBasis === 'total' ? 'text-background' : 'text-muted-foreground'}"
                        >
                            {$_('home.totalTime')}
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    {#each TIME_PRESETS as preset}
                        <button
                                type="button"
                                onclick={() => selectTimeTarget(preset)}
                                class="px-4 py-2 rounded-full text-sm font-medium border transition-colors
                                    {timeTarget === preset
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-foreground border-border'}"
                        >
                            {timeLabel(preset)}
                        </button>
                    {/each}
                </div>
                {#if timeTarget === 'quick'}
                    <p class="text-xs text-muted-foreground">{$_('home.quickestMatch')}</p>
                {:else if timeTarget !== 'any'}
                    <p class="text-xs text-muted-foreground">{$_('home.closestMatch')}</p>
                {/if}
            </div>
            {/if}
        </div>
    {/if}
</div>

{#if hasActiveFilters}
    <div class="flex flex-wrap items-center gap-2 mb-6 -mt-4">
        {#if showKind && selectedType !== 'all'}
            <span class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-card border border-border text-sm text-foreground">
                {$_('recipes.types.' + selectedType)}
                <button type="button" onclick={() => selectedType = 'all'} class="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground">
                    <X class="w-3.5 h-3.5" />
                </button>
            </span>
        {/if}
        {#if showAuthor && author.length > 0}
            <span class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-card border border-border text-sm text-foreground">
                {$_('home.activeAuthor')}
                <User class="w-3.5 h-3.5" />
                {author}
                <button type="button" onclick={clearAuthor} class="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground">
                    <X class="w-3.5 h-3.5" />
                </button>
            </span>
        {/if}
        {#each ingredients as ingredient}
            <span class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-card border border-border text-sm text-foreground">
                {ingredient}
                <button type="button" onclick={() => removeIngredient(ingredient)} class="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground">
                    <X class="w-3.5 h-3.5" />
                </button>
            </span>
        {/each}
        {#if showTime && timeTarget !== 'any'}
            <span class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-card border border-border text-sm text-foreground">
                {$_(timeBasis === 'prep' ? 'home.activeTimePrep' : 'home.activeTimeTotal', {values: {time: timeLabel(timeTarget)}})}
                <button type="button" onclick={() => timeTarget = 'any'} class="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground">
                    <X class="w-3.5 h-3.5" />
                </button>
            </span>
        {/if}
        {#if popular}
            <span class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-card border border-border text-sm text-foreground">
                {$_('home.mostPopular')}
                <button type="button" onclick={() => popular = false} class="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground">
                    <X class="w-3.5 h-3.5" />
                </button>
            </span>
        {/if}
        <button type="button" onclick={clearAllFilters} class="text-sm font-medium text-primary hover:underline">
            {$_('home.clearAll')}
        </button>
    </div>
{/if}
