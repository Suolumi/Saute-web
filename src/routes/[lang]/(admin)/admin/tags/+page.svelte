<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import Button from '../../../../../components/Button.svelte';
    import Select from '../../../../../components/Select.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import Input from '../../../../../components/Input.svelte';
    import Label from '../../../../../components/Label.svelte';
    import Checkbox from '../../../../../components/Checkbox.svelte';
    import {
        createTag, deleteTag, groupTags, loadTags, tagGroupColors, tagLabel, tags as allTags, updateTag, TAG_GROUPS,
        type RecipeTag, type RecipeTagRequest, type TagGroup,
    } from '$lib/tags';
    import {RecipeCategories, type RecipeCategory} from '$lib/recipes';
    import {locales} from '$lib/i18n';
    import {apiErrorMessage} from '$lib/api';
    import {toastError, toastSuccess} from '$lib/utils';

    const groups = $derived(groupTags([...$allTags.values()], $locale));

    let modalOpen = $state(false);
    let editing: RecipeTag | null = $state(null);
    let saving = $state(false);
    let form = $state({
        slug: '',
        group: 'diet' as TagGroup,
        categories: ['food'] as RecipeCategory[],
        implies: [] as string[],
        labels: {} as Record<string, string>,
        sourceLocale: 'en',
    });

    // An implied tag must apply to every category the tag applies to (the
    // API enforces the same rule).
    const impliable = $derived([...$allTags.values()].filter(tag =>
        tag.slug !== editing?.slug && form.categories.every(c => tag.categories.includes(c))));

    function openCreate() {
        editing = null;
        form = {slug: '', group: 'diet', categories: ['food'], implies: [], labels: {}, sourceLocale: $locale ?? 'en'};
        modalOpen = true;
    }

    function openEdit(tag: RecipeTag) {
        editing = tag;
        form = {
            slug: tag.slug, group: tag.group, categories: [...tag.categories], implies: [...tag.implies],
            labels: {...tag.labels}, sourceLocale: tag.source_locale,
        };
        modalOpen = true;
    }

    function toggleCategory(category: RecipeCategory, checked: boolean) {
        form.categories = checked ? [...form.categories, category] : form.categories.filter(c => c !== category);
        form.implies = form.implies.filter(slug => impliable.some(tag => tag.slug === slug));
    }

    function toggleImplied(slug: string) {
        form.implies = form.implies.includes(slug) ? form.implies.filter(s => s !== slug) : [...form.implies, slug];
    }

    const canSave = $derived(
        (editing !== null || form.slug.trim() !== '') &&
        form.categories.length > 0 &&
        Object.values(form.labels).some(label => label.trim() !== ''));

    async function save(event: SubmitEvent) {
        event.preventDefault();
        if (!canSave) return;
        saving = true;
        const body: RecipeTagRequest = {
            group: form.group, categories: form.categories, implies: form.implies,
            labels: form.labels, source_locale: form.sourceLocale,
        };
        const {response, data} = editing
            ? await updateTag(editing.slug, body)
            : await createTag({...body, slug: form.slug.trim()});
        saving = false;
        if (!response.ok) {
            toastError(apiErrorMessage(data, $_('admin.tags.saveError')));
            return;
        }
        if (data.backfilled > 0)
            toastSuccess($_('admin.tags.backfilled', {values: {count: data.backfilled}}));
        else
            toastSuccess($_(editing ? 'admin.tags.updated' : 'admin.tags.created'));
        modalOpen = false;
        await loadTags(true);
    }

    let deleting: RecipeTag | null = $state(null);

    async function performDelete() {
        if (!deleting) return;
        const {response, data} = await deleteTag(deleting.slug);
        deleting = null;
        if (!response.ok) {
            toastError(apiErrorMessage(data, $_('admin.tags.deleteError')));
            return;
        }
        toastSuccess($_('admin.tags.deleted'));
        await loadTags(true);
    }
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between gap-4">
        <p class="text-sm text-muted-foreground">{$_('admin.tags.intro')}</p>
        <Button size="sm" onclick={openCreate}>{$_('admin.tags.new')}</Button>
    </div>

    {#each groups as {group, tags} (group)}
        <div class="space-y-2">
            <h2 class="text-lg font-semibold text-foreground">{$_('tags.groups.' + group)} ({tags.length})</h2>
            <div class="bg-card rounded-lg border border-border divide-y divide-border">
                {#each tags as tag (tag.slug)}
                    <div class="p-3 flex flex-wrap items-center justify-between gap-2">
                        <div class="space-y-1">
                            <p class="font-medium text-card-foreground">
                                <span class="{tagGroupColors[tag.group]} px-2 py-0.5 rounded-full text-sm">{tagLabel(tag, $locale)}</span>
                                <span class="ml-2 text-xs text-muted-foreground font-mono">{tag.slug}</span>
                            </p>
                            <p class="text-xs text-muted-foreground">
                                {tag.categories.map(c => $_('admin.tags.category.' + c)).join(', ')}
                                {#if tag.implies.length > 0}
                                    · {$_('admin.tags.impliesList')}: {tag.implies.map(slug => { const t = $allTags.get(slug); return t ? tagLabel(t, $locale) : slug }).join(', ')}
                                {/if}
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <Button size="sm" variant="outline" onclick={() => openEdit(tag)}>{$_('admin.tags.edit')}</Button>
                            <Button size="sm" variant="destructive" onclick={() => deleting = tag}>{$_('admin.tags.delete')}</Button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {:else}
        <p class="p-4 text-muted-foreground bg-card rounded-lg border border-border">{$_('admin.tags.empty')}</p>
    {/each}
</div>

<Modal open={modalOpen} onClose={() => modalOpen = false} title={$_(editing ? 'admin.tags.editTitle' : 'admin.tags.new')}>
    <form onsubmit={save} class="space-y-4">
        <div>
            <Label for="tag-slug" required>{$_('admin.tags.slug')}</Label>
            <Input id="tag-slug" bind:value={form.slug} disabled={editing !== null} placeholder="gluten-free" />
            <p class="text-xs text-muted-foreground mt-1">{$_('admin.tags.slugHint')}</p>
        </div>
        <div>
            <Label for="tag-group" required>{$_('admin.tags.group')}</Label>
            <Select id="tag-group" bind:value={form.group} options={TAG_GROUPS.map(g => ({value: g, label: $_('tags.groups.' + g)}))} />
        </div>
        <div>
            <p class="text-sm font-medium text-foreground mb-2">{$_('admin.tags.categories')}</p>
            <div class="flex gap-4">
                {#each RecipeCategories as category (category)}
                    <label class="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox checked={form.categories.includes(category)} onchange={(checked) => toggleCategory(category, checked)} />
                        {$_('admin.tags.category.' + category)}
                    </label>
                {/each}
            </div>
        </div>
        <div>
            <p class="text-sm font-medium text-foreground mb-1">{$_('admin.tags.labels')}</p>
            <p class="text-xs text-muted-foreground mb-2">{$_('admin.tags.labelsHint')}</p>
            <div class="space-y-2">
                {#each locales as {code, label} (code)}
                    <div class="flex items-center gap-2">
                        <span class="w-20 text-sm text-muted-foreground">{label}</span>
                        <Input bind:value={form.labels[code]} />
                        <label class="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <input type="radio" name="tag-source" value={code} bind:group={form.sourceLocale} />
                            {$_('admin.tags.source')}
                        </label>
                    </div>
                {/each}
            </div>
        </div>
        <div>
            <p class="text-sm font-medium text-foreground mb-1">{$_('admin.tags.implies')}</p>
            <p class="text-xs text-muted-foreground mb-2">{$_('admin.tags.impliesHint')}</p>
            <div class="flex flex-wrap gap-2">
                {#each impliable as tag (tag.slug)}
                    {@const isSelected = form.implies.includes(tag.slug)}
                    <button
                            type="button"
                            aria-pressed={isSelected}
                            onclick={() => toggleImplied(tag.slug)}
                            class="px-3 py-1 rounded-full text-sm font-medium border-2 transition-colors
                                {isSelected ? tagGroupColors[tag.group] + ' border-current' : 'bg-background text-foreground border-border hover:bg-accent'}"
                    >
                        {tagLabel(tag, $locale)}
                    </button>
                {:else}
                    <p class="text-xs text-muted-foreground">{$_('admin.tags.noImpliable')}</p>
                {/each}
            </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={() => modalOpen = false} disabled={saving}>{$_('admin.tags.cancel')}</Button>
            <Button type="submit" disabled={saving || !canSave}>{$_('admin.tags.save')}</Button>
        </div>
    </form>
</Modal>

<Modal
        open={deleting !== null}
        onClose={() => deleting = null}
        title={$_('admin.tags.confirmDeleteTitle')}
        description={$_('admin.tags.confirmDeleteDescription', {values: {name: deleting ? tagLabel(deleting, $locale) : ''}})}
>
    <div class="flex justify-between">
        <Button variant="outline" onclick={() => deleting = null}>{$_('admin.tags.cancel')}</Button>
        <Button variant="destructive" onclick={performDelete}>{$_('admin.tags.delete')}</Button>
    </div>
</Modal>
