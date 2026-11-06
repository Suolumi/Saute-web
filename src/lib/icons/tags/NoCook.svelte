<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M3 13h18"}],
        ["path", {d: "M4 13a8 8 0 0 0 16 0"}],
        ["path", {d: "M12 13c0-4 2-6 6-7 0 4-2 6-6 7Z"}],
        ["path", {d: "M12 13c0-3-1.5-5-5-6 0 3 1.5 5 5 6Z"}],
    ];
</script>

<Icon name="no-cook" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
