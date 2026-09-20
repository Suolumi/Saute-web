<script lang="ts">
    import Button from '../../../../../components/Button.svelte';
    import Input from '../../../../../components/Input.svelte';
    import Label from '../../../../../components/Label.svelte';
    import PageMeta from '../../../../../components/PageMeta.svelte';
    import {goto} from "$app/navigation";
    import {_, locale} from "svelte-i18n";
    import {resetPassword} from "$lib/auth";
    import {page} from "$app/state";
    import {toastError, toastSuccess} from "$lib/utils";
    import {EyeIcon, EyeOff} from "@lucide/svelte";

    let password = $state('');
    let confirmPassword = $state('');
    let message = $state('');
    let showPassword = $state(false)

    async function handleSubmit(event: Event) {
        event.preventDefault();
        message = '';

        if (password !== confirmPassword) {
            message = $_('register.errors.passwords')
            return;
        }

        if (!/^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) {
            message = $_('register.errors.password')
            return;
        }

        const response = await resetPassword({password}, page.params.token ?? '')
        if (response.ok) {
            toastSuccess($_('reset.success'))
        } else {
            toastError($_('reset.error'))
        }
    }

</script>

<PageMeta title={$_('reset.meta.title')} description={$_('reset.meta.description')} />

<div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="max-w-md w-full space-y-8">
        <div class="text-center">
            <h2 class="text-3xl font-bold text-foreground">{$_('reset.create')}</h2>
            <p class="mt-2 text-muted-foreground">
                {$_('reset.enter')}
            </p>
        </div>

        <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
            <div>
                <Label for="password" required>{$_('reset.new.label')}</Label>
                <div class="relative">
                    <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            bind:value={password}
                            required
                            placeholder={$_('reset.new.placeholder')}
                    />
                </div>
                <button
                        type="button"
                        onclick={() => showPassword = !showPassword}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    {#if showPassword}
                        <EyeOff class="cursor-pointer" />
                    {:else}
                        <EyeIcon class="cursor-pointer" />
                    {/if}
                </button>
            </div>

            <div>
                <Label for="confirm-password" required>{$_('reset.confirm.label')}</Label>
                <div class="relative">
                    <Input
                            id="confirm-password"
                            type={showPassword ? "text" : "password"}
                            bind:value={confirmPassword}
                            required
                            placeholder={$_('reset.confirm.placeholder')}
                    />
                </div>
                <button
                        type="button"
                        onclick={() => showPassword = !showPassword}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    {#if showPassword}
                        <EyeOff class="cursor-pointer" />
                    {:else}
                        <EyeIcon class="cursor-pointer" />
                    {/if}
                </button>
            </div>

            {#if message}
                <div class="text-destructive text-sm text-center">{message}</div>
            {/if}

            <Button type="submit" class="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
                {$_('reset.submit')}
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
