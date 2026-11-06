<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["rect", {x: "3", y: "3", width: "18", height: "18", rx: "2"}],
        ["path", {d: "M3 8h18"}],
        ["path", {d: "M7 5.5h.01"}],
        ["path", {d: "M11 5.5h.01"}],
        ["rect", {x: "7", y: "11", width: "10", height: "6", rx: "1"}],
        ["path", {d: "m2 2 20 20"}],
    ];
</script>

<Icon name="no-oven" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
