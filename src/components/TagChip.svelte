<script lang="ts">
    import {tagGroupAccent, tagLabel, type RecipeTag} from "$lib/tags";
    import {tagIcon} from "$lib/tagIcons";
    import {locale} from "svelte-i18n";

    let {tag, size = 'sm'}: { tag: RecipeTag, size?: 'sm' | 'md' } = $props();

    const Icon = $derived(tagIcon(tag.icon));
</script>

<span class="inline-flex items-center gap-1 rounded-full border border-border bg-background font-medium text-foreground whitespace-nowrap
        {size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'}">
    <Icon class="{tagGroupAccent[tag.group]} {size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} flex-none" aria-hidden="true" />
    {tagLabel(tag, $locale)}
</span>
