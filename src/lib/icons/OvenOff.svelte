<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    // An oven (control strip with knobs, door window), slashed.
    const iconNode: IconNode = [
        ["rect", {width: "18", height: "18", x: "3", y: "3", rx: "2"}],
        ["path", {d: "M3 9h18"}],
        ["path", {d: "M14 6h.01"}],
        ["path", {d: "M18 6h.01"}],
        ["rect", {width: "12", height: "6", x: "6", y: "12", rx: "1"}],
        ["path", {d: "m2 2 20 20"}],
    ];
</script>

<Icon name="oven-off" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
