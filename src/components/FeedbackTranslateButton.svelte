<script lang="ts">
    import {_, locale} from "svelte-i18n";
    import {Languages} from "@lucide/svelte";
    import {apiErrorMessage} from "$lib/api";
    import {toastError, toastSuccess} from "$lib/utils";
    import {languageName, sameLanguage, translateFeedback, type Feedback, type FeedbackTranslation} from "$lib/feedback";

    // translation is the text to show instead of the original, or null to
    // show the original. The parent renders it; this only toggles it.
    let {item, translation = $bindable(null)}: {
        item: Feedback
        translation?: FeedbackTranslation | null
    } = $props();

    let loading = $state(false);
    let fetched = $state<FeedbackTranslation | null>(null);
    let knownSource = $state<string | undefined>(item.source_locale);
    let viewerLocale = $derived($locale ?? 'en');
    let alreadyInLanguage = $derived(!!knownSource && sameLanguage(knownSource, viewerLocale));

    // A translation into another locale is stale once the viewer switches language.
    $effect(() => {
        if (fetched && !sameLanguage(fetched.locale, viewerLocale)) {
            fetched = null;
            translation = null;
        }
    });

    async function translate() {
        if (fetched) {
            translation = fetched;
            return;
        }
        loading = true;
        const {response, data} = await translateFeedback(item.id, viewerLocale);
        loading = false;
        if (!response.ok) {
            toastError(apiErrorMessage(data, $_('feedback.translate.error')));
            return;
        }
        knownSource = data.source_locale;
        if (data.same_language) {
            toastSuccess($_('feedback.translate.same'));
            return;
        }
        fetched = data;
        translation = data;
    }
</script>

{#if translation}
    <button type="button" onclick={() => translation = null} class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted hover:cursor-pointer">
        <Languages class="h-3.5 w-3.5" />{$_('feedback.translate.showOriginal')}
    </button>
    <span class="text-xs text-muted-foreground">{$_('feedback.translate.note', {values: {language: languageName(translation.source_locale, viewerLocale)}})}</span>
{:else if !alreadyInLanguage}
    <button type="button" onclick={translate} disabled={loading} class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted hover:cursor-pointer disabled:opacity-60">
        <Languages class="h-3.5 w-3.5" />{loading ? $_('feedback.translate.loading') : $_('feedback.translate.button')}
    </button>
{/if}
