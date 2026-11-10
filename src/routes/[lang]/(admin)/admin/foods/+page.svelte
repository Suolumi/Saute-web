<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import Button from '../../../../../components/Button.svelte';
    import Select from '../../../../../components/Select.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import Input from '../../../../../components/Input.svelte';
    import Label from '../../../../../components/Label.svelte';
    import HighlightText from '../../../../../components/HighlightText.svelte';
    import {
        adminCreateFood, adminUpdateFood, adminDeleteFood,
        adminCreateUnit, adminUpdateUnit, adminDeleteUnit, type AdminUnitRequest,
    } from '$lib/admin';
    import {FOOD_LOCALES, foodToForm, formToRequest, type FoodForm} from '$lib/adminFoods';
    import {foodKeywords, foodName, getFoods, type Food} from '$lib/foods';
    import {getToolboxUnits, type ToolboxUnit} from '$lib/toolbox';
    import {normalizeForMatch} from '$lib/highlight';
    import {parsePositiveNumberInput} from '$lib/nutrition';
    import {toastApiError, toastSuccess} from '$lib/utils';

    // admin/foods edits the food list nutrition and conversions match
    // ingredients against, and the units they understand. Every change
    // applies immediately.
    let activeTab: 'foods' | 'units' = $state('foods');

    let foods: Food[] = $state([]);
    let units: ToolboxUnit[] = $state([]);

    function load() {
        getFoods().then(({response, data}) => { if (response.ok && data) foods = data.items; });
        getToolboxUnits().then(({response, data}) => { if (response.ok && data) units = data.items; });
    }
    load();

    // --- Foods ---
    let search = $state('');
    const searchable = $derived(new Map(foods.map(f => [f.id, normalizeForMatch([f.id, ...foodKeywords(f)].join(' '))])));
    const filteredFoods = $derived.by(() => {
        const q = normalizeForMatch(search.trim());
        if (!q) return foods;
        return foods.filter(f => searchable.get(f.id)?.includes(q));
    });
    // Rendering all ~700 rows at once is slow on phones; show more on demand.
    let shown = $state(100);

    let foodModalOpen = $state(false);
    let editingFood: Food | null = $state(null);
    let foodForm: FoodForm = $state(foodToForm());
    let savingFood = $state(false);

    function openCreateFood() {
        editingFood = null;
        foodForm = foodToForm();
        foodModalOpen = true;
    }
    function openEditFood(food: Food) {
        editingFood = food;
        foodForm = foodToForm(food);
        foodModalOpen = true;
    }

    async function saveFood(event: SubmitEvent) {
        event.preventDefault();
        savingFood = true;
        const body = formToRequest(foodForm);
        const {response, data} = editingFood ? await adminUpdateFood(editingFood.id, body) : await adminCreateFood(body);
        savingFood = false;
        if (response.ok) {
            toastSuccess($_(editingFood ? 'admin.foods.saved' : 'admin.foods.created'));
            foodModalOpen = false;
            load();
        } else {
            toastApiError($_('admin.foods.saveError'), response, data);
        }
    }

    // --- Units ---
    let unitModalOpen = $state(false);
    let editingUnit: ToolboxUnit | null = $state(null);
    let unitForm: {name: string, symbol: string, kind: 'weight' | 'volume', to_base: number | string} = $state({name: '', symbol: '', kind: 'weight', to_base: ''});
    let savingUnit = $state(false);

    function openCreateUnit() {
        editingUnit = null;
        unitForm = {name: '', symbol: '', kind: 'weight', to_base: ''};
        unitModalOpen = true;
    }
    function openEditUnit(unit: ToolboxUnit) {
        editingUnit = unit;
        unitForm = {name: unit.name, symbol: unit.symbol, kind: unit.kind, to_base: unit.to_base};
        unitModalOpen = true;
    }

    async function saveUnit(event: SubmitEvent) {
        event.preventDefault();
        const toBase = parsePositiveNumberInput(unitForm.to_base);
        if (toBase === null) return;
        savingUnit = true;
        const body: AdminUnitRequest = {name: unitForm.name.trim(), symbol: unitForm.symbol.trim(), kind: unitForm.kind, to_base: toBase};
        const {response, data} = editingUnit ? await adminUpdateUnit(editingUnit.id, body) : await adminCreateUnit(body);
        savingUnit = false;
        if (response.ok) {
            toastSuccess($_(editingUnit ? 'admin.foods.unitSaved' : 'admin.foods.unitCreated'));
            unitModalOpen = false;
            load();
        } else {
            toastApiError($_('admin.foods.saveError'), response, data);
        }
    }

    // --- Delete (foods and units) ---
    let deleteModal: {open: boolean, kind: 'food' | 'unit', id: string, label: string} = $state({open: false, kind: 'food', id: '', label: ''});

    async function performDelete() {
        const {kind, id} = deleteModal;
        const {response, data} = kind === 'food' ? await adminDeleteFood(id) : await adminDeleteUnit(id);
        if (response.ok) {
            if (kind === 'food') foods = foods.filter(f => f.id !== id);
            else units = units.filter(u => u.id !== id);
            toastSuccess($_('admin.foods.deleted'));
        } else {
            toastApiError($_('admin.foods.deleteError'), response, data);
        }
        deleteModal = {...deleteModal, open: false};
    }

    const tabClass = (active: boolean) =>
        `px-3 py-2 text-sm font-medium border-b-2 transition-colors hover:cursor-pointer shrink-0 whitespace-nowrap ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;
</script>

<div class="space-y-4">
    <h1 class="text-2xl font-bold text-foreground">{$_('admin.foods.title')}</h1>

    <div class="flex gap-2 border-b border-border overflow-x-auto scrollbar-hide">
        <button type="button" onclick={() => activeTab = 'foods'} class={tabClass(activeTab === 'foods')}>{$_('admin.foods.tabFoods')} ({foods.length})</button>
        <button type="button" onclick={() => activeTab = 'units'} class={tabClass(activeTab === 'units')}>{$_('admin.foods.tabUnits')} ({units.length})</button>
    </div>

    {#if activeTab === 'foods'}
        <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="w-full sm:max-w-sm">
                    <Input type="search" placeholder={$_('admin.foods.searchPlaceholder')} bind:value={search} />
                </div>
                <Button size="sm" onclick={openCreateFood}>{$_('admin.foods.newFood')}</Button>
            </div>
            <div class="bg-card rounded-lg border border-border divide-y divide-border">
                {#each filteredFoods.slice(0, shown) as food (food.id)}
                    <div class="p-3 flex flex-wrap items-center justify-between gap-2">
                        <div class="min-w-0">
                            <p class="font-medium text-card-foreground"><HighlightText text={foodName(food, $locale)} query={search} /> <span class="text-xs text-muted-foreground font-normal">{food.id}</span></p>
                            <p class="text-xs text-muted-foreground">
                                {food.kcal_per_100g} kcal/100 g
                                {#if food.grams_per_piece} · {food.grams_per_piece} g/{$_('admin.foods.piece')}{/if}
                                {#if food.g_per_100ml} · {food.g_per_100ml} g/100 ml{/if}
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <Button size="sm" variant="outline" onclick={() => openEditFood(food)}>{$_('admin.foods.edit')}</Button>
                            <Button size="sm" variant="destructive" onclick={() => deleteModal = {open: true, kind: 'food', id: food.id, label: foodName(food, $locale)}}>{$_('admin.foods.delete')}</Button>
                        </div>
                    </div>
                {:else}
                    <p class="p-4 text-muted-foreground">{$_('admin.foods.noResults')}</p>
                {/each}
            </div>
            {#if filteredFoods.length > shown}
                <Button variant="outline" size="sm" onclick={() => shown += 100}>{$_('admin.foods.showMore', {values: {count: filteredFoods.length - shown}})}</Button>
            {/if}
        </div>
    {:else}
        <div class="space-y-3">
            <div class="flex justify-end">
                <Button size="sm" onclick={openCreateUnit}>{$_('admin.foods.newUnit')}</Button>
            </div>
            <div class="bg-card rounded-lg border border-border divide-y divide-border">
                {#each units as unit (unit.id)}
                    <div class="p-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p class="font-medium text-card-foreground">{unit.name} <span class="text-xs text-muted-foreground font-normal">{unit.symbol}</span></p>
                            <p class="text-xs text-muted-foreground">1 {unit.symbol} = {unit.to_base} {unit.kind === 'weight' ? 'g' : 'ml'}</p>
                        </div>
                        <div class="flex gap-2">
                            <Button size="sm" variant="outline" onclick={() => openEditUnit(unit)}>{$_('admin.foods.edit')}</Button>
                            <Button size="sm" variant="destructive" onclick={() => deleteModal = {open: true, kind: 'unit', id: unit.id, label: unit.name}}>{$_('admin.foods.delete')}</Button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<Modal open={foodModalOpen} onClose={() => foodModalOpen = false} title={editingFood ? foodName(editingFood, $locale) : $_('admin.foods.newFood')}>
    <form onsubmit={saveFood} class="space-y-4">
        {#if !editingFood}
            <div>
                <Label for="food-id" required>{$_('admin.foods.id')}</Label>
                <Input id="food-id" bind:value={foodForm.id} required placeholder="green-apple" />
                <p class="mt-1 text-xs text-muted-foreground">{$_('admin.foods.idHelp')}</p>
            </div>
        {/if}
        {#each FOOD_LOCALES as l (l)}
            <div class="grid gap-2 sm:grid-cols-2">
                <div>
                    <Label for="food-name-{l}" required={l === 'en'}>{$_('admin.foods.name')} ({l})</Label>
                    <Input id="food-name-{l}" bind:value={foodForm.names[l]} required={l === 'en'} />
                </div>
                <div>
                    <Label for="food-aliases-{l}">{$_('admin.foods.aliases')} ({l})</Label>
                    <Input id="food-aliases-{l}" bind:value={foodForm.aliases[l]} />
                </div>
            </div>
        {/each}
        <p class="text-xs text-muted-foreground">{$_('admin.foods.aliasesHelp')}</p>
        <div class="grid gap-2 sm:grid-cols-2">
            {#each FOOD_LOCALES as l (l)}
                <div>
                    <Label for="food-subs-{l}">{$_('admin.foods.substitutes')} ({l})</Label>
                    <textarea id="food-subs-{l}" rows="2" bind:value={foodForm.substitutes[l]}
                              class="w-full px-3 py-2 bg-input border border-border rounded-lg text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"></textarea>
                </div>
            {/each}
        </div>
        <p class="text-xs text-muted-foreground">{$_('admin.foods.substitutesHelp')}</p>
        <div class="grid gap-2 grid-cols-2">
            <div>
                <Label for="food-gpp">{$_('admin.foods.gramsPerPiece')}</Label>
                <Input id="food-gpp" type="number" min={0} step="any" bind:value={foodForm.grams_per_piece} />
            </div>
            <div>
                <Label for="food-density">{$_('admin.foods.density')}</Label>
                <Input id="food-density" type="number" min={0} step="any" bind:value={foodForm.g_per_100ml} />
            </div>
        </div>
        <div class="grid gap-2 grid-cols-2 sm:grid-cols-3">
            {#each [['kcal_per_100g', 'kcal'], ['protein_g_per_100g', 'protein'], ['carbs_g_per_100g', 'carbs'], ['fat_g_per_100g', 'fat'], ['salt_g_per_100g', 'salt'], ['sugar_g_per_100g', 'sugar']] as const as [field, label] (field)}
                <div>
                    <Label for="food-{field}">{$_(`admin.foods.nutrient.${label}`)}</Label>
                    <Input id="food-{field}" type="number" min={0} step="any" bind:value={foodForm[field]} />
                </div>
            {/each}
        </div>
        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={() => foodModalOpen = false} disabled={savingFood}>{$_('admin.foods.cancel')}</Button>
            <Button type="submit" disabled={savingFood || !foodForm.names.en?.trim() || (!editingFood && !foodForm.id.trim())}>{$_('admin.foods.save')}</Button>
        </div>
    </form>
</Modal>

<Modal open={unitModalOpen} onClose={() => unitModalOpen = false} title={$_(editingUnit ? 'admin.foods.editUnit' : 'admin.foods.newUnit')}>
    <form onsubmit={saveUnit} class="space-y-4">
        <div class="grid gap-2 grid-cols-2">
            <div>
                <Label for="unit-name" required>{$_('admin.foods.name')}</Label>
                <Input id="unit-name" bind:value={unitForm.name} required />
            </div>
            <div>
                <Label for="unit-symbol" required>{$_('admin.foods.symbol')}</Label>
                <Input id="unit-symbol" bind:value={unitForm.symbol} required />
            </div>
        </div>
        <div class="grid gap-2 grid-cols-2">
            <div>
                <Label for="unit-kind" required>{$_('admin.foods.kind')}</Label>
                <Select id="unit-kind" bind:value={unitForm.kind} options={[{value: 'weight', label: $_('admin.foods.weight')}, {value: 'volume', label: $_('admin.foods.volume')}]} />
            </div>
            <div>
                <Label for="unit-base" required>{unitForm.kind === 'weight' ? $_('admin.foods.gramsPerUnit') : $_('admin.foods.mlPerUnit')}</Label>
                <Input id="unit-base" type="number" min={0} step="any" bind:value={unitForm.to_base} required />
            </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={() => unitModalOpen = false} disabled={savingUnit}>{$_('admin.foods.cancel')}</Button>
            <Button type="submit" disabled={savingUnit || !unitForm.name.trim() || !unitForm.symbol.trim() || parsePositiveNumberInput(unitForm.to_base) === null}>{$_('admin.foods.save')}</Button>
        </div>
    </form>
</Modal>

<Modal
        open={deleteModal.open}
        onClose={() => deleteModal = {...deleteModal, open: false}}
        title={$_('admin.foods.confirmDeleteTitle')}
        description={$_('admin.foods.confirmDeleteDescription', {values: {name: deleteModal.label}})}
>
    <div class="flex justify-between">
        <Button variant="outline" onclick={() => deleteModal = {...deleteModal, open: false}}>{$_('admin.foods.cancel')}</Button>
        <Button variant="destructive" onclick={performDelete}>{$_('admin.foods.delete')}</Button>
    </div>
</Modal>
