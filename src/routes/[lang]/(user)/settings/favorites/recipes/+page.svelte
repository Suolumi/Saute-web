<script lang="ts">
    import FavoritesList from '../../../../../../components/FavoritesList.svelte';
    import { _ } from 'svelte-i18n';
</script>

<FavoritesList
        category="food"
        searchPlaceholder={$_('home.search')}
        ingredientsLabel={$_('home.ingredients')}
        ingredientsPlaceholder={$_('home.ingredientsPlaceholder')}
/>
