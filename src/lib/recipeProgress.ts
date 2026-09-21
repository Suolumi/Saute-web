import {persisted} from 'svelte-persisted-store';
import {jsonParser} from '$lib/stores';

// Which steps of which recipes the viewer has checked off while cooking.
// Keyed by recipe id -> set of done step indices (as an array, since Sets
// don't survive JSON round-tripping). Purely a client-side convenience,
// like the shopping list's checked items - no backend involvement, no
// cross-device sync.
export type RecipeStepProgress = Record<string, number[]>

export const recipeStepProgress = persisted<RecipeStepProgress>('recipeStepProgress', {}, {
    syncTabs: true,
    serializer: jsonParser,
})

export function isStepDone(progress: RecipeStepProgress, recipeId: string, stepIndex: number): boolean {
    return progress[recipeId]?.includes(stepIndex) ?? false
}

export function toggleStepDone(recipeId: string, stepIndex: number) {
    recipeStepProgress.update(progress => {
        const done = progress[recipeId] ?? []
        const next = done.includes(stepIndex) ? done.filter(i => i !== stepIndex) : [...done, stepIndex]
        return {...progress, [recipeId]: next}
    })
}
