import {persisted} from 'svelte-persisted-store';
import {jsonParser} from '$lib/stores';

// How far the viewer has gotten through a recipe's steps while cooking.
// Keyed by recipe id -> number of steps completed, counted from the start:
// steps are sequential instructions, so "done" is always a prefix of the
// list (step i is done iff i < count). Checking step i therefore also
// checks every step before it, and unchecking it also unchecks every step
// after it - there's no way to mark step 3 done while step 1 isn't.
// Purely a client-side convenience, like the shopping list's checked items
// - no backend involvement, no cross-device sync.
export type RecipeStepProgress = Record<string, number>

export const recipeStepProgress = persisted<RecipeStepProgress>('recipeStepProgress', {}, {
    syncTabs: true,
    serializer: jsonParser,
})

export function isStepDone(progress: RecipeStepProgress, recipeId: string, stepIndex: number): boolean {
    return stepIndex < (progress[recipeId] ?? 0)
}

export function toggleStepDone(recipeId: string, stepIndex: number) {
    recipeStepProgress.update(progress => {
        const done = progress[recipeId] ?? 0
        const count = stepIndex < done ? stepIndex : stepIndex + 1
        return {...progress, [recipeId]: count}
    })
}
