<script lang="ts">
    import {goto} from "$app/navigation";
    import {page} from "$app/state";
    import {browser} from "$app/environment";
    import {
        addRecipePicture,
        favoriteRecipe,
        formatDuration,
        getFamily,
        getIngredientName,
        getRecipe,
        groupIngredients,
        PICTURE_CAP_PER_CONTRIBUTOR,
        type Recipe,
        type RecipePicture,
        type RecipePreview,
        recipeTypeColors,
        removeRecipePicture,
        unfavoriteRecipe
    } from "$lib/recipes";
    import emblaCarouselSvelte from "embla-carousel-svelte";
    import {FileText, List, Users, Wind, Flame, Clock, ArrowLeft, ArrowRight, Heart, Minus, Plus, Coffee, Camera, Share2, X, ChefHat, Pencil} from "@lucide/svelte";
    import {serverUrl, user} from "$lib/stores";
    import {_, locale} from "svelte-i18n";
    import {toastError, toastSuccess} from "$lib/utils";
    import Lightbox from "../../../../../components/Lightbox.svelte";
    import RecipeCard from "../../../../../components/RecipeCard.svelte";
    import RecipeRefIngredient from "../../../../../components/RecipeRefIngredient.svelte";
    import PageMeta from "../../../../../components/PageMeta.svelte";
    import CookMode from "../../../../../components/CookMode.svelte";
    import Checkbox from "../../../../../components/Checkbox.svelte";
    import ImageCropModal from "../../../../../components/ImageCropModal.svelte";
    import {recipeStepProgress, isStepDone, toggleStepDone} from "$lib/recipeProgress";

    let id = $derived(page.params.id)
    const { data } = $props()
    let recipe: Recipe | null | undefined = $state(data.recipe)
    let selectedServings = $state(data.recipe?.quantity ?? 1)
    let siblingVariations: RecipePreview[] = $state([])

    // The recipe currently viewed may itself be a variation; siblings are
    // always fetched relative to the family root, never the variation.
    let rootId = $derived(recipe?.variation_of ?? recipe?.id)

    $effect(() => {
        if (!id)
            return
        getRecipe(id, $locale ?? undefined).then(({response, data}) => {
            if (response.ok && data) {
                recipe = data
                selectedServings = data.quantity
            } else
                toastError($_('settings.errors.getRecipes'))
        })
    })

    $effect(() => {
        if (!rootId) {
            siblingVariations = []
            return
        }
        getFamily(rootId, $locale ?? undefined).then(({variations}) => {
            // Exclude the recipe currently being viewed: when it's itself a
            // variation, it's included in "this root's variations" like any
            // sibling, but it isn't its own sibling.
            if (variations.response.ok && variations.data)
                siblingVariations = variations.data.items.filter(v => v.id !== id)
        })
    })

    function submitVariation() {
        if (rootId)
            goto(`/${$locale}/create?variation_of=${rootId}`)
    }

    function suggestTranslationFix() {
        if (id)
            goto(`/${$locale}/recipes/${id}/suggest-fix`)
    }

    async function shareRecipe() {
        if (!recipe)
            return
        const shareData = {
            title: recipe.title,
            text: recipe.description,
            url: page.url.href,
        };
        if (navigator.share && navigator.canShare?.(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (e) {
                if ((e as Error).name !== 'AbortError') toastError($_('recipe.shareError'));
            }
        } else {
            try {
                await navigator.clipboard.writeText(page.url.href);
                toastSuccess($_('recipe.linkCopied'));
            } catch (e) {
                toastError($_('recipe.shareError'));
            }
        }
    }

    let ingredientGroups = $derived(groupIngredients(recipe?.ingredients ?? []));
    let servingsRatio = $derived(recipe && recipe.quantity > 0 ? selectedServings / recipe.quantity : 1);

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
    let heartBump = $state(false);
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
        void recipe?.pictures.length;
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
        if (!recipe?.pictures || recipe.pictures.length === 0)
            return;
        lightboxIndex = emblaApi ? emblaApi.selectedScrollSnap() : 0;
        lightboxOpen = true;
    }

    function openStepLightbox(picture: string) {
        stepLightboxPicture = picture;
    }

    async function toggleFavorite() {
        if (!recipe)
            return
        heartBump = true;
        const wasFavorite = recipe.favorite;
        recipe = {...recipe, favorite: !wasFavorite, favorite_count: recipe.favorite_count + (wasFavorite ? -1 : 1)};
        try {
            const {response} = wasFavorite ? await unfavoriteRecipe(recipe.id) : await favoriteRecipe(recipe.id);
            if (!response.ok)
                throw new Error('favorite request failed');
        } catch {
            if (!recipe)
                return
            recipe = {...recipe, favorite: wasFavorite, favorite_count: recipe.favorite_count + (wasFavorite ? 1 : -1)};
            toastError($_('recipeCard.favoriteError'));
        }
    }

    let pictureInput: HTMLInputElement = $state()!;
    let addingPicture = $state(false);

    const isAuthor = $derived(!!$user && !!recipe && $user.id === recipe.author.id);
    // A contributor's own count toward PictureCapPerContributor; meaningless
    // (and unused) for the author, who has no cap.
    const myPictureCount = $derived(
        $user && recipe ? recipe.pictures.filter(p => p.added_by?.id === $user!.id).length : 0
    );
    const reachedPictureCap = $derived(!isAuthor && myPictureCount >= PICTURE_CAP_PER_CONTRIBUTOR);

    function canRemovePicture(picture: RecipePicture): boolean {
        if (!$user || !recipe)
            return false;
        if ($user.admin || isAuthor)
            return true;
        return picture.added_by?.id === $user.id;
    }

    function triggerAddPicture() {
        pictureInput?.click();
    }

    // A contributor adding a photo to someone else's recipe goes through the
    // same crop/rotate step RecipeEdit uses, so community photos land at a
    // consistent size/orientation; the author uploading to their own recipe
    // skips straight to upload.
    let cropFile = $state<File | null>(null);

    async function uploadPicture(file: File) {
        if (!recipe)
            return;
        addingPicture = true;
        try {
            const {response, data} = await addRecipePicture(recipe.id, file);
            if (response.ok && data)
                recipe = data;
            else if (response.status === 409)
                toastError($_('recipe.addPhotoCapReached', {values: {count: PICTURE_CAP_PER_CONTRIBUTOR}}));
            else
                toastError($_('recipe.addPhotoError'));
        } catch {
            toastError($_('recipe.addPhotoError'));
        } finally {
            addingPicture = false;
        }
    }

    async function handlePictureSelected(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        target.value = '';
        if (!file || !recipe)
            return;
        if (isAuthor)
            await uploadPicture(file);
        else
            cropFile = file;
    }

    async function onPictureCropConfirm(croppedFile: File) {
        cropFile = null;
        await uploadPicture(croppedFile);
    }

    function onPictureCropCancel() {
        cropFile = null;
    }

    async function handleRemovePicture(e: MouseEvent, filename: string) {
        e.stopPropagation();
        if (!recipe)
            return;
        const previous = recipe;
        recipe = {...recipe, pictures: recipe.pictures.filter(p => p.filename !== filename)};
        try {
            const {response, data} = await removeRecipePicture(previous.id, filename);
            if (response.ok && data)
                recipe = data;
            else {
                recipe = previous;
                toastError($_('recipe.removePhotoError'));
            }
        } catch {
            recipe = previous;
            toastError($_('recipe.removePhotoError'));
        }
    }

    const currentPicture = $derived(recipe?.pictures?.[currentSlideIndex]);

    const typeColorClass = $derived(recipeTypeColors[(recipe ?? {kind: ''}).kind] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300");

    // Wake Lock API keeps the screen on while cooking so it doesn't dim/lock
    // mid-recipe. The lock is auto-released by the browser whenever the tab
    // is hidden, so it's re-acquired on visibilitychange while still enabled.
    const wakeLockSupported = browser && 'wakeLock' in navigator;
    let wakeLockActive = $state(false);
    let wakeLockSentinel: WakeLockSentinel | null = null;

    async function requestWakeLock() {
        if (!wakeLockSupported)
            return;
        try {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            wakeLockSentinel.addEventListener('release', () => wakeLockActive = false);
            wakeLockActive = true;
        } catch {
            wakeLockActive = false;
        }
    }

    function releaseWakeLock() {
        wakeLockSentinel?.release();
        wakeLockSentinel = null;
        wakeLockActive = false;
    }

    function toggleWakeLock() {
        if (wakeLockActive)
            releaseWakeLock();
        else
            requestWakeLock();
    }

    $effect(() => {
        if (!browser)
            return;
        function handleVisibility() {
            if (wakeLockActive && document.visibilityState === 'visible' && !wakeLockSentinel)
                requestWakeLock();
        }
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            releaseWakeLock();
        };
    });

    // Cook mode's open/step state lives in the URL (?cookStep=<n>, 1-indexed)
    // rather than local state, so a reload or shared link reopens it at the
    // same step. Entering pushes one history entry; every step change after
    // that replaces it in place (never pushes), so a single browser back
    // press always exits cook mode outright, from any step. +page.server.ts
    // only reads params (not searchParams), so these navigations never
    // re-fetch the recipe.
    const cookStepParam = $derived(page.url.searchParams.get('cookStep'));
    const cookModeOpen = $derived(cookStepParam !== null && !!recipe && recipe.steps.length > 0);
    const cookModeStartIndex = $derived.by(() => {
        const total = recipe?.steps.length ?? 0;
        if (total === 0)
            return 0;
        const requested = cookStepParam ? parseInt(cookStepParam, 10) : 1;
        const step = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), total) : 1;
        return step - 1;
    });

    // Tracks whether *this* page instance pushed the cook-mode history entry
    // (via the Cook button) as opposed to cook mode having been open on
    // arrival (deep link / reload) - only then is it safe for the explicit
    // close control to pop it with history.back() instead of replacing it.
    let cookModeEnteredViaPush = $state(false);

    $effect(() => {
        if (!cookModeOpen)
            cookModeEnteredViaPush = false;
    });

    function cookStepUrl(step: number | null): string {
        const url = new URL(page.url);
        if (step === null)
            url.searchParams.delete('cookStep');
        else
            url.searchParams.set('cookStep', String(step));
        return `${url.pathname}${url.search}`;
    }

    function openCookMode() {
        if (!recipe || recipe.steps.length === 0)
            return;
        cookModeEnteredViaPush = true;
        goto(cookStepUrl(1), {replaceState: false, noScroll: true, keepFocus: true});
    }

    function setCookModeStep(index: number) {
        goto(cookStepUrl(index + 1), {replaceState: true, noScroll: true, keepFocus: true});
    }

    function closeCookMode() {
        if (cookModeEnteredViaPush) {
            cookModeEnteredViaPush = false;
            history.back();
        } else {
            goto(cookStepUrl(null), {replaceState: true, noScroll: true, keepFocus: true});
        }
    }

    // Terminology lookup: for a diy-category recipe, tries `diyRecipe.<key>`
    // first and falls back to `recipe.<key>` when no diy-specific override
    // exists (svelte-i18n returns the key itself on a miss).
    function t(key: string): string {
        if (recipe?.category === 'diy') {
            const diyKey = 'diyRecipe.' + key
            const diyValue = $_(diyKey)
            if (diyValue !== diyKey) return diyValue
        }
        return $_('recipe.' + key)
    }
</script>

<PageMeta
        title={recipe?.title ?? (recipe === null ? t('notFound') : undefined)}
        description={recipe?.description}
        image={recipe?.pictures && recipe.pictures.length > 0 ? `${$serverUrl}/recipe-pictures/${recipe.pictures[0].filename}` : undefined}
/>
{#if recipe}
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
                onclick={() => goto(`/${$locale}/${recipe?.category === 'diy' ? 'diy' : 'home'}`)}
                class="flex items-center hover:cursor-pointer text-primary hover:text-primary/80 transition-colors mb-6"
        >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            {t('back')}
        </button>

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
                    {#if (recipe.pictures?.length ?? 0) >= 1}
                        <div class="embla__container flex">
                            {#each recipe.pictures as picture}
                                <img
                                        src={`${$serverUrl}/recipe-pictures/${picture.filename}`}
                                        alt={recipe.title || 'Recipe Title'}
                                        class="embla__slide__img aspect-video object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
                                />
                            {/each}
                        </div>
                    {:else}
                        <p class="embla__slide flex items-center justify-center h-full border-b border-b-border">{$_('recipeCard.noPicture')}</p>
                    {/if}
                </div>

                {#if currentPicture && canRemovePicture(currentPicture)}
                    <button
                            type="button"
                            onclick={(e) => handleRemovePicture(e, currentPicture!.filename)}
                            class="absolute bottom-3 right-3 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 hover:cursor-pointer transition-colors"
                            aria-label={$_('recipe.removePhoto')}
                            title={$_('recipe.removePhoto')}
                    >
                        <X size="16" />
                    </button>
                {/if}

                {#if $user}
                    <button
                            type="button"
                            onclick={triggerAddPicture}
                            disabled={reachedPictureCap || addingPicture}
                            class="absolute top-3 right-3 z-20 bg-black/60 hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full p-2 hover:cursor-pointer transition-colors"
                            aria-label={$_('recipe.addPhoto')}
                            title={reachedPictureCap ? $_('recipe.addPhotoCapReached', {values: {count: PICTURE_CAP_PER_CONTRIBUTOR}}) : $_('recipe.addPhoto')}
                    >
                        <Camera size="18" />
                    </button>
                    <input
                            bind:this={pictureInput}
                            type="file"
                            accept="image/*"
                            class="hidden"
                            onchange={handlePictureSelected}
                    />
                    <ImageCropModal file={cropFile} onConfirm={onPictureCropConfirm} onCancel={onPictureCropCancel} />
                {/if}
            </div>

            <div class="p-8">
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <h1 class="text-3xl sm:text-4xl font-bold text-card-foreground text-balance">{recipe.title}</h1>
                    <div class="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 sm:gap-3 sm:flex-shrink-0">
                        {#if recipe.category === 'diy'}
                            <span class="bg-muted text-muted-foreground px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ml-4">
                                {$_('recipeCard.diyBadge')}
                            </span>
                        {:else}
                            <span class="{typeColorClass} px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ml-4">
                                {$_('recipes.types.' + recipe.kind)}
                            </span>
                        {/if}
                        {#if $user}
                            <button
                                    onclick={toggleFavorite}
                                    class="bg-background hover:cursor-pointer hover:bg-accent border-2 border-primary text-primary hover:text-primary px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
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
                                    <span class="text-sm font-semibold">{recipe.favorite_count}</span>
                                {/if}
                            </button>
                        {/if}
                        <button
                                onclick={shareRecipe}
                                class="bg-background hover:cursor-pointer hover:bg-accent border-2 border-primary text-primary hover:text-primary px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                                aria-label={$_('recipe.share')}
                                title={$_('recipe.share')}
                        >
                            <Share2 size="20" />
                        </button>
                        {#if $user}
                            <button
                                    onclick={submitVariation}
                                    class="bg-background hover:cursor-pointer hover:bg-accent border-2 border-primary text-primary px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                                    aria-label={$_('recipe.submitVariation')}
                                    title={$_('recipe.submitVariation')}
                            >
                                <Plus size="20" />
                                <span class="hidden sm:inline text-sm font-semibold">{$_('recipe.submitVariation')}</span>
                            </button>
                        {/if}
                        {#if $user && recipe.locale !== recipe.source_locale}
                            <button
                                    onclick={suggestTranslationFix}
                                    class="bg-background hover:cursor-pointer hover:bg-accent border-2 border-primary text-primary px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                                    aria-label={$_('recipe.suggestFix')}
                                    title={$_('recipe.suggestFix')}
                            >
                                <Pencil size="20" />
                            </button>
                        {/if}
                    </div>
                </div>

                {#if recipe.variation_of}
                    <p class="text-sm text-muted-foreground mb-4">
                        {$_('recipe.variationBanner')}
                        <a href={`/${$locale}/recipes/${recipe.variation_of}`} class="text-primary hover:underline font-medium">{$_('recipe.viewOriginal')}</a>
                    </p>
                {/if}

                <p class="text-xl text-muted-foreground mb-6 text-pretty whitespace-pre-line">{recipe.description}</p>

                <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
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

                    <div class="grid grid-cols-2 sm:flex sm:flex-nowrap sm:items-center gap-3 sm:gap-4 lg:gap-6 text-muted-foreground text-sm sm:text-base">
                        <div class="flex items-center">
                            <Clock size="20" class="mr-2 text-black dark:text-current" />
                            <span class="whitespace-nowrap">{$_('recipe.prep')}: {formatDuration(recipe.preparation_time, $_('recipes.h'), $_('recipes.min'))}</span>
                        </div>
                        <div class="flex items-center">
                            <Flame size="20" class="mr-2 text-black dark:text-current" />
                            <span class="whitespace-nowrap">{t('cook')}: {formatDuration(recipe.cooking_time, $_('recipes.h'), $_('recipes.min'))}</span>
                        </div>
                        <div class="flex items-center">
                            <Wind size="20" class="mr-2 text-black dark:text-current" />
                            <span class="whitespace-nowrap">{t('rest')}: {formatDuration(recipe.resting_time, $_('recipes.h'), $_('recipes.min'))}</span>
                        </div>
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

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-1">
                <div class="bg-card rounded-lg border border-border p-6 sticky top-24">
                    <h2 class="text-2xl font-semibold text-card-foreground mb-6 flex items-center">
                        <FileText class="mr-3 text-primary" />
                        {t('ingredients')}
                    </h2>

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
                </div>
            </div>

            <div class="lg:col-span-2">
                <div class="bg-card rounded-lg border border-border p-6">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
                        <h2 class="text-2xl font-semibold text-card-foreground flex items-center">
                            <List class="mr-3 text-primary" />
                            {$_('recipe.instructions')}
                        </h2>
                        <div class="flex items-center gap-2 flex-wrap">
                            {#if recipe.steps.length > 0}
                                <button
                                        type="button"
                                        onclick={openCookMode}
                                        class="hover:cursor-pointer border-2 border-primary bg-primary text-primary-foreground px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md hover:bg-primary/90 whitespace-nowrap"
                                        aria-label={t('cookMode')}
                                        title={t('cookMode')}
                                >
                                    <ChefHat size="18" />
                                    <span class="hidden sm:inline text-sm font-medium">{t('cookMode')}</span>
                                </button>
                            {/if}
                            {#if wakeLockSupported}
                                <button
                                        onclick={toggleWakeLock}
                                        class="hover:cursor-pointer border-2 px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap {wakeLockActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-primary text-primary'}"
                                        aria-pressed={wakeLockActive}
                                        aria-label={$_(wakeLockActive ? 'recipe.keepAwakeOff' : 'recipe.keepAwakeOn')}
                                        title={$_(wakeLockActive ? 'recipe.keepAwakeOff' : 'recipe.keepAwakeOn')}
                                >
                                    <Coffee size="18" fill={wakeLockActive ? 'currentColor' : 'none'} />
                                    <span class="text-sm font-medium">{$_(wakeLockActive ? 'recipe.keepAwakeOff' : 'recipe.keepAwakeOn')}</span>
                                </button>
                            {/if}
                        </div>
                    </div>

                    <div class="space-y-4">
                        {#each recipe.steps as step, index}
                            {@const done = isStepDone($recipeStepProgress, recipe.id, index)}
                            <div class="flex gap-4">
                                <div class="pt-1 flex-shrink-0">
                                    <Checkbox
                                            checked={done}
                                            onchange={() => toggleStepDone(recipe!.id, index)}
                                            ariaLabel={$_('recipe.stepDone', {values: {step: index + 1}})}
                                    />
                                </div>
                                {#if step.picture}
                                    <button
                                            type="button"
                                            onclick={() => openStepLightbox(step.picture!)}
                                            class="flex-shrink-0 hover:cursor-zoom-in"
                                            aria-label={$_('recipe.stepPhoto', {values: {step: index + 1}})}
                                    >
                                        <img
                                                src={`${$serverUrl}/recipe-pictures/${step.picture}`}
                                                alt={step.title || `Step ${index + 1}`}
                                                class="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-border hover:scale-105 transition-transform {done ? 'opacity-50' : ''}"
                                        />
                                    </button>
                                {/if}
                                <div class="flex-1 min-w-0 {done ? 'opacity-50' : ''}">
                                    <div class="font-bold text-sm">
                                        {step.title || `Step ${index + 1}`}
                                    </div>
                                    <p class="text-card-foreground leading-relaxed pl-4 whitespace-pre-line {done ? 'line-through' : ''}">{step.description}</p>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        </div>

        {#if siblingVariations.length > 0}
            <div class="bg-card rounded-lg border border-border p-6 mt-8">
                <h2 class="text-2xl font-semibold text-card-foreground mb-6">{$_('recipe.variations')}</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {#each siblingVariations as variation (variation.id)}
                        <RecipeCard recipe={variation} />
                    {/each}
                </div>
            </div>
        {/if}

    </div>

    {@const author = recipe.author}
    <Lightbox
            open={lightboxOpen}
            pictures={(recipe.pictures ?? []).map(p => p.filename)}
            pictureAttributions={(recipe.pictures ?? []).map(p => ({
                username: p.added_by?.username ?? author.username,
                picture: p.added_by?.picture ?? author.picture,
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

    {#if cookModeOpen}
        <CookMode
                recipeTitle={recipe.title}
                steps={recipe.steps}
                startIndex={cookModeStartIndex}
                ingredients={recipe.ingredients}
                {servingsRatio}
                {wakeLockSupported}
                {wakeLockActive}
                {requestWakeLock}
                {releaseWakeLock}
                onStepChange={setCookModeStep}
                onClose={closeCookMode}
        />
    {/if}
{:else if recipe === null}
<!--    @TODO skeleton loading-->
{:else}
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center">
            <h2 class="text-2xl font-semibold text-foreground mb-4">{$_('recipe.notFound')}</h2>
            <button
                    onclick={() => goto(`/${$locale}/home`)}
                    class="bg-primary hover:cursor-pointer text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
            >
                {$_('recipe.back')}
            </button>
        </div>
    </div>
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
