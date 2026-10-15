<script lang="ts">
    import {_, locale} from "svelte-i18n";
    import {onMount, tick} from "svelte";
    import {goto, replaceState} from "$app/navigation";
    import {page} from "$app/state";
    import {CheckCircle2, ChevronRight, Plus, Search, User as UserIcon, X} from "@lucide/svelte";
    import {user} from "$lib/stores";
    import {apiErrorMessage} from "$lib/api";
    import {toastError, toastSuccess} from "$lib/utils";
    import {
        acknowledgeFeedback, deleteFeedback, feedbackUpdates, getFeedback, listFeedback, voteFeedback,
        type Feedback, type FeedbackType, type ListFeedbackParams
    } from "$lib/feedback";
    import FeedbackItem from "../../../../components/FeedbackItem.svelte";
    import Button from "../../../../components/Button.svelte";
    import Modal from "../../../../components/Modal.svelte";
    import PageMeta from "../../../../components/PageMeta.svelte";

    const PAGE_SIZE = 20;

    let typeFilter = $state<FeedbackType | 'all'>('all');
    let mineOnly = $state(false);
    let search = $state('');
    let query = $state('');
    let sort = $state<'votes' | 'new'>('votes');

    let openItems = $state<Feedback[]>([]);
    let openTotal = $state(0);
    let closedItems = $state<Feedback[]>([]);
    let closedTotal = $state(0);
    let loaded = $state(false);
    let showClosed = $state(false);

    let expandedId = $state<string | null>(null);
    // pinned is the item a ?open= link targets when it isn't on a loaded page.
    let pinned = $state<Feedback | null>(null);
    let highlightedId = $state<string | null>(null);
    let pendingDelete = $state<Feedback | null>(null);

    let fromParam = $derived(page.url.searchParams.get('from'));
    let newHref = $derived(`/${$locale}/feedback/new${fromParam ? `?from=${encodeURIComponent(fromParam)}` : ''}`);
    let notice = $derived($feedbackUpdates[0]);

    function withPinned(items: Feedback[], closed: boolean): Feedback[] {
        if (!pinned || (pinned.status !== 'open') !== closed || items.some(item => item.id === pinned!.id))
            return items;
        return [pinned, ...items];
    }
    let openShown = $derived(withPinned(openItems, false));
    let closedShown = $derived(withPinned(closedItems, true));

    function params(status: 'open' | 'closed', offset: number): ListFeedbackParams {
        return {
            status,
            type: typeFilter === 'all' ? undefined : typeFilter,
            q: query || undefined,
            mine: mineOnly,
            sort: status === 'open' ? sort : 'new',
            limit: PAGE_SIZE,
            offset,
        };
    }

    // Each reload bumps the generation, so a slow response for an older
    // filter combination is dropped instead of overwriting a newer one.
    let generation = 0;
    async function reload() {
        const current = ++generation;
        const [open, closed] = await Promise.all([listFeedback(params('open', 0)), listFeedback(params('closed', 0))]);
        if (current !== generation)
            return;
        if (!open.response.ok || !closed.response.ok) {
            toastError($_('feedback.toasts.load'));
            return;
        }
        openItems = open.data.items;
        openTotal = open.data.length;
        closedItems = closed.data.items;
        closedTotal = closed.data.length;
        loaded = true;
    }

    async function loadMore(status: 'open' | 'closed') {
        const current = generation;
        const offset = status === 'open' ? openItems.length : closedItems.length;
        const {response, data} = await listFeedback(params(status, offset));
        if (current !== generation || !response.ok)
            return;
        if (status === 'open')
            openItems = [...openItems, ...data.items.filter(item => !openItems.some(other => other.id === item.id))];
        else
            closedItems = [...closedItems, ...data.items.filter(item => !closedItems.some(other => other.id === item.id))];
    }

    $effect(() => {
        void typeFilter; void mineOnly; void query; void sort; void $user;
        reload();
    });

    $effect(() => {
        const value = search.trim();
        const timeout = setTimeout(() => query = value, 300);
        return () => clearTimeout(timeout);
    });

    function replaceItem(updated: Feedback) {
        const swap = (items: Feedback[]) => items.map(item => item.id === updated.id ? updated : item);
        openItems = swap(openItems);
        closedItems = swap(closedItems);
        if (pinned?.id === updated.id)
            pinned = updated;
    }

    async function openFromLink(id: string) {
        const {response, data} = await getFeedback(id);
        if (!response.ok) {
            toastError($_('feedback.toasts.notFound'));
            return;
        }
        pinned = data;
        expandedId = id;
        highlightedId = id;
        if (data.status !== 'open')
            showClosed = true;
        if (data.mine && data.unread)
            acknowledgeFeedback(id);
        await tick();
        document.getElementById(`feedback-${id}`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }

    onMount(() => {
        const id = page.url.searchParams.get('open');
        if (id)
            openFromLink(id);
    });

    function viewNotice(item: Feedback) {
        const url = new URL(page.url);
        url.searchParams.set('open', item.id);
        replaceState(url, page.state);
        openFromLink(item.id);
    }

    function toggle(item: Feedback) {
        expandedId = expandedId === item.id ? null : item.id;
        if (expandedId && item.mine && item.unread) {
            acknowledgeFeedback(item.id);
            replaceItem({...item, unread: false});
        }
    }

    async function vote(item: Feedback) {
        if (!$user) {
            toastError($_('feedback.toasts.signInToVote'));
            goto(`/${$locale}/login`);
            return;
        }
        if (item.mine) {
            toastSuccess($_('feedback.ownVote'));
            return;
        }
        const {response, data} = await voteFeedback(item.id, !item.voted);
        if (response.ok && data)
            replaceItem(data);
        else
            toastError(apiErrorMessage(data, $_('feedback.toasts.vote')));
    }

    async function confirmDelete() {
        const item = pendingDelete;
        pendingDelete = null;
        if (!item)
            return;
        const {response, data} = await deleteFeedback(item.id);
        if (!response.ok) {
            toastError(apiErrorMessage(data, $_('feedback.toasts.delete')));
            return;
        }
        if (pinned?.id === item.id)
            pinned = null;
        toastSuccess($_('feedback.toasts.deleted'));
        reload();
    }

    function chipClass(active: boolean) {
        return `inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors hover:cursor-pointer ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-primary/60'}`;
    }
    function segmentClass(active: boolean) {
        return `h-8 rounded-md px-3 text-[13px] font-medium transition-colors hover:cursor-pointer ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`;
    }
</script>

<PageMeta title={$_('feedback.meta.title')} description={$_('feedback.meta.description')} />

<div class="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex flex-col gap-2">
            <h1 class="text-4xl font-bold text-foreground">{$_('feedback.title')}</h1>
            <p class="text-pretty text-lg text-muted-foreground">{$_('feedback.intro')}</p>
        </div>
        <div class="flex flex-col gap-1.5 sm:items-end">
            <Button onclick={() => goto(newHref)} class="flex items-center gap-2 whitespace-nowrap">
                <Plus class="h-4 w-4" />
                {$_('feedback.new')}
            </Button>
            {#if !$user}
                <span class="text-[13px] text-muted-foreground">{$_('feedback.signInFirst')}</span>
            {/if}
        </div>
    </div>

    {#if notice}
        <div role="status" class="flex flex-wrap items-center gap-3 rounded-xl bg-primary/10 py-3 pl-4 pr-3 text-primary">
            <CheckCircle2 class="h-5 w-5 flex-none" />
            <span class="min-w-48 flex-1 text-sm">
                {$_(`feedback.notice.${notice.status}`, {values: {title: notice.title}})}
            </span>
            <Button variant="outline" size="sm" onclick={() => viewNotice(notice)} class="border-primary text-primary">{$_('feedback.notice.view')}</Button>
            <button type="button" onclick={() => acknowledgeFeedback(notice.id)} aria-label={$_('feedback.notice.dismiss')} class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-primary/15 hover:cursor-pointer">
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <section aria-label={$_('feedback.board')} class="flex flex-col gap-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
                {#each [['all', 'feedback.filters.all'], ['bug', 'feedback.filters.bugs'], ['idea', 'feedback.filters.ideas']] as [value, key] (value)}
                    <button type="button" aria-pressed={typeFilter === value} onclick={() => typeFilter = value as FeedbackType | 'all'} class={chipClass(typeFilter === value)}>
                        {$_(key)}
                    </button>
                {/each}
                {#if $user}
                    <span aria-hidden="true" class="mx-1 h-6 w-px bg-border"></span>
                    <button type="button" aria-pressed={mineOnly} onclick={() => mineOnly = !mineOnly} class={chipClass(mineOnly)}>
                        <UserIcon class="h-3.5 w-3.5" />{$_('feedback.filters.mine')}
                    </button>
                {/if}
            </div>
            <div class="relative min-w-52 flex-[0_1_16rem]">
                <Search class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                        type="search"
                        bind:value={search}
                        aria-label={$_('feedback.filters.search')}
                        placeholder={$_('feedback.filters.search')}
                        class="h-10 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>
        </div>

        <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-lg font-semibold text-foreground">
                    {$_('feedback.open')} <span class="font-medium text-muted-foreground">· {openTotal}</span>
                </h2>
                <div role="radiogroup" aria-label={$_('feedback.sort.label')} class="flex rounded-lg bg-muted p-0.5">
                    <button type="button" role="radio" aria-checked={sort === 'votes'} onclick={() => sort = 'votes'} class={segmentClass(sort === 'votes')}>{$_('feedback.sort.votes')}</button>
                    <button type="button" role="radio" aria-checked={sort === 'new'} onclick={() => sort = 'new'} class={segmentClass(sort === 'new')}>{$_('feedback.sort.new')}</button>
                </div>
            </div>

            {#if loaded && openShown.length === 0}
                <div class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {query || typeFilter !== 'all' || mineOnly ? $_('feedback.emptyFiltered') : $_('feedback.empty')}
                </div>
            {/if}
            {#each openShown as item (item.id)}
                <FeedbackItem
                        {item}
                        {query}
                        expanded={expandedId === item.id}
                        highlighted={highlightedId === item.id}
                        onToggle={() => toggle(item)}
                        onVote={() => vote(item)}
                        onEdit={() => goto(`/${$locale}/feedback/${item.id}/edit`)}
                        onDelete={() => pendingDelete = item}
                />
            {/each}
            {#if openItems.length < openTotal}
                <Button variant="outline" onclick={() => loadMore('open')} class="self-center">{$_('feedback.loadMore')}</Button>
            {/if}
        </div>

        <div class="flex flex-col gap-2 pt-2">
            <button
                    type="button"
                    onclick={() => showClosed = !showClosed}
                    aria-expanded={showClosed}
                    class="flex h-11 items-center gap-2 self-start text-lg font-semibold text-foreground hover:cursor-pointer"
            >
                <ChevronRight class="h-[18px] w-[18px] transition-transform {showClosed ? 'rotate-90' : ''}" />
                {showClosed ? $_('feedback.closedHeading', {values: {count: closedTotal}}) : $_('feedback.showClosed', {values: {count: closedTotal}})}
            </button>
            {#if showClosed}
                {#each closedShown as item (item.id)}
                    <FeedbackItem
                            {item}
                            {query}
                            expanded={expandedId === item.id}
                            highlighted={highlightedId === item.id}
                            onToggle={() => toggle(item)}
                            onVote={() => {}}
                            onEdit={() => {}}
                            onDelete={() => {}}
                    />
                {/each}
                {#if closedItems.length < closedTotal}
                    <Button variant="outline" onclick={() => loadMore('closed')} class="self-center">{$_('feedback.loadMore')}</Button>
                {/if}
            {/if}
        </div>
    </section>
</div>

<Modal
        open={pendingDelete !== null}
        title={$_('feedback.deleteConfirm.title')}
        description={$_('feedback.deleteConfirm.description')}
        onClose={() => pendingDelete = null}
>
    <div class="flex justify-end gap-2">
        <Button variant="outline" onclick={() => pendingDelete = null}>{$_('feedback.form.cancel')}</Button>
        <Button variant="destructive" onclick={confirmDelete}>{$_('feedback.delete')}</Button>
    </div>
</Modal>
