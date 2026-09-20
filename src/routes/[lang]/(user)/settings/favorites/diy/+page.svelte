<script lang="ts">
    import FavoritesList from '../../../../../../components/FavoritesList.svelte';
    import { _ } from 'svelte-i18n';
</script>

<FavoritesList
        category="diy"
        showKind={false}
        showTime={false}
        searchPlaceholder={$_('home.search')}
        ingredientsLabel={$_('diyHome.materials')}
        ingredientsPlaceholder={$_('diyHome.materialsPlaceholder')}
/>
