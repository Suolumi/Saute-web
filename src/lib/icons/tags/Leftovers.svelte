<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["rect", {x: "3", y: "4", width: "18", height: "3", rx: "1"}],
        ["path", {d: "M4.5 7v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7"}],
        ["path", {d: "M8 14a4 4 0 1 0 1.2-2.85"}],
        ["path", {d: "M8.5 9.5v2h2"}],
    ];
</script>

<Icon name="leftovers" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
