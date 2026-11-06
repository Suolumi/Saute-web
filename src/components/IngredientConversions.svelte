<script lang="ts">
    import type {Snippet} from "svelte";

    // lines are the ingredient's quantity in other units; with none, the
    // label renders as plain text.
    let {lines, children}: {lines: string[], children: Snippet} = $props();

    let open = $state(false);
    let root: HTMLElement | undefined = $state();

    $effect(() => {
        if (!open)
            return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape')
                open = false;
        }
        function onClick(e: MouseEvent) {
            if (root && !root.contains(e.target as Node))
                open = false;
        }
        document.addEventListener('keydown', onKey);
        document.addEventListener('click', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('click', onClick);
        };
    });
</script>

{#if lines.length === 0}
    <span class="text-card-foreground">{@render children()}</span>
{:else}
    <span class="relative inline-block" bind:this={root}>
        <button
                type="button"
                aria-expanded={open}
                onclick={() => open = !open}
                class="text-left text-card-foreground underline decoration-dotted decoration-muted-foreground underline-offset-4 hover:cursor-pointer"
        >
            {@render children()}
        </button>
        {#if open}
            <span class="absolute left-0 top-full mt-1 z-10 flex flex-col gap-0.5 whitespace-nowrap bg-card border border-border rounded-lg shadow-md p-3 text-sm text-card-foreground">
                {#each lines as line}
                    <span>{line}</span>
                {/each}
            </span>
        {/if}
    </span>
{/if}
