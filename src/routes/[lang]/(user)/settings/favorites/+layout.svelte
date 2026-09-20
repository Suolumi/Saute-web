<script lang="ts">
    import {page} from '$app/stores';
    import {goto} from '$app/navigation';
    import {locale, _} from 'svelte-i18n';

    let { children } = $props();

    const tabs = [
        ['settings.favoritesTabs.recipes', '/recipes'],
        ['settings.favoritesTabs.diy', '/diy'],
    ] as const;

    function tabHref(suffix: string) {
        return `/${$locale}/settings/favorites${suffix}`;
    }
    function isActive(suffix: string) {
        return $page.url.pathname === tabHref(suffix);
    }
</script>

<div class="inline-flex rounded-lg border border-border p-1 mb-6">
    {#each tabs as [key, suffix] (suffix)}
        <button
                type="button"
                onclick={() => goto(tabHref(suffix))}
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:cursor-pointer {isActive(suffix) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        >
            {$_(key)}
        </button>
    {/each}
</div>

{@render children?.()}
