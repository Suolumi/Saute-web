<script lang="ts">
    import {onMount} from 'svelte';
    import {_} from 'svelte-i18n';
    import {serverUrl} from '$lib/stores';
    import {Drawer} from 'vaul-svelte';
    import {ChevronLeft, ChevronRight, X, FileText} from '@lucide/svelte';
    import {groupIngredients, getIngredientName, type Step, type Ingredient} from '$lib/recipes';
    import RecipeRefIngredient from './RecipeRefIngredient.svelte';
    import Checkbox from './Checkbox.svelte';

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

    // Which ingredients have been checked off while cooking - session-local
    // only (resets the next time cook mode is opened), keyed by object
    // identity since Ingredient has no stable id.
    let checkedIngredients = $state(new Set<Ingredient>());

    function toggleIngredient(ingredient: Ingredient) {
        const next = new Set(checkedIngredients);
        if (next.has(ingredient))
            next.delete(ingredient);
        else
            next.add(ingredient);
        checkedIngredients = next;
    }

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

    function handleProgressClick(e: MouseEvent) {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        goTo(Math.min(total - 1, Math.floor(ratio * total)));
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

<svelte:head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;0,600;1,400;1,500&display=swap" rel="stylesheet">
</svelte:head>

{#snippet ingredientRows()}
    {#each ingredientGroups as group}
        <div class="flex flex-col gap-3">
            {#if group.label}
                <span class="text-[11px] font-bold uppercase pb-2" style="letter-spacing: 0.09em; color: var(--cm-ink-soft); border-bottom: 1px solid var(--cm-line);">{group.label}</span>
            {/if}
            {#each group.items as ingredient}
                {@const checked = checkedIngredients.has(ingredient)}
                <div class="flex items-start gap-3">
                    <div class="pt-px">
                        <Checkbox
                                {checked}
                                onchange={() => toggleIngredient(ingredient)}
                                ariaLabel={$_('recipe.cookModeIngredientChecked', {values: {name: ingredient.recipe_ref ? (ingredient.ref_label || ingredient.resolved_ref_title || '') : getIngredientName(ingredient, servingsRatio)}})}
                        />
                    </div>
                    <span class="text-[15px] leading-snug" style="{checked ? 'text-decoration: line-through; color: var(--cm-ink-soft);' : ''}">
                        {#if ingredient.recipe_ref}
                            <RecipeRefIngredient {ingredient} ratio={servingsRatio} />
                        {:else}
                            {getIngredientName(ingredient, servingsRatio)}
                        {/if}
                    </span>
                </div>
            {/each}
        </div>
    {/each}
{/snippet}

<svelte:window onkeydown={handleKeydown} />

<div
        class="cook-mode fixed inset-0 z-50 flex flex-col touch-pan-y"
        style="background: var(--cm-bg); color: var(--cm-ink);"
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label={$_('recipe.cookMode')}
>
    <!-- Desktop (`lg:` and up) gets a genuinely different layout, not a
         stretched phone screen: a permanent ingredients sidebar (the
         mobile drawer stays mobile/tablet-only, `lg:hidden` below) next to
         a wider stage - both grow further at `xl:`, and from `xl:` up the
         whole two-pane group is width-capped and centered (rather than
         letting the sidebar hug the left edge with the stage's own
         max-width leaving a growing dead zone on the right) so it doesn't
         drift lopsided on very wide monitors. -->
    <div class="flex-1 min-h-0 w-full flex flex-col lg:flex-row lg:h-full xl:max-w-[1240px] xl:mx-auto">
    <aside class="hidden lg:flex lg:flex-col lg:w-[340px] xl:w-[380px] lg:flex-shrink-0 lg:h-full" style="border-right: 1px solid var(--cm-line);">
        <div class="flex-shrink-0 px-7 pt-8 pb-5" style="border-bottom: 1px solid var(--cm-line);">
            <span class="cm-serif text-[13px] italic" style="color: var(--cm-ink-soft);">
                {$_('recipe.cookModeStep', {values: {step: index + 1}})} · {currentStep.title || `Step ${index + 1}`}
            </span>
            <h2 class="cm-serif m-0 mt-1 text-[26px] font-semibold">{$_('recipe.cookModeIngredients')}</h2>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-7 py-6 flex flex-col gap-6">
            {@render ingredientRows()}
        </div>
    </aside>

    <!-- The stage: full viewport width/height is the dialog's own
         backdrop; this column is capped to a comfortable reading width and
         centered in whatever space it has (the full viewport below `sm`,
         the remainder next to the sidebar from `lg` up) so a wide window
         never stretches a hero photo into a letterbox strip or flings the
         nav buttons to opposite corners. -->
    <div class="flex-1 min-h-0 lg:min-w-0 w-full flex flex-col sm:max-w-[480px] sm:mx-auto lg:max-w-2xl xl:max-w-3xl">
    <div class="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-[18px] pb-[10px] lg:pt-6">
        <div class="min-w-0 flex flex-col gap-[3px]">
            <span class="text-[10px] font-semibold uppercase truncate max-w-[220px]" style="letter-spacing: 0.09em; color: var(--cm-ink-soft);">{recipeTitle}</span>
            <span class="cm-serif text-base lg:text-lg italic font-medium">{$_('recipe.cookModeStepOf', {values: {current: index + 1, total}})}</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
            <div class="lg:hidden">
                <Drawer.Root shouldScaleBackground direction="bottom" bind:open={ingredientsOpen}>
                    <Drawer.Trigger
                            class="w-10 h-10 rounded-full flex items-center justify-center hover:cursor-pointer"
                            style="background: var(--cm-card); box-shadow: 0 2px 8px var(--cm-shadow);"
                            aria-label={$_('recipe.cookModeIngredients')}
                            title={$_('recipe.cookModeIngredients')}
                    >
                        <FileText size="18" />
                    </Drawer.Trigger>
                    <Drawer.Portal>
                        <Drawer.Overlay class="fixed inset-0 bg-black/40 z-[60]" />
                        <Drawer.Content class="cook-mode fixed bottom-0 inset-x-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] sm:bottom-6 z-[60] max-h-[75vh] flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-xl" style="background: var(--cm-card); color: var(--cm-ink);">
                            <div class="flex-shrink-0 w-11 h-[5px] rounded-full mx-auto mt-[10px] mb-[14px]" style="background: var(--cm-line);"></div>
                            <div class="flex-shrink-0 px-6 pb-4" style="border-bottom: 1px solid var(--cm-line);">
                                <span class="cm-serif text-[13px] italic" style="color: var(--cm-ink-soft);">
                                    {$_('recipe.cookModeStep', {values: {step: index + 1}})} · {currentStep.title || `Step ${index + 1}`}
                                </span>
                                <h2 class="cm-serif m-0 mt-1 text-[25px] font-semibold">{$_('recipe.cookModeIngredients')}</h2>
                            </div>
                            <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-6">
                                {@render ingredientRows()}
                            </div>
                        </Drawer.Content>
                    </Drawer.Portal>
                </Drawer.Root>
            </div>

            <button
                    type="button"
                    onclick={() => onClose()}
                    class="w-10 h-10 rounded-full flex items-center justify-center hover:cursor-pointer"
                    style="background: var(--cm-card); box-shadow: 0 2px 8px var(--cm-shadow);"
                    aria-label={$_('recipe.cookModeExit')}
                    title={$_('recipe.cookModeExit')}
            >
                <X size="17" />
            </button>
        </div>
    </div>

    <div class="flex-shrink-0 px-5 pb-4">
        <button
                type="button"
                onclick={handleProgressClick}
                class="block w-full h-1 rounded-full hover:cursor-pointer"
                style="padding: 0; border: none; background: var(--cm-line);"
                aria-label={$_('recipe.cookModeStepOf', {values: {current: index + 1, total}})}
        >
            <div class="h-full rounded-full transition-[width] duration-200" style="width: {((index + 1) / total) * 100}%; background: var(--primary);"></div>
        </button>
    </div>

    {#if currentStep.picture}
        <div class="flex-1 min-h-0 flex flex-col relative" onclick={handleAreaClick} role="presentation">
            <img
                    src={`${$serverUrl}/recipe-pictures/${currentStep.picture}`}
                    alt={currentStep.title || `Step ${index + 1}`}
                    class="w-full flex-shrink-0 object-cover h-[258px] lg:h-[320px] xl:h-[380px] lg:rounded-t-[26px]"
            />
            <div class="flex-1 min-h-0 flex flex-col relative z-[2]" style="margin-top: -26px; background: var(--cm-card); border-radius: 26px 26px 0 0; box-shadow: 0 -14px 30px var(--cm-shadow-strong); padding: 26px 24px 0 24px;">
                <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[10px] pb-2">
                    <span class="text-[11px] font-bold uppercase" style="letter-spacing: 0.1em; color: var(--cm-green-strong);">{$_('recipe.cookModeStep', {values: {step: index + 1}})}</span>
                    <h1 class="cm-serif m-0 text-[32px] lg:text-[38px] xl:text-[44px] font-semibold" style="line-height: 1.15;">{currentStep.title || `Step ${index + 1}`}</h1>
                    <p class="m-0 text-base lg:text-lg xl:text-xl whitespace-pre-line" style="line-height: 1.65; color: var(--cm-ink-soft);">{currentStep.description}</p>
                </div>
                <div class="flex-shrink-0 flex items-center justify-between" style="padding: 18px 0 22px 0;">
                    <button
                            type="button"
                            onclick={prev}
                            disabled={!canPrev}
                            class="rounded-full flex items-center justify-center hover:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            style="width: 52px; height: 52px; background: var(--cm-bg); border: 1.5px solid var(--cm-line); box-shadow: 0 3px 10px var(--cm-shadow);"
                            aria-label={$_('recipe.cookModePrevStep')}
                    >
                        <ChevronLeft size="20" />
                    </button>
                    <span class="cm-serif text-[15px] italic" style="color: var(--cm-ink-soft);">{index + 1} / {total}</span>
                    <button
                            type="button"
                            onclick={next}
                            disabled={!canNext}
                            class="rounded-full flex items-center justify-center hover:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            style="width: 56px; height: 56px; background: var(--primary); color: var(--primary-foreground); box-shadow: 0 8px 20px var(--cm-green-tint);"
                            aria-label={$_('recipe.cookModeNextStep')}
                    >
                        <ChevronRight size="22" />
                    </button>
                </div>
            </div>
        </div>
    {:else}
        <div class="flex-1 min-h-0 relative overflow-hidden flex flex-col" onclick={handleAreaClick} role="presentation" style="padding: 8px 24px 0 24px;">
            <span aria-hidden="true" class="cm-serif text-[260px] lg:text-[320px] xl:text-[380px]" style="position: absolute; top: -40px; right: -22px; font-style: italic; font-weight: 500; line-height: 1; color: var(--cm-green-tint);">{index + 1}</span>
            <div class="flex-1 min-h-0 overflow-y-auto relative z-[1] flex flex-col gap-[10px] pb-2">
                <span class="text-[11px] font-bold uppercase" style="letter-spacing: 0.1em; color: var(--cm-green-strong);">{$_('recipe.cookModeStep', {values: {step: index + 1}})}</span>
                <h1 class="cm-serif m-0 text-[32px] lg:text-[38px] xl:text-[44px] font-semibold" style="line-height: 1.15;">{currentStep.title || `Step ${index + 1}`}</h1>
                <p class="m-0 text-base lg:text-lg xl:text-xl whitespace-pre-line" style="line-height: 1.65; color: var(--cm-ink-soft);">{currentStep.description}</p>
            </div>
            <div class="flex-shrink-0 relative z-[1] flex items-center justify-between" style="padding: 18px 0 22px 0;">
                <button
                        type="button"
                        onclick={prev}
                        disabled={!canPrev}
                        class="rounded-full flex items-center justify-center hover:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        style="width: 52px; height: 52px; background: var(--cm-bg); border: 1.5px solid var(--cm-line); box-shadow: 0 3px 10px var(--cm-shadow);"
                        aria-label={$_('recipe.cookModePrevStep')}
                >
                    <ChevronLeft size="20" />
                </button>
                <span class="cm-serif text-[15px] italic" style="color: var(--cm-ink-soft);">{index + 1} / {total}</span>
                <button
                        type="button"
                        onclick={next}
                        disabled={!canNext}
                        class="rounded-full flex items-center justify-center hover:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        style="width: 56px; height: 56px; background: var(--primary); color: var(--primary-foreground); box-shadow: 0 8px 20px var(--cm-green-tint);"
                        aria-label={$_('recipe.cookModeNextStep')}
                >
                    <ChevronRight size="22" />
                </button>
            </div>
        </div>
    {/if}
    </div>
    </div>
</div>

<style>
    /* :global() because .cook-mode is also passed as a class PROP to
       Drawer.Trigger/Drawer.Content (vaul-svelte); a prop value never gets
       Svelte's scoped-style hash, and Drawer.Content is portaled out of
       this component's DOM subtree besides (breaking normal inheritance
       too) - a scoped selector would silently fail to match either. */
    :global(.cook-mode) {
        --cm-bg: oklch(0.99 0.004 75);
        --cm-card: oklch(0.97 0.006 75);
        --cm-ink: oklch(0.22 0.01 80);
        --cm-ink-soft: oklch(0.48 0.01 80);
        --cm-line: oklch(0.9 0.006 75);
        --cm-green-strong: oklch(0.36 0.13 160);
        --cm-green-tint: oklch(0.45 0.15 160 / 0.1);
        --cm-shadow: rgba(30, 18, 8, 0.08);
        --cm-shadow-strong: rgba(30, 18, 8, 0.14);
    }
    :global(html.dark .cook-mode) {
        --cm-bg: oklch(0.16 0.006 75);
        --cm-card: oklch(0.21 0.008 75);
        --cm-ink: oklch(0.96 0.004 75);
        --cm-ink-soft: oklch(0.68 0.006 75);
        --cm-line: oklch(0.3 0.01 75);
        --cm-green-strong: oklch(0.75 0.13 160);
        --cm-green-tint: oklch(0.55 0.12 160 / 0.18);
        --cm-shadow: rgba(0, 0, 0, 0.35);
        --cm-shadow-strong: rgba(0, 0, 0, 0.45);
    }
    .cm-serif {
        font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
    }
</style>
