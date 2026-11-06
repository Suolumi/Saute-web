import {
    Baby, Beef, CakeSlice, Carrot, Clock, Coins, Cookie, CookingPot, Croissant, Drumstick, Dumbbell, EggOff, Fish,
    Flame, FlameKindling, Gift, HeartPulse, Heater, Hourglass, Layers, Leaf, LeafyGreen, MilkOff, NutOff,
    Package, PiggyBank, Recycle, Refrigerator, Salad, Sandwich, Snowflake, Soup, Sparkles, Sprout, Star, Sun, Tag, Tent, Timer,
    Trees, Users, Utensils, WheatOff, WineOff, Zap,
} from "@lucide/svelte";
import FlameOff from "./icons/FlameOff.svelte";
import OvenOff from "./icons/OvenOff.svelte";
import GlutenFreeOption from "./icons/tags/GlutenFreeOption.svelte";
import HighProtein from "./icons/tags/HighProtein.svelte";
import Pescatarian from "./icons/tags/Pescatarian.svelte";
import Vegan from "./icons/tags/Vegan.svelte";
import Vegetarian from "./icons/tags/Vegetarian.svelte";
import BatchCooking from "./icons/tags/BatchCooking.svelte";
import BudgetFriendly from "./icons/tags/BudgetFriendly.svelte";
import FreezerFriendly from "./icons/tags/FreezerFriendly.svelte";
import Leftovers from "./icons/tags/Leftovers.svelte";
import MakeAhead from "./icons/tags/MakeAhead.svelte";
import Microwave from "./icons/tags/Microwave.svelte";
import NoCook from "./icons/tags/NoCook.svelte";
import NoOven from "./icons/tags/NoOven.svelte";
import OnePot from "./icons/tags/OnePot.svelte";
import SlowCooking from "./icons/tags/SlowCooking.svelte";

// tagIcons is the icons an admin can give a tag, by Lucide name (or a
// Lucide-style name for the custom ones). A curated list keeps the bundle
// from pulling in every icon.
export const tagIcons: Record<string, typeof Tag> = {
    // Drawn for the original tags, named after their slug.
    "gluten-free-option": GlutenFreeOption, "high-protein": HighProtein, "pescatarian": Pescatarian, "vegan": Vegan,
    "vegetarian": Vegetarian, "batch-cooking": BatchCooking, "budget-friendly": BudgetFriendly, "freezer-friendly": FreezerFriendly,
    "leftovers": Leftovers, "make-ahead": MakeAhead, "microwave": Microwave, "no-cook": NoCook,
    "no-oven": NoOven, "one-pot": OnePot, "slow-cooking": SlowCooking,
    "leaf": Leaf, "leafy-green": LeafyGreen, "salad": Salad, "sprout": Sprout, "carrot": Carrot,
    "fish": Fish, "beef": Beef, "drumstick": Drumstick, "wheat-off": WheatOff, "milk-off": MilkOff,
    "egg-off": EggOff, "nut-off": NutOff, "wine-off": WineOff, "dumbbell": Dumbbell, "heart-pulse": HeartPulse,
    "cooking-pot": CookingPot, "soup": Soup, "flame": Flame, "flame-kindling": FlameKindling, "flame-off": FlameOff, "heater": Heater,
    "oven-off": OvenOff, "refrigerator": Refrigerator, "snowflake": Snowflake, "hourglass": Hourglass,
    "timer": Timer, "clock": Clock, "zap": Zap, "layers": Layers, "recycle": Recycle, "piggy-bank": PiggyBank, "package": Package,
    "coins": Coins, "sandwich": Sandwich, "baby": Baby, "users": Users, "gift": Gift, "trees": Trees, "tent": Tent,
    "sun": Sun, "cake-slice": CakeSlice, "cookie": Cookie, "croissant": Croissant, "utensils": Utensils,
    "sparkles": Sparkles, "star": Star,
}

// tagIcon is a tag's icon component, or a plain tag icon when it has none
// or an unknown one.
export function tagIcon(name: string | undefined): typeof Tag {
    return (name && tagIcons[name]) || Tag
}
