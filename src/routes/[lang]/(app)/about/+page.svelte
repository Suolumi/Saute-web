<script lang="ts">
    import PageMeta from "../../../../components/PageMeta.svelte";
    import { _ } from "svelte-i18n";
    import { GitBranch, Link, Camera, Hammer, Image, Heart, Link2, Sparkles, ChefHat, Share2, ShoppingCart, Pencil } from "@lucide/svelte";
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
        { key: "cookMode", icon: ChefHat },
        { key: "share", icon: Share2 },
        { key: "shoppingList", icon: ShoppingCart },
        { key: "translationFix", icon: Pencil },
    ];
</script>

<PageMeta title={$_('about.meta.title')} description={$_('about.meta.description')} />

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold text-foreground mb-2 text-balance">{$_('about.headLabel')}</h1>
        <p class="text-lg text-muted-foreground text-pretty">{$_('about.commentLabel')}</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {#each items as item (item.key)}
            {@const Icon = item.icon}
            <div class="bg-card rounded-lg border border-border p-4 sm:p-6 flex gap-3">
                <Icon class="w-5 h-5 text-primary shrink-0 mt-1" />
                <div>
                    <h2 class="font-semibold text-card-foreground mb-1">{$_(`about.items.${item.key}.title`)}</h2>
                    <p class="text-sm text-muted-foreground leading-relaxed text-pretty">{$_(`about.items.${item.key}.description`)}</p>
                </div>
            </div>
        {/each}
    </div>
</div>
