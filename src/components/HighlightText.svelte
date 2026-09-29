<script lang="ts">
    import {highlightSegments} from '$lib/highlight';

    let {text, query}: {text: string, query: string} = $props();
</script><!--
No whitespace between segments below - Svelte's default whitespace handling
would otherwise insert stray spaces into the middle of a highlighted word.
-->{#each highlightSegments(text, query) as segment}{#if segment.match}<span class="text-primary font-semibold">{segment.text}</span>{:else}{segment.text}{/if}{/each}
