<script lang="ts">
    import {accessToken, user} from '$lib/stores';
    import {_, locale} from 'svelte-i18n';
    import {page} from '$app/stores';
    import {goto} from '$app/navigation';
    // pendingTranslationSuggestionCount is polled globally by Header.svelte
    // (mounted on every page, so an admin sees the badge site-wide, not just
    // inside /admin) - this layout just reads the same store, no second poll.
    import {pendingTranslationSuggestionCount} from '$lib/admin';

    let { children } = $props();

    // A fresh page load with a token but no $user yet is still resolving
    // getSelf() (see the root layout's afterNavigate) - wait rather than
    // flashing "not authorized" before we actually know.
    let loading = $derived(!!$accessToken && $accessToken !== '' && !$user);

    const tabs = [
        ['admin.nav.dashboard', ''],
        ['admin.nav.users', '/users'],
        ['admin.nav.recipes', '/recipes'],
        ['admin.nav.diy', '/diy'],
        ['admin.nav.translations', '/translations'],
        ['admin.nav.console', '/console'],
    ] as const;

    function tabHref(suffix: string) {
        return `/${$locale}/admin${suffix}`;
    }
    function isActive(suffix: string) {
        return $page.url.pathname === tabHref(suffix);
    }
</script>

{#if loading}
    <div class="flex justify-center py-24 text-muted-foreground">…</div>
{:else if !$user || !$user.admin}
    <div class="max-w-md mx-auto px-4 py-24 text-center">
        <h1 class="text-2xl font-bold text-foreground mb-2">{$_('admin.unauthorized.title')}</h1>
        <p class="text-muted-foreground">{$_('admin.unauthorized.description')}</p>
    </div>
{:else}
    <div class="max-w-6xl mx-auto px-4 py-6">
        <nav class="flex gap-2 mb-6 border-b border-border">
            {#each tabs as [key, suffix] (suffix)}
                <button
                        type="button"
                        onclick={() => goto(tabHref(suffix))}
                        class="px-3 py-2 text-sm font-medium border-b-2 transition-colors hover:cursor-pointer flex items-center gap-1.5 {isActive(suffix) ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
                >
                    {$_(key)}
                    {#if suffix === '/translations' && $pendingTranslationSuggestionCount > 0}
                        <span
                                class="bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none"
                                title={$_('admin.translations.pendingBadge', {values: {count: $pendingTranslationSuggestionCount}})}
                        >
                            {$pendingTranslationSuggestionCount}
                        </span>
                    {/if}
                </button>
            {/each}
        </nav>
        {@render children?.()}
    </div>
{/if}
