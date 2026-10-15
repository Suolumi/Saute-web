<script lang="ts">
    import {Info} from '@lucide/svelte';

    interface Props {
        text: string;
        label: string;
        align?: 'start' | 'end';
    }

    let {text, label, align = 'end'}: Props = $props();

    const id = $props.id();
    let open = $state(false);
    // Opened by click/tap: stays open when the mouse leaves.
    let pinned = $state(false);
    let root: HTMLElement;

    function close() {
        open = false;
        pinned = false;
    }
</script>

<svelte:document
        onpointerdown={(e) => { if (open && !root.contains(e.target as Node)) close(); }}
        onkeydown={(e) => { if (open && e.key === 'Escape') close(); }}
/>

<span bind:this={root} class="relative inline-flex">
    <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            aria-describedby={open ? id : undefined}
            onclick={() => { pinned = !pinned; open = pinned; }}
            onpointerenter={(e) => { if (e.pointerType === 'mouse') open = true; }}
            onpointerleave={(e) => { if (e.pointerType === 'mouse' && !pinned) open = false; }}
            class="flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
    >
        <Info class="w-4 h-4" />
    </button>
    {#if open}
        <span
                {id}
                role="tooltip"
                class="absolute top-full mt-2 z-20 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 text-xs font-normal text-popover-foreground shadow-md {align === 'end' ? 'right-0' : 'left-0'}"
        >
            {text}
        </span>
    {/if}
</span>
