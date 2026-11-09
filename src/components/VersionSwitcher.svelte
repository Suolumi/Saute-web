<script lang="ts">
    import type {RecipePreview} from "$lib/recipes";
    import {_, locale} from "svelte-i18n";
    import {Plus} from "@lucide/svelte";

    // versions are every member of the family, rendered in the given order.
    // onAdd, when given, adds a trailing "Add yours" chip that starts a new
    // version of the family.
    let {versions, currentId, onAdd}: {
        versions: RecipePreview[],
        currentId: string,
        onAdd?: () => void,
    } = $props();

    const chipClass = 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors';
</script>

<div class="flex flex-wrap items-center gap-2 mb-4">
    <span class="text-sm text-muted-foreground mr-1">{$_('recipe.versions.label')}</span>
    {#each versions as version (version.id)}
        {@const current = version.id === currentId}
        <a
                href={`/${$locale}/recipes/${version.id}`}
                aria-current={current ? 'page' : undefined}
                class="{chipClass} {current ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'}"
        >
            {`${version.title} · ${version.author?.username ?? ''}`}
        </a>
    {/each}
    {#if onAdd}
        <button
                type="button"
                onclick={onAdd}
                class="{chipClass} inline-flex items-center gap-1 border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary hover:cursor-pointer"
        >
            <Plus size="14" />
            {$_('recipe.versions.add')}
        </button>
    {/if}
</div>
