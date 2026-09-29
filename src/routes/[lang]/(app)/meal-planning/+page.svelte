<script lang="ts">
    import PageMeta from '../../../../components/PageMeta.svelte';
    import Button from '../../../../components/Button.svelte';
    import RecipePickerModal from '../../../../components/RecipePickerModal.svelte';
    import MealSlotCard from '../../../../components/MealSlotCard.svelte';
    import MealPlanServingsModal from '../../../../components/MealPlanServingsModal.svelte';
    import EditableNumber from '../../../../components/EditableNumber.svelte';
    import HighlightText from '../../../../components/HighlightText.svelte';
    import {_, locale} from 'svelte-i18n';
    import {goto} from '$app/navigation';
    import {serverUrl, user} from '$lib/stores';
    import {getRecipe, getRecipes, type RecipePreview} from '$lib/recipes';
    import {
        mealPlan,
        mealPlanDefaultServings,
        mealPlanDayOverrides,
        planMeal,
        unplanMeal,
        setMealServings,
        clearMealServings,
        setDayServings,
        clearDayServings,
        effectiveServings,
        findMeal,
        getWeekStart,
        getWeekDates,
        addDays,
        entriesForWeek,
        toISODate,
        MEAL_TYPES,
        type MealType,
    } from '$lib/mealPlanning';
    import {addRecipeToShoppingList, setRecipeServings} from '$lib/shoppingList';
    import {toastError, toastSuccess, pictureUrl} from '$lib/utils';
    import {ChevronLeft, ChevronRight, ShoppingCart, Search, Coffee, Sandwich, UtensilsCrossed, Minus, Plus} from '@lucide/svelte';

    const MEAL_META: Record<MealType, { icon: typeof Coffee; labelKey: string }> = {
        breakfast: {icon: Coffee, labelKey: 'mealPlanning.mealType.breakfast'},
        lunch: {icon: Sandwich, labelKey: 'mealPlanning.mealType.lunch'},
        dinner: {icon: UtensilsCrossed, labelKey: 'mealPlanning.mealType.dinner'},
    };

    const todayISO = toISODate(new Date());

    let weekStart = $state(getWeekStart(new Date()));
    let weekDates = $derived(getWeekDates(weekStart));
    let weekEntries = $derived(entriesForWeek($mealPlan, weekDates));
    let hasAnyPlanned = $derived(weekEntries.length > 0);

    let weekRangeLabel = $derived.by(() => {
        const fmt = new Intl.DateTimeFormat($locale ?? undefined, {month: 'short', day: 'numeric'});
        return `${fmt.format(weekStart)} – ${fmt.format(addDays(weekStart, 6))}`;
    });

    let dayHeaders = $derived(weekDates.map(d => {
        const date = new Date(`${d}T00:00:00`);
        return {
            date: d,
            dow: new Intl.DateTimeFormat($locale ?? undefined, {weekday: 'short'}).format(date).toUpperCase(),
            num: date.getDate(),
            isToday: d === todayISO,
        };
    }));

    // selectedDayIndex backs the mobile single-day agenda - it re-centers on
    // today whenever the visible week changes (including on first load), but
    // otherwise stays wherever the user tapped.
    let selectedDayIndex = $state(0);
    $effect(() => {
        const idx = weekDates.indexOf(todayISO);
        selectedDayIndex = idx >= 0 ? idx : 0;
    });

    function prevWeek() {
        weekStart = addDays(weekStart, -7);
    }

    function nextWeek() {
        weekStart = addDays(weekStart, 7);
    }

    function goToday() {
        weekStart = getWeekStart(new Date());
    }

    // --- Servings cascade: week default -> day override -> per-meal override ---

    function increaseWeekDefault() {
        mealPlanDefaultServings.update(v => (v ?? 0) + 1);
    }

    function decreaseWeekDefault() {
        mealPlanDefaultServings.update(v => (v && v > 1) ? v - 1 : v);
    }

    function setWeekDefault(n: number) {
        mealPlanDefaultServings.set(n);
    }

    function formatDayLabel(date: string): string {
        const d = new Date(`${date}T00:00:00`);
        return new Intl.DateTimeFormat($locale ?? undefined, {weekday: 'long', month: 'short', day: 'numeric'}).format(d);
    }

    // A day with no override of its own and no week default yet has nothing
    // concrete to show - the modal still needs a starting number to step
    // from, so it seeds at 2 rather than 0/undefined.
    const DAY_SERVINGS_SEED = 2;

    let dayModalDate: string | null = $state(null);
    let dayModalOpen = $derived(dayModalDate !== null);
    let dayModalValue = $derived(dayModalDate !== null ? ($mealPlanDayOverrides[dayModalDate] ?? $mealPlanDefaultServings ?? DAY_SERVINGS_SEED) : DAY_SERVINGS_SEED);
    let dayModalOverridden = $derived(dayModalDate !== null && $mealPlanDayOverrides[dayModalDate] !== undefined);

    function openDayModal(date: string) {
        dayModalDate = date;
    }

    function closeDayModal() {
        dayModalDate = null;
    }

    function increaseDayServings() {
        if (dayModalDate)
            setDayServings(dayModalDate, dayModalValue + 1);
    }

    function decreaseDayServings() {
        if (dayModalDate && dayModalValue > 1)
            setDayServings(dayModalDate, dayModalValue - 1);
    }

    function resetDayServings() {
        if (dayModalDate)
            clearDayServings(dayModalDate);
    }

    function setDayServingsValue(n: number) {
        if (dayModalDate)
            setDayServings(dayModalDate, n);
    }

    let mealModalDate: string | null = $state(null);
    let mealModalType: MealType | null = $state(null);
    let mealModalOpen = $derived(mealModalDate !== null && mealModalType !== null);
    let mealModalEntry = $derived(mealModalDate !== null && mealModalType !== null ? findMeal(weekEntries, mealModalDate, mealModalType) : undefined);
    let mealModalValue = $derived(mealModalEntry ? effectiveServings(mealModalEntry, $mealPlanDayOverrides, $mealPlanDefaultServings) : 1);
    let mealModalOverridden = $derived(mealModalEntry?.servings !== undefined);

    function openMealModal(date: string, mealType: MealType) {
        mealModalDate = date;
        mealModalType = mealType;
    }

    function closeMealModal() {
        mealModalDate = null;
        mealModalType = null;
    }

    function increaseMealServings() {
        if (mealModalDate && mealModalType)
            setMealServings(mealModalDate, mealModalType, mealModalValue + 1);
    }

    function decreaseMealServings() {
        if (mealModalDate && mealModalType && mealModalValue > 1)
            setMealServings(mealModalDate, mealModalType, mealModalValue - 1);
    }

    function resetMealServings() {
        if (mealModalDate && mealModalType)
            clearMealServings(mealModalDate, mealModalType);
    }

    function setMealServingsValue(n: number) {
        if (mealModalDate && mealModalType)
            setMealServings(mealModalDate, mealModalType, n);
    }

    let pickerOpen = $state(false);
    let pickerTarget: { date: string; mealType: MealType } | null = $state(null);

    function openPicker(date: string, mealType: MealType) {
        pickerTarget = {date, mealType};
        pickerOpen = true;
    }

    function closePicker() {
        pickerOpen = false;
        pickerTarget = null;
    }

    function handlePicked(recipe: RecipePreview) {
        if (pickerTarget)
            planMeal(pickerTarget.date, pickerTarget.mealType, recipe.id, recipe.title, recipe.quantity, recipe.pictures[0]);
        closePicker();
    }

    // --- Sidebar: the caller's favorites, searchable and draggable onto a slot ---

    let sidebarQuery = $state('');
    let sidebarRecipes: RecipePreview[] = $state([]);
    let sidebarLoading = $state(false);
    let sidebarRequestId = 0;

    function fetchSidebar(term: string) {
        sidebarLoading = true;
        const id = ++sidebarRequestId;
        getRecipes({favorites_only: true, title: term || undefined, locale: $locale ?? undefined, search_locale: $locale ?? undefined, limit: 20})
            .then(({response, data}) => {
                if (id !== sidebarRequestId)
                    return;
                sidebarLoading = false;
                if (response.ok && data)
                    sidebarRecipes = data.items;
            });
    }

    $effect(() => {
        const term = sidebarQuery;
        $locale;
        const t = setTimeout(() => fetchSidebar(term), term ? 250 : 0);
        return () => clearTimeout(t);
    });

    function handleDragStart(e: DragEvent, recipe: RecipePreview) {
        e.dataTransfer?.setData('application/json', JSON.stringify({id: recipe.id, title: recipe.title, quantity: recipe.quantity, picture: recipe.pictures[0]}));
        if (e.dataTransfer)
            e.dataTransfer.effectAllowed = 'copy';
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
    }

    function handleDrop(e: DragEvent, date: string, mealType: MealType) {
        e.preventDefault();
        const raw = e.dataTransfer?.getData('application/json');
        if (!raw)
            return;
        try {
            const r = JSON.parse(raw);
            planMeal(date, mealType, r.id, r.title, r.quantity, r.picture);
        } catch {
            // ignore a drop that isn't one of our own recipe payloads
        }
    }

    // --- "Add week to shopping list": the payoff of planning ---

    let addingToShoppingList = $state(false);

    async function addWeekToShoppingList() {
        if (weekEntries.length === 0)
            return;
        addingToShoppingList = true;
        const fetched = await Promise.all(weekEntries.map(e => getRecipe(e.recipeId, $locale ?? undefined)));
        let ok = true;
        fetched.forEach(({response, data}, i) => {
            const planEntry = weekEntries[i];
            if (response.ok && data) {
                addRecipeToShoppingList(data.id, data.title, data.quantity, data.pictures[0]?.filename, data.ingredients);
                // A recipe planned more than once this week (e.g. leftovers
                // on two days) collapses to the same shopping-list entry -
                // the last one processed sets its servings.
                const planServings = effectiveServings(planEntry, $mealPlanDayOverrides, $mealPlanDefaultServings);
                if (planServings !== data.quantity)
                    setRecipeServings(data.id, planServings);
            } else {
                ok = false;
            }
        });
        addingToShoppingList = false;
        if (ok) {
            toastSuccess($_('mealPlanning.addedToShoppingList'));
            goto(`/${$locale}/shopping-list`);
        } else {
            toastError($_('mealPlanning.addToShoppingListError'));
        }
    }
</script>

<PageMeta title={$_('mealPlanning.meta.title')} description={$_('mealPlanning.meta.description')} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if !$user}
        <div class="max-w-md mx-auto text-center py-24">
            <h1 class="text-2xl font-bold text-foreground mb-2">{$_('mealPlanning.unauthorized.title')}</h1>
            <p class="text-muted-foreground mb-4">{$_('mealPlanning.unauthorized.description')}</p>
            <Button onclick={() => goto(`/${$locale}/login`)}>{$_('header.login')}</Button>
        </div>
    {:else}
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
                <h1 class="text-3xl font-bold text-foreground">{$_('mealPlanning.title')}</h1>
                <div class="mt-2 flex items-center gap-2">
                    <button
                            onclick={prevWeek}
                            aria-label={$_('mealPlanning.prevWeek')}
                            class="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
                    >
                        <ChevronLeft class="w-4 h-4" />
                    </button>
                    <span class="text-lg font-semibold text-foreground whitespace-nowrap">{weekRangeLabel}</span>
                    <button
                            onclick={nextWeek}
                            aria-label={$_('mealPlanning.nextWeek')}
                            class="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
                    >
                        <ChevronRight class="w-4 h-4" />
                    </button>
                    <button onclick={goToday} class="ml-1 px-3 py-1 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:bg-muted">
                        {$_('mealPlanning.today')}
                    </button>
                </div>
            </div>
            <div class="flex flex-col items-start sm:items-end gap-2">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-muted-foreground whitespace-nowrap">{$_('mealPlanning.weekServings')}</span>
                    <div class="flex items-center gap-1.5">
                        <button
                                type="button"
                                onclick={decreaseWeekDefault}
                                disabled={!$mealPlanDefaultServings || $mealPlanDefaultServings <= 1}
                                aria-label={$_('recipe.decreaseServings')}
                                class="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed hover:cursor-pointer"
                        >
                            <Minus class="w-3 h-3" />
                        </button>
                        <EditableNumber
                                value={$mealPlanDefaultServings}
                                placeholder="—"
                                onSet={setWeekDefault}
                                class="text-sm font-bold text-foreground w-8 text-center"
                        />
                        <button
                                type="button"
                                onclick={increaseWeekDefault}
                                aria-label={$_('recipe.increaseServings')}
                                class="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted hover:cursor-pointer"
                        >
                            <Plus class="w-3 h-3" />
                        </button>
                    </div>
                </div>
                <Button
                        onclick={addWeekToShoppingList}
                        disabled={!hasAnyPlanned || addingToShoppingList}
                        class="flex items-center gap-2 whitespace-nowrap"
                >
                    <ShoppingCart class="w-4 h-4" />
                    {$_('mealPlanning.addWeekToShoppingList')}
                </Button>
            </div>
        </div>

        <!-- Desktop: full week grid + a favorites sidebar to drag from -->
        <div class="hidden lg:flex gap-6">
            <div class="w-72 flex-shrink-0 rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 h-[640px]">
                <div class="font-semibold text-foreground">{$_('mealPlanning.yourFavorites')}</div>
                <div class="relative">
                    <Search class="w-4 h-4 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                            type="text"
                            bind:value={sidebarQuery}
                            placeholder={$_('mealPlanning.searchPlaceholder')}
                            class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-border bg-background text-sm"
                    />
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto -mx-2">
                    {#if sidebarLoading && sidebarRecipes.length === 0}
                        <div class="text-sm text-muted-foreground px-2 py-4">{$_('mealPlanning.loading')}</div>
                    {:else if sidebarRecipes.length === 0}
                        <div class="text-sm text-muted-foreground px-2 py-4">{$_('mealPlanning.noFavorites')}</div>
                    {:else}
                        {#each sidebarRecipes as recipe (recipe.id)}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                    draggable="true"
                                    ondragstart={(e) => handleDragStart(e, recipe)}
                                    title={$_('mealPlanning.dragHint')}
                                    class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab hover:bg-muted"
                            >
                                <div class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {#if recipe.pictures[0]}
                                        <img src={pictureUrl($serverUrl, recipe.pictures[0])} alt="" class="w-full h-full object-cover" />
                                    {/if}
                                </div>
                                <div class="min-w-0">
                                    <div class="text-sm font-medium text-foreground truncate"><HighlightText text={recipe.title} query={sidebarQuery} /></div>
                                    <div class="text-xs text-muted-foreground truncate">{$_('recipeCard.by')} {recipe.author?.username}</div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            <div class="flex-1 min-w-0">
                <div class="grid gap-3" style="grid-template-columns: 90px repeat(7, minmax(0,1fr));">
                    <div></div>
                    {#each dayHeaders as day}
                        <button
                                type="button"
                                onclick={() => openDayModal(day.date)}
                                aria-label={$_('mealPlanning.editDayServings')}
                                class="flex flex-col items-center gap-1 pb-1 hover:cursor-pointer"
                        >
                            <span class="text-[11px] font-bold tracking-wide text-muted-foreground">{day.dow}</span>
                            <span class="relative w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold {day.isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}">
                                {day.num}
                                {#if $mealPlanDayOverrides[day.date] !== undefined}
                                    <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary {day.isToday ? 'ring-1 ring-primary-foreground' : ''}"></span>
                                {/if}
                            </span>
                        </button>
                    {/each}

                    {#each MEAL_TYPES as mealType}
                        {@const MealIcon = MEAL_META[mealType].icon}
                        <div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <MealIcon class="w-3.5 h-3.5" />
                            {$_(MEAL_META[mealType].labelKey)}
                        </div>
                        {#each weekDates as date}
                            {@const mealEntry = findMeal(weekEntries, date, mealType)}
                            <div class="h-32">
                                <MealSlotCard
                                        entry={mealEntry}
                                        compact
                                        servings={mealEntry ? effectiveServings(mealEntry, $mealPlanDayOverrides, $mealPlanDefaultServings) : 0}
                                        overridden={mealEntry?.servings !== undefined}
                                        onAdd={() => openPicker(date, mealType)}
                                        onRemove={() => unplanMeal(date, mealType)}
                                        onEditServings={() => openMealModal(date, mealType)}
                                        ondragover={handleDragOver}
                                        ondrop={(e) => handleDrop(e, date, mealType)}
                                />
                            </div>
                        {/each}
                    {/each}
                </div>
            </div>
        </div>

        <!-- Mobile: day tabs + a single-day agenda -->
        <div class="lg:hidden">
            <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {#each dayHeaders as day, i}
                    <button
                            onclick={() => selectedDayIndex = i}
                            class="flex-shrink-0 w-12 flex flex-col items-center gap-1 py-2 rounded-2xl border {i === selectedDayIndex ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border'}"
                    >
                        <span class="text-[10px] font-bold">{day.dow}</span>
                        <span class="text-base font-semibold">{day.num}</span>
                    </button>
                {/each}
            </div>

            <button
                    type="button"
                    onclick={() => openDayModal(weekDates[selectedDayIndex])}
                    aria-label={$_('mealPlanning.editDayServings')}
                    class="mt-3 w-full flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 hover:cursor-pointer"
            >
                <span class="text-xs font-semibold text-muted-foreground">{$_('mealPlanning.dayServings')}</span>
                <span class="relative text-sm font-bold text-foreground">
                    {$mealPlanDayOverrides[weekDates[selectedDayIndex]] ?? $mealPlanDefaultServings ?? '—'}
                    {#if $mealPlanDayOverrides[weekDates[selectedDayIndex]] !== undefined}
                        <span class="absolute -top-0.5 -right-2 w-1.5 h-1.5 rounded-full bg-primary"></span>
                    {/if}
                </span>
            </button>

            <div class="mt-4 flex flex-col gap-4">
                {#each MEAL_TYPES as mealType}
                    {@const MealIcon = MEAL_META[mealType].icon}
                    {@const mealEntry = findMeal(weekEntries, weekDates[selectedDayIndex], mealType)}
                    <div>
                        <div class="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground">
                            <MealIcon class="w-3.5 h-3.5" />
                            {$_(MEAL_META[mealType].labelKey)}
                        </div>
                        <MealSlotCard
                                entry={mealEntry}
                                servings={mealEntry ? effectiveServings(mealEntry, $mealPlanDayOverrides, $mealPlanDefaultServings) : 0}
                                overridden={mealEntry?.servings !== undefined}
                                onAdd={() => openPicker(weekDates[selectedDayIndex], mealType)}
                                onRemove={() => unplanMeal(weekDates[selectedDayIndex], mealType)}
                                onEditServings={() => openMealModal(weekDates[selectedDayIndex], mealType)}
                        />
                    </div>
                {/each}
            </div>
        </div>

        <RecipePickerModal
                open={pickerOpen}
                title={$_('mealPlanning.pickerTitle')}
                onClose={closePicker}
                onSelect={handlePicked}
        />

        <MealPlanServingsModal
                open={dayModalOpen}
                title={dayModalDate ? formatDayLabel(dayModalDate) : ''}
                value={dayModalValue}
                onIncrease={increaseDayServings}
                onDecrease={decreaseDayServings}
                onSet={setDayServingsValue}
                onClose={closeDayModal}
                resetLabel={dayModalOverridden ? $_('mealPlanning.useWeekDefault') : undefined}
                onReset={dayModalOverridden ? resetDayServings : undefined}
        />

        <MealPlanServingsModal
                open={mealModalOpen}
                title={mealModalDate && mealModalType ? `${$_(MEAL_META[mealModalType].labelKey)} – ${formatDayLabel(mealModalDate)}` : ''}
                value={mealModalValue}
                onIncrease={increaseMealServings}
                onDecrease={decreaseMealServings}
                onSet={setMealServingsValue}
                onClose={closeMealModal}
                resetLabel={mealModalOverridden ? $_('mealPlanning.useDayDefault') : undefined}
                onReset={mealModalOverridden ? resetMealServings : undefined}
        />
    {/if}
</div>
