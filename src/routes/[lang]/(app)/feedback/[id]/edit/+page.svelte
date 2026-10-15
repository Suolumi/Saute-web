<script lang="ts">
    import {_, locale} from "svelte-i18n";
    import {onMount} from "svelte";
    import {goto} from "$app/navigation";
    import {page} from "$app/state";
    import {ChevronLeft} from "@lucide/svelte";
    import {accessToken} from "$lib/stores";
    import {apiErrorMessage} from "$lib/api";
    import {toastError} from "$lib/utils";
    import {getFeedback, updateFeedback, type Feedback, type FeedbackForm as Form} from "$lib/feedback";
    import FeedbackForm from "../../../../../../components/FeedbackForm.svelte";
    import PageMeta from "../../../../../../components/PageMeta.svelte";

    let feedback = $state<Feedback | null>(null);
    let boardHref = $derived(`/${$locale}/feedback?open=${page.params.id}`);

    onMount(async () => {
        if (!$accessToken) {
            toastError($_('feedback.toasts.signInToPost'));
            goto(`/${$locale}/login`);
            return;
        }
        const {response, data} = await getFeedback(page.params.id ?? '');
        if (!response.ok || !data.mine || data.status !== 'open') {
            toastError($_(response.ok ? 'feedback.toasts.notEditable' : 'feedback.toasts.notFound'));
            goto(boardHref);
            return;
        }
        feedback = data;
    });

    async function submit(form: Form, photos: File[]) {
        const {response, data} = await updateFeedback(page.params.id ?? '', form, photos);
        if (response.ok && data)
            goto(boardHref);
        else
            toastError(apiErrorMessage(data, $_('feedback.toasts.save')));
    }
</script>

<PageMeta title={$_('feedback.editPage.title')} description={$_('feedback.meta.description')} />

<div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    <a href={boardHref} class="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline">
        <ChevronLeft class="h-4 w-4" />{$_('feedback.back')}
    </a>
    <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-bold text-foreground">{$_('feedback.editPage.title')}</h1>
        <p class="text-pretty text-lg text-muted-foreground">{$_('feedback.editPage.intro')}</p>
    </div>
    {#if feedback}
        <FeedbackForm initial={feedback} submitLabel={$_('feedback.editPage.submit')} onSubmit={submit} onCancel={() => goto(boardHref)} />
    {/if}
</div>
