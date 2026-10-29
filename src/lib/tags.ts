import {writable, type Readable} from "svelte/store";
import {apiFetchJson} from "$lib/api";
import type {RecipeCategory} from "$lib/recipes";

export type TagGroup = "diet" | "practical"

// TAG_GROUPS is the display order, mirroring the API's models.TagGroups.
export const TAG_GROUPS: TagGroup[] = ["diet", "practical"]

// tagGroupAccent colours a tag's icon; chips themselves stay neutral so they
// don't compete with the recipe kind badge.
export const tagGroupAccent: Record<TagGroup, string> = {
    diet: "text-emerald-600 dark:text-emerald-400",
    practical: "text-amber-600 dark:text-amber-400",
}

// tagGroupSelected styles a selected chip in the filter and picker.
export const tagGroupSelected: Record<TagGroup, string> = {
    diet: "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/20",
    practical: "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-900/20",
}

export type RecipeTag = {
    slug: string
    group: TagGroup
    categories: RecipeCategory[]
    implies: string[]
    labels: Record<string, string>
    source_locale: string
    icon?: string
}

export type TagMap = Map<string, RecipeTag>

// TagMatch is a variation that satisfies a tag filter its family root
// doesn't; the listing card links to it.
export type TagMatch = {
    id: string
    title: string
}

export type RecipeTagRequest = {
    slug?: string
    group: TagGroup
    categories: RecipeCategory[]
    implies: string[]
    labels: Record<string, string>
    source_locale: string
    icon: string
}

export function getTags() {
    return apiFetchJson<{ items: RecipeTag[] }>('/tags', 'GET')
}

export function createTag(body: RecipeTagRequest) {
    return apiFetchJson<{ tag: RecipeTag, backfilled: number }>('/admin/tags', 'POST', body)
}

export function updateTag(slug: string, body: RecipeTagRequest) {
    return apiFetchJson<{ tag: RecipeTag, backfilled: number }>(`/admin/tags/${encodeURIComponent(slug)}`, 'PUT', body)
}

export function deleteTag(slug: string) {
    return apiFetchJson<null>(`/admin/tags/${encodeURIComponent(slug)}`, 'DELETE', null)
}

const tagMapStore = writable<TagMap>(new Map())
let loading: Promise<void> | null = null

// tags is every tag by slug, loaded once per page load by loadTags.
export const tags: Readable<TagMap> = {subscribe: tagMapStore.subscribe}

// loadTags fetches the tag list the first time it's called (or again with
// force, after an admin edit). A failed fetch leaves the map empty, so tag UI
// just doesn't render.
export function loadTags(force = false): Promise<void> {
    if (loading && !force)
        return loading
    loading = getTags().then(({response, data}) => {
        if (response.ok && data)
            tagMapStore.set(new Map(data.items.map(tag => [tag.slug, tag])))
        else
            loading = null
    }).catch(() => {
        loading = null
    })
    return loading
}

// tagLabel picks the label for locale, then its base language, then the
// source label, then the slug - same fallback as the API's resolveTagLabel.
export function tagLabel(tag: RecipeTag, locale: string | null | undefined): string {
    const labels = tag.labels ?? {}
    if (locale) {
        if (labels[locale])
            return labels[locale]
        const base = locale.split('-')[0]
        for (const [key, label] of Object.entries(labels)) {
            if (label && key.split('-')[0] === base)
                return label
        }
    }
    return labels[tag.source_locale] || tag.slug
}

// tagClosure returns slugs plus every tag they transitively imply.
export function tagClosure(slugs: Iterable<string>, all: TagMap): Set<string> {
    const seen = new Set<string>()
    const queue = [...slugs]
    while (queue.length > 0) {
        const slug = queue.shift()!
        if (seen.has(slug))
            continue
        seen.add(slug)
        queue.push(...(all.get(slug)?.implies ?? []))
    }
    return seen
}

// impliedBy returns the tags implied by some other tag in selected: the ones
// the editor locks, and the ones badges hide.
export function impliedBy(selected: Iterable<string>, all: TagMap): Set<string> {
    const implied = new Set<string>()
    for (const slug of selected) {
        for (const other of tagClosure(all.get(slug)?.implies ?? [], all))
            implied.add(other)
    }
    return implied
}

// toggleTag ticks slug with everything it implies, or unticks it alone. An
// implied (locked) tag can't be unticked while its implying tag is selected.
export function toggleTag(selected: string[], slug: string, all: TagMap): string[] {
    if (!selected.includes(slug))
        return [...tagClosure([...selected, slug], all)].sort()
    if (impliedBy(selected, all).has(slug))
        return selected
    return selected.filter(s => s !== slug)
}

export function tagsForCategory(all: TagMap, category: RecipeCategory | undefined): RecipeTag[] {
    const c = category || 'food'
    return [...all.values()].filter(tag => tag.categories.includes(c))
}

// sortTags orders tags by group, then by localized label.
export function sortTags(list: RecipeTag[], locale: string | null | undefined): RecipeTag[] {
    return [...list].sort((a, b) =>
        TAG_GROUPS.indexOf(a.group) - TAG_GROUPS.indexOf(b.group) ||
        tagLabel(a, locale).localeCompare(tagLabel(b, locale), locale ?? undefined))
}

// groupTags splits tags into display groups, in TAG_GROUPS order, skipping
// empty ones.
export function groupTags(list: RecipeTag[], locale: string | null | undefined): { group: TagGroup, tags: RecipeTag[] }[] {
    const sorted = sortTags(list, locale)
    return TAG_GROUPS
        .map(group => ({group, tags: sorted.filter(tag => tag.group === group)}))
        .filter(entry => entry.tags.length > 0)
}

// badgeTags is what a recipe shows as badges: its known tags minus those
// implied by another one it carries, in display order.
export function badgeTags(slugs: string[] | null | undefined, all: TagMap, locale: string | null | undefined): RecipeTag[] {
    const carried = slugs ?? []
    const hidden = impliedBy(carried, all)
    return sortTags(carried.filter(slug => !hidden.has(slug)).map(slug => all.get(slug)).filter(tag => tag !== undefined), locale)
}
