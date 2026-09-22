<script lang="ts">
    import {_} from 'svelte-i18n';
    import Button from '../../../../../components/Button.svelte';
    import Input from '../../../../../components/Input.svelte';
    import Modal from '../../../../../components/Modal.svelte';
    import RecipePickerModal from '../../../../../components/RecipePickerModal.svelte';
    import UserPickerModal from '../../../../../components/UserPickerModal.svelte';
    import {
        getAdminRoutes, callAdminRoute,
        type AdminRouteDescriptor, type AdminRouteParam, type AdminRouteCategory, type AdminUser
    } from '$lib/admin';
    import type {RecipePreview} from '$lib/recipes';
    import {toastError, toastSuccess} from '$lib/utils';
    import {apiErrorMessage} from '$lib/api';
    import {Search, Image as ImageIcon} from '@lucide/svelte';

    const CATEGORY_ORDER: AdminRouteCategory[] = ['users', 'recipes', 'translations', 'system'];

    // Sensible client-side defaults for common query params, applied when a
    // route is selected. Unrecognized params just start empty. These are
    // live values (included in the request as-is) - clearing the field is
    // what removes them from the query, same as any other param.
    const DEFAULT_VALUES: Record<string, string> = {limit: '20', offset: '0'};

    type PickedEntity = {id: string, label: string};

    let routes: AdminRouteDescriptor[] = $state([]);
    let filter = $state('');
    let selected: AdminRouteDescriptor | null = $state(null);

    // fieldValues holds the canonical value of every path/query param, shown
    // both in the raw path+query text field and in the per-param form below
    // it - the two stay in sync via onFieldInput/onPathQueryTextInput rather
    // than a reactive effect, to avoid a feedback loop between them.
    // pickedEntities remembers, per param name, the name/id of whatever was
    // last picked via a Select button - shown as a chip, and cleared as soon
    // as that param's value no longer matches the picked id.
    let fieldValues: Record<string, string> = $state({});
    let pickedEntities: Record<string, PickedEntity> = $state({});
    let pathQueryText = $state('');

    // Body editor: raw JSON text, parsed on submit.
    let bodyText = $state('');
    let bodyError = $state('');
    let fileValue: File | null = $state(null);
    let filePreviewUrl: string | null = $state(null);
    let isFileDragOver = $state(false);
    let fileInputEl: HTMLInputElement | undefined = $state();

    let result: unknown = $state(null);
    let submitting = $state(false);
    let confirmOpen = $state(false);
    let recipePickerOpen = $state(false);
    let userPickerOpen = $state(false);
    let activePickerParam = $state('');
    let activePickerLocation: 'path' | 'body' = $state('path');

    $effect(() => {
        getAdminRoutes().then(({response, data}) => {
            if (response.ok && data)
                routes = data;
            else
                toastError($_('admin.console.loadError'));
        });
    });

    let filteredRoutes = $derived(
        routes.filter(r => (r.label + ' ' + r.id).toLowerCase().includes(filter.toLowerCase()))
    );
    let groupedRoutes = $derived.by(() => {
        const groups: Record<AdminRouteCategory, AdminRouteDescriptor[]> = {users: [], recipes: [], translations: [], system: []};
        for (const route of filteredRoutes)
            groups[route.category]?.push(route);
        return groups;
    });

    // paramsOf guards against a descriptor with no params at all: the
    // backend sends "params": [] for every route, but a null/undefined here
    // (a future manifest entry that forgets to set it) shouldn't crash the
    // console - it should just mean "no params".
    function paramsOf(route: AdminRouteDescriptor): AdminRouteParam[] {
        return route.params ?? [];
    }

    function editableParamsOf(route: AdminRouteDescriptor): AdminRouteParam[] {
        return paramsOf(route).filter(p => p.in === 'path' || p.in === 'query');
    }

    function bodyParamsOf(route: AdminRouteDescriptor): AdminRouteParam[] {
        return paramsOf(route).filter(p => p.in === 'body' && p.type !== 'file');
    }

    function fileParamOf(route: AdminRouteDescriptor): AdminRouteParam | undefined {
        return paramsOf(route).find(p => p.type === 'file');
    }

    function bodyScaffold(params: AdminRouteParam[]): Record<string, unknown> {
        const obj: Record<string, unknown> = {};
        for (const p of params)
            obj[p.name] = p.type === 'bool' ? false : p.type === 'int' ? 0 : '';
        return obj;
    }

    // Rebuilds the editable path+query text from fieldValues: every path
    // param is substituted in (or left as a ":name" placeholder if still
    // empty), and a query param is only included when it has a value -
    // clearing a field's the only way to drop it from the request.
    function buildPathQuery(route: AdminRouteDescriptor, values: Record<string, string>): string {
        let path = route.path;
        for (const param of paramsOf(route)) {
            if (param.in === 'path')
                path = path.replace(`:${param.name}`, values[param.name] || `:${param.name}`);
        }
        const query = paramsOf(route)
            .filter(p => p.in === 'query' && values[p.name])
            .map(p => `${p.name}=${encodeURIComponent(values[p.name])}`)
            .join('&');
        return query ? `${path}?${query}` : path;
    }

    // Turns the hand-edited path+query field back into a clean request
    // target: query keys left at an empty value are dropped rather than sent
    // as literal empty strings. Kept as a final safety net at submit time,
    // on top of buildPathQuery already omitting empty query params.
    function parsePathQuery(text: string): string {
        const [path, queryStr] = text.split('?');
        if (!queryStr)
            return path;
        const cleaned = new URLSearchParams();
        for (const [key, value] of new URLSearchParams(queryStr).entries()) {
            if (value !== '')
                cleaned.set(key, value);
        }
        const cleanedStr = cleaned.toString();
        return cleanedStr ? `${path}?${cleanedStr}` : path;
    }

    // The inverse of buildPathQuery: reads path/query values back out of a
    // hand-edited path+query string. Query params are matched by key, so
    // deleting one from the text clears it. Path params are matched
    // positionally against the route's template; if the segment count no
    // longer matches (a badly mangled edit), path values are left as they
    // were rather than guessed at.
    function parseIntoFields(route: AdminRouteDescriptor, text: string): Record<string, string> {
        const [pathPart, queryStr] = text.split('?');
        const values: Record<string, string> = {};
        for (const p of paramsOf(route)) {
            if (p.in === 'query')
                values[p.name] = '';
        }
        const templateSegments = route.path.split('/');
        const actualSegments = (pathPart ?? '').split('/');
        if (templateSegments.length === actualSegments.length) {
            templateSegments.forEach((seg, i) => {
                if (seg.startsWith(':'))
                    values[seg.slice(1)] = actualSegments[i];
            });
        }
        if (queryStr) {
            for (const [key, value] of new URLSearchParams(queryStr).entries())
                values[key] = value;
        }
        return values;
    }

    // Drops the picked-item chip for any param whose value no longer matches
    // what was picked, e.g. after a manual text edit.
    function dropStaleChips() {
        for (const name of Object.keys(pickedEntities)) {
            if (pickedEntities[name].id !== (fieldValues[name] ?? '')) {
                const next = {...pickedEntities};
                delete next[name];
                pickedEntities = next;
            }
        }
    }

    function onFieldInput(param: AdminRouteParam, value: string) {
        if (!selected)
            return;
        fieldValues = {...fieldValues, [param.name]: value};
        dropStaleChips();
        pathQueryText = buildPathQuery(selected, fieldValues);
    }

    function onPathQueryTextInput(value: string) {
        pathQueryText = value;
        if (!selected)
            return;
        fieldValues = {...fieldValues, ...parseIntoFields(selected, value)};
        dropStaleChips();
    }

    function selectRoute(route: AdminRouteDescriptor) {
        selected = route;
        pickedEntities = {};
        const values: Record<string, string> = {};
        for (const param of editableParamsOf(route))
            values[param.name] = DEFAULT_VALUES[param.name] ?? '';
        fieldValues = values;
        pathQueryText = buildPathQuery(route, values);
        const bodyParams = bodyParamsOf(route);
        bodyText = bodyParams.length > 0 ? JSON.stringify(bodyScaffold(bodyParams), null, 2) : '';
        bodyError = '';
        setFileValue(null);
        result = null;
        confirmOpen = false;
    }

    function openPicker(param: AdminRouteParam, location: 'path' | 'body') {
        activePickerParam = param.name;
        activePickerLocation = location;
        if (param.picker === 'user')
            userPickerOpen = true;
        else if (param.picker === 'recipe')
            recipePickerOpen = true;
    }

    // applyPick fills whichever field the "Select" button belonged to with
    // the picked entity's id (and records a chip for it), then additionally
    // autofills every *other* query/body param on this same action whose
    // name matches a field on the picked entity (e.g. picking a user for
    // "Update user" also defaults username/email; picking one for
    // "Promote / demote admin" defaults `admin` to their current status) -
    // regardless of whether that button lived next to the path field or the
    // body editor, since both should reflect the same picked entity.
    function applyPick(picked: Record<string, unknown>) {
        if (!selected)
            return;
        const idValue = String(picked.id ?? '');
        const paramDef = paramsOf(selected).find(p => p.name === activePickerParam);
        const label = paramDef?.picker === 'user' ? String(picked.username ?? '') : String(picked.title ?? '');
        pickedEntities = {...pickedEntities, [activePickerParam]: {id: idValue, label}};

        if (activePickerLocation === 'path') {
            const values = {...fieldValues, [activePickerParam]: idValue};
            for (const param of paramsOf(selected)) {
                if ((param.in === 'path' || param.in === 'query') && param.name !== activePickerParam && param.name in picked)
                    values[param.name] = String(picked[param.name] ?? '');
            }
            fieldValues = values;
            pathQueryText = buildPathQuery(selected, values);
        }

        const bodyParams = bodyParamsOf(selected);
        if (bodyParams.length > 0) {
            let obj: Record<string, unknown> = {};
            try {
                obj = bodyText.trim() ? JSON.parse(bodyText) : {};
            } catch {
                // Current text isn't valid JSON - start fresh rather than
                // guess where the picked values belong.
            }
            if (activePickerLocation === 'body')
                obj[activePickerParam] = idValue;
            for (const param of bodyParams) {
                if (param.name in picked)
                    obj[param.name] = picked[param.name];
            }
            bodyText = JSON.stringify(obj, null, 2);
            bodyError = '';
        }
    }

    function onUserPicked(picked: AdminUser) {
        applyPick(picked as unknown as Record<string, unknown>);
    }

    function onRecipePicked(picked: RecipePreview) {
        applyPick(picked as unknown as Record<string, unknown>);
    }

    // Revokes the previous preview URL (if any) before swapping in the new
    // file, so selecting/clearing repeatedly doesn't leak object URLs.
    function setFileValue(file: File | null) {
        if (filePreviewUrl)
            URL.revokeObjectURL(filePreviewUrl);
        fileValue = file;
        filePreviewUrl = file ? URL.createObjectURL(file) : null;
    }

    function onFileSelected(e: Event) {
        const input = e.target as HTMLInputElement;
        setFileValue(input.files?.[0] ?? null);
    }

    function onFileDrop(e: DragEvent) {
        e.preventDefault();
        isFileDragOver = false;
        const file = e.dataTransfer?.files?.[0];
        if (file)
            setFileValue(file);
    }

    function onFileDragOver(e: DragEvent) {
        e.preventDefault();
        isFileDragOver = true;
    }

    function onFileDragLeave() {
        isFileDragOver = false;
    }

    function doSubmit() {
        if (!selected)
            return;
        if (selected.destructive && !confirmOpen) {
            confirmOpen = true;
            return;
        }
        confirmOpen = false;

        const bodyParams = bodyParamsOf(selected);
        let body: Record<string, unknown> | null = null;
        if (bodyParams.length > 0) {
            try {
                body = bodyText.trim() ? JSON.parse(bodyText) : {};
                bodyError = '';
            } catch {
                bodyError = $_('admin.console.bodyInvalid');
                return;
            }
        }

        const fileParam = fileParamOf(selected);
        const file = fileParam && fileValue ? {field: fileParam.name, value: fileValue} : null;

        submitting = true;
        callAdminRoute(selected, parsePathQuery(pathQueryText), body, file).then(({response, data}) => {
            result = data;
            if (response.ok)
                toastSuccess($_('admin.console.success'));
            else
                toastError(apiErrorMessage(data, $_('admin.console.error')));
        }).finally(() => {
            submitting = false;
        });
    }
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="md:col-span-1 space-y-3">
        <h1 class="text-2xl font-bold text-foreground">{$_('admin.console.title')}</h1>
        <Input type="search" bind:value={filter} placeholder={$_('admin.console.filterPlaceholder')} />
        <div class="bg-card rounded-lg border border-border divide-y divide-border max-h-[70vh] overflow-y-auto scrollbar-hide">
            {#if filteredRoutes.length === 0}
                <p class="p-3 text-muted-foreground text-sm">{$_('admin.console.none')}</p>
            {/if}
            {#each CATEGORY_ORDER as category (category)}
                {#if groupedRoutes[category].length > 0}
                    <div>
                        <p class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50">
                            {$_('admin.console.categories.' + category)}
                        </p>
                        {#each groupedRoutes[category] as route (route.id)}
                            <button
                                    type="button"
                                    onclick={() => selectRoute(route)}
                                    class="block w-full text-left p-3 hover:bg-muted transition-colors hover:cursor-pointer {selected?.id === route.id ? 'bg-muted' : ''}"
                            >
                                <p class="font-medium text-sm text-card-foreground">{route.label}</p>
                                <p class="text-xs text-muted-foreground">{route.method} {route.path}</p>
                            </button>
                        {/each}
                    </div>
                {/if}
            {/each}
        </div>
    </div>

    <div class="md:col-span-2">
        {#if selected}
            {@const editableParams = editableParamsOf(selected)}
            {@const bodyPickers = bodyParamsOf(selected).filter(p => p.picker)}
            {@const fileParam = fileParamOf(selected)}
            <div class="bg-card rounded-lg border border-border p-6 space-y-4">
                <div>
                    <h2 class="text-lg font-semibold text-foreground">{selected.label}</h2>
                    <p class="text-sm text-muted-foreground">{selected.description}</p>
                    <p class="text-xs text-muted-foreground mt-1">{selected.method}</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-foreground mb-1" for="console-path">
                        {$_('admin.console.pathLabel')}
                    </label>
                    <Input
                            id="console-path" type="text" class="font-mono text-sm"
                            value={pathQueryText}
                            oninput={(e: Event) => onPathQueryTextInput((e.currentTarget as HTMLInputElement).value)}
                    />
                </div>

                {#if editableParams.length > 0}
                    <div class="border border-border rounded-lg p-4 space-y-4">
                        <p class="text-sm font-medium text-foreground">{$_('admin.console.paramsFormTitle')}</p>
                        {#each editableParams as param (param.name)}
                            <div>
                                <label class="block text-xs font-medium text-muted-foreground mb-1" for={`console-field-${param.name}`}>
                                    {param.label}{param.required ? ' *' : ''}
                                </label>
                                <div class="flex items-center gap-2">
                                    <Input
                                            id={`console-field-${param.name}`}
                                            type={param.type === 'int' ? 'number' : 'text'}
                                            class="font-mono text-sm flex-1"
                                            value={fieldValues[param.name] ?? ''}
                                            oninput={(e: Event) => onFieldInput(param, (e.currentTarget as HTMLInputElement).value)}
                                    />
                                    {#if param.picker}
                                        <Button type="button" size="sm" variant="outline" class="flex-shrink-0" onclick={() => openPicker(param, 'path')}>
                                            <Search class="w-4 h-4 mr-1" />{$_('admin.console.select')} {param.label}
                                        </Button>
                                    {/if}
                                </div>
                                {#if pickedEntities[param.name]}
                                    <p class="mt-1 inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                        <span class="font-medium">{pickedEntities[param.name].label}</span>
                                        <code class="font-mono opacity-70">{pickedEntities[param.name].id}</code>
                                    </p>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                {#if bodyText}
                    <div>
                        <label class="block text-sm font-medium text-foreground mb-1" for="console-body">
                            {$_('admin.console.bodyLabel')}
                        </label>
                        <textarea
                                id="console-body"
                                bind:value={bodyText}
                                rows="8"
                                class="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        ></textarea>
                        {#if bodyError}
                            <p class="text-sm text-destructive mt-1">{bodyError}</p>
                        {/if}
                        {#if bodyPickers.length > 0}
                            <div class="flex flex-wrap gap-3 mt-2">
                                {#each bodyPickers as param (param.name)}
                                    <div>
                                        <Button type="button" size="sm" variant="outline" onclick={() => openPicker(param, 'body')}>
                                            <Search class="w-4 h-4 mr-1" />{$_('admin.console.select')} {param.label}
                                        </Button>
                                        {#if pickedEntities[param.name]}
                                            <p class="mt-1 inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                                <span class="font-medium">{pickedEntities[param.name].label}</span>
                                                <code class="font-mono opacity-70">{pickedEntities[param.name].id}</code>
                                            </p>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if fileParam}
                    <div>
                        <label class="block text-sm font-medium text-foreground mb-1" id="console-file-label" for="console-file">
                            {fileParam.label}
                        </label>
                        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                        <div
                                class="border-2 border-dashed rounded-lg p-4 flex items-center gap-4 transition-colors hover:cursor-pointer {isFileDragOver ? 'border-primary bg-primary/5' : 'border-border'}"
                                ondrop={onFileDrop}
                                ondragover={onFileDragOver}
                                ondragleave={onFileDragLeave}
                                onclick={() => fileInputEl?.click()}
                                role="button"
                                tabindex="0"
                                aria-labelledby="console-file-label"
                        >
                            {#if filePreviewUrl}
                                <img src={filePreviewUrl} alt="" class="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-border" />
                            {:else}
                                <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                                    <ImageIcon class="w-6 h-6" />
                                </div>
                            {/if}
                            <div class="min-w-0">
                                {#if fileValue}
                                    <p class="text-sm font-medium text-foreground truncate">{fileValue.name}</p>
                                    <p class="text-xs text-muted-foreground">{$_('admin.console.fileChange')}</p>
                                {:else}
                                    <p class="text-sm">
                                        <span class="text-primary hover:text-primary/80 font-medium">{$_('fileUpload.click')}</span>
                                        <span class="text-muted-foreground">{$_('fileUpload.drag')}</span>
                                    </p>
                                {/if}
                            </div>
                        </div>
                        <input
                                bind:this={fileInputEl}
                                id="console-file"
                                type="file"
                                accept="image/*"
                                onchange={onFileSelected}
                                class="hidden"
                        />
                    </div>
                {/if}

                <Button variant="primary" disabled={submitting} onclick={doSubmit}>
                    {submitting ? $_('admin.console.submitting') : $_('admin.console.submit')}
                </Button>

                {#if result !== null}
                    <div>
                        <label class="block text-sm font-medium text-foreground mb-1" for="console-response">
                            {$_('admin.console.responseLabel')}
                        </label>
                        <textarea
                                id="console-response"
                                readonly
                                value={JSON.stringify(result, null, 2)}
                                rows="8"
                                class="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none"
                        ></textarea>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="bg-card rounded-lg border border-border p-6 text-muted-foreground">
                {$_('admin.console.selectPrompt')}
            </div>
        {/if}
    </div>
</div>

<UserPickerModal open={userPickerOpen} onClose={() => userPickerOpen = false} onSelect={onUserPicked} />
<RecipePickerModal open={recipePickerOpen} flat={true} onClose={() => recipePickerOpen = false} onSelect={onRecipePicked} />

<Modal open={confirmOpen} onClose={() => confirmOpen = false} title={$_('admin.console.confirmTitle')} description={$_('admin.console.confirmDescription')}>
    <div class="flex justify-between">
        <Button variant="outline" onclick={() => confirmOpen = false}>
            {$_('admin.console.cancel')}
        </Button>
        <Button variant="primary" onclick={doSubmit}>
            {$_('admin.console.confirm')}
        </Button>
    </div>
</Modal>
