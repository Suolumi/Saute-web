<script lang="ts">
    import Button from '../../../../components/Button.svelte';
    import Input from '../../../../components/Input.svelte';
    import Label from '../../../../components/Label.svelte';
    import PageMeta from '../../../../components/PageMeta.svelte';
    import {page} from '$app/stores';
    import {goto} from '$app/navigation';
    import {serverUrl, user} from "$lib/stores";
    import {updateSelf, updateUserPicture, type UserSettingsForm} from "$lib/user";
    import {toastError} from "$lib/utils";
    import {locale, _} from "svelte-i18n";
    import {Camera} from '@lucide/svelte';

    let { children } = $props();

    let userForm: UserSettingsForm = $state({
        username: $user?.username ?? '',
        email: $user?.email ?? '',
        password: '',
    })

    let fileInput = $state<HTMLInputElement>();

    // My Favorites has its own Recipes/DIY sub-tabs (settings/favorites/+layout.svelte)
    // - isActive treats the whole /settings/favorites/** subtree as that one tab.
    const tabs = [
        ['settings.tabs.myRecipes', ''],
        ['settings.tabs.myFavorites', '/favorites/recipes'],
    ] as const;

    function tabHref(suffix: string) {
        return `/${$locale}/settings${suffix}`;
    }
    function isActive(suffix: string) {
        if (suffix === '')
            return $page.url.pathname === tabHref('');
        return $page.url.pathname.startsWith(`/${$locale}/settings/favorites`);
    }

    $effect(() => {
        if ($user)
            userForm = {
                username: $user.username ?? '',
                email: $user.email ?? '',
                password: ''
            }
    })

    function updateProfile(event: Event) {
        event.preventDefault();
        updateSelf(userForm).then(({response, data}) => {
            if (response.ok && data)
                user.set(data)
            else
                toastError($_('settings.errors.update'));
        })
    }

    function triggerFileInput() {
        fileInput?.click();
    }

    async function updatePicture(e: Event) {
        const target = e.target as HTMLInputElement;
        let file;
        if (target.files && target.files.length > 0) {
            file = target.files[0];
        }
        if (!file)
            return;
        const {data} = await updateUserPicture(file)
        if (data && $user) {
            $user.picture = data.id
        }
    }
</script>

<PageMeta title={$_('settings.meta.title')} description={$_('settings.meta.description')} />

<div class="max-w-5xl mx-auto px-4 py-8">
    <div class="mb-8">
        <div class="flex items-center gap-x-4">
            <button
                    type="button"
                    onclick={triggerFileInput}
                    class="relative group cursor-pointer"
                    aria-label="Upload profile picture"
            >
                {#if $user && $user.picture}
                    <img
                            src={`${$serverUrl}/pictures/${$user.picture}` || "/placeholder.svg"}
                            alt="{$user.username} profile"
                            class="w-24 h-24 rounded-full object-cover transition-colors"
                    />
                {:else}
                    <div class="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-4xl font-medium">
                        {($user?.username ?? '?').charAt(0)}
                    </div>
                {/if}

                <!-- Upload overlay on hover -->
                <span class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera color="white" />
                </span>
            </button>
            <input
                    bind:this={fileInput}
                    type="file"
                    accept="image/*"
                    onchange={e => updatePicture(e)}
                    class="hidden"
                    aria-label="Profile picture file input"
            />
            <div>
                <h1 class="text-3xl font-bold text-foreground mb-2">{$user?.username ?? 'No username??'}</h1>
                <p class="text-muted-foreground">{$user?.email ?? 'No email'}</p>
            </div>
        </div>
    </div>

    <!-- Profile Settings -->
    <div class="bg-card rounded-lg border border-border p-6 mb-8">
        <h2 class="text-xl font-semibold text-card-foreground mb-4">{$_('settings.info')}</h2>

        <form class="space-y-4" onsubmit={updateProfile}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label for="username" required>{$_('settings.username.label')}</Label>
                    <Input
                            id="username"
                            type="text"
                            bind:value={userForm.username}
                            required
                            placeholder={$_('settings.username.placeholder')}
                    />
                </div>
                <div>
                    <Label for="email" required>{$_('settings.email.label')}</Label>
                    <Input
                            id="email"
                            type="email"
                            bind:value={userForm.email}
                            required
                            placeholder={$_('settings.email.placeholder')}
                    />
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Label for="email" required>{$_('settings.password.label')}</Label>
                <Input
                        id="password"
                        type="password"
                        bind:value={userForm.password}
                        required
                        placeholder={$_('settings.password.placeholder')}
                />
            </div>
            <Button type="submit">
                {$_('settings.submit')}
            </Button>
        </form>
    </div>

    <nav class="flex gap-2 mb-6 border-b border-border">
        {#each tabs as [key, suffix] (suffix)}
            <button
                    type="button"
                    onclick={() => goto(tabHref(suffix))}
                    class="px-3 py-2 text-sm font-medium border-b-2 transition-colors hover:cursor-pointer {isActive(suffix) ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
            >
                {$_(key)}
            </button>
        {/each}
    </nav>

    {@render children?.()}
</div>
