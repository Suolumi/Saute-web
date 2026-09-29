<script lang="ts">
    import {_} from 'svelte-i18n';
    import Button from '../../../../../components/Button.svelte';
    import Input from '../../../../../components/Input.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import HighlightText from '../../../../../components/HighlightText.svelte';
    import {
        getAdminUsers, setAdminStatus, sendPasswordReset, revokeMcpToken,
        adminDeleteUser, adminUpdateUserPicture, type AdminUser
    } from '$lib/admin';
    import {serverUrl, user as currentUser} from '$lib/stores';
    import {apiErrorMessage} from '$lib/api';
    import {toastError, toastSuccess} from '$lib/utils';
    import {Camera, Copy, Check} from '@lucide/svelte';

    const PAGE_SIZE = 20;

    let users: AdminUser[] = $state([]);
    let total = $state(0);
    let offset = $state(0);
    let search = $state('');
    let deleteModal = $state({isOpen: false, id: '', username: ''});
    let fileInputs: Record<string, HTMLInputElement> = {};
    let copiedId: string | null = $state(null);

    async function copyId(id: string) {
        await navigator.clipboard.writeText(id);
        copiedId = id;
        setTimeout(() => {
            if (copiedId === id)
                copiedId = null;
        }, 1500);
    }

    function load() {
        getAdminUsers({username: search || undefined, limit: PAGE_SIZE, offset}).then(({response, data}) => {
            if (response.ok && data) {
                users = data.items;
                total = data.length;
            } else {
                toastError($_('admin.errors.loadUsers'));
            }
        });
    }

    $effect(() => {
        load();
    });

    function search_() {
        offset = 0;
        load();
    }

    function toggleAdmin(target: AdminUser) {
        setAdminStatus(target.id, !target.admin).then(({response, data}) => {
            if (response.ok && data) {
                users = users.map(u => u.id === target.id ? data : u);
                toastSuccess($_('admin.users.statusUpdated'));
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.setAdminStatus')));
            }
        });
    }

    function doSendPasswordReset(target: AdminUser) {
        sendPasswordReset(target.id).then(({response, data}) => {
            if (response.ok)
                toastSuccess($_('admin.users.resetSent'));
            else
                toastError(apiErrorMessage(data, $_('admin.errors.sendPasswordReset')));
        });
    }

    function doRevokeMcpToken(target: AdminUser) {
        revokeMcpToken(target.id).then(({response, data}) => {
            if (response.ok)
                toastSuccess($_('admin.users.mcpRevoked'));
            else
                toastError(apiErrorMessage(data, $_('admin.errors.revokeMcpToken')));
        });
    }

    function triggerPictureUpload(id: string) {
        fileInputs[id]?.click();
    }

    function onPictureSelected(target: AdminUser, e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file)
            return;
        adminUpdateUserPicture(target.id, file).then(({response, data}) => {
            if (response.ok && data) {
                users = users.map(u => u.id === target.id ? {...u, picture: data.id} : u);
            } else {
                toastError($_('admin.errors.updatePicture'));
            }
        });
    }

    function confirmDelete() {
        adminDeleteUser(deleteModal.id).then(({response, data}) => {
            if (response.ok) {
                users = users.filter(u => u.id !== deleteModal.id);
                toastSuccess($_('admin.users.deleted'));
            } else {
                toastError(apiErrorMessage(data, $_('admin.errors.deleteUser')));
            }
        }).finally(() => {
            deleteModal = {isOpen: false, id: '', username: ''};
        });
    }
</script>

<div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 class="text-2xl font-bold text-foreground">{$_('admin.users.title')} ({total})</h1>
        <form class="ml-auto flex gap-2" onsubmit={(e) => { e.preventDefault(); search_(); }}>
            <Input type="search" bind:value={search} placeholder={$_('admin.users.searchPlaceholder')} class="w-56" />
            <Button type="submit" variant="outline">{$_('admin.users.search')}</Button>
        </form>
    </div>

    <div class="bg-card rounded-lg border border-border divide-y divide-border">
        {#each users as target (target.id)}
            <div class="flex flex-wrap items-center gap-3 p-4">
                <button type="button" onclick={() => triggerPictureUpload(target.id)} class="relative group flex-shrink-0" aria-label={$_('admin.users.changePicture')}>
                    {#if target.picture}
                        <img src={`${$serverUrl}/pictures/${target.picture}`} alt={target.username} class="w-10 h-10 rounded-full object-cover transition-colors" />
                    {:else}
                        <div class="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                            {target.username.charAt(0)}
                        </div>
                    {/if}
                    <span class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera color="white" class="w-4 h-4" />
                    </span>
                </button>
                <input
                        bind:this={fileInputs[target.id]}
                        type="file"
                        accept="image/*"
                        class="hidden"
                        onchange={(e) => onPictureSelected(target, e)}
                        aria-label={$_('admin.users.changePicture')}
                />

                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <p class="font-medium text-card-foreground truncate"><HighlightText text={target.username} query={search} /></p>
                        <span class="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0">
                            {target.id}
                            <button type="button" onclick={() => copyId(target.id)} aria-label={$_('admin.users.copyId')} class="hover:text-foreground hover:cursor-pointer">
                                {#if copiedId === target.id}
                                    <Check class="w-3 h-3" />
                                {:else}
                                    <Copy class="w-3 h-3" />
                                {/if}
                            </button>
                        </span>
                        {#if target.admin}
                            <span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">{$_('admin.users.adminBadge')}</span>
                        {/if}
                    </div>
                    <p class="text-xs text-muted-foreground truncate">{target.email}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onclick={() => toggleAdmin(target)}>
                        {target.admin ? $_('admin.users.demote') : $_('admin.users.promote')}
                    </Button>
                    <Button size="sm" variant="outline" onclick={() => doSendPasswordReset(target)}>
                        {$_('admin.users.sendReset')}
                    </Button>
                    <Button size="sm" variant="outline" onclick={() => doRevokeMcpToken(target)}>
                        {$_('admin.users.revokeMcp')}
                    </Button>
                    <Button size="sm" variant="destructive" onclick={() => deleteModal = {isOpen: true, id: target.id, username: target.username}} disabled={target.id === $currentUser?.id}>
                        {$_('admin.users.delete')}
                    </Button>
                </div>
            </div>
        {:else}
            <p class="p-4 text-muted-foreground">{$_('admin.users.none')}</p>
        {/each}
    </div>

    <div class="flex justify-center gap-3">
        <Button variant="outline" size="sm" disabled={offset === 0} onclick={() => { offset = Math.max(0, offset - PAGE_SIZE); load(); }}>
            {$_('admin.users.prev')}
        </Button>
        <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onclick={() => { offset += PAGE_SIZE; load(); }}>
            {$_('admin.users.next')}
        </Button>
    </div>
</div>

<Modal open={deleteModal.isOpen} onClose={() => deleteModal.isOpen = false} title={$_('admin.users.deleteConfirmTitle')} description={$_('admin.users.deleteConfirmDescription', {values: {username: deleteModal.username}})}>
    <div class="flex justify-between">
        <Button variant="outline" onclick={() => deleteModal.isOpen = false}>
            {$_('admin.users.cancel')}
        </Button>
        <Button variant="destructive" onclick={confirmDelete}>
            {$_('admin.users.confirmDelete')}
        </Button>
    </div>
</Modal>
