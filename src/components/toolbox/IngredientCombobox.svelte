<script lang="ts">
    import {_} from "svelte-i18n";
    import HighlightText from '../HighlightText.svelte';
    import {normalizeForMatch} from '$lib/highlight';

    // NamedItem is deliberately minimal - both ToolboxIngredient and
    // NutritionIngredient satisfy it structurally, so this one combobox is
    // reused against either list rather than rebuilt per list.
    type NamedItem = { id: string, name: string }

    let {
        ingredients,
        value = $bindable(''),
        id = '',
        placeholder = '',
        // open is optionally bindable so a caller can react to the dropdown
        // being open - e.g. reserving layout space for it only while it's
        // actually shown, rather than permanently (see NutritionFixModal.svelte).
        open = $bindable(false)
    }: {
        ingredients: NamedItem[]
        value: string
        id?: string
        placeholder?: string
        open?: boolean
    } = $props();

    let query = $state('');
    let container: HTMLDivElement | undefined = $state();

    const selected = $derived(ingredients.find(i => i.id === value));

    // Keep the visible text in sync with the selected ingredient whenever it
    // changes from outside (e.g. the list finishes loading) and the field
    // isn't mid-edit.
    $effect(() => {
        if (!open)
            query = selected?.name ?? '';
    });

    // Normalized once per ingredient list (not per keystroke) so filtering/
    // ranking on every keystroke is just map lookups.
    const normalizedNames = $derived(new Map(ingredients.map(i => [i.id, normalizeForMatch(i.name)])));

    // A starts-with match (e.g. "Oeuf" for query "oeuf") ranks above a
    // contains-elsewhere match (e.g. "Boeuf") - alphabetical order alone was
    // burying short, highly-relevant results behind longer names that merely
    // contain the query. Ties within a rank go to the shorter name, then
    // alphabetically.
    const filtered = $derived.by(() => {
        const q = query.trim();
        if (q.length === 0) return ingredients;
        const normalizedQuery = normalizeForMatch(q);
        return ingredients
            .filter(i => (normalizedNames.get(i.id) ?? '').includes(normalizedQuery))
            .sort((a, b) => {
                const tierA = (normalizedNames.get(a.id) ?? '').startsWith(normalizedQuery) ? 0 : 1;
                const tierB = (normalizedNames.get(b.id) ?? '').startsWith(normalizedQuery) ? 0 : 1;
                if (tierA !== tierB) return tierA - tierB;
                if (a.name.length !== b.name.length) return a.name.length - b.name.length;
                return a.name.localeCompare(b.name);
            });
    });

    function pick(ingredient: NamedItem) {
        value = ingredient.id;
        query = ingredient.name;
        open = false;
    }

    function onFocus() {
        open = true;
        query = '';
    }

    function onBlur(event: FocusEvent) {
        if (container && event.relatedTarget instanceof Node && container.contains(event.relatedTarget))
            return;
        open = false;
        query = selected?.name ?? '';
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            open = false;
            query = selected?.name ?? '';
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (filtered.length > 0)
                pick(filtered[0]);
        }
    }
</script>

<div class="relative" bind:this={container}>
    <input
            {id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="{id}-listbox"
            aria-autocomplete="list"
            autocomplete="off"
            placeholder={placeholder || $_('toolbox.quantity.ingredientPlaceholder')}
            bind:value={query}
            onfocus={onFocus}
            onblur={onBlur}
            onkeydown={onKeydown}
            class="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
    />
    {#if open}
        <div id="{id}-listbox" role="listbox" class="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {#if filtered.length === 0}
                <div class="px-4 py-3 text-sm text-muted-foreground">{$_('toolbox.quantity.noIngredientResults')}</div>
            {:else}
                {#each filtered as ingredient (ingredient.id)}
                    <button
                            type="button"
                            role="option"
                            aria-selected={ingredient.id === value}
                            tabindex="-1"
                            onclick={() => pick(ingredient)}
                            class="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors {ingredient.id === value ? 'bg-muted font-semibold' : ''}"
                    >
                        <HighlightText text={ingredient.name} {query} />
                    </button>
                {/each}
            {/if}
        </div>
    {/if}
</div>
