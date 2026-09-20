<script lang="ts">
    import Button from '../../../../components/Button.svelte';
    import Input from '../../../../components/Input.svelte';
    import Label from '../../../../components/Label.svelte';
    import RecipeCard from '../../../../components/RecipeCard.svelte';
    import RecipePickerModal from '../../../../components/RecipePickerModal.svelte';
    import PageMeta from '../../../../components/PageMeta.svelte';
    import {goto} from "$app/navigation";
    import {getRecipes, linkRecipeVariation, type RecipeCategory, type RecipePreview} from "$lib/recipes";
    import {serverUrl, user} from "$lib/stores";
    import { SquarePen, Trash, Camera, MoreVertical, Link2 } from '@lucide/svelte';
    import {updateSelf, updateUserPicture, type UserSettingsForm} from "$lib/user";
    import {toastError, toastSuccess} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";
    import {locale, _} from "svelte-i18n";
    import Modal from "../../../../components/Modal.svelte";
    import {deleteRecipe} from "$lib/recipes";

    let userForm: UserSettingsForm = $state({
        username: $user?.username ?? '',
        email: $user?.email ?? '',
        password: '',
    })

    let userRecipes: RecipePreview[] = $state([])
    let categoryFilter: 'all' | RecipeCategory = $state('all')
    // A recipe with no category at all predates this field and counts as
    // food (see the backend's own $ne-based default-listing filter) -
    // otherwise legacy recipes would vanish from the "Food" tab.
    const matchesCategoryFilter = (r: RecipePreview) =>
        categoryFilter === 'all' ||
        (categoryFilter === 'food' && (!r.category || r.category === 'food')) ||
        r.category === categoryFilter
    let filteredRecipes = $derived(userRecipes.filter(matchesCategoryFilter))
    let fileInput = $state<HTMLInputElement>();
    let modal = $state({
        isOpen: false,
        recipeId: ""
    });

    // openMenuId tracks which recipe's "..." action menu is currently open -
    // only one at a time, closed by picking an action, clicking elsewhere, or
    // toggling it again.
    let openMenuId: string | null = $state(null);

    let linkPicker = $state({isOpen: false, recipe: null as RecipePreview | null});
    let linkConfirm = $state({isOpen: false, recipe: null as RecipePreview | null, target: null as RecipePreview | null});
    let linking = $state(false);

    function toggleMenu(id: string) {
        openMenuId = openMenuId === id ? null : id;
    }

    function closeMenu() {
        openMenuId = null;
    }

    function openLinkPicker(recipe: RecipePreview) {
        closeMenu();
        linkPicker = {isOpen: true, recipe};
    }

    function onLinkTargetPicked(target: RecipePreview) {
        linkConfirm = {isOpen: true, recipe: linkPicker.recipe, target};
    }

    function confirmLinkVariation() {
        const {recipe, target} = linkConfirm;
        if (!recipe || !target)
            return;
        linking = true;
        linkRecipeVariation(recipe.id, target.id).then(({response, data}) => {
            if (response.ok) {
                toastSuccess($_('settings.linkVariation.success'));
                userRecipes = userRecipes.map(r =>
                    r.id === recipe.id ? {...r, variation_of: target.id} : r
                );
                linkConfirm = {isOpen: false, recipe: null, target: null};
            } else {
                toastError(apiErrorMessage(data, $_('settings.linkVariation.error')));
            }
        }).finally(() => {
            linking = false;
        });
    }

    function updateProfile(event: Event) {
        event.preventDefault();
        updateSelf(userForm).then(({response, data}) => {
            if (response.ok && data)
                user.set(data)
            else
                toastError($_('settings.errors.update'));
        })
    }

    function deleteR(id: string) {
        deleteRecipe(id).then(({response}) => {
            if (response.ok) {
                toastSuccess($_('settings.delete.success'))
                userRecipes = userRecipes.filter(e => e.id !== id)
            } else {
                toastError($_('settings.errors.delete'));
            }
        }).catch(err => {
            console.log(err)
            toastError($_('settings.errors.delete'));
        }).finally(() => {
            modal.isOpen = false
        })
    }

    $effect(() => {
        getRecipes({
            author: $user?.username ?? '',
            own_recipes: true,
            limit: 100,
            locale: $locale ?? 'en'
        }).then(({response, data}) => {
            if (response.ok && data)
                userRecipes = data.items
            else
                toastError($_('settings.errors.getRecipes'))
        })
    })

    $effect(() => {
        if ($user)
            userForm = {
                username: $user.username ?? '',
                email: $user.email ?? '',
                password: ''
            }
    })

    function editRecipe(id: string) {
        goto(`/${$locale}/recipes/${id}/edit`)
    }

    function triggerFileInput() {
        fileInput?.click();
    }

    async function updatePicture(e: Event) {
        const target = e.target as HTMLInputElement;
        let file;
        if (target.files && target.files.length > 0) {
            file = target.files[0];
        }
        if (!file)
            return;
        const {data} = await updateUserPicture(file)
        if (data && $user) {
            $user.picture = data.id
        }
    }
</script>

<PageMeta title={$_('settings.meta.title')} description={$_('settings.meta.description')} />

<svelte:window onclick={closeMenu} />

<div class="max-w-5xl mx-auto px-4 py-8">
    <div class="mb-8">
        <div class="flex items-center gap-x-4">
            <button
                    type="button"
                    onclick={triggerFileInput}
                    class="relative group cursor-pointer"
                    aria-label="Upload profile picture"
            >
                {#if $user && $user.picture}
                    <img
                            src={`${$serverUrl}/pictures/${$user.picture}` || "/placeholder.svg"}
                            alt="{$user.username} profile"
                            class="w-24 h-24 rounded-full object-cover transition-colors"
                    />
                {:else}
                    <div class="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-4xl font-medium">
                        {($user?.username ?? '?').charAt(0)}
                    </div>
                {/if}

                <!-- Upload overlay on hover -->
                <span class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera color="white" />
                </span>
            </button>
            <input
                    bind:this={fileInput}
                    type="file"
                    accept="image/*"
                    onchange={e => updatePicture(e)}
                    class="hidden"
                    aria-label="Profile picture file input"
            />
            <div>
                <h1 class="text-3xl font-bold text-foreground mb-2">{$user?.username ?? 'No username??'}</h1>
                <p class="text-muted-foreground">{$user?.email ?? 'No email'}</p>
            </div>
        </div>
    </div>

    <!-- Profile Settings -->
    <div class="bg-card rounded-lg border border-border p-6 mb-8">
        <h2 class="text-xl font-semibold text-card-foreground mb-4">{$_('settings.info')}</h2>

        <form class="space-y-4" onsubmit={updateProfile}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label for="username" required>{$_('settings.username.label')}</Label>
                    <Input
                            id="username"
                            type="text"
                            bind:value={userForm.username}
                            required
                            placeholder={$_('settings.username.placeholder')}
                    />
                </div>
                <div>
                    <Label for="email" required>{$_('settings.email.label')}</Label>
                    <Input
                            id="email"
                            type="email"
                            bind:value={userForm.email}
                            required
                            placeholder={$_('settings.email.placeholder')}
                    />
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Label for="email" required>{$_('settings.password.label')}</Label>
                <Input
                        id="password"
                        type="password"
                        bind:value={userForm.password}
                        required
                        placeholder={$_('settings.password.placeholder')}
                />
            </div>
            <Button type="submit">
                {$_('settings.submit')}
            </Button>
        </form>
    </div>

    <!-- User's Recipes -->
    <div class="bg-card rounded-lg border border-border p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 class="text-xl font-semibold text-card-foreground">{$_('settings.recipeCount')} ({filteredRecipes.length})</h2>
            <div class="inline-flex rounded-lg border border-border p-1 self-start">
                {#each [['all', 'settings.filterAll'], ['food', 'settings.filterFood'], ['diy', 'settings.filterDiy']] as [value, key] (value)}
                    <button
                            type="button"
                            onclick={() => categoryFilter = value as 'all' | RecipeCategory}
                            class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:cursor-pointer {categoryFilter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
                    >
                        {$_(key)}
                    </button>
                {/each}
            </div>
        </div>

        {#if filteredRecipes.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each filteredRecipes as recipe}
                    <div class="relative h-full">
                        <RecipeCard {recipe} disabled={false} />
                        <div class="absolute top-2 right-2">
                            <button
                                    type="button"
                                    onclick={(e: MouseEvent) => { e.stopPropagation(); toggleMenu(recipe.id); }}
                                    class="p-2 rounded-lg bg-card/90 hover:bg-card border border-border hover:cursor-pointer"
                                    aria-label={$_('settings.actions.menu')}
                            >
                                <MoreVertical class="text-black dark:text-white" size="16" />
                            </button>
                            {#if openMenuId === recipe.id}
                                <div class="absolute right-0 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg py-1 z-10">
                                    <button
                                            type="button"
                                            onclick={() => { closeMenu(); editRecipe(recipe.id); }}
                                            class="flex w-full items-center gap-2 px-3 py-2 text-sm text-card-foreground hover:bg-muted hover:cursor-pointer"
                                    >
                                        <SquarePen size="16" />
                                        {$_('settings.actions.edit')}
                                    </button>
                                    <button
                                            type="button"
                                            onclick={() => openLinkPicker(recipe)}
                                            class="flex w-full items-center gap-2 px-3 py-2 text-sm text-card-foreground hover:bg-muted hover:cursor-pointer"
                                    >
                                        <Link2 size="16" />
                                        {$_('settings.actions.linkAsVariation')}
                                    </button>
                                    <button
                                            type="button"
                                            onclick={() => { closeMenu(); modal = {isOpen: true, recipeId: recipe.id}; }}
                                            class="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted hover:cursor-pointer"
                                    >
                                        <Trash size="16" />
                                        {$_('settings.actions.remove')}
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="text-center py-8">
                <p class="text-muted-foreground mb-4">{$_('settings.noRecipes')}</p>
                <Button onclick={() => goto(`/${$locale}/create`)}>
                    {$_('settings.createRecipe')}
                </Button>
            </div>
        {/if}
    </div>
    <Modal open={modal.isOpen} onClose={() => modal.isOpen = false} title={$_('settings.delete.title')}>
        <div class="flex justify-between">
            <Button
                    variant="outline"
                    size="md"
                    onclick={() => modal.isOpen = false}
                    class="bg-red-800"
            >
                {$_('settings.delete.cancel')}
            </Button>
            <Button
                    variant="outline"
                    size="md"
                    onclick={() => deleteR(modal.recipeId)}
                    class="bg-primary"
            >
                {$_('settings.delete.confirm')}
            </Button>
        </div>
    </Modal>

    <RecipePickerModal
            open={linkPicker.isOpen}
            excludeFamily={linkPicker.recipe?.variation_of ?? linkPicker.recipe?.id}
            category={linkPicker.recipe?.category}
            title={$_('settings.linkVariation.pickerTitle')}
            description={$_('settings.linkVariation.pickerDescription')}
            onClose={() => linkPicker = {isOpen: false, recipe: null}}
            onSelect={onLinkTargetPicked}
    />

    <Modal
            open={linkConfirm.isOpen}
            title={$_('settings.linkVariation.confirmTitle', {values: {title: linkConfirm.recipe?.title ?? '', target: linkConfirm.target?.title ?? ''}})}
            description={$_('settings.linkVariation.confirmDescription', {values: {target: linkConfirm.target?.title ?? ''}})}
            onClose={() => linkConfirm = {isOpen: false, recipe: null, target: null}}
    >
        <div class="flex justify-between">
            <Button
                    variant="outline"
                    size="md"
                    onclick={() => linkConfirm = {isOpen: false, recipe: null, target: null}}
            >
                {$_('settings.linkVariation.cancel')}
            </Button>
            <Button
                    variant="primary"
                    size="md"
                    disabled={linking}
                    onclick={confirmLinkVariation}
            >
                {$_('settings.linkVariation.confirm')}
            </Button>
        </div>
    </Modal>
</div>
