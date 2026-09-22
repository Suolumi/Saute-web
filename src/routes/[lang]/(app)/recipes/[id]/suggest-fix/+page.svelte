<script lang="ts">
    import {page} from "$app/state";
    import {goto} from "$app/navigation";
    import {onMount} from "svelte";
    import {locale, _} from "svelte-i18n";
    import {getRecipe, submitTranslationSuggestion, type Recipe} from "$lib/recipes";
    import type {SuggestedTranslationFields} from "../../../../../../components/SuggestTranslationFix.svelte";
    import {toastError, toastSuccess} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";
    import SuggestTranslationFix from "../../../../../../components/SuggestTranslationFix.svelte";
    import PageMeta from "../../../../../../components/PageMeta.svelte";

    const id = page.params.id ?? ''
    let recipe: Recipe | null = $state(null);
    let submitting = $state(false);

    onMount(() => {
        if (!id)
            return
        getRecipe(id, $locale ?? undefined).then(({response, data}) => {
            if (response.ok && data) {
                // Nothing to fix on the recipe's own source locale - this
                // route only makes sense on a translated copy.
                if (data.locale === data.source_locale) {
                    goto(`/${$locale}/recipes/${id}`)
                    return
                }
                recipe = data
            } else {
                goto(`/${$locale}/recipes/${id}`)
            }
        })
    })

    async function submit(fields: SuggestedTranslationFields) {
        if (!recipe)
            return
        submitting = true
        const {response, data} = await submitTranslationSuggestion(id, {locale: recipe.locale, ...fields})
        submitting = false
        if (response.ok) {
            toastSuccess($_('recipe.suggestFixSuccess'))
            goto(`/${$locale}/recipes/${id}`)
        } else if (response.status === 409) {
            toastError($_('recipe.suggestFixDuplicate'))
        } else {
            toastError(apiErrorMessage(data, $_('recipe.suggestFixError')))
        }
    }
</script>

<PageMeta title={$_('recipe.suggestFixTitle')} description={recipe?.title} />

<div class="container mx-auto px-4 py-8 max-w-3xl">
    <h1 class="text-2xl font-bold text-foreground mb-6">{$_('recipe.suggestFixTitle')}</h1>
    {#if recipe}
        <SuggestTranslationFix {recipe} onSubmit={submit} {submitting} />
    {/if}
</div>
