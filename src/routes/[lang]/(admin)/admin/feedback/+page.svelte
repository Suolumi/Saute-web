<script lang="ts">
    import {_, locale} from "svelte-i18n";
    import {serverUrl} from "$lib/stores";
    import {apiErrorMessage} from "$lib/api";
    import {pictureUrl, toastError, toastSuccess} from "$lib/utils";
    import {
        adminListFeedback, adminMarkFeedbackSeen, adminSetFeedbackStatus, deleteFeedback, feedbackLinkLabel,
        pendingFeedbackCount, refreshPendingFeedbackCount, relativeTime, type Feedback, type FeedbackAdminTab, type FeedbackStatus, type FeedbackTranslation
    } from "$lib/feedback";
    import Button from "../../../../../components/Button.svelte";
    import Modal from "../../../../../components/Modal.svelte";
    import Lightbox from "../../../../../components/Lightbox.svelte";
    import FeedbackTranslateButton from "../../../../../components/FeedbackTranslateButton.svelte";

    const PAGE_SIZE = 20;
    const TABS: FeedbackAdminTab[] = ['open', 'done', 'declined', 'all'];

    let tab = $state<FeedbackAdminTab>('open');
    let counts = $state<Record<FeedbackAdminTab, number>>({new: 0, open: 0, done: 0, declined: 0, all: 0});
    let items = $state<Feedback[]>([]);
    let total = $state(0);
    let selected = $state<Feedback | null>(null);
    let confirmingDelete = $state(false);
    let lightboxIndex = $state<number | null>(null);
    let translation = $state<FeedbackTranslation | null>(null);

    async function refreshCounts() {
        const results = await Promise.all(TABS.map(name => adminListFeedback(name, 1)));
        TABS.forEach((name, index) => {
            if (results[index].response.ok)
                counts[name] = results[index].data.length;
        });
        refreshPendingFeedbackCount();
    }

    async function load(append = false) {
        const {response, data} = await adminListFeedback(tab, PAGE_SIZE, append ? items.length : 0);
        if (!response.ok) {
            toastError(apiErrorMessage(data, $_('admin.feedback.toasts.load')));
            return;
        }
        items = append ? [...items, ...data.items] : data.items;
        total = data.length;
    }

    $effect(() => {
        void tab;
        load();
    });
    $effect(() => {
        refreshCounts();
    });

    async function select(item: Feedback) {
        selected = item;
        translation = null;
        if (item.admin_seen === false) {
            await adminMarkFeedbackSeen(item.id);
            const seen = {...item, admin_seen: true};
            items = items.map(other => other.id === item.id ? seen : other);
            selected = seen;
            refreshCounts();
        }
    }

    async function setStatus(status: FeedbackStatus) {
        if (!selected)
            return;
        const {response, data} = await adminSetFeedbackStatus(selected.id, status);
        if (!response.ok) {
            toastError(apiErrorMessage(data, $_('admin.feedback.toasts.status')));
            return;
        }
        selected = data;
        toastSuccess($_(`admin.feedback.toasts.${status}`));
        await load();
        refreshCounts();
    }

    async function remove() {
        confirmingDelete = false;
        if (!selected)
            return;
        const {response, data} = await deleteFeedback(selected.id);
        if (!response.ok) {
            toastError(apiErrorMessage(data, $_('admin.feedback.toasts.delete')));
            return;
        }
        selected = null;
        toastSuccess($_('admin.feedback.toasts.deleted'));
        await load();
        refreshCounts();
    }

    function statusClass(status: FeedbackStatus) {
        return status === 'open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
            : status === 'done' ? 'bg-primary/10 text-primary'
            : 'bg-foreground/10 text-foreground';
    }
    function typeClass(item: Feedback) {
        return item.type === 'bug' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    }
</script>

<div class="flex flex-col gap-5">
    <h1 class="text-2xl font-bold text-foreground">{$_('admin.feedback.title')}</h1>

    <div role="tablist" class="flex flex-wrap gap-1 border-b border-border">
        {#each TABS as name (name)}
            <button
                    type="button"
                    role="tab"
                    aria-selected={tab === name}
                    onclick={() => { tab = name; selected = null; }}
                    class="-mb-px flex h-11 items-center gap-2 border-b-2 px-3.5 text-sm transition-colors hover:cursor-pointer {tab === name ? 'border-primary font-semibold text-primary' : 'border-transparent font-medium text-muted-foreground hover:text-foreground'}"
            >
                {$_(`admin.feedback.tabs.${name}`)}
                <span class="rounded-full bg-muted px-1.5 py-0.5 text-xs font-bold leading-none text-foreground">{counts[name]}</span>
                {#if (name === 'open' || name === 'all') && $pendingFeedbackCount > 0}
                    <span class="h-2 w-2 rounded-full bg-destructive" title={$_('admin.feedback.pendingBadge', {values: {count: $pendingFeedbackCount}})}></span>
                {/if}
            </button>
        {/each}
    </div>

    <div class="flex flex-wrap items-start gap-6">
        <div class="min-w-0 flex-[999_1_32rem] overflow-hidden rounded-xl border border-border">
            {#if items.length === 0}
                <div class="p-10 text-center text-sm text-muted-foreground">{$_('admin.feedback.empty')}</div>
            {/if}
            {#each items as item (item.id)}
                <button
                        type="button"
                        onclick={() => select(item)}
                        aria-current={selected?.id === item.id}
                        class="flex w-full items-center gap-3.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:cursor-pointer {selected?.id === item.id ? 'bg-primary/10' : 'bg-card hover:bg-muted'}"
                >
                    <span aria-hidden="true" class="h-2 w-2 flex-none rounded-full {item.admin_seen === false ? 'bg-destructive' : 'bg-transparent'}"></span>
                    <span class="w-9 flex-none text-right text-sm font-bold text-foreground">{item.vote_count}</span>
                    <span class="flex-none rounded-full px-2 text-xs font-semibold {typeClass(item)}">{$_(`feedback.type.${item.type}`)}</span>
                    <span class="flex min-w-0 flex-1 flex-col">
                        <span class="truncate text-sm text-foreground {item.admin_seen === false ? 'font-bold' : 'font-medium'}">{item.title}</span>
                        <span class="text-xs text-muted-foreground">{item.author?.username ?? $_('feedback.deletedUser')} · {relativeTime(item.created_at, $locale ?? 'en')}</span>
                    </span>
                    <span class="flex-none rounded-full px-2 text-xs font-semibold {statusClass(item.status)}">{$_(`feedback.status.${item.status}`)}</span>
                </button>
            {/each}
            {#if items.length < total}
                <div class="flex justify-center border-t border-border p-3">
                    <Button variant="outline" size="sm" onclick={() => load(true)}>{$_('feedback.loadMore')}</Button>
                </div>
            {/if}
        </div>

        {#if selected}
            <aside aria-label={$_('admin.feedback.selected')} class="flex min-w-0 flex-[1_1_24rem] flex-col gap-4 rounded-xl border border-border bg-card p-5">
                <div class="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    <span class="rounded-full px-2 text-xs font-semibold {statusClass(selected.status)}">{$_(`feedback.status.${selected.status}`)}</span>
                    <span class="rounded-full px-2 text-xs font-semibold {typeClass(selected)}">{$_(`feedback.type.${selected.type}`)}</span>
                    <span>{$_('admin.feedback.votes', {values: {count: selected.vote_count}})}</span>
                </div>
                <h2 class="text-lg font-semibold leading-snug text-foreground">{translation?.title ?? selected.title}</h2>
                <div class="text-[13px] text-muted-foreground">
                    {selected.author?.username ?? $_('feedback.deletedUser')} · {relativeTime(selected.created_at, $locale ?? 'en')}
                    · <a href={`/${$locale}/feedback?open=${selected.id}`} class="text-primary hover:underline">{$_('admin.feedback.viewOnBoard')}</a>
                </div>
                <p class="whitespace-pre-line text-foreground">{translation?.description ?? selected.description}</p>
                <div class="flex flex-wrap items-center gap-2">
                    {#key selected.id}
                        <FeedbackTranslateButton item={selected} bind:translation />
                    {/key}
                </div>
                {#if selected.photos.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each selected.photos as photo, index (photo)}
                            <button type="button" onclick={() => lightboxIndex = index} aria-label={$_('feedback.openPhoto', {values: {n: index + 1}})} class="h-20 w-26 overflow-hidden rounded-lg bg-muted hover:cursor-zoom-in">
                                <img src={pictureUrl($serverUrl, photo)} alt="" class="h-full w-full object-cover" />
                            </button>
                        {/each}
                    </div>
                {/if}
                {#if selected.link_path}
                    <a href={selected.link_path} class="self-start text-sm font-medium text-primary hover:underline">{feedbackLinkLabel(selected.link_path, selected.link_title, $_)}</a>
                {/if}
                <div class="flex flex-wrap gap-2 border-t border-border pt-4">
                    {#if selected.status === 'open'}
                        <Button onclick={() => setStatus('done')}>{$_('admin.feedback.markDone')}</Button>
                        <Button variant="outline" onclick={() => setStatus('declined')}>{$_('admin.feedback.decline')}</Button>
                    {:else}
                        <Button variant="outline" onclick={() => setStatus('open')}>{$_('admin.feedback.reopen')}</Button>
                    {/if}
                    <Button variant="outline" onclick={() => confirmingDelete = true} class="ml-auto text-destructive">{$_('feedback.delete')}</Button>
                </div>
                <p class="text-xs text-muted-foreground">{$_('admin.feedback.statusHelp')}</p>
            </aside>
        {/if}
    </div>
</div>

<Lightbox
        open={lightboxIndex !== null}
        pictures={selected?.photos ?? []}
        startIndex={lightboxIndex ?? 0}
        alt={selected?.title ?? ''}
        onClose={() => lightboxIndex = null}
/>

<Modal
        open={confirmingDelete}
        title={$_('feedback.deleteConfirm.title')}
        description={$_('admin.feedback.deleteDescription')}
        onClose={() => confirmingDelete = false}
>
    <div class="flex justify-end gap-2">
        <Button variant="outline" onclick={() => confirmingDelete = false}>{$_('feedback.form.cancel')}</Button>
        <Button variant="destructive" onclick={remove}>{$_('feedback.delete')}</Button>
    </div>
</Modal>
