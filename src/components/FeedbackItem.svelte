<script lang="ts">
    import {_, locale} from "svelte-i18n";
    import {Bug, ChevronDown, ChevronUp, Image as ImageIcon, Lightbulb, Link as LinkIcon, Lock, Pencil, Trash2} from "@lucide/svelte";
    import {serverUrl} from "$lib/stores";
    import {pictureUrl, toastSuccess} from "$lib/utils";
    import {feedbackLinkLabel, relativeTime, type Feedback} from "$lib/feedback";
    import Lightbox from "./Lightbox.svelte";
    import HighlightText from "./HighlightText.svelte";

    let {item, expanded = false, highlighted = false, query = '', onToggle, onVote, onEdit, onDelete}: {
        item: Feedback
        expanded?: boolean
        // highlighted rings the item a ?open= link pointed to.
        highlighted?: boolean
        query?: string
        onToggle: () => void
        onVote: () => void
        onEdit: () => void
        onDelete: () => void
    } = $props();

    let open = $derived(item.status === 'open');
    let lightboxIndex = $state<number | null>(null);
    let authorName = $derived(item.mine ? $_('feedback.you') : (item.author?.username ?? $_('feedback.deletedUser')));
    let ago = $derived(relativeTime(open ? item.created_at : (item.closed_at ?? item.updated_at), $locale ?? 'en'));

    async function copyLink() {
        await navigator.clipboard.writeText(`${window.location.origin}/${$locale}/feedback?open=${item.id}`);
        toastSuccess($_('feedback.toasts.linkCopied'));
    }
</script>

<article
        id="feedback-{item.id}"
        class="rounded-xl border bg-card transition-shadow {expanded ? 'border-primary/40' : 'border-border'} {highlighted ? 'ring-4 ring-primary/15' : ''} {open ? '' : 'bg-muted/50'}"
>
    <div class="flex items-center gap-3.5 px-3.5 py-2">
        {#if open}
            <button
                    type="button"
                    onclick={onVote}
                    aria-pressed={item.voted}
                    aria-label={$_('feedback.voteLabel', {values: {count: item.vote_count}})}
                    title={item.mine ? $_('feedback.ownVote') : undefined}
                    class="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-lg border text-[13px] font-semibold leading-none transition-colors hover:cursor-pointer {item.voted ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:border-primary/60'}"
            >
                <ChevronUp class="h-3.5 w-3.5" strokeWidth={2.5} />
                {item.vote_count}
            </button>
        {:else}
            <div
                    role="img"
                    aria-label={$_('feedback.votesClosed', {values: {count: item.vote_count}})}
                    class="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-lg border border-border bg-muted text-[13px] font-semibold leading-none text-muted-foreground"
            >
                <ChevronUp class="h-3.5 w-3.5" strokeWidth={2.5} />
                {item.vote_count}
            </div>
        {/if}

        <button
                type="button"
                onclick={onToggle}
                aria-expanded={expanded}
                class="flex min-w-0 flex-1 items-center gap-3 text-left hover:cursor-pointer"
        >
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-[15px] font-semibold leading-snug text-foreground"><HighlightText text={item.title} {query} /></span>
                <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {#if !open}
                        <span class="rounded-full px-1.5 font-semibold {item.status === 'done' ? 'bg-primary/10 text-primary' : 'bg-foreground/10 text-foreground'}">
                            {$_(`feedback.status.${item.status}`)}
                        </span>
                    {/if}
                    {#if item.type === 'bug'}
                        <span class="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                            <Bug class="h-3 w-3" />{$_('feedback.type.bug')}
                        </span>
                    {:else}
                        <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            <Lightbulb class="h-3 w-3" />{$_('feedback.type.idea')}
                        </span>
                    {/if}
                    <span class="inline-flex items-center gap-1.5">
                        {#if item.author?.picture}
                            <img src={`${$serverUrl}/pictures/${item.author.picture}`} alt="" class="h-4 w-4 rounded-full object-cover" />
                        {:else}
                            <span aria-hidden="true" class="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                                {(item.author?.username ?? '?').charAt(0).toUpperCase()}
                            </span>
                        {/if}
                        <span class="text-foreground {item.mine ? 'font-semibold' : 'font-medium'}">{authorName}</span>
                    </span>
                    <span>{open ? ago : $_('feedback.closedAgo', {values: {ago}})}</span>
                    {#if item.photos.length > 0}
                        <span class="inline-flex items-center gap-1"><ImageIcon class="h-3 w-3" />{item.photos.length}</span>
                    {/if}
                    {#if item.unread}
                        <span class="h-2 w-2 rounded-full bg-destructive" title={$_('feedback.unread')}></span>
                    {/if}
                </span>
            </span>
            <ChevronDown class="h-[18px] w-[18px] flex-none text-muted-foreground transition-transform {expanded ? 'rotate-180' : ''}" />
        </button>
    </div>

    {#if expanded}
        <div class="flex flex-col gap-3.5 pb-3.5 pl-[4.5rem] pr-3.5 pt-0.5">
            <p class="whitespace-pre-line text-foreground">{item.description}</p>
            {#if item.photos.length > 0}
                <div class="flex flex-wrap gap-2.5">
                    {#each item.photos as photo, index (photo)}
                        <button
                                type="button"
                                onclick={() => lightboxIndex = index}
                                aria-label={$_('feedback.openPhoto', {values: {n: index + 1}})}
                                class="h-24 w-32 overflow-hidden rounded-lg bg-muted hover:cursor-zoom-in"
                        >
                            <img src={pictureUrl($serverUrl, photo)} alt="" class="h-full w-full object-cover" loading="lazy" />
                        </button>
                    {/each}
                </div>
            {/if}
            {#if item.link_path}
                <a href={item.link_path} class="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline">
                    <LinkIcon class="h-3.5 w-3.5" />
                    {feedbackLinkLabel(item.link_path, item.link_title, $_)}
                </a>
            {/if}
            <div class="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <button type="button" onclick={copyLink} class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted hover:cursor-pointer">
                    <LinkIcon class="h-3.5 w-3.5" />{$_('feedback.copyLink')}
                </button>
                {#if open && item.mine}
                    <button type="button" onclick={onEdit} class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted hover:cursor-pointer">
                        <Pencil class="h-3.5 w-3.5" />{$_('feedback.edit')}
                    </button>
                    <button type="button" onclick={onDelete} class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-destructive hover:bg-muted hover:cursor-pointer">
                        <Trash2 class="h-3.5 w-3.5" />{$_('feedback.delete')}
                    </button>
                {:else if !open}
                    <span class="inline-flex items-center gap-1.5"><Lock class="h-3.5 w-3.5" />{$_('feedback.locked')}</span>
                {/if}
            </div>
        </div>
    {/if}
</article>

<Lightbox
        open={lightboxIndex !== null}
        pictures={item.photos}
        startIndex={lightboxIndex ?? 0}
        alt={item.title}
        onClose={() => lightboxIndex = null}
/>
