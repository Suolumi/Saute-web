<script lang="ts">
    import type {Ingredient, Recipe, Step} from "$lib/recipes";
    import {_} from "svelte-i18n";
    import Input from "./Input.svelte";
    import Textarea from "./Textarea.svelte";
    import Label from "./Label.svelte";
    import Button from "./Button.svelte";

    export type SuggestedTranslationFields = {
        title: string
        description: string
        ingredients: Ingredient[]
        steps: Step[]
    }

    // recipe is the currently-translated copy (already fetched at the
    // viewer's locale) - pre-filled here, then only the fields the submitter
    // actually edits differ from it. Structure (ingredient/step count and
    // order) always mirrors recipe exactly: no add/remove/reorder controls -
    // this is a translation fix, not a content edit.
    let {recipe, onSubmit, submitting = false}: {
        recipe: Recipe
        onSubmit: (fields: SuggestedTranslationFields) => void
        submitting?: boolean
    } = $props();

    let title = $state(recipe.title);
    let description = $state(recipe.description);
    let ingredients = $state<Ingredient[]>(recipe.ingredients.map(i => ({...i, ref_label: i.ref_label ?? ''})));
    let steps = $state<Step[]>(recipe.steps.map(s => ({...s})));

    // Ingredients that share the exact same label are one section on the
    // recipe page - and the backend already normalizes them to identical
    // text on save (validateRecipe) - so a section heading is edited once
    // per group here, not duplicated on every member ingredient. Grouping is
    // computed once from the initial data (not reactively from `ingredients`)
    // so a group doesn't visually split/merge while its own heading is being
    // typed into; `indices` are positions into the flat `ingredients` array,
    // which stays in original canonical order for submission.
    type SectionGroup = { label: string, indices: number[] }

    function buildSectionGroups(source: Ingredient[]): SectionGroup[] {
        const unlabeled: number[] = [];
        const order: string[] = [];
        const groups = new Map<string, SectionGroup>();

        source.forEach((ingredient, index) => {
            const label = (ingredient.label ?? '').trim();
            if (!label) {
                unlabeled.push(index);
                return;
            }
            const key = label.toLowerCase();
            let group = groups.get(key);
            if (!group) {
                group = {label, indices: []};
                groups.set(key, group);
                order.push(key);
            }
            group.indices.push(index);
        });

        const result: SectionGroup[] = [];
        if (unlabeled.length > 0)
            result.push({label: '', indices: unlabeled});
        for (const key of order)
            result.push(groups.get(key)!);
        return result;
    }

    let sectionGroups = $state<SectionGroup[]>(buildSectionGroups(ingredients));

    function setSectionLabel(group: SectionGroup, value: string) {
        group.label = value;
        for (const index of group.indices)
            ingredients[index].label = value;
    }

    function submit(event: SubmitEvent) {
        event.preventDefault();
        onSubmit({
            title,
            description,
            ingredients: ingredients.map(({name, quantity, unit, label, recipe_ref, ref_label}) => ({name, quantity, unit, label, recipe_ref, ref_label})),
            steps: steps.map(({title, description, picture}) => ({title, description, picture})),
        });
    }
</script>

<form onsubmit={submit} class="space-y-8">
    <p class="text-sm text-muted-foreground">{$_('recipe.suggestFixIntro')}</p>

    <div>
        <Label for="suggest-fix-title" required>{$_('edit.title.label')}</Label>
        <Input id="suggest-fix-title" bind:value={title} required disabled={submitting} />
    </div>

    <div>
        <Label for="suggest-fix-description">{$_('edit.description.label')}</Label>
        <Textarea id="suggest-fix-description" bind:value={description} rows={3} disabled={submitting} />
    </div>

    <div class="space-y-6">
        <h2 class="text-lg font-semibold text-foreground">{$_('recipe.ingredients')}</h2>
        {#each sectionGroups as group, gi (gi)}
            <div class="space-y-4">
                <div class="max-w-sm">
                    <Label for={`suggest-fix-section-${gi}`}>{$_('recipe.suggestFixSectionLabel')}</Label>
                    <Input id={`suggest-fix-section-${gi}`} bind:value={() => group.label, (v) => setSectionLabel(group, v)} disabled={submitting} />
                </div>
                {#each group.indices as i (i)}
                    {@const ingredient = ingredients[i]}
                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start border-b border-border pb-4 last:border-b-0">
                        {#if ingredient.recipe_ref}
                            <div class="sm:col-span-10">
                                <Label for={`suggest-fix-ingredient-${i}-ref-label`}>{$_('edit.ingredients.refLabel.label')}</Label>
                                <p class="text-sm text-muted-foreground mb-2">{ingredient.resolved_ref_title}</p>
                                <Input id={`suggest-fix-ingredient-${i}-ref-label`} bind:value={() => ingredient.ref_label ?? '', (v) => ingredient.ref_label = v} placeholder={$_('edit.ingredients.refLabel.placeholder')} disabled={submitting} />
                            </div>
                        {:else}
                            <div class="sm:col-span-10">
                                <Label for={`suggest-fix-ingredient-${i}-name`}>{$_('edit.ingredients.name.label')}</Label>
                                <Input id={`suggest-fix-ingredient-${i}-name`} bind:value={ingredient.name} required disabled={submitting} />
                            </div>
                        {/if}
                        <div class="sm:col-span-2">
                            <Label for={`suggest-fix-ingredient-${i}-unit`}>{$_('edit.ingredients.unit.label')}</Label>
                            <Input id={`suggest-fix-ingredient-${i}-unit`} bind:value={ingredient.unit} placeholder={$_('edit.ingredients.unit.placeholder')} disabled={submitting} />
                        </div>
                    </div>
                {/each}
            </div>
        {/each}
    </div>

    <div class="space-y-4">
        <h2 class="text-lg font-semibold text-foreground">{$_('recipe.instructions')}</h2>
        {#each steps as step, i (i)}
            <div class="space-y-2 border-b border-border pb-4 last:border-b-0">
                <Label for={`suggest-fix-step-${i}-title`}>{$_('edit.instructions.title.label')}</Label>
                <Input id={`suggest-fix-step-${i}-title`} bind:value={step.title} placeholder={$_('edit.instructions.title.placeholder')} disabled={submitting} />
                <Label for={`suggest-fix-step-${i}-description`}>{$_('edit.instructions.description.label')}</Label>
                <Textarea id={`suggest-fix-step-${i}-description`} bind:value={step.description} required disabled={submitting} />
            </div>
        {/each}
    </div>

    <p class="text-xs text-muted-foreground">{$_('recipe.suggestFixDisclaimer')}</p>

    <Button type="submit" disabled={submitting}>{$_('recipe.suggestFixSubmit')}</Button>
</form>
