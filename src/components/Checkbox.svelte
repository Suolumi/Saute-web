<script lang="ts">
    import {Check} from '@lucide/svelte';

    interface Props {
        checked: boolean;
        disabled?: boolean;
        onchange?: (checked: boolean) => void;
        // decorative renders a plain, inert <span> instead of a <button> -
        // use when this is embedded inside another clickable element (e.g.
        // a row that's already a <button>) so interactive elements don't
        // nest; the wrapping element is then responsible for toggling.
        decorative?: boolean;
        ariaLabel?: string;
        class?: string;
    }

    let {checked = false, disabled = false, onchange, decorative = false, ariaLabel, class: className = ''}: Props = $props();

    function toggle() {
        if (disabled)
            return;
        onchange?.(!checked);
    }

    const boxClasses = $derived(
        `inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 shrink-0 ${
            checked ? 'bg-primary border-primary' : 'bg-background border-border'
        } ${className}`
    );
</script>

{#if decorative}
    <span class={boxClasses} aria-hidden="true">
        {#if checked}
            <Check class="w-3.5 h-3.5 text-primary-foreground checkbox-pop" />
        {/if}
    </span>
{:else}
    <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={ariaLabel}
            {disabled}
            onclick={toggle}
            class="{boxClasses} {disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/60 hover:cursor-pointer'}"
    >
        {#if checked}
            <Check class="w-3.5 h-3.5 text-primary-foreground checkbox-pop" />
        {/if}
    </button>
{/if}

<style>
    @keyframes checkbox-pop {
        0% { transform: scale(0); opacity: 0; }
        55% { transform: scale(1.25); opacity: 1; }
        100% { transform: scale(1); }
    }
    :global(.checkbox-pop) {
        animation: checkbox-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
</style>
