<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M9 21a6 6 0 0 1-6-6c0-4 2.5-9 6-9s6 5 6 9a6 6 0 0 1-6 6Z"}],
        ["path", {d: "M15 9c0-4 2.5-6 7-6 0 4-2.5 6-7 6Z"}],
        ["path", {d: "M15 9l3-3"}],
    ];
</script>

<Icon name="vegetarian" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
