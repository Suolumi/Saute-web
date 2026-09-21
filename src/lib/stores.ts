import { writable } from "svelte/store"
import { persisted } from 'svelte-persisted-store';
import { env } from '$env/dynamic/public';
import type {User} from "$lib/user";
import type {RecipeForm} from "$lib/recipes";

export const jsonParser = {
    parse: (text: any) => {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.log(e);
            return "";
        }
    },
    stringify: (object: any) => JSON.stringify(object)
}

export const accessToken = persisted('accessToken', '', {
    syncTabs: true,
    serializer: jsonParser,
});
export const refreshToken = persisted('refreshToken', '', {
    syncTabs: true,
    serializer: jsonParser,
});
export const createRecipeCache = persisted<RecipeForm | null>('createRecipeCache', null, {
    syncTabs: true,
    serializer: jsonParser,
})
export const editRecipeCache = persisted<{ id: string, data: RecipeForm } | null>('editRecipeCache', null, {
    syncTabs: true,
    serializer: jsonParser,
})

export const user = writable<User | null>(null)
export const darkMode = persisted<boolean>('darkMode', false, {
    syncTabs: true,
    serializer: jsonParser,
})
export const serverUrl = writable<string>(env.PUBLIC_SERVER_URL || 'https://recipes-api.suolumi.fr/api/v1')
