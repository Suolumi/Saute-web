<script lang="ts" module>
    // Shared across instances so nested modals only restore body scroll when the last one closes.
    let openCount = 0;
    let previousOverflow = '';
</script>

<script lang="ts">
    import type {Snippet} from 'svelte';

    interface Props {
        open?: boolean;
        title?: string;
        description?: string;
        closeOnBackdrop?: boolean;
        showCloseButton?: boolean;
        onClose?: () => void;
        children: Snippet;
        footer?: Snippet;
        class?: string;
        style?: string;
    }

    let {
        open = false,
        title = '',
        description = '',
        closeOnBackdrop = true,
        showCloseButton = true,
        onClose = () => {},
        children,
        footer,
        class: className = '',
        style = ''
    }: Props = $props();

    $effect(() => {
        if (!open)
            return;
        if (openCount++ === 0) {
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        return () => {
            if (--openCount === 0)
                document.body.style.overflow = previousOverflow;
        };
    });

    function handleBackdropClick(event: MouseEvent): void {
        if (!closeOnBackdrop) {
            return;
        }

        if (event.target === event.currentTarget) {
            onClose();
        }
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (open && event.key === 'Escape') {
            onClose();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onclick={handleBackdropClick}
            role="presentation"
    >
        <div
                class="w-full max-w-lg max-h-[calc(100dvh-2rem)] rounded-lg border border-border bg-card text-card-foreground shadow-xl flex flex-col overflow-hidden {className}"
                {style}
                role="dialog"
                aria-modal="true"
                aria-label={title || 'Modal'}
        >
            <div class="flex items-start justify-between border-b border-border px-6 py-4 flex-shrink-0">
                <div>
                    {#if title}
                        <h2 class="text-xl font-semibold text-card-foreground">{title}</h2>
                    {/if}
                    {#if description}
                        <p class="mt-1 text-sm text-muted-foreground">{description}</p>
                    {/if}
                </div>
                {#if showCloseButton}
                    <button
                            type="button"
                            onclick={onClose}
                            class="rounded-lg p-2 text-muted-foreground transition-colors hover:cursor-pointer hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            aria-label="Close modal"
                    >
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                {/if}
            </div>

            <div class="px-6 py-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {@render children()}
            </div>

            {#if footer}
                <div class="flex justify-end gap-2 border-t border-border px-6 py-4 flex-shrink-0">
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
{/if}
