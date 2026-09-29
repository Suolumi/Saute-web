<script lang="ts">
    import PageMeta from "../../../../components/PageMeta.svelte";
    import { _ } from "svelte-i18n";
    import { GitBranch, Link, Camera, Hammer, Image, Heart, Link2, Sparkles, ChefHat, Share2, ShoppingCart, Pencil, Flame, Timer, CalendarDays, Calculator } from "@lucide/svelte";
    import type { Component } from "svelte";

    const sections: { key: string; items: { key: string; icon: Component }[] }[] = [
        {
            key: "discover",
            items: [
                { key: "favorites", icon: Heart },
                { key: "diy", icon: Hammer },
            ],
        },
        {
            key: "cooking",
            items: [
                { key: "cookMode", icon: ChefHat },
                { key: "recipeTimers", icon: Timer },
            ],
        },
        {
            key: "creating",
            items: [
                { key: "variations", icon: GitBranch },
                { key: "linkVariation", icon: Link2 },
                { key: "recipeRef", icon: Link },
                { key: "photos", icon: Camera },
                { key: "stepPhotos", icon: Image },
                { key: "nutrition", icon: Flame },
            ],
        },
        {
            key: "planning",
            items: [
                { key: "shoppingList", icon: ShoppingCart },
                { key: "mealPlanning", icon: CalendarDays },
                { key: "toolbox", icon: Calculator },
            ],
        },
        {
            key: "sharing",
            items: [
                { key: "share", icon: Share2 },
                { key: "translationFix", icon: Pencil },
            ],
        },
        {
            key: "integrations",
            items: [
                { key: "mcp", icon: Sparkles },
            ],
        },
    ];
</script>

<PageMeta title={$_('about.meta.title')} description={$_('about.meta.description')} />

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold text-foreground mb-2 text-balance">{$_('about.headLabel')}</h1>
        <p class="text-lg text-muted-foreground text-pretty">{$_('about.commentLabel')}</p>
    </div>

    <div class="space-y-10">
        {#each sections as section (section.key)}
            <section>
                <h2 class="text-xl font-semibold text-foreground mb-4">{$_(`about.sections.${section.key}.title`)}</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {#each section.items as item (item.key)}
                        {@const Icon = item.icon}
                        <div class="bg-card rounded-lg border border-border p-4 sm:p-6 flex gap-3">
                            <Icon class="w-5 h-5 text-primary shrink-0 mt-1" />
                            <div>
                                <h3 class="font-semibold text-card-foreground mb-1">{$_(`about.items.${item.key}.title`)}</h3>
                                <p class="text-sm text-muted-foreground leading-relaxed text-pretty">{$_(`about.items.${item.key}.description`)}</p>
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        {/each}
    </div>
</div>
