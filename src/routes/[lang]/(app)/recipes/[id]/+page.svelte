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
        type Recipe,
        type RecipePicture,
        type RecipePreview,
        removeRecipePicture,
        unfavoriteRecipe
    } from "$lib/recipes";
    import {Heart, Plus, Coffee, Camera, Share2, X, ChefHat, Pencil, Timer} from "@lucide/svelte";
    import {serverUrl, user} from "$lib/stores";
    import {_, locale} from "svelte-i18n";
    import {pictureUrl, toastError, toastSuccess} from "$lib/utils";
    import RecipeCard from "../../../../../components/RecipeCard.svelte";
    import RecipeView from "../../../../../components/RecipeView.svelte";
    import RecipeNutritionPanel from "../../../../../components/RecipeNutritionPanel.svelte";
    import PageMeta from "../../../../../components/PageMeta.svelte";
    import CookMode from "../../../../../components/CookMode.svelte";
    import Checkbox from "../../../../../components/Checkbox.svelte";
    import ImageCropModal from "../../../../../components/ImageCropModal.svelte";
    import {recipeStepProgress, isStepDone, toggleStepDone} from "$lib/recipeProgress";
    import {activeTimers, startTimer, cancelTimer, getTimerFor, remainingMs, formatRemaining} from "$lib/recipeTimers";
    import {unlockAlarmAudio} from "$lib/timerAlarm";
    import {onMount} from "svelte";

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

        <RecipeView {recipe} bind:selectedServings stepDone={(index) => isStepDone($recipeStepProgress, recipe!.id, index)}>
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
                {#if recipe!.steps.length > 0}
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
                <RecipeNutritionPanel recipeId={recipe!.id} {servings} ingredients={recipe!.ingredients} canonicalIngredients={canonicalIngredients ?? recipe!.ingredients} />
            {/snippet}
        </RecipeView>

        {#if siblingVariations.length > 0}
            <div class="bg-card rounded-lg border border-border p-6 mt-8">
                <h2 class="text-2xl font-semibold text-card-foreground mb-6">{$_('recipe.variations')}</h2>
                <div class="grid grid-cols-cards gap-6">
                    {#each siblingVariations as variation (variation.id)}
                        <RecipeCard recipe={variation} />
                    {/each}
                </div>
            </div>
        {/if}

    </div>

    {#if cookModeOpen}
        <CookMode
                recipeId={recipe.id}
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
