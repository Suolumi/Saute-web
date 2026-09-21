# Cook mode

Status: spec, not implemented.

## Summary

A distraction-free, one-step-at-a-time view of a recipe's instructions, opened from the
recipe detail page. Builds on the "keep screen awake" toggle that already exists there
(`wakeLockSupported`/`wakeLockActive`/`toggleWakeLock` in
`src/routes/[lang]/(app)/recipes/[id]/+page.svelte`) — today that toggle keeps the screen on
while the page shows the same static, all-steps-at-once list used for a quick read; cook
mode gives it something purpose-built to keep awake *for*.

## Motivation

Instructions currently render as one static `{#each recipe.steps as step}` list
(`+page.svelte:541-564`), same as when just reading the recipe before deciding to cook it.
At the stove, that means small text, re-finding your place after looking away, and no
enforced order. A step-through view — large text, one step visible, tap/swipe or
prev/next to advance, wake lock engaged automatically — targets the actual "cooking right
now" use case instead.

## Scope (v1)

- Entered from a new button next to the existing "keep awake" toggle in the instructions
  card header (`+page.svelte:519-538`), e.g. "Cook" with a `ChefHat` or `Play` icon
  (`@lucide/svelte`, matching the existing `Coffee`/`List` icon usage there).
- Full-screen overlay (reuse the `Modal.svelte` pattern, or a dedicated fixed-position
  component if `Modal` proves too dialog-shaped — decide during implementation) showing:
  - Step N of total (e.g. "3 / 7"), the step's `title` (falling back to `Step N`, same
    rule as today: `step.title || \`Step ${index + 1}\``) and `description` in large type.
  - The step's `picture`, if set, shown large rather than the current 20x24 thumbnail
    (`+page.svelte:543-555`); reuse `Lightbox`'s image-serving pattern
    (`${$serverUrl}/recipe-pictures/${step.picture}`).
  - Prev/next controls (buttons + swipe gesture on touch, arrow-key support on desktop).
  - A visible progress indicator (dots or a bar) across all steps; tapping a dot jumps to
    that step directly.
  - A close/exit control returning to the normal recipe view.
- Wake lock is requested automatically on entering cook mode and released on exit,
  reusing the existing wake-lock request/release logic rather than duplicating it — if the
  user had already toggled "keep awake" manually before entering, exiting cook mode should
  not release a lock they asked for independently (track ownership, e.g. cook mode only
  releases the lock if *it* acquired it).
- Ingredients stay reachable from cook mode (e.g. a collapsible drawer or a dedicated
  "ingredients" step 0) rather than forcing a trip back to the full page — needs a UX call
  during implementation; simplest v1 is a persistent "view ingredients" button that
  overlays the current ingredient list (already scaled via `servingsRatio`, see
  `getIngredientName`/`getReferenceQuantity` in `src/lib/recipes.ts`) without leaving cook
  mode.
- Respects whatever `servingsRatio` was selected on the page before entering cook mode
  (no separate scaling control inside cook mode).

## Out of scope (v1)

- Per-step timers (a step like "simmer for 10 minutes" does not get an actual countdown).
  Flagged during brainstorming as the main scope-creep risk — leave for a later pass if
  wanted.
- Marking steps as "done" / persisting progress across a session or page reload.
- Voice control / hands-free advance.
- Any backend change — this is entirely client-side, working off data the recipe detail
  page already fetches (`getRecipe` in `src/lib/recipes.ts`).

## State

Local component state in `+page.svelte` (or a new child component it mounts), no store:
- `cookModeOpen: boolean`
- `cookModeStepIndex: number`
- Wake-lock ownership flag as described above, to avoid releasing a lock the user set
  independently.

## i18n

New keys under the existing `recipe.*` namespace (`src/lib/i18n/locales/{en,fr,fi}.json`,
alongside `recipe.keepAwakeOn`/`recipe.keepAwakeOff`), e.g.:
`recipe.cookMode`, `recipe.cookModeExit`, `recipe.cookModeStepOf` (with a `{current}`/
`{total}` interpolation, matching the existing `recipe.stepPhoto` pattern that takes a
`{step}` value), `recipe.cookModeIngredients`.

## Edge cases

- Recipe with zero steps: the "Cook" entry button should not be shown (mirrors no
  instructions being useful to step through).
- Recipe with one step: still valid, degenerate case of the same UI (no prev/next needed,
  or both disabled).
- `wakeLockSupported` is already computed as false on unsupported browsers
  (`+page.svelte`) — cook mode should still work there, just without the wake lock (same
  degradation the existing toggle already has, since the button itself is only rendered
  `{#if wakeLockSupported}`).
- Leaving cook mode via browser back button (not just the close control) should still
  release an owned wake lock — needs a cleanup path beyond just the close button's
  `onclick` (e.g. `$effect` teardown).

## Testing notes

No backend involved, so this is client-only: a Playwright (`vitest` `client` project)
spec entering cook mode, stepping forward/back, jumping via a progress dot, and exiting;
plus a manual check that the wake lock is actually requested (Playwright can assert the
`navigator.wakeLock.request` call was made, not that the OS honors it).
