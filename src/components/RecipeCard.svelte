<script lang="ts">
    import {favoriteRecipe, formatDuration, getFamily, getRecipe, recipeTypeColors, unfavoriteRecipe} from '$lib/recipes';
    import {goto} from "$app/navigation";
    import type {RecipePreview} from "$lib/recipes";
    import emblaCarouselSvelte from "embla-carousel-svelte";
    import {ArrowLeft, ArrowRight, Heart, Plus} from "@lucide/svelte";
    import {serverUrl, user} from "$lib/stores";
    import {locale, _} from "svelte-i18n";
    import {toastError, pictureUrl} from "$lib/utils";
    import Lightbox from "./Lightbox.svelte";
    import Modal from "./Modal.svelte";
    import RecipeCard from "./RecipeCard.svelte";

    // suppressPicker forces a direct navigation on click, bypassing the
    // variation picker below - used for cards rendered inside the picker
    // modal itself, so picking the root there doesn't recursively reopen it.
    // onFavoriteChange, when given, fires after a successful favorite toggle
    // - the My Favorites tab uses it to drop a card the moment it's
    // unfavorited, since this component only updates its own local copy of
    // `recipe` and never mutates the parent's list itself.
    // truncateDescription clips the description to 200 chars, as fits a grid
    // listing card - the create/edit wizard's live preview (a full-page
    // stand-in, not a listing) turns it off to show the description in full.
    let { recipe, disabled = false, suppressPicker = false, onFavoriteChange, truncateDescription = true }: { recipe: RecipePreview, disabled?: boolean, suppressPicker?: boolean, onFavoriteChange?: (favorite: boolean) => void, truncateDescription?: boolean } = $props();
    let emblaApi: any = $state();
    let lightboxOpen = $state(false);
    let lightboxIndex = $state(0);
    // pictureAttributions is fetched on demand when the lightbox opens - the
    // preview this card renders from never carries per-picture attribution
    // (kept light for listings), only the full recipe does.
    let pictureAttributions: { username: string; picture: string }[] = $state([]);
    let heartBump = $state(false);
    let canScrollPrev = $state(false);
    let canScrollNext = $state(false);

    let pickerOpen = $state(false);
    let pickerLoading = $state(false);
    let familyRoot: RecipePreview | null = $state(null);
    let familyVariations: RecipePreview[] = $state([]);

    function viewRecipe(id: string) {
        goto(`/${$locale}/recipes/${id}`);
    }

    // A root with variations opens a picker instead of navigating straight
    // through - a variation's own card (recipe.variation_of set) always
    // navigates directly, since it already represents one specific version.
    function handleClick() {
        if (disabled)
            return;
        if (!suppressPicker && !recipe.variation_of && recipe.variation_count > 0) {
            openPicker();
            return;
        }
        viewRecipe(recipe.id);
    }

    async function openPicker() {
        pickerOpen = true;
        pickerLoading = true;
        try {
            const {root, variations} = await getFamily(recipe.id, $locale ?? undefined);
            if (root.response.ok && root.data && variations.response.ok && variations.data) {
                // The picker's own card only ever needs preview-shaped
                // fields; drop the detail-only picture attribution.
                familyRoot = {...root.data, pictures: root.data.pictures.map(p => p.filename)};
                familyVariations = variations.data.items;
            } else
                toastError($_('variationPicker.error'));
        } finally {
            pickerLoading = false;
        }
    }

    function submitVariation() {
        pickerOpen = false;
        goto(`/${$locale}/create?variation_of=${recipe.id}`);
    }

    function updateScrollState() {
        canScrollPrev = emblaApi ? emblaApi.canScrollPrev() : false;
        canScrollNext = emblaApi ? emblaApi.canScrollNext() : false;
    }

    function emblaInit(e: CustomEvent) {
        emblaApi = e.detail
        updateScrollState();
        emblaApi.on('select', updateScrollState);
        emblaApi.on('reInit', updateScrollState);
    }

    function next(e: MouseEvent) {
        e.stopPropagation();
        if (emblaApi)
            emblaApi.scrollNext()
    }

    function prev(e: MouseEvent) {
        e.stopPropagation();
        if (emblaApi)
            emblaApi.scrollPrev()
    }

    function openLightbox(e: MouseEvent) {
        e.stopPropagation();
        if (!recipe.pictures || recipe.pictures.length === 0)
            return;
        lightboxIndex = emblaApi ? emblaApi.selectedScrollSnap() : 0;
        lightboxOpen = true;
        pictureAttributions = [];
        getRecipe(recipe.id, $locale ?? undefined).then(({response, data}) => {
            if (response.ok && data)
                pictureAttributions = data.pictures.map(p => ({
                    username: p.added_by?.username ?? data.author.username,
                    picture: p.added_by?.picture ?? data.author.picture,
                }));
        });
    }

    async function toggleFavorite(e: MouseEvent) {
        e.stopPropagation();
        heartBump = true;
        const wasFavorite = recipe.favorite;
        recipe = {...recipe, favorite: !wasFavorite, favorite_count: recipe.favorite_count + (wasFavorite ? -1 : 1)};
        try {
            const {response} = wasFavorite ? await unfavoriteRecipe(recipe.id) : await favoriteRecipe(recipe.id);
            if (!response.ok)
                throw new Error('favorite request failed');
            onFavoriteChange?.(!wasFavorite);
        } catch {
            recipe = {...recipe, favorite: wasFavorite, favorite_count: recipe.favorite_count + (wasFavorite ? 1 : -1)};
            toastError($_('recipeCard.favoriteError'));
        }
    }

    const typeColorClass = $derived(recipeTypeColors[recipe.kind] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300");
    const totalTime = $derived(recipe.preparation_time + recipe.cooking_time + recipe.resting_time)
</script>

<div
        class={`bg-card rounded-lg border border-border overflow-hidden ${disabled ? '' : 'hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer'} flex flex-col h-full`}
        role="button"
        tabindex="0"
        onclick={handleClick}
        onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
    <div class="relative">
        {#if canScrollPrev}
            <button class="absolute h-full flex flex-col justify-center z-1 left-0 hover:cursor-pointer"
                    onclick={prev}>
                <ArrowLeft class="text-white" />
            </button>
        {/if}
        {#if canScrollNext}
            <button class="absolute h-full flex flex-col justify-center z-1 right-0 hover:cursor-pointer"
                    onclick={next}>
                <ArrowRight class="text-white" />
            </button>
        {/if}
        <div
                class="embla"
                use:emblaCarouselSvelte
                onemblaInit={emblaInit}
                onclick={openLightbox}
                onkeydown={(e) => e.key === 'Enter' && openLightbox(e as unknown as MouseEvent)}
                role="button"
                tabindex="0"
        >
            {#if (recipe.pictures?.length ?? 0) >= 1}
                <div class="embla__container">
                    {#each recipe.pictures as picture}
                        <img
                                src={pictureUrl($serverUrl, picture)}
                                alt={recipe.title || 'Recipe Title'}
                                class="embla__slide__img aspect-video object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
                        />
                    {/each}
                </div>
            {:else}
                <p class="embla__slide flex items-center justify-center h-full border-b border-b-border">{$_('recipeCard.noPicture')}</p>
            {/if}
        </div>
        {#if !disabled && $user}
            <button
                    onclick={toggleFavorite}
                    class="absolute top-2 z-2 left-2 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 transition-all duration-200 flex items-center gap-1"
                    aria-label={$_(recipe.favorite ? 'recipeCard.unfavorite' : 'recipeCard.favorite')}
                    title={$_(recipe.favorite ? 'recipeCard.unfavorite' : 'recipeCard.favorite')}
            >
                <span
                        class="inline-flex {heartBump ? 'heart-bump' : ''}"
                        onanimationend={() => heartBump = false}
                >
                    <Heart size="20" fill={recipe.favorite ? 'currentColor' : 'none'} class={recipe.favorite ? 'text-red-500' : ''} />
                </span>
                {#if recipe.favorite_count > 0}
                    <span class="text-xs font-medium">{recipe.favorite_count}</span>
                {/if}
            </button>
        {/if}
    </div>

    <div class="p-6 flex-1">
        <div class="flex items-start justify-between mb-3">
            <h3 class="text-xl font-semibold text-card-foreground text-balance">{recipe.title || $_('recipeCard.title')}</h3>
            <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                {#if !recipe.variation_of && recipe.variation_count > 0}
                    <span class="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                        {$_('recipeCard.variationCount', {values: {count: recipe.variation_count}})}
                    </span>
                {/if}
                {#if recipe.category === 'diy'}
                    <span class="bg-muted text-muted-foreground px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                        {$_('recipeCard.diyBadge')}
                    </span>
                {:else}
                    <span class="{typeColorClass} px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                        {$_('recipes.types.' + recipe.kind)}
                    </span>
                {/if}
            </div>
        </div>

        <p class="text-muted-foreground mb-4 text-pretty whitespace-pre-line">{recipe.description ? (truncateDescription && recipe.description.length > 200 ? recipe.description.slice(0, 200) + '...' : recipe.description) : $_('recipeCard.description')}</p>

    </div>
    <div class="px-6 pb-6 flex items-center justify-between text-sm text-muted-foreground">
        <div class="flex justify-center items-center gap-x-2">
            {#if recipe.author.picture}
                <img
                        src={`${$serverUrl}/pictures/${recipe.author.picture}` || "/placeholder.svg"}
                        alt="{recipe.author.username} profile"
                        class="w-8 h-8 rounded-full border-2 border-card object-cover"
                />
            {:else}
                <div class="w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-card flex items-center justify-center text-xs font-medium">
                    {recipe.author.username.charAt(0) || "?"}
                </div>
            {/if}
            <span class="font-medium text-black dark:text-white">{$_('recipeCard.by')} {recipe.author?.username || 'Author Name'}</span>
        </div>
        <div class="flex items-center space-x-4">
        {#if recipe.category !== 'diy'}
        <span class="flex items-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
            {formatDuration(totalTime, $_('recipes.h'), $_('recipes.min'))}
        </span>
        {/if}
            <span class="flex items-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
                {recipe.quantity}
        </span>
        </div>
    </div>
</div>

<Lightbox
        open={lightboxOpen}
        pictures={recipe.pictures ?? []}
        {pictureAttributions}
        startIndex={lightboxIndex}
        alt={recipe.title || 'Recipe Title'}
        onClose={() => lightboxOpen = false}
/>

{#if !suppressPicker}
    <Modal
            open={pickerOpen}
            title={$_('variationPicker.title')}
            description={$_('variationPicker.description')}
            onClose={() => pickerOpen = false}
            style="width: 60vw; max-width: 1600px; height: 85vh;"
    >
        {#if pickerLoading}
            <div class="py-8 text-center text-muted-foreground">…</div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#if familyRoot}
                    <RecipeCard recipe={familyRoot} suppressPicker={true} />
                {/if}
                {#each familyVariations as variation (variation.id)}
                    <RecipeCard recipe={variation} suppressPicker={true} />
                {/each}
                <button
                        type="button"
                        onclick={submitVariation}
                        class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-muted-foreground hover:border-primary hover:text-primary transition-colors hover:cursor-pointer min-h-[160px]"
                >
                    <Plus size="28" />
                    <span class="font-medium text-center">{$_('variationPicker.createTile')}</span>
                </button>
            </div>
        {/if}
    </Modal>
{/if}

<style>
    @keyframes heart-bump {
        0% { transform: scale(1); }
        30% { transform: scale(1.4); }
        60% { transform: scale(0.85); }
        100% { transform: scale(1); }
    }
    .heart-bump {
        animation: heart-bump 0.35s ease-in-out;
    }
</style>
