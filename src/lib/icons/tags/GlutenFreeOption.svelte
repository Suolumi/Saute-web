<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M8 22V9"}],
        ["path", {d: "M8 9c-2-1-2.5-3-2-5 2 .5 3 2.5 2 5Z"}],
        ["path", {d: "M8 9c2-1 2.5-3 2-5-2 .5-3 2.5-2 5Z"}],
        ["path", {d: "M8 14c-2.5-.5-3.5-2.5-3.5-4.5 2.5.5 3.5 2.5 3.5 4.5Z"}],
        ["path", {d: "M8 14c2.5-.5 3.5-2.5 3.5-4.5-2.5.5-3.5 2.5-3.5 4.5Z"}],
        ["circle", {cx: "17", cy: "17", r: "5"}],
        ["path", {d: "m15 17 1.5 1.5 2.5-3"}],
    ];
</script>

<Icon name="gluten-free-option" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
