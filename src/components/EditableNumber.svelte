<script lang="ts">
    // Shows a plain number; clicking it swaps in a small numeric input for
    // direct typing, committed on blur/Enter and discarded on Escape. Used
    // by the meal-planning steppers (week default, day/meal servings) next
    // to their existing -/+ buttons.
    interface Props {
        value: number | null;
        min?: number;
        placeholder?: string;
        onSet: (value: number) => void;
        class?: string;
    }

    let {value, min = 1, placeholder = '', onSet, class: className = ''}: Props = $props();

    let editing = $state(false);
    let draft = $state('');
    let inputEl: HTMLInputElement | undefined = $state();

    function startEditing() {
        draft = value !== null ? String(value) : '';
        editing = true;
    }

    $effect(() => {
        if (editing && inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    });

    function commit() {
        const n = parseInt(draft, 10);
        if (!Number.isNaN(n) && n >= min)
            onSet(n);
        editing = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            editing = false;
        }
    }
</script>

{#if editing}
    <input
            bind:this={inputEl}
            type="number"
            {min}
            bind:value={draft}
            onblur={commit}
            onkeydown={handleKeydown}
            class="{className} bg-background border border-primary rounded outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
    />
{:else}
    <button type="button" onclick={startEditing} class="{className} hover:cursor-pointer hover:underline underline-offset-2">
        {value ?? placeholder}
    </button>
{/if}
