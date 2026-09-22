<script lang="ts">
    import Modal from './Modal.svelte';
    import Button from './Button.svelte';
    import {getRecipes, type RecipeCategory, type RecipePreview} from '$lib/recipes';
    import {goto} from '$app/navigation';
    import {locale, _} from 'svelte-i18n';
    import {X} from '@lucide/svelte';

    interface Props {
        // title/category mirror the same-named fields on the recipe being
        // created - the search re-runs whenever either changes.
        title: string;
        category: RecipeCategory;
        // hasOtherContent is true once the draft has anything beyond a bare
        // title (description, a real ingredient/step, or a staged photo) -
        // clicking a match then confirms before navigating away, since that
        // navigation discards the draft (see confirmMatch below).
        hasOtherContent: boolean;
    }

    let {title, category, hasOtherContent}: Props = $props();

    let matches: RecipePreview[] = $state([]);
    // dismissedKey remembers which exact match set was last dismissed, so
    // dismissing doesn't reappear on every keystroke - only once a
    // different match set comes back.
    let dismissedKey: string | null = $state(null);
    let confirmMatch: RecipePreview | null = $state(null);
    let searchId = 0;

    const matchKey = $derived(matches.map(m => m.id).join(','));
    const visible = $derived(matches.length > 0 && matchKey !== dismissedKey);

    $effect(() => {
        // Read synchronously so a locale change alone re-triggers the
        // search - the actual fetch happens inside the debounce timeout
        // below, whose reactive reads aren't tracked.
        $locale;
        const term = title.trim();
        const id = ++searchId;
        if (term.length < 3) {
            matches = [];
            return;
        }
        const timeout = setTimeout(() => {
            getRecipes({title: term, category, locale: $locale ?? undefined, search_locale: $locale ?? undefined, limit: 3})
                .then(({response, data}) => {
                    if (id !== searchId)
                        return;
                    matches = response.ok && data ? data.items.slice(0, 3) : [];
                });
        }, 250);
        return () => clearTimeout(timeout);
    });

    function navigateTo(match: RecipePreview) {
        goto(`/${$locale}/create?variation_of=${match.id}`);
    }

    function handleMatchClick(match: RecipePreview) {
        if (hasOtherContent)
            confirmMatch = match;
        else
            navigateTo(match);
    }

    function confirmContinue() {
        if (confirmMatch)
            navigateTo(confirmMatch);
        confirmMatch = null;
    }

    function confirmCancel() {
        confirmMatch = null;
    }

    function dismiss() {
        dismissedKey = matchKey;
    }
</script>

{#if visible}
    <div class="mt-3 relative rounded-lg border border-primary/30 bg-primary/5 p-3">
        <button
                type="button"
                onclick={dismiss}
                aria-label={$_('edit.duplicateNudge.dismiss')}
                class="absolute right-2 top-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
            <X class="w-3.5 h-3.5" />
        </button>
        <p class="text-sm font-medium text-foreground pr-6">{$_('edit.duplicateNudge.title')}</p>
        <div class="mt-2 flex flex-wrap gap-2">
            {#each matches as match (match.id)}
                <button
                        type="button"
                        onclick={() => handleMatchClick(match)}
                        aria-label={$_('edit.duplicateNudge.viewMatch', {values: {title: match.title}})}
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm text-foreground hover:border-primary/50 hover:cursor-pointer transition-colors"
                >
                    <span class="font-medium">{match.title}</span>
                    <span class="text-muted-foreground">— {$_('recipeCard.by')} {match.author?.username}</span>
                </button>
            {/each}
        </div>
    </div>
{/if}

<Modal
        open={confirmMatch !== null}
        title={$_('edit.duplicateNudge.confirmTitle')}
        description={$_('edit.duplicateNudge.confirmDescription')}
        onClose={confirmCancel}
>
    <div class="flex justify-between">
        <Button variant="outline" onclick={confirmCancel}>{$_('edit.duplicateNudge.confirmCancel')}</Button>
        <Button onclick={confirmContinue}>{$_('edit.duplicateNudge.confirmContinue')}</Button>
    </div>
</Modal>
