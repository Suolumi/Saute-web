<script lang="ts">
    import {badgeTags, tags as allTags} from "$lib/tags";
    import {locale, _} from "svelte-i18n";
    import TagChip from "./TagChip.svelte";

    // fit shows as many badges as fit in the height left to this component
    // (at least one row) and a "+N" button that expands the rest inline;
    // the parent must give it that height (flex-1 in a column). Without fit,
    // every badge shows.
    let {slugs, fit = false, size = 'sm'}: {
        slugs: string[] | null | undefined, fit?: boolean, size?: 'sm' | 'md'
    } = $props();

    let expanded = $state(false);
    let box: HTMLElement | undefined = $state();
    let ghost: HTMLElement | undefined = $state();
    let ghostMore: HTMLElement | undefined = $state();
    let fitCount: number | null = $state(null);

    const shown = $derived(badgeTags(slugs, $allTags, $locale));
    const fitting = $derived(fit && !expanded);
    const visible = $derived(fitting ? shown.slice(0, fitCount ?? 0) : shown);
    const hiddenCount = $derived(shown.length - visible.length);

    // measure lays every badge out in an invisible copy and counts those whose
    // row fits in the box. When some don't, "+N" goes after the last fitting
    // badge, or takes its place when the row has no room left for it.
    function measure() {
        if (!box || !ghost || !ghostMore) return;
        const limit = box.clientHeight;
        const chips = [...ghost.children].filter(el => el !== ghostMore) as HTMLElement[];
        const firstOut = chips.findIndex(chip => chip.offsetTop + chip.offsetHeight > limit);
        if (firstOut === -1) {
            fitCount = chips.length;
            return;
        }
        const last = chips[firstOut - 1];
        const gap = parseFloat(getComputedStyle(ghost).columnGap) || 0;
        const moreFits = last && last.offsetLeft + last.offsetWidth + gap + ghostMore.offsetWidth <= ghost.clientWidth;
        fitCount = moreFits ? firstOut : Math.max(0, firstOut - 1);
    }

    $effect(() => {
        if (!fitting || !box) return;
        void shown;
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(box);
        return () => observer.disconnect();
    });

    const moreClasses = 'px-2 py-0.5 rounded-full border border-dashed border-border text-xs font-medium whitespace-nowrap';

    function expand(e: MouseEvent | KeyboardEvent) {
        e.stopPropagation();
        expanded = true;
    }
</script>

{#if shown.length > 0}
    <div bind:this={box} class={fitting ? 'relative flex-1 min-h-6' : ''}>
        {#if fitting}
            <div bind:this={ghost} class="invisible absolute inset-x-0 top-0 flex flex-wrap gap-1.5" aria-hidden="true">
                {#each shown as tag (tag.slug)}
                    <TagChip {tag} {size} />
                {/each}
                <span bind:this={ghostMore} class={moreClasses}>+{shown.length}</span>
            </div>
        {/if}
        <div class="flex flex-wrap gap-1.5 {fitting ? 'absolute inset-x-0 top-0' : ''} {fitting && fitCount === null ? 'invisible' : ''}">
            {#each visible as tag (tag.slug)}
                <TagChip {tag} {size} />
            {/each}
            {#if hiddenCount > 0}
                <button
                        type="button"
                        onclick={expand}
                        onkeydown={(e) => e.key === 'Enter' && expand(e)}
                        class="{moreClasses} text-muted-foreground hover:text-foreground hover:border-foreground/40"
                        aria-label={$_('tags.showMore', {values: {count: hiddenCount}})}
                >
                    +{hiddenCount}
                </button>
            {/if}
        </div>
    </div>
{/if}
