<script lang="ts">
    import {onMount} from 'svelte';
    import {_} from 'svelte-i18n';
    import {serverUrl} from '$lib/stores';
    import {Drawer} from 'vaul-svelte';
    import {ChevronLeft, ChevronRight, X, FileText} from '@lucide/svelte';
    import {groupIngredients, getIngredientName, type Step, type Ingredient} from '$lib/recipes';
    import RecipeRefIngredient from './RecipeRefIngredient.svelte';

    let {
        recipeTitle,
        steps,
        startIndex = 0,
        ingredients,
        servingsRatio = 1,
        wakeLockSupported,
        wakeLockActive,
        requestWakeLock,
        releaseWakeLock,
        onStepChange,
        onClose,
    }: {
        recipeTitle: string;
        steps: Step[];
        startIndex?: number;
        ingredients: Ingredient[];
        servingsRatio?: number;
        wakeLockSupported: boolean;
        wakeLockActive: boolean;
        requestWakeLock: () => void | Promise<void>;
        releaseWakeLock: () => void;
        onStepChange: (index: number) => void;
        onClose: () => void;
    } = $props();

    let index = $state(startIndex);
    let ingredientsOpen = $state(false);

    const total = $derived(steps.length);
    const canPrev = $derived(index > 0);
    const canNext = $derived(index < total - 1);
    const currentStep = $derived(steps[index]);
    const ingredientGroups = $derived(groupIngredients(ingredients));

    function goTo(newIndex: number) {
        if (newIndex < 0 || newIndex >= total || newIndex === index)
            return;
        index = newIndex;
        onStepChange(index);
    }

    function prev(e?: Event) {
        e?.stopPropagation();
        goTo(index - 1);
    }

    function next(e?: Event) {
        e?.stopPropagation();
        goTo(index + 1);
    }

    // Tap zones: left half of the step area steps back, right half steps
    // forward - explicit buttons/dots on top of this handle the rest and
    // stop propagation so they don't also trigger a zone tap.
    function handleAreaClick(e: MouseEvent) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        if (e.clientX - rect.left < rect.width / 2)
            prev();
        else
            next();
    }

    let touchStartX: number | null = null;

    function handleTouchStart(e: TouchEvent) {
        touchStartX = e.touches[0].clientX;
    }

    function handleTouchEnd(e: TouchEvent) {
        if (touchStartX === null)
            return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        const threshold = 50;
        if (deltaX > threshold)
            prev();
        else if (deltaX < -threshold)
            next();
    }

    function handleKeydown(e: KeyboardEvent) {
        // While the ingredients drawer is open, let it own Escape (closing
        // just the drawer) instead of also exiting cook mode underneath it;
        // arrow keys are suppressed too so they don't advance steps while
        // reading/scrolling the ingredient list.
        if (ingredientsOpen)
            return;
        if (e.key === 'Escape')
            onClose();
        else if (e.key === 'ArrowLeft')
            prev();
        else if (e.key === 'ArrowRight')
            next();
    }

    // Cook mode auto-acquires the wake lock on open and releases it on
    // close - but only if it was the one that acquired it, so it never
    // clobbers a lock the user already turned on manually via the page's
    // own "keep awake" toggle before entering cook mode.
    let acquiredWakeLock = false;

    onMount(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        if (wakeLockSupported && !wakeLockActive) {
            acquiredWakeLock = true;
            requestWakeLock();
        }

        return () => {
            document.body.style.overflow = previousOverflow;
            if (acquiredWakeLock)
                releaseWakeLock();
        };
    });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
        class="fixed inset-0 z-50 flex flex-col bg-background text-foreground touch-pan-y"
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label={$_('recipe.cookMode')}
>
    <div class="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border flex-shrink-0">
        <div class="min-w-0">
            <p class="text-xs text-muted-foreground truncate">{recipeTitle}</p>
            <p class="text-sm font-semibold">{$_('recipe.cookModeStepOf', {values: {current: index + 1, total}})}</p>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
            <Drawer.Root shouldScaleBackground direction="bottom" bind:open={ingredientsOpen}>
                <Drawer.Trigger
                        class="rounded-lg p-2 text-muted-foreground transition-colors hover:cursor-pointer hover:bg-muted hover:text-foreground"
                        aria-label={$_('recipe.cookModeIngredients')}
                        title={$_('recipe.cookModeIngredients')}
                >
                    <FileText size="20" />
                </Drawer.Trigger>
                <Drawer.Portal>
                    <Drawer.Overlay class="fixed inset-0 bg-black/40 z-[60]" />
                    <Drawer.Content class="fixed bottom-0 inset-x-0 z-[60] max-h-[75vh] flex flex-col rounded-t-[10px] bg-card border-t border-border shadow-xl">
                        <div class="flex items-center justify-center pt-2 flex-shrink-0">
                            <div class="h-1.5 w-12 rounded-full bg-zinc-300"></div>
                        </div>
                        <div class="flex-1 overflow-y-auto px-6 py-4">
                            <h2 class="text-lg font-semibold text-card-foreground mb-4 flex items-center">
                                <FileText class="mr-2 text-primary" size="20" />
                                {$_('recipe.cookModeIngredients')}
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
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            <button
                    type="button"
                    onclick={() => onClose()}
                    class="rounded-lg p-2 text-muted-foreground transition-colors hover:cursor-pointer hover:bg-muted hover:text-foreground"
                    aria-label={$_('recipe.cookModeExit')}
                    title={$_('recipe.cookModeExit')}
            >
                <X size="22" />
            </button>
        </div>
    </div>

    <div
            class="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10"
            onclick={handleAreaClick}
            role="presentation"
    >
        <div class="max-w-2xl mx-auto">
            {#if currentStep.picture}
                <img
                        src={`${$serverUrl}/recipe-pictures/${currentStep.picture}`}
                        alt={currentStep.title || `Step ${index + 1}`}
                        class="w-full max-h-[40vh] object-cover rounded-lg border border-border mb-6"
                />
            {/if}
            <h1 class="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                {currentStep.title || `Step ${index + 1}`}
            </h1>
            <p class="text-lg sm:text-xl leading-relaxed text-foreground whitespace-pre-line">
                {currentStep.description}
            </p>
        </div>
    </div>

    <div class="flex-shrink-0 border-t border-border px-4 sm:px-6 py-3 sm:py-4 flex flex-col items-center gap-3">
        {#if total > 1}
            <div class="flex items-center gap-2">
                {#each steps as step, i}
                    <button
                            type="button"
                            onclick={(e) => { e.stopPropagation(); goTo(i); }}
                            class="rounded-full transition-all hover:cursor-pointer {i === index ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-border hover:bg-muted-foreground'}"
                            aria-label={$_('recipe.cookModeGoToStep', {values: {step: i + 1}})}
                            aria-current={i === index}
                    ></button>
                {/each}
            </div>
        {/if}

        <div class="flex items-center justify-between w-full max-w-md">
            <button
                    type="button"
                    onclick={prev}
                    disabled={!canPrev}
                    class="flex items-center gap-1 px-4 py-2 rounded-lg border-2 border-primary text-primary hover:bg-accent transition-colors hover:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    aria-label={$_('recipe.cookModePrevStep')}
            >
                <ChevronLeft size="20" />
            </button>
            <button
                    type="button"
                    onclick={next}
                    disabled={!canNext}
                    class="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors hover:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-primary"
                    aria-label={$_('recipe.cookModeNextStep')}
            >
                <ChevronRight size="20" />
            </button>
        </div>
    </div>
</div>
