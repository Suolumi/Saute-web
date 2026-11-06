<script lang="ts">
    import {_} from "svelte-i18n";
    import Modal from "./Modal.svelte";
    import Label from "./Label.svelte";
    import Input from "./Input.svelte";
    import {activeTimers, startAdHocTimer} from "$lib/recipeTimers";
    import {unlockAlarmAudio} from "$lib/timerAlarm";

    let {open = $bindable(false)}: {open?: boolean} = $props();

    let name = $state('');
    // bind:value on a number input yields a number once typed.
    let minutes: number | string = $state('');
    let seconds: number | string = $state('');

    const presets = [1, 5, 10, 15, 30];

    function start(totalMinutes: number) {
        if (totalMinutes <= 0)
            return;
        unlockAlarmAudio();
        const adHocCount = $activeTimers.filter(t => t.recipeId === null).length;
        startAdHocTimer(name.trim() || $_('adHocTimer.autoLabel', {values: {n: adHocCount + 1}}), totalMinutes);
        name = '';
        minutes = '';
        seconds = '';
        open = false;
    }
</script>

<Modal {open} title={$_('adHocTimer.title')} onClose={() => open = false}>
    <div class="space-y-5">
        <div class="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
                <Label for="adhoc-timer-name">{$_('adHocTimer.nameLabel')}</Label>
                <Input id="adhoc-timer-name" type="text" placeholder={$_('adHocTimer.namePlaceholder')} bind:value={name} />
            </div>
            <div>
                <Label for="adhoc-timer-minutes">{$_('adHocTimer.minutesLabel')}</Label>
                <Input id="adhoc-timer-minutes" type="number" min={0} class="w-20" bind:value={minutes} />
            </div>
            <div>
                <Label for="adhoc-timer-seconds">{$_('adHocTimer.secondsLabel')}</Label>
                <Input id="adhoc-timer-seconds" type="number" min={0} max={59} class="w-20" bind:value={seconds} />
            </div>
        </div>
        <button
                type="button"
                onclick={() => start((Number(minutes) || 0) + (Number(seconds) || 0) / 60)}
                class="w-full px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors hover:cursor-pointer"
        >
            {$_('adHocTimer.start')}
        </button>
        <div>
            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{$_('adHocTimer.presets')}</div>
            <div class="flex flex-wrap gap-2">
                {#each presets as preset}
                    <button
                            type="button"
                            onclick={() => start(preset)}
                            class="px-4 py-2 rounded-full text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted transition-colors hover:cursor-pointer"
                    >
                        {$_('adHocTimer.presetMinutes', {values: {minutes: preset}})}
                    </button>
                {/each}
            </div>
        </div>
    </div>
</Modal>
