<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["ellipse", {cx: "9", cy: "6", rx: "6", ry: "2.5"}],
        ["path", {d: "M3 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6"}],
        ["path", {d: "M3 10v4c0 1.4 2.7 2.5 6 2.5"}],
        ["path", {d: "M3 14v4c0 1.4 2.7 2.5 6 2.5"}],
        ["path", {d: "M18 13v8"}],
        ["path", {d: "m15 18 3 3 3-3"}],
    ];
</script>

<Icon name="budget-friendly" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
