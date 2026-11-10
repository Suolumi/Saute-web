<script lang="ts">
    import {_} from 'svelte-i18n';
    import Button from '../../../../components/Button.svelte';
    import {getAdminStats, cleanupImages, type AdminStats} from '$lib/admin';
    import {toastApiError, toastSuccess} from '$lib/utils';

    let stats: AdminStats | null = $state(null);
    let cleaning = $state(false);

    function loadStats() {
        getAdminStats().then(({response, data}) => {
            if (response.ok && data)
                stats = data;
            else
                toastApiError($_('admin.errors.loadStats'), response, data);
        });
    }

    $effect(() => {
        loadStats();
    });

    function runCleanup() {
        cleaning = true;
        cleanupImages().then(({response, data}) => {
            if (response.ok && data) {
                const total = Object.values(data.removed).reduce((a, b) => a + b, 0);
                toastSuccess($_('admin.dashboard.cleanupSuccess', {values: {count: total}}));
            } else {
                toastApiError($_('admin.errors.cleanup'), response, data);
            }
        }).finally(() => {
            cleaning = false;
        });
    }
</script>

<div class="space-y-6">
    <h1 class="text-2xl font-bold text-foreground">{$_('admin.dashboard.title')}</h1>

    {#if stats}
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div class="bg-card rounded-lg border border-border p-4">
                <p class="text-sm text-muted-foreground">{$_('admin.dashboard.totalUsers')}</p>
                <p class="text-2xl font-semibold text-foreground">{stats.total_users}</p>
            </div>
            <div class="bg-card rounded-lg border border-border p-4">
                <p class="text-sm text-muted-foreground">{$_('admin.dashboard.totalAdmins')}</p>
                <p class="text-2xl font-semibold text-foreground">{stats.total_admins}</p>
            </div>
            <div class="bg-card rounded-lg border border-border p-4">
                <p class="text-sm text-muted-foreground">{$_('admin.dashboard.totalRecipes')}</p>
                <p class="text-2xl font-semibold text-foreground">{stats.total_recipes}</p>
            </div>
        </div>
        {#if Object.keys(stats.recipes_by_category).length > 0}
            <div class="bg-card rounded-lg border border-border p-4">
                <p class="text-sm font-medium text-foreground mb-2">{$_('admin.dashboard.byCategory')}</p>
                <div class="flex gap-4 text-sm text-muted-foreground">
                    {#each Object.entries(stats.recipes_by_category) as [category, count] (category)}
                        <span>{category}: {count}</span>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}

    <div class="bg-card rounded-lg border border-border p-6">
        <h2 class="text-lg font-semibold text-foreground mb-2">{$_('admin.dashboard.maintenance')}</h2>
        <p class="text-sm text-muted-foreground mb-4">{$_('admin.dashboard.cleanupDescription')}</p>
        <Button onclick={runCleanup} disabled={cleaning}>
            {cleaning ? $_('admin.dashboard.cleanupRunning') : $_('admin.dashboard.cleanupButton')}
        </Button>
    </div>
</div>
