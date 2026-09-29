<script lang="ts">
    import {_} from "svelte-i18n";
    import Modal from "../Modal.svelte";
    import Input from "../Input.svelte";
    import Textarea from "../Textarea.svelte";
    import Label from "../Label.svelte";
    import Button from "../Button.svelte";
    import {submitIngredientSuggestion, type ToolboxIngredient} from "$lib/toolbox";
    import {toastError, toastSuccess} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";

    let {
        open = $bindable(false),
        ingredients,
        onSubmitted = () => {}
    }: {
        open: boolean
        ingredients: ToolboxIngredient[]
        onSubmitted?: () => void
    } = $props();

    let name = $state('');
    let density: number = $state(NaN);
    let note = $state('');
    let submitting = $state(false);

    $effect(() => {
        if (open) {
            name = '';
            density = NaN;
            note = '';
        }
    });

    const trimmedName = $derived(name.trim());
    const duplicate = $derived(ingredients.find(i => i.name.toLowerCase() === trimmedName.toLowerCase()));

    function close() {
        open = false;
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (!trimmedName || !Number.isFinite(density))
            return;
        submitting = true;
        const {response, data} = await submitIngredientSuggestion({
            name: trimmedName,
            g_per_100ml: density,
            note: note.trim() || undefined
        });
        submitting = false;
        if (response.ok) {
            toastSuccess($_('toolbox.suggestIngredient.success'));
            close();
            onSubmitted();
        } else {
            toastError(apiErrorMessage(data, $_('toolbox.suggestIngredient.error')));
        }
    }
</script>

<Modal {open} onClose={close} title={$_('toolbox.suggestIngredient.title')}>
    <form onsubmit={submit} class="space-y-5">
        <div>
            <Label for="suggest-ingredient-name" required>{$_('toolbox.suggestIngredient.nameLabel')}</Label>
            <Input id="suggest-ingredient-name" bind:value={name} required />
            {#if duplicate}
                <p class="mt-2 text-sm rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-3 py-2">
                    {$_('toolbox.suggestIngredient.duplicateWarning', {values: {name: trimmedName}})}
                </p>
            {:else if trimmedName.length > 0}
                <p class="mt-2 text-sm rounded-lg bg-primary/10 text-primary px-3 py-2">
                    {$_('toolbox.suggestIngredient.newHint')}
                </p>
            {/if}
        </div>

        <div>
            <Label for="suggest-ingredient-density" required>{$_('toolbox.suggestIngredient.densityLabel')}</Label>
            <Input id="suggest-ingredient-density" type="number" min={20} bind:value={density} required />
            <p class="mt-2 text-xs text-muted-foreground">{$_('toolbox.suggestIngredient.densityHint')}</p>
        </div>

        <div>
            <Label for="suggest-ingredient-note">{$_('toolbox.suggestIngredient.noteLabel')}</Label>
            <Textarea id="suggest-ingredient-note" rows={2} bind:value={note} />
        </div>

        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={close} disabled={submitting}>
                {$_('toolbox.suggestIngredient.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !trimmedName || !Number.isFinite(density)}>
                {duplicate ? $_('toolbox.suggestIngredient.submitCorrection') : $_('toolbox.suggestIngredient.submitNew')}
            </Button>
        </div>
    </form>
</Modal>
