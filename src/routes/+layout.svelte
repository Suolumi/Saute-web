<script lang="ts">
	import '../app.css';
	import Header from "../components/Header.svelte";
	import TimerWidget from "../components/TimerWidget.svelte";
    import {afterNavigate, goto} from "$app/navigation";
	import {onMount} from "svelte";
    import {accessToken, refreshToken, user} from "$lib/stores";
    import {getSelf} from "$lib/user";
    import {SvelteToast} from "@zerodevx/svelte-toast";
    import {locale} from "svelte-i18n";

	let { children } = $props();

	onMount(() => {
		if (window.location.pathname === "/")
			goto(`/${$locale ?? 'en'}/home`)
	})

    afterNavigate(async () => {
        if ($accessToken && $accessToken !== '' && !$user) {
            const {response, data} = await getSelf()
            if (response.ok && data) {
                user.set(data)
            } else {
                accessToken.set('')
                refreshToken.set('')
                console.error(response)
            }
        }
    });
</script>

{#if $locale}
    <Header />
{/if}
{@render children?.()}
<SvelteToast options={{ reversed: true, intro: { y: 192 } }} />
<TimerWidget />
