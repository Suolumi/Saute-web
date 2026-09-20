<script lang="ts">
    import {page} from "$app/state";

    // title is the bare page/recipe name - this component owns the " – Sauté"
    // suffix so every page gets it consistently. og:title/twitter:title stay
    // bare (site branding goes through og:site_name instead, per convention).
    let {
        title = undefined,
        description = "Sauté – discover, save and cook recipes.",
        image = undefined,
    }: {
        title?: string;
        description?: string;
        image?: string;
    } = $props();

    const FALLBACK_IMAGE_PATH = '/icons/icon-512.png';

    let pageTitle = $derived(title ? `${title} – Sauté` : 'Sauté');
    let resolvedImage = $derived(image ?? `${page.url.origin}${FALLBACK_IMAGE_PATH}`);
</script>

<svelte:head>
    <title>{pageTitle}</title>

    <meta property="og:site_name" content="Sauté" />
    <meta property="og:title" content={title ?? 'Sauté'} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={resolvedImage} />
    <meta property="og:url" content={page.url.href} />
    <meta property="og:type" content="website" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title ?? 'Sauté'} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={resolvedImage} />
</svelte:head>
