<script lang="ts">
    import {Minus, Plus} from '@lucide/svelte';
    import {_} from 'svelte-i18n';
    import Modal from './Modal.svelte';
    import EditableNumber from './EditableNumber.svelte';

    // Shared by the day-level and meal-level servings editors on the meal
    // planning page - both are just "a number, a -/+ stepper, and an
    // optional link back to whatever this would otherwise inherit from".
    interface Props {
        open: boolean;
        title: string;
        value: number;
        onIncrease: () => void;
        onDecrease: () => void;
        onSet: (value: number) => void;
        onClose: () => void;
        resetLabel?: string;
        onReset?: () => void;
    }

    let {open, title, value, onIncrease, onDecrease, onSet, onClose, resetLabel, onReset}: Props = $props();
</script>

<Modal {open} {title} {onClose}>
    <div class="flex flex-col items-center gap-4 py-2">
        <div class="flex items-center gap-4">
            <button
                    type="button"
                    onclick={onDecrease}
                    disabled={value <= 1}
                    class="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed hover:cursor-pointer"
                    aria-label={$_('recipe.decreaseServings')}
            >
                <Minus class="w-4 h-4" />
            </button>
            <EditableNumber {value} onSet={onSet} class="text-2xl font-bold text-card-foreground w-14 text-center" />
            <button
                    type="button"
                    onclick={onIncrease}
                    class="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted hover:cursor-pointer"
                    aria-label={$_('recipe.increaseServings')}
            >
                <Plus class="w-4 h-4" />
            </button>
        </div>
        {#if resetLabel && onReset}
            <button type="button" onclick={onReset} class="text-sm text-primary hover:underline hover:cursor-pointer">
                {resetLabel}
            </button>
        {/if}
    </div>
</Modal>
