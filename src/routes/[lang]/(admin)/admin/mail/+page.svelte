<script lang="ts">
    import {_, locale} from 'svelte-i18n';
    import Button from '../../../../../components/Button.svelte';
    import Input from '../../../../../components/Input.svelte';
    import Label from '../../../../../components/Label.svelte';
    import Textarea from '../../../../../components/Textarea.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import {
        getAdminStats,
        getMailBroadcastStatus,
        previewAdminMail,
        sendAdminMail,
        type AdminMail,
        type MailBroadcastStatus
    } from '$lib/admin';
    import {toastError, toastSuccess} from '$lib/utils';
    import {apiErrorMessage} from '$lib/api';

    const POLL_MS = 2000;
    const PREVIEW_DEBOUNCE_MS = 500;

    let subject = $state('');
    let heading = $state('');
    let message = $state('');
    let buttonLabel = $state('');
    let buttonUrl = $state('');

    let previewHtml = $state('');
    let previewError = $state('');
    let sendingTest = $state(false);
    let confirming = $state(false);
    let starting = $state(false);
    let userCount = $state<number | null>(null);
    let status = $state<MailBroadcastStatus | null>(null);

    let mail: AdminMail = $derived({
        subject,
        heading,
        message,
        button_label: buttonLabel.trim() || undefined,
        button_url: buttonUrl.trim() || undefined,
    });
    let complete = $derived(subject.trim() !== '' && heading.trim() !== '' && message.trim() !== '');
    let running = $derived(status?.running ?? false);

    // Only the latest preview request may update the iframe.
    let previewSeq = 0;
    $effect(() => {
        const current = mail;
        if (!complete) {
            previewHtml = '';
            previewError = '';
            return;
        }
        const seq = ++previewSeq;
        const timer = setTimeout(() => {
            previewAdminMail(current).then(({response, data}) => {
                if (seq !== previewSeq)
                    return;
                if (response.ok && data) {
                    previewHtml = data.html;
                    previewError = '';
                } else {
                    previewError = apiErrorMessage(data, $_('admin.mail.errors.preview'));
                }
            });
        }, PREVIEW_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    });

    function loadStatus() {
        return getMailBroadcastStatus().then(({response, data}) => {
            if (response.ok && data)
                status = data;
        });
    }

    $effect(() => {
        loadStatus();
        getAdminStats().then(({response, data}) => {
            if (response.ok && data)
                userCount = data.total_users;
        });
    });

    $effect(() => {
        if (!running)
            return;
        const interval = setInterval(loadStatus, POLL_MS);
        return () => clearInterval(interval);
    });

    function sendTest() {
        sendingTest = true;
        sendAdminMail(mail, true).then(({response, data}) => {
            if (response.ok)
                toastSuccess($_('admin.mail.testSent'));
            else
                toastError(apiErrorMessage(data, $_('admin.mail.errors.send')));
        }).finally(() => {
            sendingTest = false;
        });
    }

    function sendToAll() {
        starting = true;
        sendAdminMail(mail, false).then(({response, data}) => {
            if (response.ok && data) {
                status = data;
                confirming = false;
                toastSuccess($_('admin.mail.started'));
            } else {
                toastError(apiErrorMessage(data, $_('admin.mail.errors.send')));
            }
        }).finally(() => {
            starting = false;
        });
    }

    function formatDate(iso?: string) {
        return iso ? new Date(iso).toLocaleString($locale ?? undefined) : '';
    }
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-2xl font-bold text-foreground">{$_('admin.mail.title')}</h1>
        <p class="text-sm text-muted-foreground mt-1">{$_('admin.mail.description')}</p>
    </div>

    {#if status && status.started_at}
        <div class="bg-card rounded-lg border border-border p-4 space-y-2">
            <p class="text-sm font-medium text-foreground">
                {running ? $_('admin.mail.statusRunning') : $_('admin.mail.statusLast')}: “{status.subject}”
            </p>
            <p class="text-sm text-muted-foreground">
                {$_('admin.mail.progress', {values: {sent: status.sent, failed: status.failed.length, total: status.total}})}
                · {formatDate(status.started_at)}{#if status.finished_at} → {formatDate(status.finished_at)}{/if}
            </p>
            {#if status.total > 0}
                <div class="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                            class="h-full bg-primary transition-all"
                            style="width: {((status.sent + status.failed.length) / status.total) * 100}%"
                    ></div>
                </div>
            {/if}
            {#if status.failed.length > 0}
                <details class="text-sm">
                    <summary class="cursor-pointer text-destructive">{$_('admin.mail.failures', {values: {count: status.failed.length}})}</summary>
                    <ul class="mt-2 space-y-1 text-muted-foreground">
                        {#each status.failed as f (f.email)}
                            <li><span class="text-foreground">{f.email}</span>: {f.error}</li>
                        {/each}
                    </ul>
                </details>
            {/if}
        </div>
    {/if}

    <div class="grid gap-6 lg:grid-cols-2">
        <div class="bg-card rounded-lg border border-border p-6 space-y-4">
            <div>
                <Label for="mail-subject" required>{$_('admin.mail.subject')}</Label>
                <Input id="mail-subject" bind:value={subject} maxlength={200} />
            </div>
            <div>
                <Label for="mail-heading" required>{$_('admin.mail.heading')}</Label>
                <Input id="mail-heading" bind:value={heading} maxlength={200} />
            </div>
            <div>
                <Label for="mail-message" required>{$_('admin.mail.message')}</Label>
                <Textarea id="mail-message" bind:value={message} rows={10} maxlength={20000} />
                <p class="text-xs text-muted-foreground mt-1">{$_('admin.mail.messageHint')}</p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label for="mail-button-label">{$_('admin.mail.buttonLabel')}</Label>
                    <Input id="mail-button-label" bind:value={buttonLabel} />
                </div>
                <div>
                    <Label for="mail-button-url">{$_('admin.mail.buttonUrl')}</Label>
                    <Input id="mail-button-url" type="url" bind:value={buttonUrl} placeholder="https://" />
                </div>
            </div>
            <div class="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onclick={sendTest} disabled={!complete || sendingTest}>
                    {sendingTest ? $_('admin.mail.sending') : $_('admin.mail.sendTest')}
                </Button>
                <Button variant="destructive" onclick={() => confirming = true} disabled={!complete || running}>
                    {$_('admin.mail.sendAll')}
                </Button>
            </div>
        </div>

        <div class="bg-card rounded-lg border border-border p-2 flex flex-col min-h-[32rem]">
            <p class="text-sm font-medium text-foreground px-2 py-1">{$_('admin.mail.preview')}</p>
            {#if previewError}
                <p class="text-sm text-destructive px-2">{previewError}</p>
            {:else if previewHtml}
                <iframe
                        title={$_('admin.mail.preview')}
                        srcdoc={previewHtml}
                        sandbox=""
                        class="flex-1 w-full rounded-md border border-border bg-white"
                ></iframe>
            {:else}
                <p class="text-sm text-muted-foreground px-2">{$_('admin.mail.previewEmpty')}</p>
            {/if}
        </div>
    </div>
</div>

<Modal
        open={confirming}
        title={$_('admin.mail.confirmTitle')}
        description={userCount === null
            ? $_('admin.mail.confirmDescriptionUnknown', {values: {subject}})
            : $_('admin.mail.confirmDescription', {values: {count: userCount, subject}})}
        onClose={() => confirming = false}
>
    <div class="flex justify-end gap-2">
        <Button variant="outline" onclick={() => confirming = false}>{$_('admin.mail.cancel')}</Button>
        <Button variant="destructive" onclick={sendToAll} disabled={starting}>{$_('admin.mail.confirmSend')}</Button>
    </div>
</Modal>
