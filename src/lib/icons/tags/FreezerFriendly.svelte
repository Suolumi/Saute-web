<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["rect", {x: "3", y: "3", width: "18", height: "18", rx: "2"}],
        ["path", {d: "M3 8h18"}],
        ["path", {d: "M12 11v8"}],
        ["path", {d: "m8.5 13 7 4"}],
        ["path", {d: "m8.5 17 7-4"}],
    ];
</script>

<Icon name="freezer-friendly" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
