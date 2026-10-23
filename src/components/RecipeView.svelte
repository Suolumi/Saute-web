<script lang="ts">
    import type {Snippet} from "svelte";
    import {_, locale} from "svelte-i18n";
    import emblaCarouselSvelte from "embla-carousel-svelte";
    import {FileText, List, Users, Wind, Flame, Clock, ArrowLeft, ArrowRight, Minus, Plus} from "@lucide/svelte";
    import {
        formatDuration,
        getIngredientName,
        groupIngredients,
        type RecipeViewData,
        type RecipePicture,
        type Step,
        recipeTypeColors
    } from "$lib/recipes";
    import {serverUrl} from "$lib/stores";
    import {pictureUrl} from "$lib/utils";
    import Lightbox from "./Lightbox.svelte";
    import RecipeRefIngredient from "./RecipeRefIngredient.svelte";

    // RecipeView renders a recipe the way its published page shows it. The
    // detail page feeds it the published recipe and fills the snippets with
    // its interactive controls; the edit page's live preview feeds it the
    // normalized draft (pictures and step pictures may be blob: URLs) and
    // leaves them out. Layout follows the container width, not the viewport,
    // so the narrow preview column looks like the published page on a phone.
    let {
        recipe,
        selectedServings = $bindable(),
        headerActions,
        pictureOverlay,
        instructionsActions,
        stepAside,
        stepFooter,
        stepDone = () => false,
        nutrition,
    }: {
        recipe: RecipeViewData
        selectedServings: number
        headerActions?: Snippet
        pictureOverlay?: Snippet<[RecipePicture | undefined]>
        instructionsActions?: Snippet
        stepAside?: Snippet<[number]>
        stepFooter?: Snippet<[Step, number]>
        stepDone?: (index: number) => boolean
        // nutrition receives the selected servings; it's only rendered for a
        // non-diy recipe that has ingredients.
        nutrition?: Snippet<[number]>
    } = $props();

    const ingredientGroups = $derived(groupIngredients(recipe.ingredients));
    const servingsRatio = $derived(recipe.quantity > 0 ? selectedServings / recipe.quantity : 1);

    function decreaseServings() {
        if (selectedServings > 1)
            selectedServings -= 1;
    }

    function increaseServings() {
        selectedServings += 1;
    }

    let emblaApi: any = $state();
    let lightboxOpen = $state(false);
    let lightboxIndex = $state(0);
    let stepLightboxPicture: string | null = $state(null);
    let canScrollPrev = $state(false);
    let canScrollNext = $state(false);
    let currentSlideIndex = $state(0);

    function updateScrollState() {
        canScrollPrev = emblaApi ? emblaApi.canScrollPrev() : false;
        canScrollNext = emblaApi ? emblaApi.canScrollNext() : false;
        currentSlideIndex = emblaApi ? emblaApi.selectedScrollSnap() : 0;
    }

    function emblaInit(e: CustomEvent) {
        emblaApi = e.detail
        updateScrollState();
        emblaApi.on('select', updateScrollState);
        emblaApi.on('reInit', updateScrollState);
    }

    // Embla scans its slide DOM once at init; adding/removing a picture
    // changes the {#each recipe.pictures} list under it without Embla
    // noticing on its own, so canScrollNext/currentSlideIndex would stay
    // stuck on whatever they were before the change. Re-scan explicitly
    // whenever the picture count changes.
    $effect(() => {
        void recipe.pictures.length;
        if (emblaApi) {
            emblaApi.reInit();
            updateScrollState();
        }
    });

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
        if (recipe.pictures.length === 0)
            return;
        lightboxIndex = emblaApi ? emblaApi.selectedScrollSnap() : 0;
        lightboxOpen = true;
    }

    const currentPicture = $derived(recipe.pictures[currentSlideIndex]);

    const typeColorClass = $derived(recipeTypeColors[recipe.kind] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300");

    // Terminology lookup: for a diy-category recipe, tries `diyRecipe.<key>`
    // first and falls back to `recipe.<key>` when no diy-specific override
    // exists (svelte-i18n returns the key itself on a miss).
    function t(key: string): string {
        if (recipe.category === 'diy') {
            const diyKey = 'diyRecipe.' + key
            const diyValue = $_(diyKey)
            if (diyValue !== diyKey) return diyValue
        }
        return $_('recipe.' + key)
    }
</script>

<div class="@container">
    <div class="bg-card rounded-lg border border-border overflow-hidden mb-8">
        <div class="relative">
            {#if canScrollPrev}
                <button class="absolute h-full flex flex-col justify-center left-0 z-20 hover:cursor-pointer"
                        onclick={prev}>
                    <ArrowLeft class="text-white" />
                </button>
            {/if}
            {#if canScrollNext}
                <button class="absolute h-full flex flex-col justify-center right-0 z-20 hover:cursor-pointer"
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
                {#if recipe.pictures.length >= 1}
                    <div class="embla__container flex">
                        {#each recipe.pictures as picture}
                            <img
                                    src={pictureUrl($serverUrl, picture.filename)}
                                    alt={recipe.title || 'Recipe Title'}
                                    class="embla__slide__img aspect-video object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
                            />
                        {/each}
                    </div>
                {:else}
                    <p class="embla__slide flex items-center justify-center h-full border-b border-b-border">{$_('recipeCard.noPicture')}</p>
                {/if}
            </div>

            {@render pictureOverlay?.(currentPicture)}
        </div>

        <div class="p-8">
            <div class="flex flex-col @xl:flex-row @xl:items-start @xl:justify-between gap-4 mb-4">
                <h1 class="text-3xl @xl:text-4xl font-bold text-card-foreground text-balance">{recipe.title}</h1>
                <div class="flex items-center justify-between @xl:justify-start w-full @xl:w-auto gap-2 @xl:gap-3 @xl:flex-shrink-0">
                    {#if recipe.category === 'diy'}
                        <span class="bg-muted text-muted-foreground px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ml-4">
                            {$_('recipeCard.diyBadge')}
                        </span>
                    {:else}
                        <span class="{typeColorClass} px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ml-4">
                            {$_('recipes.types.' + recipe.kind)}
                        </span>
                    {/if}
                    {@render headerActions?.()}
                </div>
            </div>

            {#if recipe.variation_of}
                <p class="text-sm text-muted-foreground mb-4">
                    {$_('recipe.variationBanner')}
                    <a href={`/${$locale}/recipes/${recipe.variation_of}`} class="text-primary hover:underline font-medium">{$_('recipe.viewOriginal')}</a>
                </p>
            {/if}

            <p class="text-xl text-muted-foreground mb-6 text-pretty whitespace-pre-line">{recipe.description}</p>

            <div class="flex flex-col @xl:flex-row @xl:flex-wrap @xl:items-center @xl:justify-between gap-4">
                <div class="flex items-center gap-x-2">
                    {#if recipe.author.picture}
                        <img
                                src={`${$serverUrl}/pictures/${recipe.author.picture}`}
                                alt="{recipe.author.username} profile"
                                class="w-8 h-8 rounded-full border-2 border-card object-cover"
                        />
                    {:else}
                        <div class="w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-card flex items-center justify-center text-xs font-medium">
                            {recipe.author.username.charAt(0) || "?"}
                        </div>
                    {/if}
                    <span class="text-lg font-medium text-card-foreground">{$_('recipeCard.by')} {recipe.author?.username || 'Author Name'}</span>
                </div>

                <div class="grid grid-cols-2 @xl:flex @xl:flex-nowrap @xl:items-center gap-3 @xl:gap-4 @3xl:gap-6 text-muted-foreground text-sm @xl:text-base">
                    <div class="flex items-center">
                        <Clock size="20" class="mr-2 text-black dark:text-current" />
                        <span class="whitespace-nowrap">{t('prep')}: {formatDuration(recipe.preparation_time, $_('recipes.h'), $_('recipes.min'))}</span>
                    </div>
                    {#if recipe.category !== 'diy'}
                        <div class="flex items-center">
                            <Flame size="20" class="mr-2 text-black dark:text-current" />
                            <span class="whitespace-nowrap">{t('cook')}: {formatDuration(recipe.cooking_time, $_('recipes.h'), $_('recipes.min'))}</span>
                        </div>
                        <div class="flex items-center">
                            <Wind size="20" class="mr-2 text-black dark:text-current" />
                            <span class="whitespace-nowrap">{t('rest')}: {formatDuration(recipe.resting_time, $_('recipes.h'), $_('recipes.min'))}</span>
                        </div>
                    {/if}
                    <div class="flex items-center">
                        <Users size="20" class="mr-2 text-black dark:text-current" />
                        <span class="whitespace-nowrap mr-2">{t('servings')}:</span>
                        <div class="flex items-center gap-2">
                            <button
                                    type="button"
                                    onclick={decreaseServings}
                                    disabled={selectedServings <= 1}
                                    aria-label={$_('recipe.decreaseServings')}
                                    class="w-6 h-6 flex items-center justify-center rounded-full border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed hover:cursor-pointer transition-colors"
                            >
                                <Minus size="14" />
                            </button>
                            <span class="w-4 text-center font-medium text-card-foreground">{selectedServings}</span>
                            <button
                                    type="button"
                                    onclick={increaseServings}
                                    aria-label={$_('recipe.increaseServings')}
                                    class="w-6 h-6 flex items-center justify-center rounded-full border border-border hover:bg-accent hover:cursor-pointer transition-colors"
                            >
                                <Plus size="14" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 @3xl:grid-cols-3 gap-8">
        <div class="@3xl:col-span-1">
            <div class="bg-card rounded-lg border border-border p-6 sticky top-24">
                <h2 class="text-2xl font-semibold text-card-foreground mb-6 flex items-center">
                    <FileText class="mr-3 text-primary" />
                    {t('ingredients')}
                </h2>

                {#if ingredientGroups.length > 0}
                    <div class="space-y-4">
                        {#each ingredientGroups as group}
                            <div>
                                {#if group.label}
                                    <h3 class="font-semibold text-card-foreground text-sm mb-2">{group.label}</h3>
                                {/if}
                                <ul class="space-y-3">
                                    {#each group.items as ingredient}
                                        <li class="flex items-start">
                                            <div class="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                                            {#if ingredient.recipe_ref}
                                                <RecipeRefIngredient {ingredient} ratio={servingsRatio} />
                                            {:else}
                                                <span class="text-card-foreground">{getIngredientName(ingredient, servingsRatio)}</span>
                                            {/if}
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-muted-foreground">{$_('create.noIngredient')}</p>
                {/if}
            </div>
        </div>

        <div class="@3xl:col-span-2">
            <div class="bg-card rounded-lg border border-border p-6">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <h2 class="text-2xl font-semibold text-card-foreground flex items-center">
                        <List class="mr-3 text-primary" />
                        {$_('recipe.instructions')}
                    </h2>
                    {#if instructionsActions}
                        <div class="flex items-center gap-2 flex-wrap">
                            {@render instructionsActions()}
                        </div>
                    {/if}
                </div>

                {#if recipe.steps.length > 0}
                    <div class="space-y-4">
                        {#each recipe.steps as step, index}
                            {@const done = stepDone(index)}
                            <div class="flex gap-4">
                                {#if stepAside}
                                    <div class="pt-1 flex-shrink-0">
                                        {@render stepAside(index)}
                                    </div>
                                {/if}
                                <div class="flex-1 min-w-0 {done ? 'opacity-50' : ''}">
                                    <div class="font-bold text-sm">
                                        {step.title || `Step ${index + 1}`}
                                    </div>
                                    <p class="text-card-foreground leading-relaxed pl-4 whitespace-pre-line {done ? 'line-through' : ''}">{step.description}</p>
                                    {@render stepFooter?.(step, index)}
                                </div>
                                {#if step.picture}
                                    <button
                                            type="button"
                                            onclick={() => stepLightboxPicture = step.picture!}
                                            class="flex-shrink-0 hover:cursor-zoom-in"
                                            aria-label={$_('recipe.stepPhoto', {values: {step: index + 1}})}
                                    >
                                        <img
                                                src={pictureUrl($serverUrl, step.picture)}
                                                alt={step.title || `Step ${index + 1}`}
                                                class="w-20 h-20 @xl:w-24 @xl:h-24 object-cover rounded-lg border border-border hover:scale-105 transition-transform {done ? 'opacity-50' : ''}"
                                        />
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-muted-foreground">{$_('create.noStep')}</p>
                {/if}
            </div>
        </div>
    </div>

    {#if nutrition && recipe.category !== 'diy' && recipe.ingredients.length > 0}
        {@render nutrition(selectedServings)}
    {/if}
</div>

<Lightbox
        open={lightboxOpen}
        pictures={recipe.pictures.map(p => p.filename)}
        pictureAttributions={recipe.pictures.map(p => ({
            username: p.added_by?.username ?? recipe.author.username,
            picture: p.added_by?.picture ?? recipe.author.picture,
        }))}
        startIndex={lightboxIndex}
        alt={recipe.title || 'Recipe Title'}
        onClose={() => lightboxOpen = false}
/>

<Lightbox
        open={stepLightboxPicture !== null}
        pictures={stepLightboxPicture ? [stepLightboxPicture] : []}
        alt={recipe.title || 'Recipe Title'}
        onClose={() => stepLightboxPicture = null}
/>
