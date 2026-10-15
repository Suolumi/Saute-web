<script lang="ts">
    import {_, locale} from "svelte-i18n";
    import {onDestroy, onMount} from "svelte";
    import {Bug, Camera, Lightbulb, Link as LinkIcon, Plus, X, AlertCircle} from "@lucide/svelte";
    import {serverUrl, user} from "$lib/stores";
    import {pictureUrl} from "$lib/utils";
    import {getRecipe} from "$lib/recipes";
    import {
        feedbackLinkLabel, listFeedback, MAX_FEEDBACK_DESCRIPTION, MAX_FEEDBACK_PHOTOS, MAX_FEEDBACK_TITLE,
        parseFeedbackLink, recipeIdFromPath, similarFeedback, voteFeedback,
        type Feedback, type FeedbackForm, type FeedbackType
    } from "$lib/feedback";
    import Button from "./Button.svelte";
    import Input from "./Input.svelte";
    import Textarea from "./Textarea.svelte";

    let {initial, fromPath, submitLabel, onSubmit, onCancel}: {
        // initial is the feedback being edited; absent when creating.
        initial?: Feedback
        // fromPath is the page the user came from, offered as the linked page.
        fromPath?: string
        submitLabel: string
        onSubmit: (form: FeedbackForm, newPhotos: File[]) => Promise<void>
        onCancel: () => void
    } = $props();

    let type = $state<FeedbackType>(initial?.type ?? 'bug');
    let title = $state(initial?.title ?? '');
    let description = $state(initial?.description ?? '');
    let keptPhotos = $state<string[]>(initial?.photos ?? []);
    let newPhotos = $state<{file: File, url: string}[]>([]);
    let submitting = $state(false);
    let fileInput: HTMLInputElement | undefined = $state();

    const KINDS = [{value: 'bug' as const, Icon: Bug}, {value: 'idea' as const, Icon: Lightbulb}];

    type Link = {path: string, label: string, source: 'from' | 'pasted' | 'saved'};
    let link = $state<Link | null>(null);
    let pasting = $state(false);
    let pasted = $state('');
    let linkError = $state('');
    let checkingLink = $state(false);

    let photoCount = $derived(keptPhotos.length + newPhotos.length);
    let canSubmit = $derived(title.trim() !== '' && description.trim() !== '' && !submitting);

    // Open items, for the "someone may have posted this already" nudge.
    let openItems = $state<Feedback[]>([]);
    let similar = $derived(initial ? [] : similarFeedback(title, openItems));

    async function resolveLink(path: string): Promise<string | null> {
        const recipeId = recipeIdFromPath(path);
        if (!recipeId)
            return feedbackLinkLabel(path, undefined, $_);
        const {response, data} = await getRecipe(recipeId, $locale ?? undefined);
        if (!response.ok || !data?.title)
            return null;
        return feedbackLinkLabel(path, data.title, $_);
    }

    onMount(async () => {
        if (initial?.link_path) {
            link = {path: initial.link_path, label: feedbackLinkLabel(initial.link_path, initial.link_title, $_), source: 'saved'};
        } else if (fromPath) {
            const label = await resolveLink(fromPath);
            if (label)
                link = {path: fromPath, label, source: 'from'};
        }
        if (!initial) {
            const {response, data} = await listFeedback({status: 'open', sort: 'votes', limit: 100});
            if (response.ok && data?.items)
                openItems = data.items;
        }
    });

    onDestroy(() => newPhotos.forEach(photo => URL.revokeObjectURL(photo.url)));

    async function voteSimilar(item: Feedback) {
        if (item.mine)
            return;
        const {response, data} = await voteFeedback(item.id, !item.voted);
        if (response.ok && data)
            openItems = openItems.map(other => other.id === data.id ? data : other);
    }

    function addFiles(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const room = MAX_FEEDBACK_PHOTOS - photoCount;
        for (const file of Array.from(input.files ?? []).slice(0, room))
            newPhotos.push({file, url: URL.createObjectURL(file)});
        input.value = '';
    }

    function removeNewPhoto(index: number) {
        URL.revokeObjectURL(newPhotos[index].url);
        newPhotos.splice(index, 1);
    }

    function startPasting() {
        pasting = true;
        pasted = '';
        linkError = '';
    }

    async function addPastedLink() {
        const parsed = parseFeedbackLink(pasted, window.location.origin);
        if ('error' in parsed) {
            linkError = $_(`feedback.form.linkErrors.${parsed.error}`);
            return;
        }
        checkingLink = true;
        const label = await resolveLink(parsed.path);
        checkingLink = false;
        if (!label) {
            linkError = $_('feedback.form.linkErrors.missingRecipe');
            return;
        }
        link = {path: parsed.path, label, source: 'pasted'};
        pasting = false;
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (!canSubmit)
            return;
        submitting = true;
        try {
            await onSubmit({
                type,
                title: title.trim(),
                description: description.trim(),
                link_path: link?.path ?? '',
                photos: keptPhotos,
            }, newPhotos.map(photo => photo.file));
        } finally {
            submitting = false;
        }
    }
</script>

<form onsubmit={submit} class="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 sm:p-6">
    <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 text-sm font-semibold text-foreground">{$_('feedback.form.kind')}</legend>
        <div role="radiogroup" class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {#each KINDS as {value, Icon} (value)}
                <button
                        type="button"
                        role="radio"
                        aria-checked={type === value}
                        onclick={() => type = value}
                        class="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-left transition-colors hover:cursor-pointer {type === value ? 'border-[1.5px] border-primary bg-primary/10 text-primary' : 'border border-border bg-background text-foreground hover:border-primary/60'}"
                >
                    <Icon class="mt-0.5 h-[18px] w-[18px] flex-none" />
                    <span class="flex flex-col gap-0.5">
                        <span class="font-semibold">{$_(`feedback.form.${value}.label`)}</span>
                        <span class="text-[13px] opacity-85">{$_(`feedback.form.${value}.hint`)}</span>
                    </span>
                </button>
            {/each}
        </div>
    </fieldset>

    <div class="flex flex-col gap-1.5">
        <label for="feedback-title" class="text-sm font-semibold text-foreground">{$_('feedback.form.title')}</label>
        <Input id="feedback-title" bind:value={title} maxlength={MAX_FEEDBACK_TITLE} placeholder={$_(`feedback.form.${type}.titlePlaceholder`)} required />
        {#if similar.length > 0}
            <div class="mt-1 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                <div class="text-[13px] font-semibold text-amber-900 dark:text-amber-200">{$_('feedback.form.similar')}</div>
                {#each similar as item (item.id)}
                    <div class="flex items-center gap-3 rounded-lg border border-amber-200 bg-background px-3 py-2 dark:border-amber-900">
                        <span class="min-w-8 text-[13px] font-semibold text-foreground">{item.vote_count}</span>
                        <a href={`/${$locale}/feedback?open=${item.id}`} target="_blank" rel="noopener" class="min-w-0 flex-1 text-sm text-foreground hover:underline">{item.title}</a>
                        {#if $user && !item.mine}
                            <button
                                    type="button"
                                    onclick={() => voteSimilar(item)}
                                    aria-pressed={item.voted}
                                    class="h-9 whitespace-nowrap rounded-lg border border-primary px-3 text-[13px] font-semibold text-primary hover:cursor-pointer {item.voted ? 'bg-primary/10' : 'bg-background'}"
                            >
                                {item.voted ? $_('feedback.form.upvoted') : $_('feedback.form.upvoteInstead')}
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div class="flex flex-col gap-1.5">
        <label for="feedback-description" class="text-sm font-semibold text-foreground">{$_(`feedback.form.${type}.descriptionLabel`)}</label>
        <Textarea id="feedback-description" bind:value={description} rows={5} maxlength={MAX_FEEDBACK_DESCRIPTION} placeholder={$_(`feedback.form.${type}.descriptionPlaceholder`)} required />
        <span class="text-[13px] text-muted-foreground">{$_(`feedback.form.${type}.descriptionHint`)}</span>
    </div>

    <div class="flex flex-col gap-2">
        <div class="text-sm font-semibold text-foreground">
            {$_('feedback.form.photos')} <span class="font-normal text-muted-foreground">· {$_('feedback.form.photosHint', {values: {max: MAX_FEEDBACK_PHOTOS}})}</span>
        </div>
        <div class="flex flex-wrap gap-3">
            {#each keptPhotos as photo, index (photo)}
                <div class="relative h-[84px] w-28">
                    <img src={pictureUrl($serverUrl, photo)} alt="" class="h-full w-full rounded-lg object-cover" />
                    <button type="button" onclick={() => keptPhotos.splice(index, 1)} aria-label={$_('feedback.form.removePhoto', {values: {n: index + 1}})} class="absolute -right-2 -top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-border bg-background text-foreground hover:cursor-pointer">
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>
            {/each}
            {#each newPhotos as photo, index (photo.url)}
                <div class="relative h-[84px] w-28">
                    <img src={photo.url} alt="" class="h-full w-full rounded-lg object-cover" />
                    <button type="button" onclick={() => removeNewPhoto(index)} aria-label={$_('feedback.form.removePhoto', {values: {n: keptPhotos.length + index + 1}})} class="absolute -right-2 -top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-border bg-background text-foreground hover:cursor-pointer">
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>
            {/each}
            {#if photoCount < MAX_FEEDBACK_PHOTOS}
                <button type="button" onclick={() => fileInput?.click()} class="flex h-[84px] w-28 flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-border bg-background text-[13px] text-foreground hover:border-primary/60 hover:cursor-pointer">
                    <Camera class="h-5 w-5" />
                    {$_('feedback.form.addPhoto', {values: {count: photoCount, max: MAX_FEEDBACK_PHOTOS}})}
                </button>
            {/if}
            <input bind:this={fileInput} type="file" accept="image/jpeg,image/png" multiple onchange={addFiles} class="hidden" />
        </div>
    </div>

    <div class="flex flex-col gap-2">
        <div class="text-sm font-semibold text-foreground">
            {$_('feedback.form.link')} <span class="font-normal text-muted-foreground">· {$_('feedback.form.optional')}</span>
        </div>
        {#if pasting}
            <div class="flex flex-wrap gap-2">
                <input
                        type="url"
                        bind:value={pasted}
                        oninput={() => linkError = ''}
                        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPastedLink(); } }}
                        aria-label={$_('feedback.form.linkInput')}
                        aria-invalid={linkError !== ''}
                        aria-describedby="feedback-link-message"
                        placeholder={$_('feedback.form.linkPlaceholder')}
                        class="h-11 min-w-0 flex-[1_1_20rem] rounded-lg border bg-input px-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring {linkError ? 'border-destructive' : 'border-border'}"
                />
                <Button variant="outline" onclick={addPastedLink} disabled={checkingLink || pasted.trim() === ''} class="h-11 border-primary text-primary">{$_('feedback.form.addLink')}</Button>
                <Button variant="ghost" onclick={() => { pasting = false; linkError = ''; }} class="h-11">{$_('feedback.form.cancel')}</Button>
            </div>
            <span id="feedback-link-message" class="flex items-center gap-1.5 text-[13px] {linkError ? 'text-destructive' : 'text-muted-foreground'}">
                {#if linkError}<AlertCircle class="h-3.5 w-3.5 flex-none" />{/if}
                {linkError || $_('feedback.form.linkHelp')}
            </span>
        {:else if link}
            <div class="flex flex-wrap items-center gap-3">
                <span class="inline-flex max-w-full items-center gap-2 rounded-full bg-primary/10 py-1.5 pl-3 pr-1.5 text-sm font-medium text-primary">
                    <LinkIcon class="h-3.5 w-3.5 flex-none" />
                    <span class="truncate">{link.label}</span>
                    <button type="button" onclick={() => link = null} aria-label={$_('feedback.form.removeLink')} class="flex h-6 w-6 flex-none items-center justify-center rounded-full hover:bg-primary/15 hover:cursor-pointer">
                        <X class="h-3.5 w-3.5" />
                    </button>
                </span>
                <button type="button" onclick={startPasting} class="text-sm font-medium text-primary underline hover:cursor-pointer">{$_('feedback.form.useAnotherLink')}</button>
            </div>
            <span class="text-[13px] text-muted-foreground">{$_(`feedback.form.linkSource.${link.source}`)}</span>
        {:else}
            <button type="button" onclick={startPasting} class="inline-flex h-10 items-center gap-1.5 self-start rounded-lg border border-dashed border-border bg-background px-3.5 text-sm font-medium text-foreground hover:border-primary/60 hover:cursor-pointer">
                <Plus class="h-3.5 w-3.5" />{$_('feedback.form.pasteLink')}
            </button>
        {/if}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <span class="text-[13px] text-muted-foreground">{$_('feedback.form.public')}</span>
        <div class="flex gap-2">
            <Button variant="outline" onclick={onCancel}>{$_('feedback.form.cancel')}</Button>
            <Button type="submit" disabled={!canSubmit}>{submitLabel}</Button>
        </div>
    </div>
</form>
