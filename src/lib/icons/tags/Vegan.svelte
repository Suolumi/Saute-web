<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M12 22v-9"}],
        ["path", {d: "M12 13C12 8 9 5 3 5c0 5 3 8 9 8Z"}],
        ["path", {d: "M12 11c0-5 3-8 9-8 0 5-3 8-9 8Z"}],
        ["path", {d: "M7 22h10"}],
    ];
</script>

<Icon name="vegan" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
