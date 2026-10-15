<script lang="ts">
    import {_, locale} from "svelte-i18n";
    import {onMount} from "svelte";
    import {goto} from "$app/navigation";
    import {page} from "$app/state";
    import {ChevronLeft} from "@lucide/svelte";
    import {accessToken} from "$lib/stores";
    import {apiErrorMessage} from "$lib/api";
    import {toastError} from "$lib/utils";
    import {createFeedback, parseFeedbackLink, type FeedbackForm as Form} from "$lib/feedback";
    import FeedbackForm from "../../../../../components/FeedbackForm.svelte";
    import PageMeta from "../../../../../components/PageMeta.svelte";

    // Only a page of this site, and not the feedback pages themselves, is
    // offered as the linked page.
    let fromPath = $derived.by(() => {
        const from = page.url.searchParams.get('from');
        if (!from)
            return undefined;
        const parsed = parseFeedbackLink(from, page.url.origin);
        if ('error' in parsed || parsed.path.split('/').filter(Boolean)[1] === 'feedback')
            return undefined;
        return parsed.path;
    });

    let ready = $state(false);
    onMount(() => {
        if (!$accessToken) {
            toastError($_('feedback.toasts.signInToPost'));
            goto(`/${$locale}/login`);
            return;
        }
        ready = true;
    });

    async function submit(form: Form, photos: File[]) {
        const {response, data} = await createFeedback(form, photos);
        if (response.ok && data)
            goto(`/${$locale}/feedback?open=${data.id}`);
        else
            toastError(apiErrorMessage(data, $_('feedback.toasts.save')));
    }
</script>

<PageMeta title={$_('feedback.newPage.title')} description={$_('feedback.meta.description')} />

<div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    <a href={`/${$locale}/feedback`} class="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline">
        <ChevronLeft class="h-4 w-4" />{$_('feedback.back')}
    </a>
    <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-bold text-foreground">{$_('feedback.newPage.title')}</h1>
        <p class="text-pretty text-lg text-muted-foreground">{$_('feedback.newPage.intro')}</p>
    </div>
    {#if ready}
        <FeedbackForm {fromPath} submitLabel={$_('feedback.newPage.submit')} onSubmit={submit} onCancel={() => goto(`/${$locale}/feedback`)} />
    {/if}
</div>
