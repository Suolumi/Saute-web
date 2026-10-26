<script lang="ts">
    import {groupTags, tagGroupColors, tagLabel, tags as allTags, tagsForCategory} from "$lib/tags";
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
                    <button
                            type="button"
                            aria-pressed={isSelected}
                            onclick={() => toggle(tag.slug)}
                            class="px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors
                                {isSelected ? tagGroupColors[group] + ' border-current' : 'bg-background text-foreground border-border hover:bg-accent'}"
                    >
                        {tagLabel(tag, $locale)}
                    </button>
                {/each}
            </div>
        </div>
    {/each}
</div>
