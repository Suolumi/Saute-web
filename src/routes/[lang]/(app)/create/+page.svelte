<script lang="ts">
    import {createRecipe, getRecipe, type Recipe, type RecipeCategory, type RecipeForm} from "$lib/recipes.js";
    import {goto} from "$app/navigation";
    import {page} from "$app/state";
    import RecipeEdit from "../../../../components/RecipeEdit.svelte";
    import Modal from "../../../../components/Modal.svelte";
    import Button from "../../../../components/Button.svelte";
    import PageMeta from "../../../../components/PageMeta.svelte";
    import {onMount} from "svelte";
    import {accessToken, createRecipeCache} from "$lib/stores";
    import {toastError} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";
    import {locale, _} from "svelte-i18n";

    let variationOf = $derived(page.url.searchParams.get('variation_of') ?? undefined)
    // categoryParam only matters for a plain (non-variation) create; a
    // variation always inherits its category from the fetched root recipe
    // instead (see recipeFormFromSource) so it can't be forked into the
    // wrong category by an untrusted query param.
    let categoryParam = $derived((page.url.searchParams.get('category') as RecipeCategory | null) ?? 'food')
    let choiceMade = $state(false)
    let seedRecipe: RecipeForm | undefined = $state(undefined)
    // Plain create (no variation_of) never needs a choice; a variation
    // target blocks rendering the form until "start blank"/"start from a
    // copy" is picked.
    let readyToEdit = $derived(variationOf === undefined || choiceMade)
    let effectiveCategory = $derived(seedRecipe?.category ?? categoryParam)

    $effect(() => {
        // Reset if the target changes (e.g. navigating directly between two
        // different variation_of links without an intervening page).
        void variationOf
        choiceMade = false
        seedRecipe = undefined
    })

    function recipeFormFromSource(source: Recipe): RecipeForm {
        return {
            title: source.title,
            description: source.description,
            quantity: source.quantity,
            kind: source.kind,
            category: source.category,
            preparation_time: source.preparation_time,
            cooking_time: source.cooking_time,
            resting_time: source.resting_time,
            ingredients: source.ingredients,
            // Never copy the original's pictures - they're the original
            // author's files, and a variation starts with none of its own.
            steps: source.steps.map(step => ({title: step.title, description: step.description})),
            pictures: [],
        }
    }

    function startBlank() {
        $createRecipeCache = null
        choiceMade = true
    }

    async function startFromCopy() {
        if (!variationOf)
            return
        $createRecipeCache = null
        const {response, data} = await getRecipe(variationOf, $locale ?? undefined)
        if (response.ok && data)
            seedRecipe = recipeFormFromSource(data)
        else
            toastError(apiErrorMessage(data, $_('create.toasts.save')))
        choiceMade = true
    }

    function cancelVariationChoice() {
        if (history.length > 1)
            history.back()
        else
            goto(`/${$locale}/home`)
    }

    async function submit(recipe: RecipeForm, newPictures: File[], newStepPictures: Record<number, File>) {
        const {response, data} = await createRecipe(recipe, newPictures, $locale ?? undefined, newStepPictures, variationOf)
        if (response.ok && data) {
            $createRecipeCache = null
            goto(`/${$locale}/recipes/${data.id}`)
        } else
            toastError(apiErrorMessage(data, recipe.category === 'diy' ? $_('diyEdit.toasts.create') : $_('create.toasts.save')));
    }

    onMount(() => {
        if (!$accessToken || $accessToken === "") {
            toastError($_('create.toasts.noAccount'))
            goto(`/${$locale}/home`)
        }
    })
</script>

<PageMeta
        title={effectiveCategory === 'diy' ? $_('diyEdit.meta.title') : $_('create.meta.title')}
        description={effectiveCategory === 'diy' ? $_('diyEdit.meta.description') : $_('create.meta.description')}
/>

<Modal
        open={variationOf !== undefined && !choiceMade}
        title={$_('create.variationChoice.title')}
        description={$_('create.variationChoice.description')}
        onClose={cancelVariationChoice}
>
    <div class="flex flex-col sm:flex-row gap-3">
        <Button variant="primary" onclick={startFromCopy} class="flex-1">{$_('create.variationChoice.copyOption')}</Button>
        <Button variant="outline" onclick={startBlank} class="flex-1">{$_('create.variationChoice.blankOption')}</Button>
    </div>
</Modal>

{#if readyToEdit}
    <RecipeEdit
            onSubmit={submit}
            recipe={seedRecipe}
            excludeFamily={variationOf}
            category={effectiveCategory}
            headLabel={effectiveCategory === 'diy' ? $_('diyEdit.headLabel') : $_('create.headLabel')}
            commentLabel={effectiveCategory === 'diy' ? $_('diyEdit.commentLabel') : $_('create.commentLabel')}
    />
{/if}
