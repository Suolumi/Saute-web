<script lang="ts">
    import {favoriteRecipe, formatDuration, getRecipe, recipeTypeColors, unfavoriteRecipe} from '$lib/recipes';
    import {goto} from "$app/navigation";
    import type {RecipePreview} from "$lib/recipes";
    import emblaCarouselSvelte from "embla-carousel-svelte";
    import {
        ArrowLeft, ArrowRight, Carrot, Cookie, CookingPot, Croissant, CupSoda, EggFried, Heart, IceCreamCone,
        Layers, Salad, Utensils, UtensilsCrossed, Wrench,
    } from "@lucide/svelte";
    import {serverUrl, user} from "$lib/stores";
    import {locale, _} from "svelte-i18n";
    import {toastError, pictureUrl} from "$lib/utils";
    import Lightbox from "./Lightbox.svelte";
    import HighlightText from "./HighlightText.svelte";
    import TagBadges from "./TagBadges.svelte";

    // onFavoriteChange, when given, fires after a successful favorite toggle
    // - the My Favorites tab uses it to drop a card the moment it's
    // unfavorited, since this component only updates its own local copy of
    // `recipe` and never mutates the parent's list itself.
    // truncateDescription clips the description to 200 chars, as fits a grid
    // listing card - the create/edit wizard's live preview (a full-page
    // stand-in, not a listing) turns it off to show the description in full.
    // highlightQuery, when given, highlights the portion of the title that
    // matches a search box driving this card's listing (e.g. RecipeFilters'
    // searchTerm) - omitted entirely for cards shown outside a search
    // context (related-recipe sections, etc.).
    let { recipe, disabled = false, onFavoriteChange, truncateDescription = true, highlightQuery = '' }: { recipe: RecipePreview, disabled?: boolean, onFavoriteChange?: (favorite: boolean) => void, truncateDescription?: boolean, highlightQuery?: string } = $props();
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

    function viewRecipe(id: string) {
        goto(`/${$locale}/recipes/${id}`);
    }

    function handleClick() {
        if (!disabled)
            viewRecipe(recipe.id);
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

    const kindIcons: Record<string, typeof Utensils> = {
        breakfast: EggFried, starter: Salad, dish: UtensilsCrossed, "side-dish": Carrot, sauce: CookingPot,
        baking: Croissant, snack: Cookie, plate: Utensils, dessert: IceCreamCone, drink: CupSoda,
    };
    const PlaceholderIcon = $derived(recipe.category === 'diy' ? Wrench : kindIcons[recipe.kind] ?? Utensils);
    const typeColorClass = $derived(recipeTypeColors[recipe.kind] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300");
    // DIY projects only have a preparation time; older ones may still store cook/rest values.
    const totalTime = $derived(recipe.category === 'diy' ? recipe.preparation_time : recipe.preparation_time + recipe.cooking_time + recipe.resting_time)
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
                <div
                        role="img"
                        aria-label={$_('recipeCard.noPicture')}
                        class="aspect-video w-full flex items-center justify-center border-b border-b-border {recipe.category === 'diy' ? 'bg-muted text-muted-foreground' : typeColorClass}"
                >
                    <PlaceholderIcon class="w-1/4 h-1/4 opacity-40" strokeWidth={1.5} />
                </div>
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

    <div class="p-6 flex-1 flex flex-col">
        <div class="flex items-start justify-between mb-3">
            <h3 class="text-xl font-semibold text-card-foreground text-balance min-w-0 wrap-break-word">{#if recipe.title}<HighlightText text={recipe.title} query={highlightQuery} />{:else}{$_('recipeCard.title')}{/if}</h3>
            <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                {#if (recipe.family_size ?? 0) > 1}
                    <span class="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                        <Layers size="14" />
                        {$_('recipeCard.familySize', {values: {count: recipe.family_size}})}
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

        <p class="text-muted-foreground mb-4 text-pretty whitespace-pre-line wrap-break-word">{recipe.description ? (truncateDescription && recipe.description.length > 200 ? recipe.description.slice(0, 200) + '...' : recipe.description) : $_('recipeCard.description')}</p>

        <TagBadges slugs={recipe.tags} fit />

    </div>
    <div class="px-6 pb-6 flex items-center justify-between text-sm text-muted-foreground">
        <div class="flex justify-center items-center gap-x-2 min-w-0">
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
            <span class="font-medium text-black dark:text-white min-w-0 wrap-break-word">{$_('recipeCard.by')} {recipe.author?.username || 'Author Name'}</span>
        </div>
        <div class="flex items-center space-x-4">
        {#if recipe.category !== 'diy' || totalTime > 0}
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
