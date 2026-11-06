import {redirect} from '@sveltejs/kit';

// The Toolbox page was removed; old links land on the recipe list.
export function load({params}) {
    redirect(301, `/${params.lang}/home`);
}
