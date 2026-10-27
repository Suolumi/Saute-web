<script lang="ts">
    import {locales} from "$lib/i18n";
    import {Check, ChevronDown} from "@lucide/svelte";
    import {goto} from "$app/navigation";
    import {locale} from "svelte-i18n";

    let open: boolean = $state(false);
    let rootRef: HTMLElement | undefined = $state();

    let current = $derived(locales.find(l => l.code === $locale) ?? locales[0]);

    function switchLocale(newLocale: string) {
        open = false;
        if (newLocale === $locale)
            return;
        const parts = window.location.pathname.split('/');
        parts[1] = newLocale;
        goto(parts.join('/') + window.location.search + window.location.hash);
    }

    function onWindowClick(e: MouseEvent) {
        if (open && rootRef && !rootRef.contains(e.target as Node))
            open = false;
    }

    function onWindowKeydown(e: KeyboardEvent) {
        if (open && e.key === 'Escape')
            open = false;
    }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="relative" bind:this={rootRef}>
    <button
            onclick={() => open = !open}
            aria-label="Select language"
            aria-haspopup="menu"
            aria-expanded={open}
            class="flex items-center gap-1 pl-2 pr-1.5 py-2 text-sm text-foreground rounded-lg hover:bg-muted hover:text-primary hover:cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
    >
        <span>{current.flag}</span>
        <span class="hidden sm:inline">{current.label}</span>
        <ChevronDown class="h-4 w-4 opacity-60 transition-transform {open ? 'rotate-180' : ''}" />
    </button>

    {#if open}
        <div role="menu" class="absolute right-0 mt-2 w-40 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
            {#each locales as l (l.code)}
                <button
                        role="menuitemradio"
                        aria-checked={l.code === current.code}
                        onclick={() => switchLocale(l.code)}
                        class="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-foreground transition-colors hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 {l.code === current.code ? 'font-semibold' : ''}"
                >
                    <span>{l.flag}</span>
                    <span class="flex-1">{l.label}</span>
                    {#if l.code === current.code}
                        <Check class="h-4 w-4 text-primary" />
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>
