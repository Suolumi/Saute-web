<script lang="ts">
    import {groupTags, impliedBy, tagGroupAccent, tagGroupSelected, tagLabel, tags as allTags, tagsForCategory, toggleTag} from "$lib/tags";
    import {tagIcon} from "$lib/tagIcons";
    import type {RecipeCategory} from "$lib/recipes";
    import {locale, _} from "svelte-i18n";
    import {Check, Lock} from "@lucide/svelte";

    // selected is the recipe's tag slugs. Ticking a tag also ticks what it
    // implies; an implied tag stays locked until its implying tag is unticked.
    let {selected = $bindable([]), category}: { selected: string[], category: RecipeCategory } = $props();

    const groups = $derived(groupTags(tagsForCategory($allTags, category), $locale));
    const locked = $derived(impliedBy(selected, $allTags));
</script>

{#if groups.length > 0}
    <div class="space-y-3">
        {#each groups as {group, tags} (group)}
            <div>
                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">{$_('tags.groups.' + group)}</p>
                <div class="flex flex-wrap gap-2">
                    {#each tags as tag (tag.slug)}
                        {@const isSelected = selected.includes(tag.slug)}
                        {@const isLocked = isSelected && locked.has(tag.slug)}
                        {@const Icon = tagIcon(tag.icon)}
                        <button
                                type="button"
                                aria-pressed={isSelected}
                                disabled={isLocked}
                                title={isLocked ? $_('tags.lockedHint') : undefined}
                                onclick={() => selected = toggleTag(selected, tag.slug, $allTags)}
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 text-foreground transition-colors
                                    {isSelected ? tagGroupSelected[group] : 'bg-background border-border hover:bg-accent'}
                                    {isLocked ? 'opacity-70 cursor-not-allowed' : ''}"
                        >
                            {#if isLocked}
                                <Lock class="w-4 h-4 flex-none {tagGroupAccent[group]}" />
                            {:else if isSelected}
                                <Check class="w-4 h-4 flex-none {tagGroupAccent[group]}" />
                            {:else}
                                <Icon class="w-4 h-4 flex-none {tagGroupAccent[group]}" aria-hidden="true" />
                            {/if}
                            {tagLabel(tag, $locale)}
                        </button>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
{/if}
