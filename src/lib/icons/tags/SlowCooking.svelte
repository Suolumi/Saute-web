<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M2 13h13"}],
        ["path", {d: "M13.5 13v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-6"}],
        ["path", {d: "M5.5 13a3 3 0 0 1 6 0"}],
        ["circle", {cx: "17.5", cy: "6.5", r: "4.5"}],
        ["path", {d: "M17.5 4.5v2l1.5 1"}],
    ];
</script>

<Icon name="slow-cooking" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
