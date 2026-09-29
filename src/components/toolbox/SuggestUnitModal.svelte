<script lang="ts">
    import {_} from "svelte-i18n";
    import Modal from "../Modal.svelte";
    import Input from "../Input.svelte";
    import Textarea from "../Textarea.svelte";
    import Label from "../Label.svelte";
    import Select from "../Select.svelte";
    import Button from "../Button.svelte";
    import {submitUnitSuggestion, type ToolboxUnit} from "$lib/toolbox";
    import {toastError, toastSuccess} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";

    let {
        open = $bindable(false),
        units,
        // initialName pre-fills the name field when opened - used when this
        // is opened from a specific piece of unrecognized unit text (e.g.
        // NutritionLinkSuggestion/NutritionFixModal's "isn't a known unit"
        // link) rather than the Toolbox tab's own blank "suggest a unit"
        // entry point.
        initialName = '',
        onSubmitted = () => {}
    }: {
        open: boolean
        units: ToolboxUnit[]
        initialName?: string
        onSubmitted?: () => void
    } = $props();

    let name = $state('');
    let symbol = $state('');
    let kind: 'weight' | 'volume' = $state('weight');
    let toBase: number = $state(NaN);
    let note = $state('');
    let submitting = $state(false);

    $effect(() => {
        if (open) {
            name = initialName;
            symbol = '';
            kind = 'weight';
            toBase = NaN;
            note = '';
        }
    });

    const trimmedName = $derived(name.trim());
    const duplicate = $derived(units.find(u => u.name.toLowerCase() === trimmedName.toLowerCase()));
    const kindOptions = $derived([
        {value: 'weight', label: $_('toolbox.suggestUnit.kindWeight')},
        {value: 'volume', label: $_('toolbox.suggestUnit.kindVolume')}
    ]);

    function close() {
        open = false;
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (!trimmedName || !symbol.trim() || !Number.isFinite(toBase))
            return;
        submitting = true;
        const {response, data} = await submitUnitSuggestion({
            name: trimmedName,
            symbol: symbol.trim(),
            kind,
            to_base: toBase,
            note: note.trim() || undefined
        });
        submitting = false;
        if (response.ok) {
            toastSuccess($_('toolbox.suggestUnit.success'));
            close();
            onSubmitted();
        } else {
            toastError(apiErrorMessage(data, $_('toolbox.suggestUnit.error')));
        }
    }
</script>

<Modal {open} onClose={close} title={$_('toolbox.suggestUnit.title')}>
    <form onsubmit={submit} class="space-y-5">
        <div>
            <Label for="suggest-unit-name" required>{$_('toolbox.suggestUnit.nameLabel')}</Label>
            <Input id="suggest-unit-name" bind:value={name} required />
            {#if duplicate}
                <p class="mt-2 text-sm rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-3 py-2">
                    {$_('toolbox.suggestUnit.duplicateWarning', {values: {name: trimmedName}})}
                </p>
            {:else if trimmedName.length > 0}
                <p class="mt-2 text-sm rounded-lg bg-primary/10 text-primary px-3 py-2">
                    {$_('toolbox.suggestUnit.newHint')}
                </p>
            {/if}
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
                <Label for="suggest-unit-symbol" required>{$_('toolbox.suggestUnit.symbolLabel')}</Label>
                <Input id="suggest-unit-symbol" bind:value={symbol} required />
            </div>
            <div>
                <Label for="suggest-unit-kind" required>{$_('toolbox.suggestUnit.kindLabel')}</Label>
                <Select id="suggest-unit-kind" bind:value={kind} options={kindOptions} required />
            </div>
        </div>

        <div>
            <Label for="suggest-unit-to-base" required>{$_('toolbox.suggestUnit.toBaseLabel')}</Label>
            <Input id="suggest-unit-to-base" type="number" min={0.001} step="any" bind:value={toBase} required />
            <p class="mt-2 text-xs text-muted-foreground">
                {kind === 'weight' ? $_('toolbox.suggestUnit.toBaseHintWeight') : $_('toolbox.suggestUnit.toBaseHintVolume')}
            </p>
        </div>

        <div>
            <Label for="suggest-unit-note">{$_('toolbox.suggestUnit.noteLabel')}</Label>
            <Textarea id="suggest-unit-note" rows={2} bind:value={note} />
        </div>

        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={close} disabled={submitting}>
                {$_('toolbox.suggestUnit.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !trimmedName || !symbol.trim() || !Number.isFinite(toBase)}>
                {duplicate ? $_('toolbox.suggestUnit.submitCorrection') : $_('toolbox.suggestUnit.submitNew')}
            </Button>
        </div>
    </form>
</Modal>
