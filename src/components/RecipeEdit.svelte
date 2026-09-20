<script lang="ts">
    import Button from "./Button.svelte";
    import Input from "./Input.svelte";
    import Textarea from './Textarea.svelte';
    import Select from './Select.svelte';
    import Label from './Label.svelte';
    import RecipeCard from "./RecipeCard.svelte";
    import RecipePickerModal from "./RecipePickerModal.svelte";
    import {
        getIngredientName,
        getReferenceQuantity,
        groupIngredients,
        type Ingredient,
        type RecipeCategory,
        type RecipeForm,
        type RecipePicture,
        type RecipePreview,
        RecipeTypes,
        type Step
    } from "$lib/recipes";
    import FileUpload from "./FileUpload.svelte";
    import ImageCropModal from "./ImageCropModal.svelte";
    import {createRecipeCache, editRecipeCache, serverUrl, user} from "$lib/stores";
    import {untrack} from "svelte";
    import {_} from 'svelte-i18n'
    import {toastError} from "$lib/utils";
    import {Trash2, GripVertical, EllipsisVertical, Plus, Pencil, Link2} from "@lucide/svelte";

    interface Props {
        onChange?: (recipe: RecipeForm) => void;
        onSubmit?: (recipe: RecipeForm, newPictures: File[], newStepPictures: Record<number, File>) => void;
        recipe?: RecipeForm
        recipeId?: string
        // excludeFamily is this recipe's own root id (if it has one yet) -
        // passed to the recipe-reference picker so a recipe can't offer
        // itself/its own family as a reference target.
        excludeFamily?: string
        // pictureAttribution, when non-empty, is the recipe's full picture
        // list (with who added each one) - set only when the caller has
        // fullPictureAccess (an admin editing a recipe they don't author),
        // and used purely to render an attribution badge per picture in the
        // photo step; recipe.pictures itself stays a plain filename list
        // either way (see recipeFormFromSource in the edit page).
        pictureAttribution?: RecipePicture[]
        // category drives the blank-form default when no recipe/cache exists
        // yet (a variation or edit's own recipe.category always wins once
        // loaded, see getRecipe/normalizeRecipe) and picks the terminology
        // set (t()) plus whether the food kind/type selector shows.
        category?: RecipeCategory
        headLabel: string
        commentLabel: string
    }

    let {
        onChange = (recipe: RecipeForm) => {},
        onSubmit = (recipe: RecipeForm, newPictures: File[], newStepPictures: Record<number, File>) => {},
        recipe = undefined,
        recipeId = undefined,
        excludeFamily = undefined,
        pictureAttribution = [],
        category = 'food',
        headLabel = $_('create.headLabel'),
        commentLabel = $_('create.commentLabel'),
    }: Props = $props()

    // Terminology lookup: for a diy-category recipe, tries `<diyNamespace>.<key>`
    // first and falls back to `<namespace>.<key>` when no diy-specific
    // override exists (svelte-i18n returns the key itself on a miss).
    function categoryLabel(namespace: string, diyNamespace: string, key: string, values?: Record<string, string | number>): string {
        if (formData.category === 'diy') {
            const diyKey = diyNamespace + '.' + key
            const diyValue = $_(diyKey, values ? {values} : undefined)
            if (diyValue !== diyKey) return diyValue
        }
        return $_(namespace + '.' + key, values ? {values} : undefined)
    }

    function t(key: string, values?: Record<string, string | number>): string {
        return categoryLabel('edit', 'diyEdit', key, values)
    }

    let recipePickerOpen = $state(false);
    let recipePickerTargetSection = $state<string | null>(null);

    function openRecipePicker(sectionId: string) {
        recipePickerTargetSection = sectionId;
        recipePickerOpen = true;
    }

    function onRecipePicked(picked: RecipePreview) {
        if (recipePickerTargetSection)
            addRecipeRefToSection(recipePickerTargetSection, picked);
    }

    let formData = $state<RecipeForm>(getRecipe(recipe));
    let pendingPictures = $state<{file: File, url: string}[]>([])

    // --- Step editing --------------------------------------------------------
    // Steps carry no server-side identity, but drag-reorder and per-step pending
    // photo uploads both need a stable client-only key, so editing happens on
    // `stepRows` (uid + fields) and is flattened back into formData.steps, the
    // same pattern `sections` below uses for ingredients.

    type EditStep = { uid: string, title: string, description: string, picture: string };

    let stepUid = 0;

    function nextStepUid(): string {
        stepUid += 1;
        return `step-${stepUid}`;
    }

    function buildStepRows(stepsList: Step[]): EditStep[] {
        return stepsList.map(step => ({uid: nextStepUid(), title: step.title, description: step.description, picture: step.picture ?? ''}));
    }

    let stepRows = $state<EditStep[]>(untrack(() => buildStepRows(formData.steps)));
    let stepPendingPictures = $state<Record<string, {file: File, url: string}>>({});

    $effect(() => {
        formData.steps = stepRows.map(({title, description, picture}) => picture ? {title, description, picture} : {title, description});
    });

    const steps = [
        {id: 'basics', icon: 'M4 6h16M4 12h16M4 18h7'},
        {id: 'ingredients', icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'},
        {id: 'instructions', icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'},
        {id: 'photos', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'},
    ]
    let currentStep = $state(0);

    function goToStep(index: number) {
        currentStep = Math.max(0, Math.min(steps.length - 1, index));
    }

    $effect(() => {
        if (recipe)
            untrack(() => {
                formData = getRecipe(recipe)
                sections = buildSections(formData.ingredients)
                stepRows = buildStepRows(formData.steps)
            })
    })

    $effect(() => {
        onChange(formData)
        if (recipeId !== undefined)
            $editRecipeCache = {id: recipeId, data: formData}
        else
            $createRecipeCache = formData
    })

    function normalizeRecipe(data: RecipeForm): RecipeForm {
        return {
            ...data,
            ingredients: (data.ingredients ?? []).map(ingredient => ({...ingredient, label: ingredient.label ?? '', ref_label: ingredient.ref_label ?? ''})),
            steps: data.steps ?? [],
            pictures: data.pictures ?? [],
        }
    }

    // A cache entry that has no content is indistinguishable from the blank
    // bootstrap value written before the real recipe has loaded; treat it as
    // "no draft" so it never shadows freshly-fetched data.
    function isBlank(data: RecipeForm): boolean {
        return !data.title && !data.description &&
            (data.ingredients?.length ?? 0) === 0 &&
            (data.steps?.length ?? 0) === 0 &&
            (data.pictures?.length ?? 0) === 0
    }

    function getRecipe(recipeProps: RecipeForm | undefined): RecipeForm {
        let r = <RecipeForm>{
            title: '',
            description: '',
            quantity: 0,
            kind: 'dish',
            category: category,
            preparation_time: 0,
            cooking_time: 0,
            resting_time: 0,
            ingredients: [],
            steps: [],
            pictures: []
        }

        if (recipeId !== undefined) {
            const cached = $editRecipeCache?.id === recipeId ? $editRecipeCache.data : undefined
            return normalizeRecipe(cached && !isBlank(cached) ? cached : (recipeProps ?? r))
        }

        return normalizeRecipe($createRecipeCache && !isBlank($createRecipeCache) ? $createRecipeCache : (recipeProps ?? r))
    }

    // A step counts as blank only once it has no title, no description, and no
    // photo (pending or already saved) - a photo alone is deliberate content.
    function isEmptyStep(row: EditStep): boolean {
        return !row.title.trim() && !row.description.trim() && !row.picture && !stepPendingPictures[row.uid];
    }

    // Keeps exactly one blank trailing step: the current trailing row is left
    // alone while still blank (same object, so it never loses focus mid-type),
    // any interior row that goes blank is dropped and the list re-collapses,
    // and a fresh blank row is appended once the trailing one gets content.
    function normalizeStepRows(list: EditStep[]): EditStep[] {
        const trailingBlank = list.length > 0 && isEmptyStep(list[list.length - 1]) ? list[list.length - 1] : null;
        const bodySource = trailingBlank ? list.slice(0, -1) : list;
        const body = bodySource.filter(row => !isEmptyStep(row));
        if (trailingBlank && body.length === bodySource.length) return list;
        const placeholder = trailingBlank ?? {uid: nextStepUid(), title: '', description: '', picture: ''};
        return [...body, placeholder];
    }

    $effect(() => {
        const normalized = normalizeStepRows(stepRows);
        if (normalized !== stepRows) stepRows = normalized;
    });

    function removeStep(uid: string) {
        clearStepPendingPicture(uid);
        stepRows = stepRows.filter(s => s.uid !== uid);
    }

    function clearStepPendingPicture(uid: string) {
        const pending = stepPendingPictures[uid];
        if (!pending) return;
        URL.revokeObjectURL(pending.url);
        const {[uid]: _removed, ...rest} = stepPendingPictures;
        stepPendingPictures = rest;
    }

    // A fresh upload always supersedes whatever picture the step already had.
    function setStepPendingPicture(uid: string, file: File) {
        clearStepPendingPicture(uid);
        stepPendingPictures = {...stepPendingPictures, [uid]: {file, url: URL.createObjectURL(file)}};
        stepRows = stepRows.map(s => s.uid === uid ? {...s, picture: ''} : s);
    }

    function removeStepPicture(uid: string) {
        clearStepPendingPicture(uid);
        stepRows = stepRows.map(s => s.uid === uid ? {...s, picture: ''} : s);
    }

    function onStepFileSelected(uid: string, files: FileList) {
        const file = files[0];
        if (!file) return;
        cropQueue = [...cropQueue, {file, target: {kind: 'step', uid}}];
        if (!currentCrop)
            advanceCropQueue();
    }

    async function saveRecipe() {
        for (let nb of [...formData.ingredients.map(e => e.quantity), formData.cooking_time, formData.resting_time, formData.preparation_time, formData.quantity]) {
            if (nb < 0)
                return toastError($_('create.toasts.negativeNumber'))
        }
        // The trailing blank ingredient/step that auto-grow always leaves in
        // place must never reach the API - strip it (and any other blank row)
        // from the outgoing payload only, leaving the on-screen form as-is.
        const cleanedIngredients = formData.ingredients.filter(i => i.name.trim() || i.recipe_ref);
        const cleanedStepRows = stepRows.filter(row => !isEmptyStep(row));
        const cleanedSteps: Step[] = cleanedStepRows.map(({title, description, picture}) => picture ? {title, description, picture} : {title, description});

        const newStepPictures: Record<number, File> = {};
        cleanedStepRows.forEach((row, index) => {
            const pending = stepPendingPictures[row.uid];
            if (pending)
                newStepPictures[index] = pending.file;
        });
        onSubmit({...formData, ingredients: cleanedIngredients, steps: cleanedSteps}, pendingPictures.map(picture => picture.file), newStepPictures);
    }

    function removePicture(index: number) {
        formData.pictures = formData.pictures.filter((_, i) => i !== index);
    }

    // attributionFor looks up a filename in pictureAttribution - only ever
    // non-empty (and only ever contains a contributor entry) in
    // fullPictureAccess mode, see the pictureAttribution prop doc.
    function attributionFor(filename: string): RecipePicture | undefined {
        return pictureAttribution.find(p => p.filename === filename);
    }

    // --- Step drag & drop ---------------------------------------------------
    // Same pointer-capture approach as the ingredient/category drag below, just
    // for a flat list.

    let draggingStepUid = $state<string | null>(null);
    let stepDropIndicator = $state<{ beforeUid: string | null, before: boolean } | null>(null);
    let stepDragPos = $state<{ x: number, y: number } | null>(null);

    function startStepDrag(e: PointerEvent, uid: string) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        draggingStepUid = uid;
        stepDragPos = {x: e.clientX + 14, y: e.clientY + 14};
        stepDropIndicator = null;
    }

    function handleStepDragPointerMove(e: PointerEvent) {
        if (!draggingStepUid) return;
        stepDragPos = {x: e.clientX + 14, y: e.clientY + 14};
        let best: { uid: string, mid: number } | null = null;
        let bestDist = Infinity;
        for (const row of document.querySelectorAll<HTMLElement>('[data-step-row]')) {
            const uid = row.dataset.stepUid!;
            if (uid === draggingStepUid) continue;
            const rect = row.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const dist = Math.abs(e.clientY - mid);
            if (dist < bestDist) {
                bestDist = dist;
                best = {uid, mid};
            }
        }
        stepDropIndicator = best ? {beforeUid: best.uid, before: e.clientY < best.mid} : null;
    }

    function handleStepDragPointerUp() {
        if (!draggingStepUid) return;
        const draggedUid = draggingStepUid;
        const drop = stepDropIndicator;
        const dragged = stepRows.find(s => s.uid === draggedUid);
        if (dragged && drop) {
            let working = stepRows.filter(s => s.uid !== draggedUid);
            let insertAt = working.length;
            const pos = working.findIndex(s => s.uid === drop.beforeUid);
            if (pos !== -1) insertAt = drop.before ? pos : pos + 1;
            working.splice(insertAt, 0, dragged);
            stepRows = working;
        }
        draggingStepUid = null;
        stepDropIndicator = null;
        stepDragPos = null;
    }

    type CropTarget = { kind: 'recipe' } | { kind: 'step', uid: string };
    type CropQueueItem = { file: File, target: CropTarget };

    let cropQueue = $state<CropQueueItem[]>([])
    let currentCrop = $state<CropQueueItem | null>(null)

    function advanceCropQueue() {
        const [next, ...rest] = cropQueue
        currentCrop = next ?? null
        cropQueue = rest
    }

    async function onFileUpload(files: FileList) {
        cropQueue = [...cropQueue, ...Array.from(files).map(file => ({file, target: {kind: 'recipe'} as const}))]
        if (!currentCrop)
            advanceCropQueue()
    }

    function onCropConfirm(croppedFile: File) {
        const target = currentCrop?.target
        if (target?.kind === 'step')
            setStepPendingPicture(target.uid, croppedFile)
        else
            pendingPictures = [...pendingPictures, {file: croppedFile, url: URL.createObjectURL(croppedFile)}]
        advanceCropQueue()
    }

    function onCropCancel() {
        advanceCropQueue()
    }

    function removePendingPicture(index: number) {
        const picture = pendingPictures[index]
        if (picture)
            URL.revokeObjectURL(picture.url)
        pendingPictures = pendingPictures.filter((_, i) => i !== index)
    }

    let hasPictures = $derived(((formData.pictures?.length ?? 0) > 0 && !formData.pictures[0].includes('placeholder')) || pendingPictures.length > 0);

    let previewIngredientGroups = $derived(groupIngredients(formData.ingredients.filter(i => i.name.trim() || i.recipe_ref)));

    // --- Ingredient categories -------------------------------------------------
    // The backend only stores a free-text `label` per ingredient; a "category" is
    // just the set of ingredients sharing one. The block below turns that into an
    // editable structure (add/rename/delete/drag-reorder categories, drag ingredients
    // between them) and syncs the result straight back into formData.ingredients -
    // so `label` stays the single source of truth on save, nothing new is added to
    // the recipe schema.

    type EditSection = { id: string, name: string | null, ingredients: Ingredient[] };

    let sectionUid = 0;

    function nextSectionId(): string {
        sectionUid += 1;
        return `sec-${sectionUid}`;
    }

    // The unlabeled group (id 'uncategorized', name null) is always present, even
    // empty, so there's always a default drop target and an "Add ingredient" button.
    function buildSections(ingredients: Ingredient[]): EditSection[] {
        const groups = groupIngredients(ingredients);
        const withUncategorized = groups[0]?.label === null ? groups : [{label: null, items: []}, ...groups];
        return withUncategorized.map(group => ({
            id: group.label === null ? 'uncategorized' : nextSectionId(),
            name: group.label,
            ingredients: group.items
        }));
    }

    function flattenSections(list: EditSection[]): Ingredient[] {
        return list.flatMap(section => section.ingredients.map(ingredient => ({...ingredient, label: section.name ?? ''})));
    }

    let sections = $state<EditSection[]>(untrack(() => buildSections(formData.ingredients)));

    $effect(() => {
        formData.ingredients = flattenSections(sections);
    });

    // An ingredient counts as blank only once none of its fields carry
    // anything - a recipe reference, or any of name/quantity/unit, all count.
    function isEmptyIngredient(ingredient: Ingredient): boolean {
        return !ingredient.name.trim() && !ingredient.recipe_ref && !ingredient.quantity && !(ingredient.unit ?? '').trim();
    }

    function makeBlankIngredient(sectionName: string | null): Ingredient {
        return {name: '', quantity: 0, unit: '', label: sectionName ?? ''};
    }

    // Same collapse-and-append invariant as normalizeStepRows, applied per
    // section: exactly one blank trailing ingredient row at all times.
    function normalizeSectionIngredients(section: EditSection): Ingredient[] {
        const list = section.ingredients;
        const trailingBlank = list.length > 0 && isEmptyIngredient(list[list.length - 1]) ? list[list.length - 1] : null;
        const bodySource = trailingBlank ? list.slice(0, -1) : list;
        const body = bodySource.filter(i => !isEmptyIngredient(i));
        if (trailingBlank && body.length === bodySource.length) return list;
        const placeholder = trailingBlank ?? makeBlankIngredient(section.name);
        return [...body, placeholder];
    }

    $effect(() => {
        let changed = false;
        const normalized = sections.map(s => {
            const ingredients = normalizeSectionIngredients(s);
            if (ingredients === s.ingredients) return s;
            changed = true;
            return {...s, ingredients};
        });
        if (changed) sections = normalized;
    });

    let editingSectionId = $state<string | null>(null);
    let editingSectionName = $state('');
    let openMenuFor = $state<Ingredient | null>(null);

    // The always-present blank "new category" slot at the bottom of the
    // sections list; committing it (blur/Enter) turns it into a real section
    // and clears the slot so it's ready for the next one.
    let newCategoryName = $state('');

    function commitNewCategory() {
        const trimmed = newCategoryName.trim();
        newCategoryName = '';
        if (!trimmed) return;
        const exists = sections.some(s => s.name !== null && s.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) return;
        sections = [...sections, {id: nextSectionId(), name: trimmed, ingredients: []}];
    }

    function startRename(section: EditSection) {
        if (section.id === 'uncategorized') return;
        editingSectionId = section.id;
        editingSectionName = section.name ?? '';
    }

    // An empty, never-named category (created via "Add category" then abandoned)
    // has nothing to persist - drop it instead of leaving a stray empty header.
    function cancelSectionEdit() {
        if (!editingSectionId) return;
        const section = sections.find(s => s.id === editingSectionId);
        if (section && section.ingredients.length === 0 && !section.name)
            sections = sections.filter(s => s.id !== editingSectionId);
        editingSectionId = null;
        editingSectionName = '';
    }

    function confirmSectionName() {
        if (!editingSectionId) return;
        const id = editingSectionId;
        const trimmed = editingSectionName.trim();
        const section = sections.find(s => s.id === id);
        if (!section) {
            editingSectionId = null;
            editingSectionName = '';
            return;
        }

        if (!trimmed) {
            if (section.ingredients.length === 0)
                sections = sections.filter(s => s.id !== id);
            editingSectionId = null;
            editingSectionName = '';
            return;
        }

        // Renaming to match another category's name merges the two, same as
        // giving two ingredients the same label used to.
        const match = sections.find(s => s.id !== id && s.name !== null && s.name.toLowerCase() === trimmed.toLowerCase());
        sections = match
            ? sections
                .map(s => s.id === match.id ? {...s, ingredients: [...s.ingredients, ...section.ingredients]} : s)
                .filter(s => s.id !== id)
            : sections.map(s => s.id === id ? {...s, name: trimmed} : s);
        editingSectionId = null;
        editingSectionName = '';
    }

    function deleteSection(id: string) {
        const section = sections.find(s => s.id === id);
        if (!section) return;
        sections = sections
            .map(s => s.id === 'uncategorized' ? {...s, ingredients: [...s.ingredients, ...section.ingredients]} : s)
            .filter(s => s.id !== id);
        if (editingSectionId === id) {
            editingSectionId = null;
            editingSectionName = '';
        }
    }

    // Fills the section's current blank trailing row instead of inserting a
    // new one, so picking a recipe reference behaves like typing would: the
    // list never grows by more than the one fresh blank row auto-grow adds.
    function addRecipeRefToSection(sectionId: string, recipe: RecipePreview) {
        sections = sections.map(s => {
            if (s.id !== sectionId) return s;
            const ingredients = s.ingredients.slice();
            const lastIdx = ingredients.length - 1;
            const refIngredient: Ingredient = {
                name: '', quantity: 1, unit: '', label: s.name ?? '',
                recipe_ref: recipe.id, ref_label: '', resolved_ref_title: recipe.title,
                variation_count: recipe.variation_count,
            };
            if (lastIdx >= 0 && isEmptyIngredient(ingredients[lastIdx]))
                ingredients[lastIdx] = refIngredient;
            else
                ingredients.push(refIngredient);
            return {...s, ingredients};
        });
    }

    function removeIngredientFromSection(sectionId: string, ingredient: Ingredient) {
        sections = sections.map(s => s.id === sectionId
            ? {...s, ingredients: s.ingredients.filter(it => it !== ingredient)}
            : s);
    }

    function moveIngredientToSection(ingredient: Ingredient, fromSectionId: string, toSectionId: string) {
        openMenuFor = null;
        if (fromSectionId === toSectionId) return;
        sections = sections.map(s => {
            if (s.id === fromSectionId) return {...s, ingredients: s.ingredients.filter(it => it !== ingredient)};
            if (s.id === toSectionId) return {...s, ingredients: [...s.ingredients, ingredient]};
            return s;
        });
    }

    // --- Drag & drop -------------------------------------------------------
    // Pointer capture on the grip handle keeps move/up events targeted at it even
    // once the cursor leaves the row, so no window-level listeners are needed.

    type Dragging =
        | { type: 'ingredient', sectionId: string, ingredient: Ingredient }
        | { type: 'section', sectionId: string };

    type DropIndicator =
        | { kind: 'ingredient', sectionId: string, beforeItem: Ingredient | null, before: boolean }
        | { kind: 'section', beforeSectionId: string, before: boolean };

    let dragging = $state<Dragging | null>(null);
    let dropIndicator = $state<DropIndicator | null>(null);
    let dragPos = $state<{ x: number, y: number } | null>(null);

    function isSectionDragged(section: EditSection): boolean {
        return dragging !== null && dragging.type === 'section' && dragging.sectionId === section.id;
    }

    function isSectionDropAbove(section: EditSection): boolean {
        return dropIndicator !== null && dropIndicator.kind === 'section' && dropIndicator.beforeSectionId === section.id && dropIndicator.before;
    }

    function isSectionDropBelow(section: EditSection): boolean {
        return dropIndicator !== null && dropIndicator.kind === 'section' && dropIndicator.beforeSectionId === section.id && !dropIndicator.before;
    }

    function isSectionEmptyDropTarget(section: EditSection): boolean {
        return dropIndicator !== null && dropIndicator.kind === 'ingredient' && dropIndicator.sectionId === section.id && section.ingredients.length === 0;
    }

    function isRowDragged(ingredient: Ingredient): boolean {
        return dragging !== null && dragging.type === 'ingredient' && dragging.ingredient === ingredient;
    }

    function isRowDropAbove(section: EditSection, ingredient: Ingredient): boolean {
        return dropIndicator !== null && dropIndicator.kind === 'ingredient' && dropIndicator.sectionId === section.id && dropIndicator.beforeItem === ingredient && dropIndicator.before;
    }

    function isRowDropBelow(section: EditSection, ingredient: Ingredient): boolean {
        return dropIndicator !== null && dropIndicator.kind === 'ingredient' && dropIndicator.sectionId === section.id && dropIndicator.beforeItem === ingredient && !dropIndicator.before;
    }

    function startIngredientDrag(e: PointerEvent, sectionId: string, ingredient: Ingredient) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragging = {type: 'ingredient', sectionId, ingredient};
        dragPos = {x: e.clientX + 14, y: e.clientY + 14};
        dropIndicator = null;
    }

    function startSectionDrag(e: PointerEvent, sectionId: string) {
        if (sectionId === 'uncategorized') return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragging = {type: 'section', sectionId};
        dragPos = {x: e.clientX + 14, y: e.clientY + 14};
        dropIndicator = null;
    }

    function handleDragPointerMove(e: PointerEvent) {
        if (!dragging) return;
        dragPos = {x: e.clientX + 14, y: e.clientY + 14};

        if (dragging.type === 'ingredient') {
            const dragged = dragging.ingredient;
            let best: { sectionId: string, item: Ingredient, mid: number } | null = null;
            let bestDist = Infinity;
            for (const row of document.querySelectorAll<HTMLElement>('[data-row]')) {
                const sectionId = row.dataset.section!;
                const rowIndex = Number(row.dataset.rowIndex);
                const item = sections.find(s => s.id === sectionId)?.ingredients[rowIndex];
                if (!item || item === dragged) continue;
                const rect = row.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                const dist = Math.abs(e.clientY - mid);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = {sectionId, item, mid};
                }
            }
            if (best) {
                dropIndicator = {kind: 'ingredient', sectionId: best.sectionId, beforeItem: best.item, before: e.clientY < best.mid};
                return;
            }
            let zone: HTMLElement | undefined;
            for (const z of document.querySelectorAll<HTMLElement>('[data-section-dropzone]')) {
                const rect = z.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    zone = z;
                    break;
                }
            }
            dropIndicator = zone ? {kind: 'ingredient', sectionId: zone.dataset.section!, beforeItem: null, before: true} : null;
        } else {
            let best: { sectionId: string, mid: number } | null = null;
            let bestDist = Infinity;
            for (const block of document.querySelectorAll<HTMLElement>('[data-section-block]')) {
                const sectionId = block.dataset.section!;
                if (sectionId === 'uncategorized' || sectionId === dragging.sectionId) continue;
                const rect = block.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                const dist = Math.abs(e.clientY - mid);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = {sectionId, mid};
                }
            }
            dropIndicator = best ? {kind: 'section', beforeSectionId: best.sectionId, before: e.clientY < best.mid} : null;
        }
    }

    function handleDragPointerUp() {
        if (!dragging) return;
        const drag = dragging;
        const drop = dropIndicator;

        if (drag.type === 'ingredient' && drop?.kind === 'ingredient') {
            const item = drag.ingredient;
            let working = sections.map(s => s.id === drag.sectionId
                ? {...s, ingredients: s.ingredients.filter(it => it !== item)}
                : s);
            const toIdx = working.findIndex(s => s.id === drop.sectionId);
            if (toIdx !== -1) {
                const list = working[toIdx].ingredients.slice();
                let insertAt = list.length;
                if (drop.beforeItem) {
                    const pos = list.indexOf(drop.beforeItem);
                    if (pos !== -1) insertAt = drop.before ? pos : pos + 1;
                }
                list.splice(insertAt, 0, item);
                working[toIdx] = {...working[toIdx], ingredients: list};
            }
            sections = working;
        } else if (drag.type === 'section' && drop?.kind === 'section') {
            const fromIdx = sections.findIndex(s => s.id === drag.sectionId);
            if (fromIdx !== -1) {
                const moving = sections[fromIdx];
                let working = sections.filter(s => s.id !== drag.sectionId);
                let insertAt = working.length;
                const pos = working.findIndex(s => s.id === drop.beforeSectionId);
                if (pos !== -1) insertAt = drop.before ? pos : pos + 1;
                if (insertAt < 1) insertAt = 1; // uncategorized always stays first
                working.splice(insertAt, 0, moving);
                sections = working;
            }
        }

        dragging = null;
        dropIndicator = null;
        dragPos = null;
    }

    let dragGhostLabel = $derived.by(() => {
        const drag = dragging;
        if (!drag) return '';
        if (drag.type === 'ingredient') return drag.ingredient.name || $_('edit.ingredients.name.placeholder');
        return sections.find(s => s.id === drag.sectionId)?.name ?? '';
    });

    let stepDragGhostLabel = $derived(stepRows.find(s => s.uid === draggingStepUid)?.title || $_('edit.instructions.title.placeholder'));

    $effect(() => {
        function onDocPointerDown(e: PointerEvent) {
            if (openMenuFor && !(e.target instanceof Element && e.target.closest('[data-keep-menu]')))
                openMenuFor = null;
        }

        document.addEventListener('pointerdown', onDocPointerDown, true);
        return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
    });
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8">
    <h1 class="text-4xl font-bold text-foreground mb-2 text-balance">{headLabel}</h1>
    <p class="text-lg text-muted-foreground text-pretty">{commentLabel}</p>
  </div>

  <div class="grid grid-cols-1 gap-8">
    <div class="bg-card rounded-lg border border-border p-6">
      <h2 class="text-2xl font-semibold text-card-foreground mb-6">{t('details')}</h2>
      <div class="space-y-6">
        <div class="grid grid-cols-1 gap-8">
          <!-- Form column -->
          <div class="lg:col-span-3">
            <!-- Stepper -->
            <div class="mb-8">
              <ol class="flex items-center">
                {#each steps as step, index}
                  {@const isDone = index < currentStep}
                  {@const isActive = index === currentStep}
                  <li class="flex items-center {index < steps.length - 1 ? 'flex-1' : ''}">
                    <button
                        type="button"
                        onclick={() => goToStep(index)}
                        class="flex flex-col items-center gap-2 group focus:outline-none"
                        aria-current={isActive ? 'step' : undefined}
                    >
                                <span
                                    class="flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                                        {isActive ? 'border-primary bg-primary text-primary-foreground' :
                                         isDone ? 'border-primary bg-primary/10 text-primary' :
                                         'border-border bg-card text-muted-foreground group-hover:border-primary/50'}"
                                >
                                    {#if isDone}
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    {:else}
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={step.icon}></path>
                                        </svg>
                                    {/if}
                                </span>
                      <span class="text-xs font-medium hidden sm:block {isActive ? 'text-foreground' : 'text-muted-foreground'}">
                                    {t('wizard.' + step.id + '.name')}
                                </span>
                    </button>
                    {#if index < steps.length - 1}
                      <div class="flex-1 h-0.5 mx-2 -mt-6 sm:-mt-6 transition-colors {isDone ? 'bg-primary' : 'bg-border'}"></div>
                    {/if}
                  </li>
                {/each}
              </ol>
            </div>

            <div class="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div class="mb-6">
                <p class="text-sm font-medium text-primary mb-1">
                  {$_('edit.wizard.stepLabel', {values: {current: currentStep + 1, total: steps.length}})}
                </p>
                <h2 class="text-2xl font-semibold text-card-foreground">
                  {t('wizard.' + steps[currentStep].id + '.name')}
                </h2>
                <p class="text-sm text-muted-foreground mt-1">
                  {t('wizard.' + steps[currentStep].id + '.hint')}
                </p>

                <!-- Step 1: Basics -->
                {#if currentStep === 0}
                  <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class={formData.category === 'diy' ? 'md:col-span-2' : ''}>
                        <Label for="recipe-title" required>{t('title.label')}</Label>
                        <Input
                            id="recipe-title"
                            type="text"
                            bind:value={formData.title}
                            placeholder={t('title.placeholder')}
                        />
                      </div>
                      {#if formData.category !== 'diy'}
                        <div>
                          <Label for="recipe-type">{$_('edit.type.label')}</Label>
                          <Select
                              id="recipe-type"
                              bind:value={formData.kind}
                              options={RecipeTypes.map(e => ({label: $_('recipes.types.' + e), value: e}))}
                          />
                        </div>
                      {/if}
                    </div>

                    <div>
                      <Label for="description" required>{$_('edit.description.label')}</Label>
                      <Textarea
                          id="description"
                          bind:value={formData.description}
                          placeholder={t('description.placeholder')}
                          rows={3}
                      />
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label for="servings">{t('servings.label')}</Label>
                        <Input id="servings" type="number" bind:value={formData.quantity} min={1} />
                      </div>
                      {#if formData.category !== 'diy'}
                        <div>
                          <Label for="prep-time">{$_('edit.prep.label')} ({$_('recipes.min')})</Label>
                          <Input id="prep-time" type="number" bind:value={formData.preparation_time} min={0} />
                        </div>
                        <div>
                          <Label for="cook-time">{t('cook.label')} ({$_('recipes.min')})</Label>
                          <Input id="cook-time" type="number" bind:value={formData.cooking_time} min={0} />
                        </div>
                        <div>
                          <Label for="resting-time">{t('rest.label')} ({$_('recipes.min')})</Label>
                          <Input id="resting-time" type="number" bind:value={formData.resting_time} min={0} />
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}

                <!-- Step 2: Ingredients -->
                {#if currentStep === 1}
                  <div>
                    <p class="text-sm text-muted-foreground mb-4">{$_('edit.ingredients.dragHint')}</p>

                    <div class="space-y-5">
                      {#each sections as section (section.id)}
                        <div
                            data-section-block
                            data-section={section.id}
                            class="transition-opacity"
                            style={isSectionDragged(section) ? 'opacity:0.4' : ''}
                        >
                          {#if isSectionDropAbove(section)}
                            <div class="h-0.5 bg-primary rounded mb-2"></div>
                          {/if}

                          {#if section.name !== null}
                            <div class="flex items-center gap-1 mb-2">
                              <button
                                  type="button"
                                  onpointerdown={(e) => startSectionDrag(e, section.id)}
                                  onpointermove={handleDragPointerMove}
                                  onpointerup={handleDragPointerUp}
                                  onpointercancel={handleDragPointerUp}
                                  class="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab touch-none transition-colors"
                                  aria-label="Reorder category"
                              >
                                <GripVertical class="w-4 h-4" />
                              </button>

                              {#if editingSectionId === section.id}
                                <Input
                                    value={editingSectionName}
                                    oninput={(e: Event) => editingSectionName = (e.target as HTMLInputElement).value}
                                    onblur={confirmSectionName}
                                    onkeydown={(e: KeyboardEvent) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        if (e.key === 'Escape') cancelSectionEdit();
                                    }}
                                    placeholder={$_('edit.ingredients.categoryNamePlaceholder')}
                                    class="max-w-[240px] py-1.5 px-2 text-sm font-semibold"
                                />
                              {:else}
                                <span class="font-semibold text-sm text-foreground px-1 py-1">{section.name}</span>
                                <button
                                    type="button"
                                    onclick={() => startRename(section)}
                                    class="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                    aria-label={$_('edit.ingredients.renameCategory')}
                                    title={$_('edit.ingredients.renameCategory')}
                                >
                                  <Pencil class="w-3.5 h-3.5" />
                                </button>
                              {/if}

                              <div class="flex-1"></div>

                              <button
                                  type="button"
                                  onclick={() => deleteSection(section.id)}
                                  class="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  aria-label={$_('edit.ingredients.deleteCategory')}
                                  title={$_('edit.ingredients.deleteCategory')}
                              >
                                <Trash2 class="w-4 h-4" />
                              </button>
                            </div>
                          {/if}

                          <div
                              data-section-dropzone
                              data-section={section.id}
                              class="flex flex-col gap-3 min-h-[2.5rem] rounded-lg border-2 border-dashed transition-colors {isSectionEmptyDropTarget(section) ? 'bg-primary/5 border-primary' : 'border-transparent'}"
                          >
                            {#each section.ingredients as ingredient, rowIndex (ingredient)}
                              {@const isPlaceholder = rowIndex === section.ingredients.length - 1 && isEmptyIngredient(ingredient)}
                              <div>
                                {#if isRowDropAbove(section, ingredient)}
                                  <div class="h-0.5 bg-primary rounded mb-1.5"></div>
                                {/if}

                                <div
                                    data-row
                                    data-section={section.id}
                                    data-row-index={rowIndex}
                                    class="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-border bg-card transition-opacity touch-none {isRowDragged(ingredient) ? 'opacity-35' : ''}"
                                >
                                  {#if isPlaceholder}
                                    <div class="col-span-1"></div>
                                  {:else}
                                    <button
                                        type="button"
                                        onpointerdown={(e) => startIngredientDrag(e, section.id, ingredient)}
                                        onpointermove={handleDragPointerMove}
                                        onpointerup={handleDragPointerUp}
                                        onpointercancel={handleDragPointerUp}
                                        class="col-span-1 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab touch-none transition-colors"
                                        aria-label="Reorder ingredient"
                                    >
                                      <GripVertical class="w-4 h-4" />
                                    </button>
                                  {/if}

                                  {#if ingredient.recipe_ref}
                                    <div class="col-span-5 flex flex-col gap-1 self-end">
                                      <div class="flex items-center gap-1 text-sm font-medium text-card-foreground">
                                        <Link2 class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                        <span class="truncate">{ingredient.ref_label || ingredient.resolved_ref_title}</span>
                                        {#if ingredient.variation_count && ingredient.variation_count > 0}
                                            <span class="ml-auto flex-shrink-0 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                                                {$_('recipeCard.variationCount', {values: {count: ingredient.variation_count}})}
                                            </span>
                                        {/if}
                                      </div>
                                      <Input
                                          type="text"
                                          bind:value={() => ingredient.ref_label ?? '', (v) => ingredient.ref_label = v}
                                          placeholder={$_('edit.ingredients.refLabel.placeholder')}
                                          aria-label={$_('edit.ingredients.refLabel.label')}
                                      />
                                    </div>
                                  {:else}
                                    <div class="col-span-5 self-end">
                                      <Input
                                          type="text"
                                          bind:value={ingredient.name}
                                          placeholder={t('ingredients.name.placeholder')}
                                          required
                                          aria-label={t('ingredients.name.label')}
                                      />
                                    </div>
                                  {/if}
                                  <div class="col-span-6 self-end flex items-center gap-2">
                                    <div class="flex-[2]">
                                      <Input
                                          type="number"
                                          bind:value={ingredient.quantity}
                                          placeholder={$_('edit.ingredients.quantity.placeholder')}
                                          aria-label={$_('edit.ingredients.quantity.label')}
                                      />
                                    </div>
                                    <div class="flex-[2]">
                                      <Input
                                          type="text"
                                          bind:value={ingredient.unit}
                                          placeholder={$_('edit.ingredients.unit.placeholder')}
                                          aria-label={$_('edit.ingredients.unit.label')}
                                      />
                                    </div>

                                    <div class="flex-none flex justify-center relative" data-keep-menu>
                                      <button
                                          type="button"
                                          onclick={(e) => { e.stopPropagation(); openMenuFor = openMenuFor === ingredient ? null : ingredient; }}
                                          class="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                          aria-label={$_('edit.ingredients.moveTo')}
                                      >
                                        <EllipsisVertical class="w-4 h-4" />
                                      </button>
                                      {#if openMenuFor === ingredient}
                                        <div data-keep-menu class="absolute right-0 top-9 z-30 min-w-[180px] bg-card border border-border rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5">
                                          <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 pt-1 pb-0.5">
                                            {$_('edit.ingredients.moveTo')}
                                          </div>
                                          {#each sections.filter(s => s.id !== section.id) as target (target.id)}
                                            <button
                                                type="button"
                                                onclick={() => moveIngredientToSection(ingredient, section.id, target.id)}
                                                class="text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground text-foreground"
                                            >
                                              {target.name ?? $_('edit.ingredients.uncategorized')}
                                            </button>
                                          {/each}
                                        </div>
                                      {/if}
                                    </div>

                                    <div class="flex-none flex justify-center">
                                      <button
                                          type="button"
                                          onclick={() => removeIngredientFromSection(section.id, ingredient)}
                                          aria-label={$_('edit.ingredients.remove')}
                                          class="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      >
                                        <Trash2 class="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {#if ingredient.recipe_ref}
                                  <p class="text-xs text-muted-foreground mt-1 pl-1">
                                    {$_('edit.ingredients.preview', {values: {text: `${getReferenceQuantity(ingredient)} ${ingredient.ref_label || ingredient.resolved_ref_title}`.trim()}})}
                                  </p>
                                {:else if ingredient.name.trim()}
                                  <p class="text-xs text-muted-foreground mt-1 pl-1">
                                    {$_('edit.ingredients.preview', {values: {text: getIngredientName(ingredient)}})}
                                  </p>
                                {/if}

                                {#if isRowDropBelow(section, ingredient)}
                                  <div class="h-0.5 bg-primary rounded mt-1.5"></div>
                                {/if}
                              </div>
                            {/each}
                          </div>

                          {#if formData.category !== 'diy'}
                            <div class="mt-3">
                              <Button
                                  variant="outline"
                                  class="w-full"
                                  size="sm"
                                  onclick={() => openRecipePicker(section.id)}
                              >
                                {t('ingredients.addRecipeRef')}
                              </Button>
                            </div>
                          {/if}

                          {#if isSectionDropBelow(section)}
                            <div class="h-0.5 bg-primary rounded mt-2"></div>
                          {/if}
                        </div>
                      {/each}
                    </div>

                    <div class="mt-4 flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2">
                      <Plus class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Input
                          value={newCategoryName}
                          oninput={(e: Event) => newCategoryName = (e.target as HTMLInputElement).value}
                          onblur={commitNewCategory}
                          onkeydown={(e: KeyboardEvent) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') newCategoryName = '';
                          }}
                          placeholder={$_('edit.ingredients.addCategory')}
                          aria-label={$_('edit.ingredients.addCategory')}
                          class="flex-1 py-1.5 px-2 text-sm font-semibold border-0 bg-transparent focus:ring-0"
                      />
                    </div>
                  </div>
                {/if}

                <!-- Step 3: Instructions -->
                {#if currentStep === 2}
                  <div>
                    <div class="space-y-3">
                      {#each stepRows as row, index (row.uid)}
                        {@const pendingPic = stepPendingPictures[row.uid]}
                        {@const isPlaceholder = index === stepRows.length - 1 && isEmptyStep(row)}
                        <div>
                          {#if stepDropIndicator?.beforeUid === row.uid && stepDropIndicator.before}
                            <div class="h-0.5 bg-primary rounded mb-1.5"></div>
                          {/if}
                          <div
                              data-step-row
                              data-step-uid={row.uid}
                              class="flex gap-3 items-start rounded-lg border border-border p-4 touch-none transition-opacity {draggingStepUid === row.uid ? 'opacity-35' : ''}"
                          >
                            {#if isPlaceholder}
                              <div class="w-8 h-8 flex-shrink-0 mt-1"></div>
                            {:else}
                              <button
                                  type="button"
                                  onpointerdown={(e) => startStepDrag(e, row.uid)}
                                  onpointermove={handleStepDragPointerMove}
                                  onpointerup={handleStepDragPointerUp}
                                  onpointercancel={handleStepDragPointerUp}
                                  class="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab touch-none transition-colors flex-shrink-0 mt-1"
                                  aria-label={$_('edit.instructions.reorder')}
                              >
                                <GripVertical class="w-4 h-4" />
                              </button>
                            {/if}
                            <span class="bg-primary text-primary-foreground w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center flex-shrink-0 mt-1">
                                        {index + 1}
                                    </span>
                            <div class="flex-1 flex gap-3 items-start">
                              <div class="flex-1 min-w-0 space-y-2">
                                <div>
                                  <Label for={`step-title-${row.uid}`}>{$_('edit.instructions.title.label')}</Label>
                                  <Input
                                      id={`step-title-${row.uid}`}
                                      type="text"
                                      bind:value={row.title}
                                      placeholder={t('instructions.title.placeholder')}
                                  />
                                </div>
                                <div>
                                  <Label for={`step-description-${row.uid}`}>{$_('edit.instructions.description.label')}</Label>
                                  <Textarea
                                      id={`step-description-${row.uid}`}
                                      bind:value={row.description}
                                      placeholder={t('instructions.description.placeholder')}
                                      rows={2}
                                  />
                                </div>
                              </div>
                              <div class="flex-shrink-0">
                                <Label>{$_('edit.instructions.photo.label')}</Label>
                                {#if pendingPic || row.picture}
                                  <div class="relative inline-block group mt-1">
                                    <img
                                        src={pendingPic ? pendingPic.url : `${$serverUrl}/recipe-pictures/${row.picture}`}
                                        alt={$_('edit.instructions.photo.alt', {values: {step: index + 1}})}
                                        class="w-24 h-24 object-cover rounded-lg border border-border"
                                    />
                                    <button
                                        type="button"
                                        onclick={() => removeStepPicture(row.uid)}
                                        aria-label={$_('edit.instructions.photo.remove')}
                                        class="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      ×
                                    </button>
                                  </div>
                                {:else}
                                  <label class="mt-1 flex items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-colors">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        onchange={(e) => {
                                            const target = e.target as HTMLInputElement;
                                            if (target.files) onStepFileSelected(row.uid, target.files);
                                            target.value = '';
                                        }}
                                    />
                                    <Plus class="w-5 h-5" />
                                  </label>
                                {/if}
                              </div>
                            </div>
                            <button
                                type="button"
                                onclick={() => removeStep(row.uid)}
                                aria-label={$_('edit.instructions.remove')}
                                class="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus:ring-2 focus:ring-ring flex-shrink-0 mt-1"
                            >
                              <Trash2 class="w-4 h-4" />
                            </button>
                          </div>
                          {#if stepDropIndicator?.beforeUid === row.uid && !stepDropIndicator.before}
                            <div class="h-0.5 bg-primary rounded mt-1.5"></div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Step 4: Photos -->
                {#if currentStep === 3}
                  <div>
                    <FileUpload onFilesSelected={onFileUpload} class="mb-4" />

                    {#if hasPictures}
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {#each formData.pictures as image, index}
                          {@const contributor = attributionFor(image)?.added_by}
                          <div class="relative group">
                            <img
                                src={`${$serverUrl}/recipe-pictures/${image}`}
                                alt={t('photos.alt', {index: index + 1})}
                                class="w-full aspect-video object-cover rounded-lg border border-border"
                            />
                            {#if contributor}
                              <span class="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-medium rounded-full px-2 py-1 whitespace-nowrap">
                                {$_('recipe.photoAddedBy', {values: {username: contributor.username}})}
                              </span>
                            {/if}
                            <button
                                type="button"
                                onclick={() => removePicture(index)}
                                class="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        {/each}
                        {#each pendingPictures as picture, index}
                          <div class="relative group">
                            <img
                                src={picture.url}
                                alt={t('photos.newAlt', {index: index + 1})}
                                class="w-full aspect-video object-cover rounded-lg border border-border"
                            />
                            <button
                                type="button"
                                onclick={() => removePendingPicture(index)}
                                class="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}

                <!-- Navigation -->
                <div class="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-border">
                  <Button
                      variant="outline"
                      onclick={() => goToStep(currentStep - 1)}
                      disabled={currentStep === 0}
                  >
                    {$_('edit.wizard.back')}
                  </Button>

                  {#if currentStep < steps.length - 1}
                    <Button onclick={() => goToStep(currentStep + 1)}>
                      {$_('edit.wizard.next')}
                    </Button>
                  {:else}
                    <Button onclick={saveRecipe}>
                      {t('submit')}
                    </Button>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Live preview column -->
            <div class="lg:col-span-2">
              <div class="lg:sticky lg:top-8 space-y-6">
                <h2 class="text-2xl font-semibold text-card-foreground mt-4">{$_('edit.preview')}</h2>

                <RecipeCard recipe={{...formData, author: $user ?? {id: '', admin: false, username: 'aa', picture: ''}, id: '', favorite: false, favorite_count: 0, variation_count: 0}} disabled />

                <div class="bg-card rounded-xl border border-border p-6">
                  <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <svg class="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    {categoryLabel('recipe', 'diyRecipe', 'ingredients')}
                  </h3>

                  {#if previewIngredientGroups.length > 0}
                    <div class="space-y-4">
                      {#each previewIngredientGroups as group}
                        <div>
                          {#if group.label}
                            <h4 class="font-semibold text-foreground text-sm mb-2">{group.label}</h4>
                          {/if}
                          <ul class="space-y-2">
                            {#each group.items as ingredient}
                              <li class="flex items-start text-sm">
                                <div class="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 mr-2 flex-shrink-0"></div>
                                <span class="text-foreground">
                                                {#if ingredient.recipe_ref}
                                                  {`${getReferenceQuantity(ingredient)} ${ingredient.ref_label || ingredient.resolved_ref_title}`.trim()}
                                                {:else}
                                                  {getIngredientName(ingredient)}
                                                {/if}
                                            </span>
                              </li>
                            {/each}
                          </ul>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-sm text-muted-foreground">{$_('create.noIngredient')}</p>
                  {/if}
                </div>

                <div class="bg-card rounded-xl border border-border p-6">
                  <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <svg class="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"></path>
                    </svg>
                    {$_('recipe.instructions')}
                  </h3>

                  {#if formData.steps.length > 0 && formData.steps.some(s => s.title.trim() || s.description.trim())}
                    <div class="space-y-4">
                      {#each formData.steps as step}
                        {#if step.title.trim() || step.description.trim()}
                          <div class="flex gap-3">
                            <div class="text-sm">
                              {#if step.title.trim()}
                                <h4 class="font-semibold text-foreground mb-1">{step.title}</h4>
                              {/if}
                              {#if step.description.trim()}
                                <p class="text-foreground leading-relaxed whitespace-pre-line">{step.description}</p>
                              {/if}
                            </div>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {:else}
                    <p class="text-sm text-muted-foreground">{$_('create.noStep')}</p>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<ImageCropModal file={currentCrop?.file ?? null} onConfirm={onCropConfirm} onCancel={onCropCancel} />

<RecipePickerModal
    open={recipePickerOpen}
    {excludeFamily}
    onClose={() => recipePickerOpen = false}
    onSelect={onRecipePicked}
/>

{#if dragging && dragPos}
  <div
      class="fixed z-50 pointer-events-none bg-card border border-primary rounded-lg px-3 py-2 text-sm font-medium text-foreground shadow-lg"
      style="left:{dragPos.x}px; top:{dragPos.y}px; transform:rotate(-1.5deg);"
  >
    {dragGhostLabel}
  </div>
{/if}

{#if draggingStepUid && stepDragPos}
  <div
      class="fixed z-50 pointer-events-none bg-card border border-primary rounded-lg px-3 py-2 text-sm font-medium text-foreground shadow-lg"
      style="left:{stepDragPos.x}px; top:{stepDragPos.y}px; transform:rotate(-1.5deg);"
  >
    {stepDragGhostLabel}
  </div>
{/if}
