<script lang="ts">
    import {untrack} from 'svelte';
    import {_} from 'svelte-i18n';
    import Button from '../../../../../components/Button.svelte';
    import Select from '../../../../../components/Select.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import Input from '../../../../../components/Input.svelte';
    import Label from '../../../../../components/Label.svelte';
    import IngredientCombobox from '../../../../../components/toolbox/IngredientCombobox.svelte';
    import {
        approveNutritionSuggestion, getNutritionSuggestions, rejectNutritionSuggestion, type NutritionSuggestionView,
        adminCreateNutritionLink, adminUpdateNutritionLink, adminDeleteNutritionLink, type AdminNutritionLinkRequest,
        adminCreateUnitAlias, adminUpdateUnitAlias, adminDeleteUnitAlias, type AdminUnitAliasRequest,
        refreshPendingNutritionSuggestionCount,
    } from '$lib/admin';
    import {getNutritionIngredients, getIngredientNutritionLinks, getUnitAliases, type NutritionIngredient, type IngredientNutritionLink, type UnitAlias} from '$lib/nutrition';
    import {getToolboxUnits, type ToolboxUnit} from '$lib/toolbox';
    import {apiErrorMessage} from '$lib/api';
    import {toastError, toastSuccess} from '$lib/utils';

    // admin/nutrition has two tabs: "Links" is direct CRUD over the live
    // ingredient_nutrition_links/unit_aliases tables (an admin's own edits
    // always apply immediately, never a suggestion); "Pending corrections"
    // is the review queue - the only path that ever reaches it is a
    // non-admin's correction to an ingredient/alias that's already linked,
    // since a first-time link applies immediately for anyone. See
    // CLAUDE.md's Nutrition Info entry.
    let activeTab: 'links' | 'pending' = $state('links');

    // --- Links tab ---
    let nutritionIngredients: NutritionIngredient[] = $state([]);
    let links: IngredientNutritionLink[] = $state([]);
    let aliases: UnitAlias[] = $state([]);
    let units: ToolboxUnit[] = $state([]);

    function loadLinksTab() {
        getNutritionIngredients().then(({response, data}) => { if (response.ok && data) nutritionIngredients = data.items; });
        getIngredientNutritionLinks().then(({response, data}) => { if (response.ok && data) links = data.items; });
        getUnitAliases().then(({response, data}) => { if (response.ok && data) aliases = data.items; });
        getToolboxUnits().then(({response, data}) => { if (response.ok && data) units = data.items; });
    }

    $effect(() => {
        if (activeTab === 'links') untrack(loadLinksTab);
    });

    function nutritionName(id: string): string {
        return nutritionIngredients.find(n => n.id === id)?.name ?? id;
    }
    function unitLabel(id: string): string {
        const u = units.find(u => u.id === id);
        return u ? `${u.name} (${u.symbol})` : id;
    }

    // Link create/edit modal
    let linkModalOpen = $state(false);
    let editingLink: IngredientNutritionLink | null = $state(null);
    let linkForm = $state({ingredientName: '', nutritionId: '', gPer100ml: '', gramsPerUnit: ''});
    let savingLink = $state(false);

    function openCreateLink() {
        editingLink = null;
        linkForm = {ingredientName: '', nutritionId: '', gPer100ml: '', gramsPerUnit: ''};
        linkModalOpen = true;
    }
    function openEditLink(link: IngredientNutritionLink) {
        editingLink = link;
        linkForm = {
            ingredientName: link.name, nutritionId: link.nutrition_id,
            gPer100ml: link.g_per_100ml?.toString() ?? '', gramsPerUnit: link.grams_per_unit?.toString() ?? '',
        };
        linkModalOpen = true;
    }

    async function saveLink(event: SubmitEvent) {
        event.preventDefault();
        if (!linkForm.ingredientName.trim() || !linkForm.nutritionId) return;
        savingLink = true;
        const body: AdminNutritionLinkRequest = {
            ingredient_name: linkForm.ingredientName.trim(),
            nutrition_id: linkForm.nutritionId,
            g_per_100ml: linkForm.gPer100ml ? Number(linkForm.gPer100ml) : undefined,
            grams_per_unit: linkForm.gramsPerUnit ? Number(linkForm.gramsPerUnit) : undefined,
        };
        const {response, data} = editingLink
            ? await adminUpdateNutritionLink(editingLink.id, body)
            : await adminCreateNutritionLink(body);
        savingLink = false;
        if (response.ok) {
            toastSuccess($_(editingLink ? 'admin.nutrition.linkUpdated' : 'admin.nutrition.linkCreated'));
            linkModalOpen = false;
            loadLinksTab();
        } else {
            toastError(apiErrorMessage(data, $_('admin.nutrition.linkSaveError')));
        }
    }

    // Unit alias create/edit modal
    let aliasModalOpen = $state(false);
    let editingAlias: UnitAlias | null = $state(null);
    let aliasForm = $state({alias: '', unitId: ''});
    let savingAlias = $state(false);

    function openCreateAlias() {
        editingAlias = null;
        aliasForm = {alias: '', unitId: units[0]?.id ?? ''};
        aliasModalOpen = true;
    }
    function openEditAlias(a: UnitAlias) {
        editingAlias = a;
        aliasForm = {alias: a.alias, unitId: a.unit_id};
        aliasModalOpen = true;
    }

    async function saveAlias(event: SubmitEvent) {
        event.preventDefault();
        if (!aliasForm.alias.trim() || !aliasForm.unitId) return;
        savingAlias = true;
        const body: AdminUnitAliasRequest = {alias: aliasForm.alias.trim(), unit_id: aliasForm.unitId};
        const {response, data} = editingAlias
            ? await adminUpdateUnitAlias(editingAlias.id, body)
            : await adminCreateUnitAlias(body);
        savingAlias = false;
        if (response.ok) {
            toastSuccess($_(editingAlias ? 'admin.nutrition.aliasUpdated' : 'admin.nutrition.aliasCreated'));
            aliasModalOpen = false;
            loadLinksTab();
        } else {
            toastError(apiErrorMessage(data, $_('admin.nutrition.aliasSaveError')));
        }
    }

    // Shared delete-confirm modal (links and aliases both use it, distinguished by `kind`)
    let deleteModal: {open: boolean, kind: 'link' | 'alias', id: string, label: string} = $state({open: false, kind: 'link', id: '', label: ''});

    function confirmDeleteLink(link: IngredientNutritionLink) {
        deleteModal = {open: true, kind: 'link', id: link.id, label: link.name};
    }
    function confirmDeleteAlias(a: UnitAlias) {
        deleteModal = {open: true, kind: 'alias', id: a.id, label: a.alias};
    }

    async function performDelete() {
        const {kind, id} = deleteModal;
        const {response, data} = kind === 'link' ? await adminDeleteNutritionLink(id) : await adminDeleteUnitAlias(id);
        if (response.ok) {
            if (kind === 'link') links = links.filter(l => l.id !== id);
            else aliases = aliases.filter(a => a.id !== id);
            toastSuccess($_(kind === 'link' ? 'admin.nutrition.linkDeleted' : 'admin.nutrition.aliasDeleted'));
        } else {
            toastError(apiErrorMessage(data, $_('admin.nutrition.deleteError')));
        }
        deleteModal = {...deleteModal, open: false};
    }

    // --- Pending corrections tab ---
    let status = $state('pending');
    let items: NutritionSuggestionView[] = $state([]);
    let resolving: Record<string, boolean> = $state({});

    function loadPending() {
        getNutritionSuggestions(status).then(({response, data}) => {
            if (response.ok && data)
                items = data.items;
            else
                toastError($_('admin.errors.loadNutrition'));
        });
    }

    $effect(() => {
        if (activeTab !== 'pending') return;
        status;
        untrack(loadPending);
    });

    function approve(item: NutritionSuggestionView) {
        resolving[item.id] = true;
        approveNutritionSuggestion(item.id).then(({response, data}) => {
            if (response.ok) {
                items = items.filter(i => i.id !== item.id);
                toastSuccess($_('admin.nutrition.approved'));
                refreshPendingNutritionSuggestionCount();
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.resolveNutrition')));
            }
        }).finally(() => {
            delete resolving[item.id];
        });
    }

    function reject(item: NutritionSuggestionView) {
        resolving[item.id] = true;
        rejectNutritionSuggestion(item.id).then(({response, data}) => {
            if (response.ok) {
                items = items.filter(i => i.id !== item.id);
                toastSuccess($_('admin.nutrition.rejected'));
                refreshPendingNutritionSuggestionCount();
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.resolveNutrition')));
            }
        }).finally(() => {
            delete resolving[item.id];
        });
    }
</script>

<div class="space-y-4">
    <h1 class="text-2xl font-bold text-foreground">{$_('admin.nutrition.title')}</h1>

    <div class="flex gap-2 border-b border-border">
        <button
                type="button"
                onclick={() => activeTab = 'links'}
                class="px-3 py-2 text-sm font-medium border-b-2 transition-colors hover:cursor-pointer {activeTab === 'links' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
            {$_('admin.nutrition.tabLinks')}
        </button>
        <button
                type="button"
                onclick={() => activeTab = 'pending'}
                class="px-3 py-2 text-sm font-medium border-b-2 transition-colors hover:cursor-pointer {activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
            {$_('admin.nutrition.tabPending')}
        </button>
    </div>

    {#if activeTab === 'links'}
        <div class="space-y-8">
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-foreground">{$_('admin.nutrition.ingredientLinks')} ({links.length})</h2>
                    <Button size="sm" onclick={openCreateLink}>{$_('admin.nutrition.newLink')}</Button>
                </div>
                <div class="bg-card rounded-lg border border-border divide-y divide-border">
                    {#each links as link (link.id)}
                        <div class="p-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p class="font-medium text-card-foreground">{link.name}</p>
                                <p class="text-xs text-muted-foreground">
                                    {$_('admin.nutrition.linkedTo')}: {nutritionName(link.nutrition_id)}
                                    {#if link.g_per_100ml} · {link.g_per_100ml} g/100ml{/if}
                                    {#if link.grams_per_unit} · {link.grams_per_unit} g/unit{/if}
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <Button size="sm" variant="outline" onclick={() => openEditLink(link)}>{$_('admin.nutrition.edit')}</Button>
                                <Button size="sm" variant="destructive" onclick={() => confirmDeleteLink(link)}>{$_('admin.nutrition.delete')}</Button>
                            </div>
                        </div>
                    {:else}
                        <p class="p-4 text-muted-foreground">{$_('admin.nutrition.noLinks')}</p>
                    {/each}
                </div>
            </div>

            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-foreground">{$_('admin.nutrition.unitAliases')} ({aliases.length})</h2>
                    <Button size="sm" onclick={openCreateAlias}>{$_('admin.nutrition.newAlias')}</Button>
                </div>
                <div class="bg-card rounded-lg border border-border divide-y divide-border">
                    {#each aliases as alias (alias.id)}
                        <div class="p-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p class="font-medium text-card-foreground">{alias.alias}</p>
                                <p class="text-xs text-muted-foreground">{$_('admin.nutrition.aliasFor')}: {unitLabel(alias.unit_id)}</p>
                            </div>
                            <div class="flex gap-2">
                                <Button size="sm" variant="outline" onclick={() => openEditAlias(alias)}>{$_('admin.nutrition.edit')}</Button>
                                <Button size="sm" variant="destructive" onclick={() => confirmDeleteAlias(alias)}>{$_('admin.nutrition.delete')}</Button>
                            </div>
                        </div>
                    {:else}
                        <p class="p-4 text-muted-foreground">{$_('admin.nutrition.noAliases')}</p>
                    {/each}
                </div>
            </div>
        </div>
    {:else}
        <div class="space-y-4">
            <div class="max-w-xs">
                <Select
                        bind:value={status}
                        options={[
                            {value: 'pending', label: $_('admin.nutrition.statusPending')},
                            {value: 'approved', label: $_('admin.nutrition.statusApproved')},
                            {value: 'rejected', label: $_('admin.nutrition.statusRejected')},
                        ]}
                />
            </div>

            <div class="bg-card rounded-lg border border-border divide-y divide-border">
                {#each items as item (item.id)}
                    <div class="p-4 space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p class="font-medium text-card-foreground">
                                    {item.ingredient_name}
                                    {#if item.is_correction}
                                        <span class="text-xs text-muted-foreground">({$_('admin.nutrition.correctionOf', {values: {name: item.current_name}})})</span>
                                    {/if}
                                </p>
                                <p class="text-xs text-muted-foreground">{$_('admin.translations.submittedBy', {values: {username: item.submitted_by_username}})}</p>
                            </div>
                            {#if status === 'pending'}
                                <div class="flex gap-2">
                                    <Button size="sm" variant="outline" disabled={resolving[item.id]} onclick={() => reject(item)}>
                                        {$_('admin.nutrition.reject')}
                                    </Button>
                                    <Button size="sm" disabled={resolving[item.id]} onclick={() => approve(item)}>
                                        {$_('admin.nutrition.approve')}
                                    </Button>
                                </div>
                            {/if}
                        </div>

                        <table class="w-full text-sm">
                            <tbody>
                            <tr class="border-t border-border">
                                <td class="pr-4 py-2 text-muted-foreground whitespace-nowrap">{$_('admin.nutrition.linkedTo')}</td>
                                <td class="py-2 text-card-foreground font-medium">{item.nutrition_name}</td>
                            </tr>
                            {#if item.g_per_100ml}
                                <tr class="border-t border-border">
                                    <td class="pr-4 py-2 text-muted-foreground whitespace-nowrap">{$_('admin.nutrition.density')}</td>
                                    <td class="py-2 text-card-foreground">{item.g_per_100ml} g/100ml</td>
                                </tr>
                            {/if}
                            {#if item.grams_per_unit}
                                <tr class="border-t border-border">
                                    <td class="pr-4 py-2 text-muted-foreground whitespace-nowrap">{$_('admin.nutrition.gramsPerUnit')}</td>
                                    <td class="py-2 text-card-foreground">{item.grams_per_unit} g</td>
                                </tr>
                            {/if}
                            {#if item.unit_alias}
                                <tr class="border-t border-border">
                                    <td class="pr-4 py-2 text-muted-foreground whitespace-nowrap">{$_('admin.nutrition.unitAlias')}</td>
                                    <td class="py-2 text-card-foreground">
                                        {item.unit_alias} → {item.unit_name}
                                        {#if item.is_unit_correction}
                                            <span class="text-xs text-muted-foreground">({$_('admin.nutrition.correction')})</span>
                                        {/if}
                                    </td>
                                </tr>
                            {/if}
                            {#if item.note}
                                <tr class="border-t border-border">
                                    <td class="pr-4 py-2 text-muted-foreground whitespace-nowrap">{$_('admin.nutrition.note')}</td>
                                    <td class="py-2 text-card-foreground">{item.note}</td>
                                </tr>
                            {/if}
                            </tbody>
                        </table>
                    </div>
                {:else}
                    <p class="p-4 text-muted-foreground">{$_('admin.nutrition.none')}</p>
                {/each}
            </div>
        </div>
    {/if}
</div>

<Modal open={linkModalOpen} onClose={() => linkModalOpen = false} title={$_(editingLink ? 'admin.nutrition.editLink' : 'admin.nutrition.newLink')}>
    <form onsubmit={saveLink} class="space-y-4">
        <div>
            <Label for="link-name" required>{$_('admin.nutrition.ingredientName')}</Label>
            <Input id="link-name" bind:value={linkForm.ingredientName} required />
        </div>
        <div>
            <Label for="link-nutrition" required>{$_('admin.nutrition.nutritionEntry')}</Label>
            <IngredientCombobox id="link-nutrition" ingredients={nutritionIngredients} bind:value={linkForm.nutritionId} />
        </div>
        <div>
            <Label for="link-density">{$_('admin.nutrition.density')}</Label>
            <Input id="link-density" type="number" bind:value={linkForm.gPer100ml} />
        </div>
        <div>
            <Label for="link-gpu">{$_('admin.nutrition.gramsPerUnit')}</Label>
            <Input id="link-gpu" type="number" bind:value={linkForm.gramsPerUnit} />
        </div>
        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={() => linkModalOpen = false} disabled={savingLink}>{$_('admin.nutrition.cancel')}</Button>
            <Button type="submit" disabled={savingLink || !linkForm.ingredientName.trim() || !linkForm.nutritionId}>{$_('admin.nutrition.save')}</Button>
        </div>
    </form>
</Modal>

<Modal open={aliasModalOpen} onClose={() => aliasModalOpen = false} title={$_(editingAlias ? 'admin.nutrition.editAlias' : 'admin.nutrition.newAlias')}>
    <form onsubmit={saveAlias} class="space-y-4">
        <div>
            <Label for="alias-text" required>{$_('admin.nutrition.aliasText')}</Label>
            <Input id="alias-text" bind:value={aliasForm.alias} required />
        </div>
        <div>
            <Label for="alias-unit" required>{$_('admin.nutrition.unit')}</Label>
            <Select id="alias-unit" bind:value={aliasForm.unitId} options={units.map(u => ({value: u.id, label: `${u.name} (${u.symbol})`}))} />
        </div>
        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={() => aliasModalOpen = false} disabled={savingAlias}>{$_('admin.nutrition.cancel')}</Button>
            <Button type="submit" disabled={savingAlias || !aliasForm.alias.trim() || !aliasForm.unitId}>{$_('admin.nutrition.save')}</Button>
        </div>
    </form>
</Modal>

<Modal
        open={deleteModal.open}
        onClose={() => deleteModal = {...deleteModal, open: false}}
        title={$_('admin.nutrition.confirmDeleteTitle')}
        description={$_('admin.nutrition.confirmDeleteDescription', {values: {name: deleteModal.label}})}
>
    <div class="flex justify-between">
        <Button variant="outline" onclick={() => deleteModal = {...deleteModal, open: false}}>{$_('admin.nutrition.cancel')}</Button>
        <Button variant="destructive" onclick={performDelete}>{$_('admin.nutrition.delete')}</Button>
    </div>
</Modal>
