<script lang="ts">
    import {user, darkMode, accessToken, refreshToken, serverUrl} from '$lib/stores';
    import {goto} from "$app/navigation";
    import {page} from "$app/state";
    import Button from "./Button.svelte";
    import {onDestroy, onMount} from "svelte";
    import {browser} from "$app/environment";
    import {_, locale} from "svelte-i18n";
    import LanguageSelect from "./LanguageSelect.svelte";
    import {Drawer} from "vaul-svelte";
    import {Home, Wrench, Info, Sparkles, Settings, BookOpen, Heart, ShieldCheck, LogOut, ChevronRight, X} from "@lucide/svelte";

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

    let pathSegment = $derived(page.url.pathname.split('/').filter(Boolean)[1]);

    function navRowClass(active: boolean): string {
        return `flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors ${active ? 'bg-primary/10' : 'hover:bg-muted'}`;
    }

    function navChipClass(active: boolean): string {
        return `flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${active ? 'bg-primary/15 text-primary' : 'bg-foreground/10 text-foreground'}`;
    }

    function navLabelClass(active: boolean): string {
        return `text-[15px] ${active ? 'font-semibold text-primary' : 'font-medium text-foreground'}`;
    }

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
                                <button
                                        onclick={() => { goto(`/${$locale}/settings/favorites/recipes`); showProfileDropdown = false; }}
                                        class="block w-full text-left px-4 py-2 text-sm text-foreground transition-colors hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                                >
                                    {$_('header.myFavorites')}
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
                                    class="fixed bottom-0 right-0 top-0 z-50 flex w-[78%] max-w-sm flex-col overflow-hidden rounded-l-[20px] bg-card shadow-xl"
                            >
                                {#if $user}
                                    <div class="relative flex-shrink-0 border-b border-primary/20 bg-primary/10 px-5 py-4">
                                        <button
                                                onclick={() => drawerOpen = false}
                                                aria-label="Close menu"
                                                class="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-foreground/10"
                                        >
                                            <X class="w-4 h-4" />
                                        </button>
                                        <button
                                                onclick={() => { drawerOpen = false; goto(`/${$locale}/settings`); }}
                                                class="mt-2.5 flex w-full items-center gap-3 text-left"
                                        >
                                            {#if $user.picture}
                                                <img src={`${$serverUrl}/pictures/${$user.picture}`} alt="" class="h-11 w-11 flex-shrink-0 rounded-full object-cover" />
                                            {:else}
                                                <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[17px] font-bold text-primary-foreground">
                                                    {$user.username?.charAt(0) || '?'}
                                                </div>
                                            {/if}
                                            <div class="flex min-w-0 flex-col gap-0.5">
                                                <div class="truncate text-[15px] font-semibold text-foreground">{$user.username}</div>
                                                <div class="flex items-center gap-0.5 text-xs text-muted-foreground">
                                                    {$_('header.viewProfile')}
                                                    <ChevronRight class="w-3 h-3" />
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                {:else}
                                    <div class="flex flex-shrink-0 items-center justify-end px-4 py-3">
                                        <button
                                                onclick={() => drawerOpen = false}
                                                aria-label="Close menu"
                                                class="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted"
                                        >
                                            <X class="w-4 h-4" />
                                        </button>
                                    </div>
                                {/if}

                                <div class="flex flex-1 flex-col overflow-y-auto pb-3">
                                    <div class="px-5 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">
                                        {$_('header.browse')}
                                    </div>
                                    <div class="flex flex-col gap-0.5 px-3">
                                        <button
                                                onclick={() => {drawerOpen = false; goto(`/${$locale}/home`)}}
                                                class={navRowClass(pathSegment === 'home')}
                                        >
                                            <div class={navChipClass(pathSegment === 'home')}>
                                                <Home class="w-4 h-4" />
                                            </div>
                                            <div class={navLabelClass(pathSegment === 'home')}>{$_('header.allRecipes')}</div>
                                            {#if pathSegment === 'home'}
                                                <div class="ml-auto mr-1.5 h-1.5 w-1.5 rounded-full bg-primary"></div>
                                            {/if}
                                        </button>
                                        <button
                                                onclick={() => {drawerOpen = false; goto(`/${$locale}/diy`)}}
                                                class={navRowClass(pathSegment === 'diy')}
                                        >
                                            <div class={navChipClass(pathSegment === 'diy')}>
                                                <Wrench class="w-4 h-4" />
                                            </div>
                                            <div class={navLabelClass(pathSegment === 'diy')}>{$_('header.diy')}</div>
                                            {#if pathSegment === 'diy'}
                                                <div class="ml-auto mr-1.5 h-1.5 w-1.5 rounded-full bg-primary"></div>
                                            {/if}
                                        </button>
                                        <button
                                                onclick={() => {drawerOpen = false; goto(`/${$locale}/about`)}}
                                                class={navRowClass(pathSegment === 'about')}
                                        >
                                            <div class={navChipClass(pathSegment === 'about')}>
                                                <Info class="w-4 h-4" />
                                            </div>
                                            <div class={navLabelClass(pathSegment === 'about')}>{$_('header.about')}</div>
                                            {#if pathSegment === 'about'}
                                                <div class="ml-auto mr-1.5 h-1.5 w-1.5 rounded-full bg-primary"></div>
                                            {/if}
                                        </button>
                                    </div>

                                    <div class="px-5 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">
                                        {$_('header.aiTools')}
                                    </div>
                                    <div class="px-3">
                                        <button
                                                onclick={() => {drawerOpen = false; goto(`/${$locale}/connect-ai`)}}
                                                class="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-ai-accent/5"
                                        >
                                            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ai-accent/15 text-ai-accent">
                                                <Sparkles class="w-4 h-4" />
                                            </div>
                                            <div class="text-[15px] font-medium text-ai-accent">{$_('header.connectAI')}</div>
                                            <div class="ml-auto mr-1.5 rounded-full bg-ai-accent/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-ai-accent">AI</div>
                                        </button>
                                    </div>

                                    {#if $user}
                                        <div class="px-5 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">
                                            {$_('header.account')}
                                        </div>
                                        <div class="flex flex-col gap-0.5 px-3">
                                            <button
                                                    onclick={() => { goto(`/${$locale}/settings`); drawerOpen = false; }}
                                                    class={navRowClass(false)}
                                            >
                                                <div class={navChipClass(false)}>
                                                    <Settings class="w-4 h-4" />
                                                </div>
                                                <div class={navLabelClass(false)}>{$_('header.settings')}</div>
                                            </button>
                                            <button
                                                    onclick={() => { goto(`/${$locale}/settings`); drawerOpen = false; }}
                                                    class={navRowClass(false)}
                                            >
                                                <div class={navChipClass(false)}>
                                                    <BookOpen class="w-4 h-4" />
                                                </div>
                                                <div class={navLabelClass(false)}>{$_('header.myRecipes')}</div>
                                            </button>
                                            <button
                                                    onclick={() => { goto(`/${$locale}/settings/favorites/recipes`); drawerOpen = false; }}
                                                    class={navRowClass(false)}
                                            >
                                                <div class={navChipClass(false)}>
                                                    <Heart class="w-4 h-4" />
                                                </div>
                                                <div class={navLabelClass(false)}>{$_('header.myFavorites')}</div>
                                            </button>
                                            {#if $user.admin}
                                                <button
                                                        onclick={() => { drawerOpen = false; goto(`/${$locale}/admin`) }}
                                                        class={navRowClass(false)}
                                                >
                                                    <div class={navChipClass(false)}>
                                                        <ShieldCheck class="w-4 h-4" />
                                                    </div>
                                                    <div class={navLabelClass(false)}>{$_('header.admin')}</div>
                                                </button>
                                            {/if}
                                        </div>

                                        <div class="flex-1"></div>

                                        <button
                                                onclick={logout}
                                                class="mx-4 mb-4 mt-4 flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-destructive px-3 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5"
                                        >
                                            <LogOut class="w-4 h-4" />
                                            {$_('header.logout')}
                                        </button>
                                    {:else}
                                        <div class="flex-1"></div>
                                        <div class="space-y-2 px-6 pb-2 pt-4">
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
                                    {/if}
                                </div>
                            </Drawer.Content>
                        </Drawer.Portal>
                    </Drawer.Root>
                </div>
            </div>
        </div>
    </div>
</nav>
