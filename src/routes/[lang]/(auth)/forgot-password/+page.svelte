<script lang="ts">
    import Button from '../../../../components/Button.svelte';
    import Input from '../../../../components/Input.svelte';
    import Label from '../../../../components/Label.svelte';
    import PageMeta from '../../../../components/PageMeta.svelte';
    import {goto} from "$app/navigation";
    import {_, locale} from "svelte-i18n";
    import {toastError, toastSuccess} from "$lib/utils";
    import {forgotPassword} from "$lib/auth.js";

    let email = $state('');

    async function handleSubmit(event: Event) {
        event.preventDefault();
        if (email.length === 0)
            return toastError($_('forgot.empty'))

        const response = await forgotPassword({id: email, locale: $locale ?? ''});
        if (response.ok)
            toastSuccess($_('forgot.sent'))
        else
            toastError($_('forgot.failed'))
    }
</script>

<PageMeta title={$_('forgot.meta.title')} description={$_('forgot.meta.description')} />

<div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="max-w-md w-full space-y-8">
        <div class="text-center">
            <h2 class="text-3xl font-bold text-foreground">{$_('forgot.reset')}</h2>
            <p class="mt-2 text-muted-foreground">
                {$_('forgot.resetDesc')}
            </p>
        </div>

        <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
            <div>
                <Label for="email" required>{$_('forgot.id.label')}</Label>
                <Input
                        id="email"
                        type="text"
                        bind:value={email}
                        required
                        placeholder={$_('forgot.id.placeholder')}
                />
            </div>

            <Button type="submit" class="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
                {$_('forgot.submit')}
            </Button>
        </form>

        <div class="text-center">
            <p class="text-muted-foreground">
                {$_('forgot.remember')}
                <Button variant="link" onclick={() => goto(`/${$locale}/login`)} class="p-0 h-auto font-medium">
                    {$_('forgot.back')}
                </Button>
            </p>
        </div>
    </div>
</div>
