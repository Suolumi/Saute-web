<script lang="ts">
    import {untrack} from 'svelte';
    import {_} from 'svelte-i18n';
    import Button from '../../../../../components/Button.svelte';
    import Select from '../../../../../components/Select.svelte';
    import {approveTranslationSuggestion, getTranslationSuggestions, rejectTranslationSuggestion, refreshPendingTranslationSuggestionCount, type TranslationSuggestionView} from '$lib/admin';
    import {apiErrorMessage} from '$lib/api';
    import {toastError, toastSuccess} from '$lib/utils';

    type DiffRow = { label: string, current: string, suggested: string }

    let status = $state('pending');
    let items: TranslationSuggestionView[] = $state([]);
    let resolving: Record<string, boolean> = $state({});

    function load() {
        getTranslationSuggestions(status).then(({response, data}) => {
            if (response.ok && data)
                items = data.items;
            else
                toastError($_('admin.errors.loadTranslations'));
        });
    }

    $effect(() => {
        status;
        untrack(load);
    });

    // changedFields renders only the fields that actually differ between the
    // current live translation and the suggestion - matching what the
    // suggestion's own approval logic (diffTranslationOverrides) treats as
    // "actually changed", so what an admin reviews here is exactly what
    // becomes a durable override on approval.
    function changedFields(item: TranslationSuggestionView): DiffRow[] {
        const rows: DiffRow[] = [];
        const push = (label: string, current: string, suggested: string) => {
            if ((current ?? '') !== (suggested ?? ''))
                rows.push({label, current: current ?? '', suggested: suggested ?? ''});
        };
        push($_('edit.title.label'), item.current_title, item.suggested_title);
        push($_('edit.description.label'), item.current_description, item.suggested_description);

        const ingredientCount = Math.max(item.current_ingredients?.length ?? 0, item.suggested_ingredients?.length ?? 0);
        for (let i = 0; i < ingredientCount; i++) {
            const current = item.current_ingredients?.[i];
            const suggested = item.suggested_ingredients?.[i];
            const prefix = `${$_('recipe.ingredients')} ${i + 1}`;
            push(`${prefix} – ${$_('edit.ingredients.name.label')}`, current?.name ?? '', suggested?.name ?? '');
            push(`${prefix} – ${$_('edit.ingredients.unit.label')}`, current?.unit ?? '', suggested?.unit ?? '');
            push(`${prefix} – ${$_('recipe.suggestFixSectionLabel')}`, current?.label ?? '', suggested?.label ?? '');
            push(`${prefix} – ${$_('edit.ingredients.refLabel.label')}`, current?.ref_label ?? '', suggested?.ref_label ?? '');
        }

        const stepCount = Math.max(item.current_steps?.length ?? 0, item.suggested_steps?.length ?? 0);
        for (let i = 0; i < stepCount; i++) {
            const current = item.current_steps?.[i];
            const suggested = item.suggested_steps?.[i];
            const prefix = `${$_('recipe.instructions')} ${i + 1}`;
            push(`${prefix} – ${$_('edit.instructions.title.label')}`, current?.title ?? '', suggested?.title ?? '');
            push(`${prefix} – ${$_('edit.instructions.description.label')}`, current?.description ?? '', suggested?.description ?? '');
        }
        return rows;
    }

    function approve(item: TranslationSuggestionView) {
        resolving[item.id] = true;
        approveTranslationSuggestion(item.id).then(({response, data}) => {
            if (response.ok) {
                items = items.filter(i => i.id !== item.id);
                toastSuccess($_('admin.translations.approved'));
                refreshPendingTranslationSuggestionCount();
            } else if (response.status === 409) {
                toastError($_('admin.translations.staleError'));
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.resolveTranslation')));
            }
        }).finally(() => {
            delete resolving[item.id];
        });
    }

    function reject(item: TranslationSuggestionView) {
        resolving[item.id] = true;
        rejectTranslationSuggestion(item.id).then(({response, data}) => {
            if (response.ok) {
                items = items.filter(i => i.id !== item.id);
                toastSuccess($_('admin.translations.rejected'));
                refreshPendingTranslationSuggestionCount();
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.resolveTranslation')));
            }
        }).finally(() => {
            delete resolving[item.id];
        });
    }
</script>

<div class="space-y-4">
    <h1 class="text-2xl font-bold text-foreground">{$_('admin.translations.title')} ({items.length})</h1>

    <div class="max-w-xs">
        <Select
                bind:value={status}
                options={[
                    {value: 'pending', label: $_('admin.translations.statusPending')},
                    {value: 'approved', label: $_('admin.translations.statusApproved')},
                    {value: 'rejected', label: $_('admin.translations.statusRejected')},
                    {value: 'stale', label: $_('admin.translations.statusStale')},
                ]}
        />
    </div>

    <div class="bg-card rounded-lg border border-border divide-y divide-border">
        {#each items as item (item.id)}
            <div class="p-4 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p class="font-medium text-card-foreground">{item.recipe_title} <span class="text-xs text-muted-foreground">({item.locale})</span></p>
                        <p class="text-xs text-muted-foreground">{$_('admin.translations.submittedBy', {values: {username: item.submitted_by_username}})}</p>
                    </div>
                    {#if status === 'pending'}
                        <div class="flex gap-2">
                            <Button size="sm" variant="outline" disabled={resolving[item.id]} onclick={() => reject(item)}>
                                {$_('admin.translations.reject')}
                            </Button>
                            <Button size="sm" disabled={resolving[item.id]} onclick={() => approve(item)}>
                                {$_('admin.translations.approve')}
                            </Button>
                        </div>
                    {/if}
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                        <tr class="text-left text-muted-foreground">
                            <th class="pr-4 py-1 font-medium"></th>
                            <th class="pr-4 py-1 font-medium">{$_('admin.translations.current')}</th>
                            <th class="py-1 font-medium">{$_('admin.translations.suggested')}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {#each changedFields(item) as row}
                            <tr class="align-top border-t border-border">
                                <td class="pr-4 py-2 text-muted-foreground whitespace-nowrap">{row.label}</td>
                                <td class="pr-4 py-2 text-card-foreground">{row.current}</td>
                                <td class="py-2 text-card-foreground font-medium">{row.suggested}</td>
                            </tr>
                        {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {:else}
            <p class="p-4 text-muted-foreground">{$_('admin.translations.none')}</p>
        {/each}
    </div>
</div>
