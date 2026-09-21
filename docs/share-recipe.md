# Share button

Status: implemented (recipe detail page only — see `CLAUDE.md`'s "Current state").

## Summary

A "Share" button on the recipe detail page that hands off the recipe's URL (and title) to
the OS/browser share sheet where available, falling back to copying the link to the
clipboard. Fully client-side; no backend change. Small and self-contained relative to cook
mode / shopping list — the per-page social-preview embeds this depends on already exist
(`PageMeta.svelte`, wired into the recipe detail page per `CLAUDE.md`'s "Current state"),
so a shared link already unfurls correctly on iMessage/Slack/Twitter/etc. without any
further work.

## Placement

Next to the existing favorite button in the recipe detail page's title row
(`+page.svelte:380-402`, `{#if $user}` block wrapping the favorite button) — unlike
favoriting, sharing doesn't require being logged in, so the share button should render
unconditionally (outside that `{#if $user}`), styled to match the favorite button (same
`border-2 border-primary text-primary` treatment, `Share2` icon from `@lucide/svelte`
alongside the already-imported `Heart`/`Coffee`/`Camera` icons there).

## Behavior

```ts
async function shareRecipe() {
    const shareData = {
        title: recipe.title,
        text: recipe.description,
        url: page.url.href,   // already used as-is for og:url in PageMeta.svelte
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
        try {
            await navigator.share(shareData);
        } catch (e) {
            // AbortError on user-cancelled share sheet — not an error, no toast.
            if ((e as Error).name !== 'AbortError') toastError($_('recipe.shareError'));
        }
    } else {
        await navigator.clipboard.writeText(page.url.href);
        toastSuccess($_('recipe.linkCopied'));  // or whatever the existing toast-success
                                                  // helper is named in src/lib/utils.ts —
                                                  // confirm during implementation
    }
}
```

- `navigator.share` (Web Share API) is used when available (most mobile browsers, some
  desktop browsers); falls back to `navigator.clipboard.writeText` + a success toast
  (`toastError` already exists in `src/lib/utils.ts` and is used throughout — confirm
  whether a matching `toastSuccess`/similar exists, otherwise the toast library
  (`@zerodevx/svelte-toast`, per `CLAUDE.md`) can raise a plain success toast directly).
- `page.url.href` is the same value `PageMeta.svelte` already uses for `og:url`
  (`src/components/PageMeta.svelte:30`) — no new canonical-URL logic needed. Recipe URLs
  are plain `/[lang]/recipes/[id]`, no query params to strip.
- No icon-only vs icon+label decision made here — match whatever the favorite button does
  responsively (it currently always shows icon-only in that row; keep consistent).

## Scope

- Recipe detail page only for v1 (highest-intent surface: someone reading a recipe is the
  one who'd share it).
- `RecipeCard.svelte` (used on home/diy/favorites/admin listings) is a reasonable v1.1
  extension using the same `shareRecipe`-style helper, parameterized by the card's own
  recipe id/title — not included in v1 to keep this small, since it also means deciding
  how it interacts with the card's existing favorite button and hover states.
- No new backend endpoint, no share-count tracking. If "most shared recipe" analytics is
  ever wanted, that's a distinct, separate feature — not implied by this one.

## i18n

New keys under `recipe.*` (`src/lib/i18n/locales/{en,fr,fi}.json`): `recipe.share`,
`recipe.linkCopied`, `recipe.shareError`.

## Edge cases

- Browsers with neither `navigator.share` nor `navigator.clipboard` (very old / restricted
  contexts): degrade to doing nothing visible beyond an error toast — no third fallback
  (e.g. a manual "copy this link" text box) planned for v1 given how rare this is in
  practice; revisit only if it shows up in real usage.
- `navigator.share` exists but the share sheet is cancelled by the user: must not show an
  error toast (`AbortError`, handled above) — a cancelled share is not a failure.
- Clipboard write can reject in some contexts (e.g. permissions, non-HTTPS/non-localhost)
  — wrap in try/catch and toast an error rather than let it throw uncaught.

## Testing notes

Playwright (`client` vitest project) can stub `navigator.share`/`navigator.clipboard` to
assert the right one is called with the right `url`/`title`, and that a rejected/aborted
share doesn't raise a false-error toast.
