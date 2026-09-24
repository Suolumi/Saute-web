<script lang="ts">
    import Modal from './Modal.svelte';
    import Button from './Button.svelte';
    import {getAdminRecipeFavorites, type RecipeFavoriter} from '$lib/admin';
    import {serverUrl} from '$lib/stores';
    import {_} from 'svelte-i18n';
    import {toastError} from '$lib/utils';

    const PAGE_SIZE = 20;

    interface Props {
        open: boolean;
        onClose: () => void;
        recipeId: string;
        recipeTitle: string;
    }

    let {open, onClose, recipeId, recipeTitle}: Props = $props();

    let users: RecipeFavoriter[] = $state([]);
    let total = $state(0);
    let offset = $state(0);
    let loading = $state(false);

    function load() {
        loading = true;
        getAdminRecipeFavorites(recipeId, {limit: PAGE_SIZE, offset})
            .then(({response, data}) => {
                loading = false;
                if (response.ok && data) {
                    users = data.items;
                    total = data.length;
                } else {
                    toastError($_('admin.favoritesModal.loadError'));
                }
            });
    }

    $effect(() => {
        if (open) {
            offset = 0;
            load();
        }
    });
</script>

<Modal
        {open}
        title={$_('admin.favoritesModal.title')}
        description={$_('admin.favoritesModal.description', {values: {title: recipeTitle}})}
        {onClose}
>
    <div class="min-h-[8rem] flex flex-col gap-1">
        {#if loading}
            <div class="py-8 text-center text-muted-foreground">…</div>
        {:else if users.length === 0}
            <div class="py-8 text-center text-muted-foreground">{$_('admin.favoritesModal.none')}</div>
        {:else}
            {#each users as user (user.id)}
                <div class="flex items-center gap-3 rounded-lg p-2">
                    {#if user.picture}
                        <img
                                src={`${$serverUrl}/pictures/${user.picture}`}
                                alt={user.username}
                                class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                    {:else}
                        <div class="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                            {user.username.charAt(0)}
                        </div>
                    {/if}
                    <p class="font-medium text-card-foreground truncate">{user.username}</p>
                </div>
            {/each}
        {/if}
    </div>

    {#if total > PAGE_SIZE}
        <div class="flex justify-center gap-3 pt-3">
            <Button variant="outline" size="sm" disabled={offset === 0} onclick={() => { offset = Math.max(0, offset - PAGE_SIZE); load(); }}>
                {$_('admin.favoritesModal.prev')}
            </Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onclick={() => { offset += PAGE_SIZE; load(); }}>
                {$_('admin.favoritesModal.next')}
            </Button>
        </div>
    {/if}
</Modal>
