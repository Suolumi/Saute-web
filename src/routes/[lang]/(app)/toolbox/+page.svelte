<script lang="ts">
    import {onMount} from "svelte";
    import {_, locale} from "svelte-i18n";
    import {user} from "$lib/stores";
    import {ArrowRightLeft, SearchX, Pause, Play, X} from "@lucide/svelte";
    import PageMeta from "../../../../components/PageMeta.svelte";
    import Label from "../../../../components/Label.svelte";
    import Input from "../../../../components/Input.svelte";
    import Select from "../../../../components/Select.svelte";
    import IngredientCombobox from "../../../../components/toolbox/IngredientCombobox.svelte";
    import SuggestIngredientModal from "../../../../components/toolbox/SuggestIngredientModal.svelte";
    import SuggestUnitModal from "../../../../components/toolbox/SuggestUnitModal.svelte";
    import SuggestSubstitutionModal from "../../../../components/toolbox/SuggestSubstitutionModal.svelte";
    import {
        getToolboxIngredients, getToolboxUnits, getToolboxSubstitutions, convertQuantity,
        type ToolboxIngredient, type ToolboxUnit, type ToolboxSubstitution
    } from "$lib/toolbox";
    import {getNutritionIngredients, type NutritionIngredient} from "$lib/nutrition";
    import {
        activeTimers, startAdHocTimer, cancelTimer, pauseTimer, resumeTimer, isPaused, remainingMs, formatRemaining
    } from "$lib/recipeTimers";
    import {unlockAlarmAudio} from "$lib/timerAlarm";

    type Tab = 'quantity' | 'oven' | 'nutrition' | 'timers' | 'substitutions';

    let ingredients: ToolboxIngredient[] = $state([]);
    let units: ToolboxUnit[] = $state([]);
    let substitutions: ToolboxSubstitution[] = $state([]);

    let activeTab: Tab = $state('quantity');

    let ingredientId = $state('');
    let amount: number = $state(250);
    let fromUnitId = $state('');
    let toUnitId = $state('');

    let ovenTemp: number = $state(350);
    let ovenUnit: 'F' | 'C' = $state('F');

    let nutritionIngredients: NutritionIngredient[] = $state([]);
    let nutritionIngredientId = $state('');

    let subSearch = $state('');

    let showSuggestIngredient = $state(false);
    let showSuggestUnit = $state(false);
    let showSuggestSubstitution = $state(false);

    let timerName = $state('');
    let timerMinutes: number = $state(5);
    let timerSeconds: number = $state(0);
    let timerNow = $state(Date.now());

    onMount(() => {
        const interval = setInterval(() => timerNow = Date.now(), 500);
        return () => clearInterval(interval);
    });

    onMount(() => {
        getNutritionIngredients().then(({response, data}) => {
            if (response.ok && data)
                nutritionIngredients = data.items;
        });
    });

    // displayName resolves a curated Ciqual entry's name in the site's
    // current language - NutritionIngredient.name is always Ciqual's own
    // French name; .names holds the en/fi translations baked in at import.
    function displayName(item: NutritionIngredient): string {
        return item.names?.[$locale ?? ''] ?? item.name;
    }

    const localizedNutritionIngredients = $derived(nutritionIngredients.map(n => ({id: n.id, name: displayName(n)})));
    const selectedNutritionIngredient = $derived(nutritionIngredients.find(n => n.id === nutritionIngredientId));

    const adHocTimers = $derived(
        [...$activeTimers].filter(t => t.recipeId === null).sort((a, b) => remainingMs(a, timerNow) - remainingMs(b, timerNow))
    );

    const timerPresets = [1, 5, 10, 15, 30];

    function nextAutoLabel(): string {
        return $_('toolbox.timers.autoLabel', {values: {n: adHocTimers.length + 1}});
    }

    function startCustomTimer() {
        const totalMinutes = (timerMinutes || 0) + (timerSeconds || 0) / 60;
        if (totalMinutes <= 0) return;
        unlockAlarmAudio();
        startAdHocTimer(timerName.trim() || nextAutoLabel(), totalMinutes);
        timerName = '';
    }

    function startPresetTimer(minutes: number) {
        unlockAlarmAudio();
        startAdHocTimer(timerName.trim() || nextAutoLabel(), minutes);
        timerName = '';
    }

    function timerStatusText(timer: (typeof adHocTimers)[number]): string {
        if (timer.ringing) return $_('recipe.timerDone');
        const time = formatRemaining(remainingMs(timer, timerNow));
        return isPaused(timer) ? $_('recipe.timerPaused', {values: {time}}) : $_('recipe.timerRemaining', {values: {time}});
    }

    $effect(() => {
        Promise.all([getToolboxIngredients($locale), getToolboxUnits($locale), getToolboxSubstitutions($locale)]).then(
            ([ingredientsRes, unitsRes, substitutionsRes]) => {
                if (ingredientsRes.response.ok && ingredientsRes.data)
                    ingredients = ingredientsRes.data.items;
                if (unitsRes.response.ok && unitsRes.data)
                    units = unitsRes.data.items;
                if (substitutionsRes.response.ok && substitutionsRes.data)
                    substitutions = substitutionsRes.data.items;

                if (!ingredientId)
                    ingredientId = ingredients.find(i => i.name.toLowerCase() === 'milk')?.id ?? ingredients[0]?.id ?? '';
                if (!fromUnitId)
                    fromUnitId = units.find(u => u.symbol.toLowerCase() === 'g')?.id ?? units.find(u => u.kind === 'weight')?.id ?? units[0]?.id ?? '';
                if (!toUnitId)
                    toUnitId = units.find(u => u.symbol.toLowerCase() === 'cl')?.id ?? units.find(u => u.kind === 'volume')?.id ?? units[0]?.id ?? '';
            }
        );
    });

    const selectedIngredient = $derived(ingredients.find(i => i.id === ingredientId));
    const fromUnit = $derived(units.find(u => u.id === fromUnitId));
    const toUnit = $derived(units.find(u => u.id === toUnitId));
    const unitOptions = $derived(units.map(u => ({value: u.id, label: `${u.name} (${u.symbol})`})));

    const result = $derived.by(() => {
        if (!fromUnit || !toUnit || !Number.isFinite(amount))
            return undefined;
        return convertQuantity(amount, fromUnit, toUnit, selectedIngredient);
    });

    function swapUnits() {
        [fromUnitId, toUnitId] = [toUnitId, fromUnitId];
    }

    const ovenUnitOptions = $derived([
        {value: 'F', label: $_('toolbox.oven.unitFahrenheit')},
        {value: 'C', label: $_('toolbox.oven.unitCelsius')}
    ]);
    const ovenResultUnit = $derived(ovenUnit === 'F' ? 'C' : 'F');
    const ovenResult = $derived.by(() => {
        if (!Number.isFinite(ovenTemp))
            return undefined;
        return ovenUnit === 'F'
            ? Math.round((ovenTemp - 32) * 5 / 9)
            : Math.round(ovenTemp * 9 / 5 + 32);
    });

    const filteredSubstitutions = $derived.by(() => {
        const q = subSearch.trim().toLowerCase();
        if (!q)
            return substitutions;
        return substitutions.filter(s => `${s.problem} ${s.solution} ${s.tag ?? ''}`.toLowerCase().includes(q));
    });

    function refreshIngredients() {
        getToolboxIngredients($locale).then(({response, data}) => {
            if (response.ok && data)
                ingredients = data.items;
        });
    }

    function refreshUnits() {
        getToolboxUnits($locale).then(({response, data}) => {
            if (response.ok && data)
                units = data.items;
        });
    }

    function refreshSubstitutions() {
        getToolboxSubstitutions($locale).then(({response, data}) => {
            if (response.ok && data)
                substitutions = data.items;
        });
    }
</script>

<PageMeta title={$_('toolbox.meta.title')} description={$_('toolbox.meta.description')} />

<div class="container mx-auto px-4 py-8 max-w-3xl">
    <div class="mb-6">
        <h1 class="text-3xl font-bold text-foreground mb-2">{$_('toolbox.title')}</h1>
        <p class="text-muted-foreground">{$_('toolbox.subtitle')}</p>
    </div>

    <div class="flex flex-wrap gap-2 mb-6">
        <button
                type="button"
                onclick={() => activeTab = 'quantity'}
                class="px-5 py-2.5 rounded-full text-sm font-semibold transition-colors hover:cursor-pointer {activeTab === 'quantity' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}"
        >
            {$_('toolbox.tabs.quantity')}
        </button>
        <button
                type="button"
                onclick={() => activeTab = 'oven'}
                class="px-5 py-2.5 rounded-full text-sm font-semibold transition-colors hover:cursor-pointer {activeTab === 'oven' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}"
        >
            {$_('toolbox.tabs.oven')}
        </button>
        <button
                type="button"
                onclick={() => activeTab = 'nutrition'}
                class="px-5 py-2.5 rounded-full text-sm font-semibold transition-colors hover:cursor-pointer {activeTab === 'nutrition' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}"
        >
            {$_('toolbox.tabs.nutrition')}
        </button>
        <button
                type="button"
                onclick={() => activeTab = 'timers'}
                class="px-5 py-2.5 rounded-full text-sm font-semibold transition-colors hover:cursor-pointer {activeTab === 'timers' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}"
        >
            {$_('toolbox.tabs.timers')}
        </button>
        <button
                type="button"
                onclick={() => activeTab = 'substitutions'}
                class="px-5 py-2.5 rounded-full text-sm font-semibold transition-colors hover:cursor-pointer {activeTab === 'substitutions' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}"
        >
            {$_('toolbox.tabs.substitutions')}
        </button>
    </div>

    {#if activeTab === 'quantity'}
        <div class="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
            <div class="grid sm:grid-cols-[1.3fr_1fr] gap-4">
                <div>
                    <Label for="toolbox-ingredient">{$_('toolbox.quantity.ingredientLabel')}</Label>
                    <IngredientCombobox id="toolbox-ingredient" {ingredients} bind:value={ingredientId} />
                </div>
                <div>
                    <Label for="toolbox-amount">{$_('toolbox.quantity.amountLabel')}</Label>
                    <Input id="toolbox-amount" type="number" min={0} bind:value={amount} />
                </div>
            </div>

            <div class="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                <div>
                    <Label for="toolbox-from-unit">{$_('toolbox.quantity.fromLabel')}</Label>
                    <Select id="toolbox-from-unit" bind:value={fromUnitId} options={unitOptions} />
                </div>
                <button
                        type="button"
                        onclick={swapUnits}
                        aria-label={$_('toolbox.quantity.swap')}
                        class="w-11 h-11 rounded-full border border-border bg-input flex items-center justify-center hover:bg-muted transition-colors hover:cursor-pointer mb-0.5 justify-self-center"
                >
                    <ArrowRightLeft class="w-4 h-4 text-foreground" />
                </button>
                <div>
                    <Label for="toolbox-to-unit">{$_('toolbox.quantity.toLabel')}</Label>
                    <Select id="toolbox-to-unit" bind:value={toUnitId} options={unitOptions} />
                </div>
            </div>

            <div class="bg-primary/10 rounded-xl p-6 text-center">
                <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('toolbox.quantity.result')}</div>
                <div class="text-4xl font-extrabold text-primary mt-1.5">
                    {result !== undefined ? result.toFixed(1) : '—'} {toUnit?.symbol ?? ''}
                </div>
            </div>
            <p class="text-sm text-muted-foreground">{$_('toolbox.quantity.disclaimer')}</p>

            {#if $user}
                <div class="flex flex-wrap items-center justify-end gap-4 pt-4 border-t border-border">
                    <button type="button" onclick={() => showSuggestUnit = true} class="text-sm font-semibold text-primary hover:text-primary/80 transition-colors hover:cursor-pointer">
                        {$_('toolbox.quantity.suggestUnit')}
                    </button>
                    <button type="button" onclick={() => showSuggestIngredient = true} class="text-sm font-semibold text-primary hover:text-primary/80 transition-colors hover:cursor-pointer">
                        {$_('toolbox.quantity.suggestIngredient')}
                    </button>
                </div>
            {/if}
        </div>
    {:else if activeTab === 'oven'}
        <div class="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
            <div class="grid grid-cols-2 gap-4 max-w-sm">
                <div>
                    <Label for="toolbox-oven-temp">{$_('toolbox.oven.temperatureLabel')}</Label>
                    <Input id="toolbox-oven-temp" type="number" bind:value={ovenTemp} />
                </div>
                <div>
                    <Label for="toolbox-oven-unit">{$_('toolbox.oven.unitLabel')}</Label>
                    <Select id="toolbox-oven-unit" bind:value={ovenUnit} options={ovenUnitOptions} />
                </div>
            </div>
            <div class="bg-primary/10 rounded-xl p-6 text-center">
                <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('toolbox.oven.resultLabel')}</div>
                <div class="text-4xl font-extrabold text-primary mt-1.5">{ovenResult !== undefined ? `${ovenResult}°${ovenResultUnit}` : '—'}</div>
            </div>
        </div>
    {:else if activeTab === 'nutrition'}
        <div class="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
                <Label for="toolbox-nutrition-ingredient">{$_('toolbox.nutritionData.ingredientLabel')}</Label>
                <IngredientCombobox
                        id="toolbox-nutrition-ingredient"
                        ingredients={localizedNutritionIngredients}
                        bind:value={nutritionIngredientId}
                        placeholder={$_('toolbox.nutritionData.placeholder')}
                />
            </div>

            {#if selectedNutritionIngredient}
                <div class="bg-primary/10 rounded-xl p-6">
                    <div class="text-lg font-bold text-foreground mb-1">{displayName(selectedNutritionIngredient)}</div>
                    <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">{$_('toolbox.nutritionData.per100g')}</div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('recipe.nutrition.kcal')}</div>
                            <div class="text-xl font-bold text-foreground">{Math.round(selectedNutritionIngredient.kcal_per_100g)}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('recipe.nutrition.protein')}</div>
                            <div class="text-xl font-bold text-foreground">{selectedNutritionIngredient.protein_g_per_100g} {$_('recipe.nutrition.gShort')}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('recipe.nutrition.carbs')}</div>
                            <div class="text-xl font-bold text-foreground">{selectedNutritionIngredient.carbs_g_per_100g} {$_('recipe.nutrition.gShort')}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('recipe.nutrition.fat')}</div>
                            <div class="text-xl font-bold text-foreground">{selectedNutritionIngredient.fat_g_per_100g} {$_('recipe.nutrition.gShort')}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('recipe.nutrition.salt')}</div>
                            <div class="text-xl font-bold text-foreground">{selectedNutritionIngredient.salt_g_per_100g} {$_('recipe.nutrition.gShort')}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{$_('recipe.nutrition.sugar')}</div>
                            <div class="text-xl font-bold text-foreground">{selectedNutritionIngredient.sugar_g_per_100g} {$_('recipe.nutrition.gShort')}</div>
                        </div>
                    </div>
                </div>
            {:else}
                <div class="text-center py-8 text-muted-foreground">
                    <SearchX class="w-8 h-8 mx-auto mb-2 opacity-60" />
                    {$_('toolbox.nutritionData.empty')}
                </div>
            {/if}

            <p class="text-sm text-muted-foreground">{$_('toolbox.nutritionData.disclaimer')}</p>
        </div>
    {:else if activeTab === 'timers'}
        <div class="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
            <div class="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
                <div>
                    <Label for="toolbox-timer-name">{$_('toolbox.timers.nameLabel')}</Label>
                    <Input id="toolbox-timer-name" type="text" placeholder={$_('toolbox.timers.namePlaceholder')} bind:value={timerName} />
                </div>
                <div>
                    <Label for="toolbox-timer-minutes">{$_('toolbox.timers.minutesLabel')}</Label>
                    <Input id="toolbox-timer-minutes" type="number" min={0} class="w-20" bind:value={timerMinutes} />
                </div>
                <div>
                    <Label for="toolbox-timer-seconds">{$_('toolbox.timers.secondsLabel')}</Label>
                    <Input id="toolbox-timer-seconds" type="number" min={0} max={59} class="w-20" bind:value={timerSeconds} />
                </div>
            </div>
            <button
                    type="button"
                    onclick={startCustomTimer}
                    class="w-full px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors hover:cursor-pointer"
            >
                {$_('toolbox.timers.start')}
            </button>

            <div>
                <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{$_('toolbox.timers.presets')}</div>
                <div class="flex flex-wrap gap-2">
                    {#each timerPresets as minutes}
                        <button
                                type="button"
                                onclick={() => startPresetTimer(minutes)}
                                class="px-4 py-2 rounded-full text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted transition-colors hover:cursor-pointer"
                        >
                            {$_('toolbox.timers.presetMinutes', {values: {minutes}})}
                        </button>
                    {/each}
                </div>
            </div>

            <div class="pt-4 border-t border-border">
                <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{$_('toolbox.timers.active')}</div>
                {#if adHocTimers.length === 0}
                    <p class="text-sm text-muted-foreground">{$_('toolbox.timers.empty')}</p>
                {:else}
                    <div class="space-y-2">
                        {#each adHocTimers as timer (timer.id)}
                            <div class="flex items-center gap-2 p-3 border border-border rounded-xl bg-background">
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-semibold text-foreground truncate">{timer.label}</div>
                                    <div class="text-sm {timer.ringing ? 'text-primary font-semibold' : 'text-muted-foreground'}">
                                        {timerStatusText(timer)}
                                    </div>
                                </div>
                                {#if !timer.ringing}
                                    <button
                                            type="button"
                                            onclick={() => isPaused(timer) ? resumeTimer(timer.id) : pauseTimer(timer.id)}
                                            aria-label={isPaused(timer) ? $_('recipe.resumeTimer') : $_('recipe.pauseTimer')}
                                            title={isPaused(timer) ? $_('recipe.resumeTimer') : $_('recipe.pauseTimer')}
                                            class="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hover:cursor-pointer"
                                    >
                                        {#if isPaused(timer)}
                                            <Play size="16" />
                                        {:else}
                                            <Pause size="16" />
                                        {/if}
                                    </button>
                                {/if}
                                <button
                                        type="button"
                                        onclick={() => cancelTimer(timer.id)}
                                        aria-label={$_('recipe.dismissTimer')}
                                        title={$_('recipe.dismissTimer')}
                                        class="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors hover:cursor-pointer"
                                >
                                    <X size="16" />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <div class="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-5">
            <div>
                <Label for="toolbox-sub-search">{$_('toolbox.substitutions.searchLabel')}</Label>
                <Input id="toolbox-sub-search" type="search" placeholder={$_('toolbox.substitutions.searchPlaceholder')} bind:value={subSearch} />
            </div>

            {#if filteredSubstitutions.length === 0}
                <div class="text-center py-8 text-muted-foreground">
                    <SearchX class="w-8 h-8 mx-auto mb-2 opacity-60" />
                    {substitutions.length === 0 ? $_('toolbox.substitutions.empty') : $_('toolbox.substitutions.noResults')}
                </div>
            {:else}
                <div class="space-y-3">
                    {#each filteredSubstitutions as sub (sub.id)}
                        <div class="border border-border rounded-xl p-4 bg-background">
                            <div class="flex items-center justify-between gap-3 mb-1.5">
                                <span class="font-bold text-foreground">{sub.problem}</span>
                                {#if sub.tag}
                                    <span class="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full whitespace-nowrap">{sub.tag}</span>
                                {/if}
                            </div>
                            <p class="text-sm text-muted-foreground">{sub.solution}</p>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if $user}
                <div class="flex items-center justify-end pt-4 border-t border-border">
                    <button type="button" onclick={() => showSuggestSubstitution = true} class="text-sm font-semibold text-primary hover:text-primary/80 transition-colors hover:cursor-pointer">
                        {$_('toolbox.substitutions.suggest')}
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>

{#if $user}
    <SuggestIngredientModal bind:open={showSuggestIngredient} {ingredients} onSubmitted={refreshIngredients} />
    <SuggestUnitModal bind:open={showSuggestUnit} {units} onSubmitted={refreshUnits} />
    <SuggestSubstitutionModal bind:open={showSuggestSubstitution} {substitutions} onSubmitted={refreshSubstitutions} />
{/if}
