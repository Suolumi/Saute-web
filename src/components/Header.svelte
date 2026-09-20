<script lang="ts">
    import {user, darkMode, accessToken, refreshToken, serverUrl} from '$lib/stores';
    import {goto} from "$app/navigation";
    import Button from "./Button.svelte";
    import {onDestroy, onMount} from "svelte";
    import {browser} from "$app/environment";
    import {_, locale} from "svelte-i18n";
    import LanguageSelect from "./LanguageSelect.svelte";
    import {Drawer} from "vaul-svelte";

    function toggleDarkMode(): void {
        darkMode.update((mode: boolean) => {
            const newMode: boolean = !mode;
            if (newMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            return newMode;
        });
    }

    let showProfileDropdown: boolean = $state(false);
    let dropdownRef: HTMLElement | undefined = $state();
    let drawerOpen: boolean | undefined = $state();

    function toggleProfileDropdown(e: MouseEvent): void {
        if (dropdownRef && !dropdownRef.contains(e.target as Node) && showProfileDropdown) {
            showProfileDropdown = false;
        }
    }

    onMount(() => {
        if (browser)
            document.addEventListener("click", toggleProfileDropdown);
        if ($darkMode)
            document.documentElement.classList.add('dark');
    });

    onDestroy(() => {
        if (browser)
            document.removeEventListener("click", toggleProfileDropdown);
    });

    function logout(): void {
        drawerOpen = false
        user.set(null);
        accessToken.set('')
        refreshToken.set('')
        showProfileDropdown = false;
        goto(`/${$locale}/home`);
    }
</script>

<nav class="bg-card border-b border-border sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
            <div class="flex items-center md:space-x-8">
                <button
                        onclick={() => goto(`/${$locale}/home`)}
                        class="text-2xl font-bold text-primary hover:text-primary/80 transition-colors hover:cursor-pointer"
                        aria-label="Sauté"
                >
                    {$_('header.appName')}
                </button>

                <div class="hidden md:flex space-x-6">
                    <button
                            onclick={() => goto(`/${$locale}/home`)}
                            class="text-foreground hover:text-primary transition-colors font-medium hover:cursor-pointer"
                            aria-label="All Recipes"
                    >
                        {$_('header.allRecipes')}
                    </button>
                    <button
                        onclick={() => goto(`/${$locale}/diy`)}
                        class="text-foreground hover:text-primary transition-colors font-medium hover:cursor-pointer"
                        aria-label="DIY"
                    >
                        {$_('header.diy')}
                    </button>
                    <button
                        onclick={() => goto(`/${$locale}/about`)}
                        class="text-foreground hover:text-primary transition-colors font-medium hover:cursor-pointer"
                        aria-label="About"
                    >
                        {$_('header.about')}
                    </button>
                    <button
                            onclick={() => goto(`/${$locale}/connect-ai`)}
                            class="text-ai-accent hover:text-ai-accent/80 transition-colors text-sm font-medium hover:cursor-pointer"
                            aria-label="Connect to AI"
                    >
                        {$_('header.connectAI')}
                    </button>
                </div>
            </div>

            <div class="flex items-center gap-2 md:gap-4">
                <LanguageSelect />
                <button
                        onclick={toggleDarkMode}
                        class="p-2 text-foreground hover:text-primary hover:cursor-pointer transition-colors rounded-lg hover:bg-muted"
                        aria-label="Toggle dark mode"
                >
                    {#if $darkMode}
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                    {:else}
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                        </svg>
                    {/if}
                </button>

                {#if $user}
                    <div class="relative hidden md:block">
                        <button
                                onclick={() => showProfileDropdown = true}
                                bind:this={dropdownRef}
                                class="flex items-center space-x-2 p-1 rounded-full hover:bg-muted transition-colors hover:cursor-pointer"
                                aria-label="Profile menu"
                        >
                            {#if $user.picture}
                                <img src={`${$serverUrl}/pictures/${$user.picture}` || "/placeholder.svg"} alt="Profile" class="w-8 h-8 rounded-full object-cover" />
                            {:else}
                                <div class="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                                    {$user.username?.charAt(0) || '?'}
                                </div>
                            {/if}
                        </button>

                        {#if showProfileDropdown}
                            <div class="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                                <button
                                        onclick={() => { goto(`/${$locale}/settings`); showProfileDropdown = false; }}
                                        class="block w-full text-left px-4 py-2 text-sm text-foreground transition-colors hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                                >
                                    {$_('header.settings')}
                                </button>
                                <button
                                        onclick={() => { goto(`/${$locale}/settings`); showProfileDropdown = false; }}
                                        class="block w-full text-left px-4 py-2 text-sm text-foreground transition-colors hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                                >
                                    {$_('header.myRecipes')}
                                </button>
                                {#if $user.admin}
                                    <button
                                            onclick={() => { goto(`/${$locale}/admin`); showProfileDropdown = false; }}
                                            class="block w-full text-left px-4 py-2 text-sm text-foreground transition-colors hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                                    >
                                        {$_('header.admin')}
                                    </button>
                                {/if}
                                <button
                                        onclick={logout}
                                        class="block w-full text-left px-4 py-2 text-sm text-foreground transition-colors hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                                >
                                    {$_('header.logout')}
                                </button>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="hidden md:flex space-x-2 md:mr-0 mr-2">
                        <button
                                onclick={() => goto(`/${$locale}/login`)}
                                class="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors hover:cursor-pointer"
                        >
                            {$_('header.login')}
                        </button>
                        <Button
                                variant="primary"
                                onclick={() => goto(`/${$locale}/register`)}
                                class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors hover:cursor-pointer"
                        >
                            {$_('header.register')}
                        </Button>
                    </div>
                {/if}
                <div class="md:hidden">
                    <Drawer.Root shouldScaleBackground direction="right" bind:open={drawerOpen}>
                        <Drawer.Trigger class="flex items-center justify-center">
                            <button class="text-foreground hover:text-primary" aria-label="Menu">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                                </svg>
                            </button>
                        </Drawer.Trigger>
                        <Drawer.Portal>
                            <Drawer.Overlay class="fixed inset-0 bg-black/40 z-50" />
                            <Drawer.Content
                                    class="fixed bottom-0 right-0 top-0 z-50 flex w-[60%] max-w-xs rounded-l-[10px] bg-card border-l border-border shadow-xl"
                            >
                                <div class="flex items-center justify-center ml-1.5">
                                    <div class="h-12 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 items-center"></div>
                                </div>
                                <div class="flex flex-col h-full w-full mt-5">
                                    <!-- Menu items -->
                                    <div class="flex-1 overflow-y-auto py-4">
                                            <button
                                                    onclick={() => {drawerOpen = false; goto(`/${$locale}/home`)}}
                                                    class="block w-full text-left px-6 py-3 text-foreground hover:bg-muted transition-colors font-medium"
                                            >
                                                {$_('header.allRecipes')}
                                            </button>
                                            <button
                                                    onclick={() => {drawerOpen = false; goto(`/${$locale}/diy`)}}
                                                    class="block w-full text-left px-6 py-3 text-foreground hover:bg-muted transition-colors font-medium"
                                            >
                                                {$_('header.diy')}
                                            </button>
                                            <button
                                                    onclick={() => {drawerOpen = false; goto(`/${$locale}/about`)}}
                                                    class="block w-full text-left px-6 py-3 text-foreground hover:bg-muted transition-colors font-medium"
                                            >
                                                {$_('header.about')}
                                            </button>
                                            <button
                                                    onclick={() => {drawerOpen = false; goto(`/${$locale}/connect-ai`)}}
                                                    class="block w-full text-left px-6 py-2 text-ai-accent hover:bg-muted transition-colors text-sm font-medium"
                                            >
                                                {$_('header.connectAI')}
                                            </button>
                                            {#if !$user}
                                                <div class="border-t border-border mt-4 pt-4 px-6 space-y-2">
                                                    <button
                                                            onclick={() => {drawerOpen = false; goto(`/${$locale}/login`)}}
                                                            class="block w-full px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors border border-border rounded-lg"
                                                    >
                                                        {$_('header.login')}
                                                    </button>
                                                    <button
                                                            onclick={() => {drawerOpen = false; goto(`/${$locale}/register`)}}
                                                            class="block w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                                                    >
                                                        {$_('header.register')}
                                                    </button>
                                                </div>
                                            {:else}
                                                <div class="border-t border-border mt-4 pt-4">
                                                    <button
                                                            onclick={() => { goto(`/${$locale}/settings`); drawerOpen = false; }}
                                                            class="block w-full text-left px-6 py-3 text-foreground hover:bg-muted transition-colors font-medium"
                                                    >
                                                        {$_('header.settings')}
                                                    </button>
                                                    <button
                                                            onclick={() => { goto(`/${$locale}/settings`); drawerOpen = false; }}
                                                            class="block w-full text-left px-6 py-3 text-foreground hover:bg-muted transition-colors font-medium"
                                                    >
                                                        {$_('header.myRecipes')}
                                                    </button>
                                                    {#if $user.admin}
                                                        <button
                                                                onclick={() => { drawerOpen = false; goto(`/${$locale}/admin`) }}
                                                                class="block w-full text-left px-6 py-3 text-foreground hover:bg-muted transition-colors font-medium"
                                                        >
                                                            {$_('header.admin')}
                                                        </button>
                                                    {/if}
                                                    <button
                                                            onclick={logout}
                                                            class="block w-full text-left px-6 py-3 text-foreground hover:bg-muted transition-colors font-medium"
                                                    >
                                                        {$_('header.logout')}
                                                    </button>
                                                </div>
                                            {/if}
                                    </div>
                                </div>
                            </Drawer.Content>
                        </Drawer.Portal>
                    </Drawer.Root>
                </div>
            </div>
        </div>
    </div>
</nav>
