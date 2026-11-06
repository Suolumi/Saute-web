<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["rect", {x: "2", y: "7", width: "20", height: "13", rx: "2"}],
        ["rect", {x: "5", y: "10", width: "10", height: "7", rx: "1"}],
        ["path", {d: "M18.5 10.5v.01"}],
        ["path", {d: "M18.5 13.5v3"}],
        ["path", {d: "M8 4c.5-.7.5-1.3 0-2"}],
        ["path", {d: "M12 4c.5-.7.5-1.3 0-2"}],
    ];
</script>

<Icon name="microwave" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
