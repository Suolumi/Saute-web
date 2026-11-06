<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M3 11h18"}],
        ["path", {d: "M5 11v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7"}],
        ["path", {d: "M3 13H1.5"}],
        ["path", {d: "M21 13h1.5"}],
        ["path", {d: "M14 11 17 2"}],
    ];
</script>

<Icon name="one-pot" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
