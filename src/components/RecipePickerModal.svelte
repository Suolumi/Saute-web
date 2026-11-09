<script lang="ts">
    import Modal from './Modal.svelte';
    import Button from './Button.svelte';
    import Checkbox from './Checkbox.svelte';
    import HighlightText from './HighlightText.svelte';
    import TagFilter from './TagFilter.svelte';
    import {getFamily, getRecipes, type RecipeCategory, type RecipePreview} from '$lib/recipes';
    import {tags as allTags, tagsForCategory} from '$lib/tags';
    import {serverUrl} from '$lib/stores';
    import {locale, _} from 'svelte-i18n';
    import {toastError} from '$lib/utils';

    interface Props {
        open: boolean;
        // excludeFamily is this recipe's own family id (if it has one yet) -
        // a recipe can't offer itself or its own family as a reference
        // target. UX nicety only; the server is the authoritative check.
        excludeFamily?: string;
        // category, when set, restricts results to that category (e.g. the
        // "link as version" flow only offers same-category targets). Also
        // a UX nicety - the server is the authoritative check wherever one
        // applies.
        category?: RecipeCategory;
        // title/description override the default generic picker copy (e.g.
        // ingredient picking, linking a recipe as a version).
        title?: string;
        description?: string;
        // flat lists every matching recipe ungrouped - every version of
        // every family (own_recipes, with no author filter) - instead of the
        // default family-collapsed listing, which shows each family once as
        // its newest matching version. Used by the admin console, where any
        // version needs to be selectable (e.g. to detach it back to
        // standalone).
        flat?: boolean;
        // excludeRecipeIds hides these exact recipe ids from results and from
        // a family's drill-in list - used by the shopping list picker so a
        // recipe already on the list can't be accidentally re-picked and
        // replaced (losing an edited servings count). A family row stays
        // even when its own (displayed) version is excluded, so the other
        // versions stay reachable through the drill-in.
        excludeRecipeIds?: string[];
        // multiSelect switches from "pick one, close immediately" to
        // checkbox selection across possibly multiple searches, confirmed
        // via a footer button. A family (more than one version) drills into
        // its own version-picking view instead of being added directly,
        // since each version can have different ingredients.
        multiSelect?: boolean;
        // tagFilter shows tag chips under the search box.
        tagFilter?: boolean;
        onClose: () => void;
        onSelect?: (recipe: RecipePreview) => void;
        onConfirm?: (recipes: RecipePreview[]) => void;
    }

    let {open, excludeFamily, category, title, description, flat, excludeRecipeIds, multiSelect, tagFilter, onClose, onSelect, onConfirm}: Props = $props();

    const PAGE_SIZE = 20;

    let query = $state('');
    let selectedTags: string[] = $state([]);
    const showTagFilter = $derived(!!tagFilter && tagsForCategory($allTags, category).length > 0);
    let results: RecipePreview[] = $state([]);
    let loading = $state(false);
    let loadingMore = $state(false);
    let hasMore = $state(true);
    let searched = $state(false);
    let searchId = 0;
    let resultsSentinel: HTMLDivElement | undefined = $state();

    let selected: Map<string, RecipePreview> = $state(new Map());

    let drillFamily: RecipePreview | null = $state(null);
    let drillVersions: RecipePreview[] = $state([]);
    let drillLoading = $state(false);

    const excluded = $derived(new Set(excludeRecipeIds ?? []));
    // A family row may stand for an excluded version; only standalone rows
    // are dropped by id (the drill-in list filters the members).
    const visibleResults = $derived(results.filter(r => r.family_size > 1 || !excluded.has(r.id)));

    function fetchPage(term: string, offset: number, replace: boolean) {
        const id = ++searchId;
        if (replace)
            loading = true;
        else
            loadingMore = true;
        getRecipes({title: term || undefined, tags: selectedTags.length > 0 ? selectedTags : undefined, exclude_family: excludeFamily, category, own_recipes: flat || undefined, locale: $locale ?? undefined, search_locale: $locale ?? undefined, limit: PAGE_SIZE, offset})
            .then(({response, data}) => {
                if (id !== searchId)
                    return;
                loading = false;
                loadingMore = false;
                searched = true;
                if (response.ok && data) {
                    results = replace ? data.items : [...results, ...data.items];
                    hasMore = data.items.length === PAGE_SIZE;
                } else {
                    hasMore = false;
                    toastError($_('edit.ingredients.recipePicker.error'));
                }
            });
    }

    function loadMore() {
        if (loading || loadingMore || !hasMore)
            return;
        fetchPage(query.trim(), results.length, false);
    }

    $effect(() => {
        // Read synchronously so a locale change alone (not just a query
        // edit) re-triggers the search - the actual fetch happens inside
        // the debounce timeout below, whose reactive reads aren't tracked.
        $locale;
        selectedTags;
        if (!open)
            return;
        const term = query.trim();
        const timeout = setTimeout(() => {
            results = [];
            hasMore = true;
            fetchPage(term, 0, true);
        }, 250);
        return () => clearTimeout(timeout);
    });

    $effect(() => {
        if (!resultsSentinel)
            return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting)
                loadMore();
        });
        observer.observe(resultsSentinel);
        return () => observer.disconnect();
    });

    $effect(() => {
        if (!open) {
            selected = new Map();
            drillFamily = null;
            drillVersions = [];
        }
    });

    function select(recipe: RecipePreview) {
        onSelect?.(recipe);
        onClose();
    }

    function isSelected(recipe: RecipePreview): boolean {
        return selected.has(recipe.id);
    }

    function toggleSelected(recipe: RecipePreview) {
        const next = new Map(selected);
        if (next.has(recipe.id))
            next.delete(recipe.id);
        else
            next.set(recipe.id, recipe);
        selected = next;
    }

    function handleRowClick(recipe: RecipePreview) {
        if (!multiSelect) {
            if (excluded.has(recipe.id))
                return;
            select(recipe);
            return;
        }
        if (recipe.family_size > 1) {
            openDrill(recipe);
            return;
        }
        toggleSelected(recipe);
    }

    async function openDrill(preview: RecipePreview) {
        drillFamily = preview;
        drillVersions = [];
        drillLoading = true;
        try {
            const {response, data} = await getFamily(preview.family_id, $locale ?? undefined);
            if (response.ok && data) {
                drillVersions = data.items;
            } else {
                toastError($_('edit.ingredients.recipePicker.error'));
            }
        } finally {
            drillLoading = false;
        }
    }

    function closeDrill() {
        drillFamily = null;
        drillVersions = [];
    }

    function confirmSelection() {
        onConfirm?.([...selected.values()]);
        onClose();
    }
</script>

{#snippet recipeRow(recipe: RecipePreview, opts: {selectable: boolean, isSelected: boolean, onClick: () => void})}
    <button
            type="button"
            onclick={opts.onClick}
            disabled={!opts.selectable}
            class="flex items-center gap-3 rounded-lg p-2 text-left transition-colors {opts.selectable ? 'hover:bg-muted hover:cursor-pointer' : 'opacity-50 cursor-not-allowed'}"
    >
        {#if multiSelect}
            <Checkbox checked={opts.isSelected} disabled={!opts.selectable} decorative />
        {/if}
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
            <p class="font-medium text-card-foreground truncate"><HighlightText text={recipe.title} {query} /></p>
            <p class="text-xs text-muted-foreground truncate">{$_('recipeCard.by')} {recipe.author?.username}</p>
        </div>
        {#if !opts.selectable}
            <span class="ml-auto flex-shrink-0 bg-muted text-muted-foreground px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                {$_('edit.ingredients.recipePicker.alreadyAdded')}
            </span>
        {:else if recipe.family_size > 1}
            <span class="ml-auto flex-shrink-0 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                {$_('recipeCard.familySize', {values: {count: recipe.family_size}})}
            </span>
        {/if}
    </button>
{/snippet}

{#snippet pickerFooter()}
    <Button variant="outline" onclick={onClose}>{$_('edit.ingredients.recipePicker.cancel')}</Button>
    <Button disabled={selected.size === 0} onclick={confirmSelection}>
        {$_('edit.ingredients.recipePicker.addSelected', {values: {count: selected.size}})}
    </Button>
{/snippet}

{#snippet drillFooter()}
    <Button variant="outline" onclick={onClose}>{$_('edit.ingredients.recipePicker.cancel')}</Button>
    <Button onclick={closeDrill}>{$_('edit.ingredients.recipePicker.backToList')}</Button>
{/snippet}

<Modal
        open={open && !drillFamily}
        title={title ?? $_('edit.ingredients.recipePicker.title')}
        description={description ?? $_('edit.ingredients.recipePicker.description')}
        {onClose}
        footer={multiSelect ? pickerFooter : undefined}
>
    <input
            type="text"
            bind:value={query}
            placeholder={$_('edit.ingredients.recipePicker.searchPlaceholder')}
            class="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
    {#if showTagFilter}
        <div class="mt-3">
            <TagFilter bind:selected={selectedTags} category={category ?? 'food'} />
        </div>
    {/if}
    <div class="mt-3 max-h-[50vh] overflow-y-auto flex flex-col gap-1">
        {#if loading}
            <div class="py-8 text-center text-muted-foreground">…</div>
        {:else if searched && visibleResults.length === 0}
            <div class="py-8 text-center text-muted-foreground">{$_('edit.ingredients.recipePicker.noResults')}</div>
        {:else}
            {#each visibleResults as recipe (recipe.id)}
                {@render recipeRow(recipe, {selectable: true, isSelected: isSelected(recipe), onClick: () => handleRowClick(recipe)})}
            {/each}
            {#if searched && hasMore}
                <div bind:this={resultsSentinel} class="h-1"></div>
            {/if}
            {#if loadingMore}
                <div class="py-3 text-center text-muted-foreground">…</div>
            {/if}
        {/if}
    </div>
</Modal>

{#if multiSelect}
    <Modal
            open={open && !!drillFamily}
            title={$_('edit.ingredients.recipePicker.chooseVariation')}
            description={$_('edit.ingredients.recipePicker.chooseVariationDescription')}
            onClose={closeDrill}
            footer={drillFooter}
    >
        <button
                type="button"
                onclick={closeDrill}
                class="mb-3 text-sm text-muted-foreground hover:text-foreground transition-colors hover:cursor-pointer"
        >
            &larr; {$_('edit.ingredients.recipePicker.back')}
        </button>
        <div class="max-h-[50vh] overflow-y-auto flex flex-col gap-1">
            {#if drillLoading}
                <div class="py-8 text-center text-muted-foreground">…</div>
            {:else if drillFamily}
                {#each drillVersions.filter(v => !excluded.has(v.id)) as variation (variation.id)}
                    {@render recipeRow(variation, {selectable: true, isSelected: isSelected(variation), onClick: () => toggleSelected(variation)})}
                {/each}
            {/if}
        </div>
    </Modal>
{/if}
