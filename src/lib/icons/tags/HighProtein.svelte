<script lang="ts">
    import {Icon, type IconNode, type IconProps} from "@lucide/svelte";

    let props: IconProps = $props();

    const iconNode: IconNode = [
        ["path", {d: "M4 20c-2.5-2-2.5-6 0-8.5S9 7 12.5 8s5.5 3.5 4.5 6.5-4 4-6.5 5-4 2.5-6.5.5Z"}],
        ["circle", {cx: "8", cy: "14.5", r: "2"}],
        ["path", {d: "M19 2v6"}],
        ["path", {d: "M16 5h6"}],
    ];
</script>

<Icon name="high-protein" {...props} {iconNode}>
    {@render props.children?.()}
</Icon>
