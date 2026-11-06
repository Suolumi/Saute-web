<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["rect", {x: "2", y: "13", width: "9", height: "8", rx: "1.5"}],
        ["rect", {x: "13", y: "13", width: "9", height: "8", rx: "1.5"}],
        ["rect", {x: "7.5", y: "3", width: "9", height: "8", rx: "1.5"}],
        ["path", {d: "M2 16h9"}],
        ["path", {d: "M13 16h9"}],
        ["path", {d: "M7.5 6h9"}],
    ];
</script>

<Icon name="batch-cooking" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
