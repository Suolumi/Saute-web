<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["rect", {x: "3", y: "4", width: "18", height: "17", rx: "2"}],
        ["path", {d: "M3 9h18"}],
        ["path", {d: "M8 2v4"}],
        ["path", {d: "M16 2v4"}],
        ["path", {d: "M7 14h6"}],
        ["path", {d: "m11 12 2 2-2 2"}],
        ["path", {d: "M17 13v4"}],
    ];
</script>

<Icon name="make-ahead" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
