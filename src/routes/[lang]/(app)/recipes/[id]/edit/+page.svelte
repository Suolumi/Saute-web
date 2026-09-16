<script lang="ts">
    import RecipeEdit from "../../../../../../components/RecipeEdit.svelte";
    import {editRecipe, getRecipe, type Recipe, type RecipeForm, type RecipePicture} from "$lib/recipes.js";
    import {goto} from "$app/navigation";
    import {onMount} from "svelte";
    import {page} from "$app/state";
    import {toastError} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";
    import {locale, _} from "svelte-i18n";
    import {editRecipeCache, user} from "$lib/stores";

    const id = page.params.id ?? ''
    let recipe: RecipeForm | undefined = $state(undefined);
    let excludeFamily: string | undefined = $state(undefined);
    // pictureAttribution is only populated when fullPictureAccess is true
    // (an admin editing a recipe they don't author) - it's what lets the
    // wizard's photo step show who added each picture and offer removing
    // any of them. The recipe's own author never gets this: their photo
    // step only ever shows/controls their own pictures (see
    // recipeFormFromSource), matching the backend's mergePatch rule.
    let pictureAttribution: RecipePicture[] = $state([]);

    // The wizard's photo step (formData.pictures) is a plain filename list
    // sent back as keep_picture_ids - it must never include a contributor's
    // picture unless fullPictureAccess is set, or the save is rejected
    // server-side (and, short of that, would silently offer to remove
    // someone else's photo).
    function recipeFormFromSource(source: Recipe, fullPictureAccess: boolean): RecipeForm {
        const pictures = fullPictureAccess ? source.pictures : source.pictures.filter(p => !p.added_by);
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
            steps: source.steps,
            pictures: pictures.map(p => p.filename),
        }
    }

    async function submit(recipe: RecipeForm, newPictures: File[], newStepPictures: Record<number, File>) {
        const {response, data} = await editRecipe(recipe, id, newPictures, newStepPictures)
        if (response.ok && data) {
            $editRecipeCache = null
            goto(`/${$locale}/recipes/${data.id}`)
        } else
            toastError(apiErrorMessage(data, recipe?.category === 'diy' ? $_('diyEdit.toasts.save') : $_('edit.toasts.save')))
    }

    onMount(() => {
        if (!id)
            return
        getRecipe(id).then(({response, data}) => {
            if (response.ok && data) {
                const fullPictureAccess = !!$user?.admin && $user.id !== data.author.id
                recipe = recipeFormFromSource(data, fullPictureAccess)
                pictureAttribution = fullPictureAccess ? data.pictures : []
                excludeFamily = data.variation_of ?? data.id
            }
        })
    })
</script>

<RecipeEdit
        onSubmit={submit}
        {recipe}
        recipeId={id}
        {excludeFamily}
        {pictureAttribution}
        headLabel={recipe?.category === 'diy' ? $_('diyEdit.editHeadLabel') : $_('edit.headLabel')}
        commentLabel={recipe?.category === 'diy' ? $_('diyEdit.editCommentLabel') : $_('edit.commentLabel')}
/>
