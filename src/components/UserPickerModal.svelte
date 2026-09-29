<script lang="ts">
    import Modal from './Modal.svelte';
    import HighlightText from './HighlightText.svelte';
    import {getAdminUsers, type AdminUser} from '$lib/admin';
    import {serverUrl} from '$lib/stores';
    import {_} from 'svelte-i18n';
    import {toastError} from '$lib/utils';

    interface Props {
        open: boolean;
        onClose: () => void;
        // Full AdminUser (not the redacted public User) so the console can
        // default query/body fields like email from whoever gets picked.
        onSelect: (user: AdminUser) => void;
    }

    let {open, onClose, onSelect}: Props = $props();

    let query = $state('');
    let results: AdminUser[] = $state([]);
    let loading = $state(false);
    let searched = $state(false);
    let searchId = 0;

    $effect(() => {
        if (!open)
            return;
        const term = query.trim();
        const id = ++searchId;
        loading = true;
        const timeout = setTimeout(() => {
            getAdminUsers({username: term, limit: 20})
                .then(({response, data}) => {
                    if (id !== searchId)
                        return;
                    loading = false;
                    searched = true;
                    if (response.ok && data)
                        results = data.items;
                    else
                        toastError($_('admin.console.userPicker.error'));
                });
        }, 250);
        return () => clearTimeout(timeout);
    });

    function select(target: AdminUser) {
        onSelect(target);
        onClose();
    }
</script>

<Modal
        {open}
        title={$_('admin.console.userPicker.title')}
        description={$_('admin.console.userPicker.description')}
        {onClose}
>
    <input
            type="text"
            bind:value={query}
            placeholder={$_('admin.console.userPicker.searchPlaceholder')}
            class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
    <div class="mt-3 max-h-[50vh] overflow-y-auto flex flex-col gap-1">
        {#if loading}
            <div class="py-8 text-center text-muted-foreground">…</div>
        {:else if searched && results.length === 0}
            <div class="py-8 text-center text-muted-foreground">{$_('admin.console.userPicker.noResults')}</div>
        {:else}
            {#each results as target (target.id)}
                <button
                        type="button"
                        onclick={() => select(target)}
                        class="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-muted transition-colors hover:cursor-pointer"
                >
                    {#if target.picture}
                        <img
                                src={`${$serverUrl}/pictures/${target.picture}`}
                                alt={target.username}
                                class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                    {:else}
                        <div class="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                            {target.username.charAt(0)}
                        </div>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <p class="font-medium text-card-foreground truncate"><HighlightText text={target.username} {query} /></p>
                    </div>
                </button>
            {/each}
        {/if}
    </div>
</Modal>
