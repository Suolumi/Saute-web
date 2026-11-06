<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M2 9c2-3 5-4 8-4s5 2 6 4c-1 2-3 4-6 4S4 12 2 9Z"}],
        ["path", {d: "M16 9l3-3v6Z"}],
        ["circle", {cx: "6", cy: "8.5", r: ".5"}],
        ["path", {d: "M11 22c0-5 3-8 9-8 0 6-3 8-9 8Z"}],
        ["path", {d: "M11 22l5-4"}],
    ];
</script>

<Icon name="pescatarian" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
