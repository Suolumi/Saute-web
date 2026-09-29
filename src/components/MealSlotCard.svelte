<script lang="ts">
    import {Plus, X, ImageOff} from '@lucide/svelte';
    import {serverUrl} from '$lib/stores';
    import {pictureUrl} from '$lib/utils';
    import {_} from 'svelte-i18n';
    import type {MealPlanEntry} from '$lib/mealPlanning';

    // compact is the desktop weekly-grid cell (narrow column, vertical card);
    // the mobile day agenda uses the wider horizontal row instead. Both
    // share the same add/remove/drag-target behavior.
    interface Props {
        entry?: MealPlanEntry;
        compact?: boolean;
        servings: number;
        overridden: boolean;
        onAdd: () => void;
        onRemove: () => void;
        onEditServings: () => void;
        ondragover?: (e: DragEvent) => void;
        ondrop?: (e: DragEvent) => void;
    }

    let {entry, compact = false, servings, overridden, onAdd, onRemove, onEditServings, ondragover, ondrop}: Props = $props();
</script>

{#if entry}
    {#if compact}
        <div class="relative h-full rounded-xl border border-border bg-card p-2 flex flex-col justify-center gap-2">
            <button
                    onclick={onRemove}
                    aria-label={$_('mealPlanning.removeMeal')}
                    class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive"
            >
                <X class="w-3 h-3" />
            </button>
            <div class="w-full aspect-[4/3] rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                {#if entry.recipePicture}
                    <img src={pictureUrl($serverUrl, entry.recipePicture)} alt="" class="w-full h-full object-cover" />
                {:else}
                    <ImageOff class="w-5 h-5 text-muted-foreground" />
                {/if}
            </div>
            <div>
                <div class="text-xs font-semibold text-foreground line-clamp-2 leading-tight">{entry.recipeTitle}</div>
                <button
                        type="button"
                        onclick={onEditServings}
                        aria-label={$_('mealPlanning.editServings')}
                        class="relative mt-1 text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 inline-block hover:bg-border hover:cursor-pointer"
                >
                    {$_('mealPlanning.servings', {values: {count: servings}})}
                    {#if overridden}
                        <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary"></span>
                    {/if}
                </button>
            </div>
        </div>
    {:else}
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            <div class="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {#if entry.recipePicture}
                    <img src={pictureUrl($serverUrl, entry.recipePicture)} alt="" class="w-full h-full object-cover" />
                {:else}
                    <ImageOff class="w-6 h-6 text-muted-foreground" />
                {/if}
            </div>
            <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-foreground truncate">{entry.recipeTitle}</div>
                <button
                        type="button"
                        onclick={onEditServings}
                        aria-label={$_('mealPlanning.editServings')}
                        class="relative mt-1 text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 inline-block hover:bg-border hover:cursor-pointer"
                >
                    {$_('mealPlanning.servings', {values: {count: servings}})}
                    {#if overridden}
                        <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary"></span>
                    {/if}
                </button>
            </div>
            <button
                    onclick={onRemove}
                    aria-label={$_('mealPlanning.removeMeal')}
                    class="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
            >
                <X class="w-4 h-4" />
            </button>
        </div>
    {/if}
{:else}
    <button
            type="button"
            onclick={onAdd}
            {ondragover}
            {ondrop}
            aria-label={$_('mealPlanning.addMeal')}
            class="h-full w-full rounded-xl border-2 border-dashed border-border flex {compact ? 'flex-col gap-1 py-3' : 'flex-row gap-2 py-4'} items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary"
    >
        <Plus class={compact ? 'w-4 h-4' : 'w-4 h-4'} />
        <span class="text-xs font-semibold">{$_('mealPlanning.addRecipe')}</span>
    </button>
{/if}
