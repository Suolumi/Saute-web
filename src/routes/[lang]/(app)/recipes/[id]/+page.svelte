<script lang="ts">
    import {goto} from "$app/navigation";
    import {page} from "$app/state";
    import {browser} from "$app/environment";
    import {
        addRecipePicture,
        favoriteRecipe,
        getFamily,
        getRecipe,
        PICTURE_CAP_PER_CONTRIBUTOR,
        type Ingredient,
        type Recipe,
        type RecipePicture,
        type RecipePreview,
        removeRecipePicture,
        unfavoriteRecipe
    } from "$lib/recipes";
    import {Heart, Plus, Coffee, Camera, Share2, X, Pencil, Timer} from "@lucide/svelte";
    import {serverUrl, user} from "$lib/stores";
    import {_, locale} from "svelte-i18n";
    import {pictureUrl, toastError, toastSuccess} from "$lib/utils";
    import VersionSwitcher from "../../../../../components/VersionSwitcher.svelte";
    import AdHocTimerModal from "../../../../../components/AdHocTimerModal.svelte";
    import RecipeView from "../../../../../components/RecipeView.svelte";
    import RecipeNutritionPanel from "../../../../../components/RecipeNutritionPanel.svelte";
    import PageMeta from "../../../../../components/PageMeta.svelte";
    import Checkbox from "../../../../../components/Checkbox.svelte";
    import ImageCropModal from "../../../../../components/ImageCropModal.svelte";
    import {recipeStepProgress, isStepDone, toggleStepDone} from "$lib/recipeProgress";
    import {activeTimers, startTimer, cancelTimer, getTimerFor, remainingMs, formatRemaining} from "$lib/recipeTimers";
    import {unlockAlarmAudio} from "$lib/timerAlarm";
    import {onMount} from "svelte";
    import {ScreenWakeLock} from "$lib/wakeLock.svelte";
    import {canonicalConversions, canonicalSubstitutes, loadConversionData, type ConversionData} from "$lib/ingredientConversions";

    let id = $derived(page.params.id)
    const { data } = $props()
    let recipe: Recipe | null | undefined = $state(data.recipe)
    let selectedServings = $state(data.recipe?.quantity ?? 1)
    let familyVersions: RecipePreview[] = $state([])
    let familyFetchFailed = $state(false)

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

    // canonicalIngredients is only fetched when actually viewing a
    // translated copy (recipe.locale !== recipe.source_locale) - the
    // Nutrition panel's fix-it flow must submit against the recipe's
    // canonical (source-locale) ingredient text, since that's what
    // GetRecipeNutrition always resolves links against server-side;
    // submitting the locale-displayed name instead creates a link that can
    // never match this recipe (confirmed live: linking "Patate douce" while
    // viewing a French translation of a "Sweet potatoe" (source_locale en)
    // recipe created a real link that just never resolves for it). Left
    // undefined when they're the same locale - RecipeNutritionPanel falls
    // back to the (already-canonical) ingredients prop in that case.
    let canonicalIngredients: Recipe['ingredients'] | undefined = $state(undefined)
    $effect(() => {
        if (!recipe || recipe.locale === recipe.source_locale) {
            canonicalIngredients = undefined
            return
        }
        getRecipe(recipe.id).then(({response, data}) => {
            if (response.ok && data) canonicalIngredients = data.ingredients
        })
    })

    // The effect depends on these only, so switching between versions of one
    // family keeps the chips instead of refetching them.
    let familyId = $derived(recipe?.family_id)
    let familySize = $derived(recipe?.family_size ?? 1)

    $effect(() => {
        familyVersions = []
        familyFetchFailed = false
        if (!familyId || familySize <= 1)
            return
        let stale = false
        getFamily(familyId, $locale ?? undefined).then(({response, data}) => {
            if (stale)
                return
            if (response.ok && data)
                familyVersions = data.items
            else
                familyFetchFailed = true
        })
        return () => { stale = true }
    })

    let timerModalOpen = $state(false)
    let conversionData: ConversionData | null = $state(null)
    $effect(() => {
        const sourceLocale = recipe?.source_locale
        loadConversionData(sourceLocale).then(data => conversionData = data)
    })

    function conversionsFor(ingredient: Ingredient, ratio: number): string[] {
        if (!recipe || !conversionData)
            return []
        return canonicalConversions(ingredient, ratio, recipe.ingredients, canonicalIngredients, conversionData)
    }

    function substitutesFor(ingredient: Ingredient): string[] {
        if (!recipe || !conversionData)
            return []
        return canonicalSubstitutes(ingredient, recipe.ingredients, canonicalIngredients, conversionData, $locale)
    }

    function submitVariation() {
        if (recipe)
            goto(`/${$locale}/create?variation_of=${recipe.id}`)
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

    let servingsRatio = $derived(recipe && recipe.quantity > 0 ? selectedServings / recipe.quantity : 1);

    let heartBump = $state(false);

    function onStartStepTimer(stepIndex: number, label: string, minutes: number) {
        if (!recipe) return;
        unlockAlarmAudio();
        startTimer(recipe.id, stepIndex, label, recipe.title, minutes);
    }

    // Drives the live "Xm Ys left" label on a step's own timer button - the
    // global widget (mounted separately in the root layout) ticks the store
    // itself, but a per-step button here needs its own clock to re-render
    // every second rather than only whenever the store happens to change.
    let now = $state(Date.now());
    onMount(() => {
        const interval = setInterval(() => now = Date.now(), 500);
        return () => clearInterval(interval);
    });

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

    // Wake Lock API keeps the screen on while cooking so it doesn't dim/lock
    // mid-recipe.
    const wakeLockSupported = browser && 'wakeLock' in navigator;
    const wakeLock = new ScreenWakeLock(() => navigator.wakeLock.request('screen'));

    $effect(() => {
        if (!browser)
            return;
        function handleVisibility() {
            if (document.visibilityState === 'visible')
                wakeLock.onVisible();
        }
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            wakeLock.release();
        };
    });

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
        image={recipe?.pictures && recipe.pictures.length > 0 ? pictureUrl($serverUrl, recipe.pictures[0].filename) : undefined}
/>
{#if recipe}
    <div class="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
                onclick={() => goto(`/${$locale}/${recipe?.category === 'diy' ? 'diy' : 'home'}`)}
                class="flex items-center hover:cursor-pointer text-primary hover:text-primary/80 transition-colors mb-6"
        >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            {t('back')}
        </button>

        <RecipeView {recipe} bind:selectedServings conversions={recipe.category === 'diy' ? undefined : conversionsFor} substitutes={recipe.category === 'diy' ? undefined : substitutesFor} stepDone={(index) => isStepDone($recipeStepProgress, recipe!.id, index)}>
            {#snippet pictureOverlay(currentPicture)}
                {#if currentPicture && canRemovePicture(currentPicture)}
                    <button
                            type="button"
                            onclick={(e) => handleRemovePicture(e, currentPicture.filename)}
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
            {/snippet}

            {#snippet versions()}
                {#if familyVersions.length > 1}
                    <VersionSwitcher versions={familyVersions} currentId={recipe!.id} onAdd={$user ? submitVariation : undefined} />
                {/if}
            {/snippet}

            {#snippet headerActions()}
                {#if $user}
                    <button
                            onclick={toggleFavorite}
                            class="bg-background hover:cursor-pointer hover:bg-accent border-2 border-primary text-primary hover:text-primary px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                            aria-label={$_(recipe!.favorite ? 'recipeCard.unfavorite' : 'recipeCard.favorite')}
                            title={$_(recipe!.favorite ? 'recipeCard.unfavorite' : 'recipeCard.favorite')}
                    >
                        <span
                                class="inline-flex {heartBump ? 'heart-bump' : ''}"
                                onanimationend={() => heartBump = false}
                        >
                            <Heart size="20" fill={recipe!.favorite ? 'currentColor' : 'none'} class={recipe!.favorite ? 'text-red-500' : ''} />
                        </span>
                        {#if recipe!.favorite_count > 0}
                            <span class="text-sm font-semibold">{recipe!.favorite_count}</span>
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
                {#if $user && recipe && (familySize <= 1 || familyFetchFailed)}
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
                {#if $user && recipe!.locale !== recipe!.source_locale}
                    <button
                            onclick={suggestTranslationFix}
                            class="bg-background hover:cursor-pointer hover:bg-accent border-2 border-primary text-primary px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                            aria-label={$_('recipe.suggestFix')}
                            title={$_('recipe.suggestFix')}
                    >
                        <Pencil size="20" />
                    </button>
                {/if}
            {/snippet}

            {#snippet instructionsActions()}
                <button
                        type="button"
                        onclick={() => timerModalOpen = true}
                        class="hover:cursor-pointer border-2 px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap bg-background hover:bg-accent border-primary text-primary"
                        aria-label={$_('adHocTimer.title')}
                        title={$_('adHocTimer.title')}
                >
                    <Plus size="18" />
                    <span class="hidden sm:inline text-sm font-medium">{$_('adHocTimer.button')}</span>
                </button>
                {#if wakeLockSupported}
                    <button
                            onclick={() => wakeLock.toggle()}
                            class="hover:cursor-pointer border-2 px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap {wakeLock.wanted ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-primary text-primary'}"
                            aria-pressed={wakeLock.wanted}
                            aria-label={$_(wakeLock.wanted ? 'recipe.keepAwakeOff' : 'recipe.keepAwakeOn')}
                            title={$_(wakeLock.wanted ? 'recipe.keepAwakeOff' : 'recipe.keepAwakeOn')}
                    >
                        <Coffee size="18" fill={wakeLock.wanted ? 'currentColor' : 'none'} />
                        <span class="text-sm font-medium">{$_(wakeLock.wanted ? 'recipe.keepAwakeOff' : 'recipe.keepAwakeOn')}</span>
                    </button>
                {/if}
            {/snippet}

            {#snippet stepAside(index)}
                <Checkbox
                        checked={isStepDone($recipeStepProgress, recipe!.id, index)}
                        onchange={() => toggleStepDone(recipe!.id, index)}
                        ariaLabel={$_('recipe.stepDone', {values: {step: index + 1}})}
                />
            {/snippet}

            {#snippet stepFooter(step, index)}
                {@const stepTimer = getTimerFor($activeTimers, recipe!.id, index)}
                {#if step.timer_minutes}
                    <div class="pl-4 mt-1.5">
                        {#if stepTimer}
                            <button
                                    type="button"
                                    onclick={() => cancelTimer(stepTimer.id)}
                                    class="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full hover:cursor-pointer {stepTimer.ringing ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}"
                            >
                                <Timer size="14" />
                                {stepTimer.ringing ? $_('recipe.timerDone') : $_('recipe.timerRemaining', {values: {time: formatRemaining(remainingMs(stepTimer, now))}})}
                                <X size="12" />
                            </button>
                        {:else}
                            <button
                                    type="button"
                                    onclick={() => onStartStepTimer(index, step.title || `Step ${index + 1}`, step.timer_minutes!)}
                                    class="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors hover:cursor-pointer"
                            >
                                <Timer size="14" />
                                {$_('recipe.startTimer', {values: {minutes: step.timer_minutes}})}
                            </button>
                        {/if}
                    </div>
                {/if}
            {/snippet}

            {#snippet nutrition(servings)}
                <RecipeNutritionPanel recipeId={recipe!.id} {servings} ingredients={recipe!.ingredients} canonicalIngredients={canonicalIngredients ?? recipe!.ingredients} sourceLocale={recipe!.source_locale} />
            {/snippet}
        </RecipeView>

    </div>

    <AdHocTimerModal bind:open={timerModalOpen} />
{:else if recipe === null}
<!--    @TODO skeleton loading-->
{:else}
    <div class="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
