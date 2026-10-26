<script lang="ts">
    import {badgeTags, tagGroupColors, tagLabel, tags as allTags} from "$lib/tags";
    import {locale, _} from "svelte-i18n";

    // max caps how many badges show before a "+N" button that expands the
    // rest inline; omit it to show them all.
    let {slugs, max}: { slugs: string[] | null | undefined, max?: number } = $props();

    let expanded = $state(false);

    const shown = $derived(badgeTags(slugs, $allTags, $locale));
    const visible = $derived(max === undefined || expanded ? shown : shown.slice(0, max));
    const hiddenCount = $derived(shown.length - visible.length);

    function expand(e: MouseEvent | KeyboardEvent) {
        e.stopPropagation();
        expanded = true;
    }
</script>

{#if shown.length > 0}
    <div class="flex flex-wrap gap-1.5">
        {#each visible as tag (tag.slug)}
            <span class="{tagGroupColors[tag.group]} px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
                {tagLabel(tag, $locale)}
            </span>
        {/each}
        {#if hiddenCount > 0}
            <button
                    type="button"
                    onclick={expand}
                    onkeydown={(e) => e.key === 'Enter' && expand(e)}
                    class="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-muted text-muted-foreground hover:text-foreground"
                    aria-label={$_('tags.showMore', {values: {count: hiddenCount}})}
            >
                +{hiddenCount}
            </button>
        {/if}
    </div>
{/if}
