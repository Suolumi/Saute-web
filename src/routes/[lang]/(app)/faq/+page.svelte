<script lang="ts">
    import PageMeta from "../../../../components/PageMeta.svelte";
    import { _ } from "svelte-i18n";
    import { ChevronDown, GitBranch, Link, Camera, Hammer, Image, Heart, Link2, Sparkles } from "@lucide/svelte";
    import type { Component } from "svelte";

    const items: { key: string; icon: Component }[] = [
        { key: "variations", icon: GitBranch },
        { key: "recipeRef", icon: Link },
        { key: "photos", icon: Camera },
        { key: "diy", icon: Hammer },
        { key: "stepPhotos", icon: Image },
        { key: "favorites", icon: Heart },
        { key: "linkVariation", icon: Link2 },
        { key: "mcp", icon: Sparkles },
    ];

    let openKeys: Set<string> = $state(new Set());

    function toggle(key: string): void {
        const next = new Set(openKeys);
        if (next.has(key))
            next.delete(key);
        else
            next.add(key);
        openKeys = next;
    }
</script>

<PageMeta title={$_('faq.meta.title')} description={$_('faq.meta.description')} />

<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold text-foreground mb-2 text-balance">{$_('faq.headLabel')}</h1>
        <p class="text-lg text-muted-foreground text-pretty">{$_('faq.commentLabel')}</p>
    </div>

    <div class="flex flex-col gap-3">
        {#each items as item (item.key)}
            {@const Icon = item.icon}
            {@const isOpen = openKeys.has(item.key)}
            <div class="bg-card rounded-lg border border-border overflow-hidden">
                <button
                        type="button"
                        onclick={() => toggle(item.key)}
                        aria-expanded={isOpen}
                        class="w-full flex items-center gap-3 px-4 sm:px-6 py-4 text-left hover:cursor-pointer hover:bg-muted transition-colors"
                >
                    <Icon class="w-5 h-5 text-primary shrink-0" />
                    <span class="flex-1 font-semibold text-card-foreground">{$_(`faq.items.${item.key}.question`)}</span>
                    <ChevronDown class="w-5 h-5 text-muted-foreground shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}" />
                </button>
                {#if isOpen}
                    <div class="px-4 sm:px-6 pb-4 pl-12 sm:pl-15">
                        <p class="text-foreground leading-relaxed text-pretty">{$_(`faq.items.${item.key}.answer`)}</p>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>
