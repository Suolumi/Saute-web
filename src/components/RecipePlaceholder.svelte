<script lang="ts">
    import {
        Carrot, Cookie, CookingPot, Croissant, CupSoda, EggFried, IceCreamCone, Salad, Utensils, UtensilsCrossed, Wrench,
    } from "@lucide/svelte";
    import {_} from "svelte-i18n";
    import {recipeTypeColors} from "$lib/recipes";

    // RecipePlaceholder stands in for a recipe's pictures when it has none:
    // the kind's colour with its icon (a wrench for DIY).
    let {kind, category, class: className = ''}: { kind: string, category?: string, class?: string } = $props();

    const kindIcons: Record<string, typeof Utensils> = {
        breakfast: EggFried, starter: Salad, dish: UtensilsCrossed, "side-dish": Carrot, sauce: CookingPot,
        baking: Croissant, snack: Cookie, plate: Utensils, dessert: IceCreamCone, drink: CupSoda,
    };
    const Icon = $derived(category === 'diy' ? Wrench : kindIcons[kind] ?? Utensils);
    const colorClass = $derived(category === 'diy'
        ? 'bg-muted text-muted-foreground'
        : recipeTypeColors[kind] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300");
</script>

<div
        role="img"
        aria-label={$_('recipeCard.noPicture')}
        class="aspect-video w-full flex items-center justify-center border-b border-b-border {colorClass} {className}"
>
    <Icon class="w-1/4 h-1/4 opacity-40" strokeWidth={1.5} />
</div>
