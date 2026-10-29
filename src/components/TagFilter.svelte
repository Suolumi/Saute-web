<script lang="ts">
    import {groupTags, tagGroupAccent, tagGroupSelected, tagLabel, tags as allTags, tagsForCategory} from "$lib/tags";
    import {tagIcon} from "$lib/tagIcons";
    import type {RecipeCategory} from "$lib/recipes";
    import {locale, _} from "svelte-i18n";

    // selected are filter tags: a recipe must carry all of them. Unlike
    // TagPicker, implications aren't applied here - recipes store them
    // expanded, so filtering on "vegetarian" already includes vegan recipes.
    let {selected = $bindable([]), category}: { selected: string[], category: RecipeCategory } = $props();

    const groups = $derived(groupTags(tagsForCategory($allTags, category), $locale));

    function toggle(slug: string) {
        selected = selected.includes(slug) ? selected.filter(s => s !== slug) : [...selected, slug];
    }
</script>

<div class="flex flex-col gap-3">
    {#each groups as {group, tags} (group)}
        <div>
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">{$_('tags.groups.' + group)}</p>
            <div class="flex flex-wrap gap-2">
                {#each tags as tag (tag.slug)}
                    {@const isSelected = selected.includes(tag.slug)}
                    {@const Icon = tagIcon(tag.icon)}
                    <button
                            type="button"
                            aria-pressed={isSelected}
                            onclick={() => toggle(tag.slug)}
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 text-foreground transition-colors
                                {isSelected ? tagGroupSelected[group] : 'bg-background border-border hover:bg-accent'}"
                    >
                        <Icon class="w-4 h-4 flex-none {tagGroupAccent[group]}" aria-hidden="true" />
                        {tagLabel(tag, $locale)}
                    </button>
                {/each}
            </div>
        </div>
    {/each}
</div>
