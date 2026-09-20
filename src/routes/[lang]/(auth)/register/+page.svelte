<script lang="ts">
    import Button from '../../../../components/Button.svelte';
    import Input from '../../../../components/Input.svelte';
    import Label from '../../../../components/Label.svelte';
    import PageMeta from '../../../../components/PageMeta.svelte';
    import {accessToken, refreshToken} from '$lib/stores';

    import {goto} from "$app/navigation";
    import {register, type RegisterRequest} from "$lib/auth";
    import {toastError, toastSuccess} from "$lib/utils";
    import {_, locale} from "svelte-i18n";
    import {EyeIcon, EyeOff} from "@lucide/svelte";

    let email = $state('');
    let username = $state('');
    let password = $state('');
    let confirmPassword = $state('');
    let error = $state('');
    let showPassword = $state(false)

    async function handleRegister(event: SubmitEvent) {
        event.preventDefault();
        error = '';

        if (!email || !username || !password || !confirmPassword) {
            error = $_('register.errors.field');
            return;
        }

        if (password !== confirmPassword) {
            error = $_('register.errors.passwords');
            return;
        }

        if (!/^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) {
            error = $_('register.errors.password');
            return;
        }

        // Create new user
        const newUser: RegisterRequest = {
            username,
            email,
            password
        };

        const {response, data} = await register(newUser);
        if (response.ok && data) {
            accessToken.set(data.access_token);
            refreshToken.set(data.refresh_token);
            toastSuccess($_('register.toasts.success'));
            await goto(`/${$locale}/home`)
        } else {
            toastError($_('register.toasts.error'));
        }
    }
</script>

<PageMeta title={$_('register.meta.title')} description={$_('register.meta.description')} />

<div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="max-w-md w-full space-y-8">
        <div class="text-center">
            <h2 class="text-3xl font-bold text-foreground">{$_('register.join')}</h2>
            <p class="mt-2 text-muted-foreground">{$_('register.create')}</p>
        </div>

        <form class="mt-8 space-y-6" onsubmit={handleRegister}>
            <div class="space-y-4">
                <div>
                    <Label for="email" required>{$_('register.email.label')}</Label>
                    <Input
                            id="email"
                            type="email"
                            bind:value={email}
                            placeholder={$_('register.email.placeholder')}
                    />
                </div>

                <div>
                    <Label for="username" required>{$_('register.username.label')}</Label>
                    <Input
                            id="username"
                            type="text"
                            bind:value={username}
                            placeholder={$_('register.username.placeholder')}
                    />
                </div>

                <div>
                    <Label for="password" required>{$_('register.password.label')}</Label>
                    <div class="relative">
                        <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                bind:value={password}
                                placeholder={$_('register.password.placeholder')}
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

                <div>
                    <Label for="confirmPassword" required>{$_('register.passwordConfirm.label')}</Label>
                    <div class="relative">
                        <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                bind:value={confirmPassword}
                                placeholder={$_('register.passwordConfirm.placeholder')}
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
                {$_('register.submit')}
            </Button>

            <div class="text-center">
                <p class="text-muted-foreground">
                    {$_('register.already')}
                    <Button variant="link" onclick={() => goto(`/${$locale}/login`)} class="p-0 h-auto font-medium">
                        {$_('register.signIn')}
                    </Button>
                </p>
            </div>
        </form>
    </div>
</div>
