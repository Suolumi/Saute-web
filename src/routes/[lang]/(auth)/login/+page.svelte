<script lang="ts">
    import Button from '../../../../components/Button.svelte';
    import Input from '../../../../components/Input.svelte';
    import Label from '../../../../components/Label.svelte';
    import PageMeta from '../../../../components/PageMeta.svelte';
    import {goto} from "$app/navigation";
    import {login, type LoginRequest} from "$lib/auth";
    import {accessToken, refreshToken} from "$lib/stores";
    import {toastError, toastSuccess} from "$lib/utils";
    import {locale, _} from "svelte-i18n";
    import {EyeIcon, EyeOff} from "@lucide/svelte";

    let id = $state('');
    let password = $state('');
    let error = $state('');
    let showPassword = $state(false)

    async function handleLogin(event: SubmitEvent) {
        event.preventDefault();
        error = '';

        if (!id || !password) {
            error = $_('login.errors.field');
            return;
        }

        const request: LoginRequest = {
            id,
            password
        }
        const {response, data} = await login(request);
        if (response.ok && data) {
            accessToken.set(data.access_token);
            refreshToken.set(data.refresh_token);
            toastSuccess($_('login.toasts.success'));
            await goto(`/${$locale}/home`)
        } else
            toastError($_('login.toasts.error'));
    }

    function goToRegister() {
        goto(`/${$locale}/register`);
    }
</script>

<PageMeta title={$_('login.meta.title')} description={$_('login.meta.description')} />

<div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="max-w-md w-full space-y-8">
        <div class="text-center">
            <h2 class="text-3xl font-bold text-foreground">{$_('login.signIn')}</h2>
            <p class="mt-2 text-muted-foreground">{$_('login.welcome')}</p>
        </div>

        <form class="mt-8 space-y-6" onsubmit={handleLogin}>
            <div class="space-y-4">
                <div>
                    <Label for="id" required>{$_('login.id.label')}</Label>
                    <Input
                            id="id"
                            type="text"
                            bind:value={id}
                            placeholder={$_('login.id.placeholder')}
                    />
                </div>

                <div>
                    <Label for="password" required>{$_('login.password.label')}</Label>
                    <div class="relative">
                        <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                bind:value={password}
                                placeholder={$_('login.password.placeholder')}
                        />
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
                </div>
            </div>

            {#if error}
                <div class="text-destructive text-sm text-center">{error}</div>
            {/if}

            <Button type="submit" class="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
                {$_('login.submit')}
            </Button>

            <div class="text-center">
                <Button variant="link" onclick={() => goto(`/${$locale}/forgot-password`)} class="p-0 h-auto text-sm text-muted-foreground hover:text-foreground">
                    {$_('login.forgotPassword')}
                </Button>
            </div>

            <div class="text-center">
                <p class="text-muted-foreground">
                    {$_('login.noAccount')}
                    <Button variant="link" onclick={goToRegister} class="p-0 h-auto font-medium">
                        {$_('login.signUp')}
                    </Button>
                </p>
            </div>
        </form>
    </div>
</div>
