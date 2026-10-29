import {
    Baby, Beef, CakeSlice, Carrot, Clock, Coins, Cookie, CookingPot, Croissant, Drumstick, Dumbbell, EggOff, Fish,
    Flame, FlameKindling, Gift, HeartPulse, Heater, Hourglass, Layers, Leaf, LeafyGreen, MilkOff, Microwave, NutOff,
    PiggyBank, Recycle, Refrigerator, Salad, Sandwich, Snowflake, Soup, Sparkles, Sprout, Star, Sun, Tag, Tent, Timer,
    Trees, Users, Utensils, Vegan, WheatOff, WineOff, Zap,
} from "@lucide/svelte";

// tagIcons is the Lucide icons an admin can give a tag, by Lucide name. A
// curated list keeps the bundle from pulling in every icon.
export const tagIcons: Record<string, typeof Tag> = {
    "vegan": Vegan, "leaf": Leaf, "leafy-green": LeafyGreen, "salad": Salad, "sprout": Sprout, "carrot": Carrot,
    "fish": Fish, "beef": Beef, "drumstick": Drumstick, "wheat-off": WheatOff, "milk-off": MilkOff,
    "egg-off": EggOff, "nut-off": NutOff, "wine-off": WineOff, "dumbbell": Dumbbell, "heart-pulse": HeartPulse,
    "cooking-pot": CookingPot, "soup": Soup, "flame": Flame, "flame-kindling": FlameKindling, "heater": Heater,
    "microwave": Microwave, "refrigerator": Refrigerator, "snowflake": Snowflake, "hourglass": Hourglass,
    "timer": Timer, "clock": Clock, "zap": Zap, "layers": Layers, "recycle": Recycle, "piggy-bank": PiggyBank,
    "coins": Coins, "sandwich": Sandwich, "baby": Baby, "users": Users, "gift": Gift, "trees": Trees, "tent": Tent,
    "sun": Sun, "cake-slice": CakeSlice, "cookie": Cookie, "croissant": Croissant, "utensils": Utensils,
    "sparkles": Sparkles, "star": Star,
}

// tagIcon is a tag's icon component, or a plain tag icon when it has none
// or an unknown one.
export function tagIcon(name: string | undefined): typeof Tag {
    return (name && tagIcons[name]) || Tag
}
