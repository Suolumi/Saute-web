<script lang="ts">
    import {_} from "svelte-i18n";
    import Modal from "../Modal.svelte";
    import Input from "../Input.svelte";
    import Textarea from "../Textarea.svelte";
    import Label from "../Label.svelte";
    import Button from "../Button.svelte";
    import {submitSubstitutionSuggestion, type ToolboxSubstitution} from "$lib/toolbox";
    import {toastError, toastSuccess} from "$lib/utils";
    import {apiErrorMessage} from "$lib/api";

    let {
        open = $bindable(false),
        substitutions,
        onSubmitted = () => {}
    }: {
        open: boolean
        substitutions: ToolboxSubstitution[]
        onSubmitted?: () => void
    } = $props();

    let problem = $state('');
    let solution = $state('');
    let tag = $state('');
    let note = $state('');
    let submitting = $state(false);

    $effect(() => {
        if (open) {
            problem = '';
            solution = '';
            tag = '';
            note = '';
        }
    });

    const trimmedProblem = $derived(problem.trim());
    const duplicate = $derived(substitutions.find(s => s.problem.toLowerCase() === trimmedProblem.toLowerCase()));

    function close() {
        open = false;
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (!trimmedProblem || !solution.trim())
            return;
        submitting = true;
        const {response, data} = await submitSubstitutionSuggestion({
            problem: trimmedProblem,
            solution: solution.trim(),
            tag: tag.trim() || undefined,
            note: note.trim() || undefined
        });
        submitting = false;
        if (response.ok) {
            toastSuccess($_('toolbox.suggestSubstitution.success'));
            close();
            onSubmitted();
        } else {
            toastError(apiErrorMessage(data, $_('toolbox.suggestSubstitution.error')));
        }
    }
</script>

<Modal {open} onClose={close} title={$_('toolbox.suggestSubstitution.title')}>
    <form onsubmit={submit} class="space-y-5">
        <div>
            <Label for="suggest-sub-problem" required>{$_('toolbox.suggestSubstitution.problemLabel')}</Label>
            <Input id="suggest-sub-problem" bind:value={problem} placeholder={$_('toolbox.suggestSubstitution.problemPlaceholder')} required />
            {#if duplicate}
                <p class="mt-2 text-sm rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-3 py-2">
                    {$_('toolbox.suggestSubstitution.duplicateWarning', {values: {problem: trimmedProblem}})}
                </p>
            {:else if trimmedProblem.length > 0}
                <p class="mt-2 text-sm rounded-lg bg-primary/10 text-primary px-3 py-2">
                    {$_('toolbox.suggestSubstitution.newHint')}
                </p>
            {/if}
        </div>

        <div>
            <Label for="suggest-sub-solution" required>{$_('toolbox.suggestSubstitution.solutionLabel')}</Label>
            <Textarea id="suggest-sub-solution" rows={2} bind:value={solution} required />
        </div>

        <div>
            <Label for="suggest-sub-tag">{$_('toolbox.suggestSubstitution.tagLabel')}</Label>
            <Input id="suggest-sub-tag" bind:value={tag} />
        </div>

        <div>
            <Label for="suggest-sub-note">{$_('toolbox.suggestSubstitution.noteLabel')}</Label>
            <Textarea id="suggest-sub-note" rows={2} bind:value={note} />
        </div>

        <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onclick={close} disabled={submitting}>
                {$_('toolbox.suggestSubstitution.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !trimmedProblem || !solution.trim()}>
                {duplicate ? $_('toolbox.suggestSubstitution.submitCorrection') : $_('toolbox.suggestSubstitution.submitNew')}
            </Button>
        </div>
    </form>
</Modal>
