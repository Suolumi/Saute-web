import {writable} from "svelte/store";
import {apiFetchJson} from "$lib/api";
import {normalizeForMatch} from "$lib/highlight";

export type FeedbackType = 'bug' | 'idea'
export type FeedbackStatus = 'open' | 'done' | 'declined'

export const MAX_FEEDBACK_PHOTOS = 3
export const MAX_FEEDBACK_TITLE = 120
export const MAX_FEEDBACK_DESCRIPTION = 5000

export type Feedback = {
    id: string
    type: FeedbackType
    title: string
    description: string
    photos: string[]
    link_path?: string
    // link_title is the linked recipe's title, when link_path is a recipe
    // page that still exists.
    link_title?: string
    author?: { id: string, username: string, picture?: string }
    // source_locale is known once someone has translated this feedback.
    source_locale?: string
    status: FeedbackStatus
    vote_count: number
    voted: boolean
    mine: boolean
    unread?: boolean
    admin_seen?: boolean
    created_at: string
    updated_at: string
    closed_at?: string
}

export type FeedbackList = {
    length: number
    items: Feedback[]
}

export type FeedbackForm = {
    type: FeedbackType
    title: string
    description: string
    link_path: string
    // photos are the already-stored filenames to keep (edit only).
    photos: string[]
}

export type ListFeedbackParams = {
    status?: 'open' | 'closed' | FeedbackStatus
    type?: FeedbackType
    q?: string
    mine?: boolean
    sort?: 'votes' | 'new'
    limit?: number
    offset?: number
}

function feedbackBody(form: FeedbackForm, newPhotos: File[]) {
    const formData = new FormData()
    formData.append('feedback', JSON.stringify(form))
    for (const file of newPhotos)
        formData.append('photos', file)
    return formData
}

export function listFeedback(params: ListFeedbackParams) {
    return apiFetchJson<FeedbackList>('/feedback', 'GET', null, {...params, mine: params.mine ? 'true' : undefined})
}

export function getFeedback(id: string) {
    return apiFetchJson<Feedback>(`/feedback/${id}`)
}

export function createFeedback(form: FeedbackForm, newPhotos: File[]) {
    return apiFetchJson<Feedback>('/feedback', 'POST', feedbackBody(form, newPhotos))
}

export function updateFeedback(id: string, form: FeedbackForm, newPhotos: File[]) {
    return apiFetchJson<Feedback>(`/feedback/${id}`, 'PATCH', feedbackBody(form, newPhotos))
}

export function deleteFeedback(id: string) {
    return apiFetchJson<object>(`/feedback/${id}`, 'DELETE')
}

export function voteFeedback(id: string, vote: boolean) {
    return apiFetchJson<Feedback>(`/feedback/${id}/vote`, vote ? 'POST' : 'DELETE')
}

export type FeedbackTranslation = {
    title: string
    description: string
    locale: string
    source_locale: string
    // same_language means the feedback was already written in locale.
    same_language: boolean
}

// translateFeedback asks the API for a feedback in locale. Feedback is never
// translated on its own; this only runs when a viewer clicks "Translate".
export function translateFeedback(id: string, locale: string) {
    return apiFetchJson<FeedbackTranslation>(`/feedback/${id}/translate`, 'POST', {locale})
}

// sameLanguage compares the base language of two BCP-47 tags ("fr" = "fr-CA").
export function sameLanguage(a: string, b: string): boolean {
    return a.split('-')[0].toLowerCase() === b.split('-')[0].toLowerCase()
}

// languageName names a language code in the viewer's locale ("fr" -> "French").
export function languageName(code: string, locale: string): string {
    try {
        return new Intl.DisplayNames([locale], {type: 'language'}).of(code) ?? code
    } catch {
        return code
    }
}

export function markFeedbackSeen(id: string) {
    return apiFetchJson<object>(`/feedback/${id}/seen`, 'POST')
}

// feedbackUpdates holds the signed-in user's own feedback that an admin
// closed since they last looked. Header.svelte polls it; it drives the
// unread badge on the Feedback link and the notice on the board.
export const feedbackUpdates = writable<Feedback[]>([])

export async function refreshFeedbackUpdates() {
    const {response, data} = await apiFetchJson<FeedbackList>('/feedback/updates')
    if (response.ok && data?.items)
        feedbackUpdates.set(data.items)
}

export async function acknowledgeFeedback(id: string) {
    feedbackUpdates.update(items => items.filter(item => item.id !== id))
    await markFeedbackSeen(id)
}

// FeedbackLinkError explains why a pasted link was refused.
export type FeedbackLinkError = 'invalid' | 'external'

// parseFeedbackLink checks that raw (a full URL or a site path) points to a
// page of this site, and returns its path. The origin comparison is the
// whole check: it works the same on localhost and in production.
export function parseFeedbackLink(raw: string, origin: string): { path: string } | { error: FeedbackLinkError } {
    const trimmed = raw.trim()
    let url: URL
    try {
        if (trimmed.startsWith('/') && !trimmed.startsWith('//'))
            url = new URL(trimmed, origin)
        else
            url = new URL(trimmed)
    } catch {
        return {error: 'invalid'}
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return {error: 'invalid'}
    if (url.origin !== origin)
        return {error: 'external'}
    return {path: url.pathname}
}

const RECIPE_PATH = /^\/[A-Za-z-]+\/recipes\/([0-9a-f]{24})(?:\/.*)?$/

// recipeIdFromPath returns the recipe a site path points to, if any.
export function recipeIdFromPath(path: string): string | undefined {
    return RECIPE_PATH.exec(path)?.[1]
}

const PAGE_LABEL_KEYS: Record<string, string> = {
    home: 'header.allRecipes',
    diy: 'header.diy',
    toolbox: 'header.toolbox',
    about: 'header.about',
    'connect-ai': 'header.connectAI',
    create: 'header.createRecipe',
    settings: 'header.settings',
    'shopping-list': 'shoppingList.navButton',
    'meal-planning': 'mealPlanning.navButton',
    feedback: 'feedback.title',
}

// feedbackLinkLabel names a linked page for display: the recipe's title for
// a recipe page, the page's own name for the main sections, else the path.
export function feedbackLinkLabel(path: string, recipeTitle: string | undefined, t: (key: string, options?: object) => string): string {
    if (recipeIdFromPath(path))
        return recipeTitle ? t('feedback.link.recipe', {values: {title: recipeTitle}}) : t('feedback.link.recipeUnknown')
    const section = path.split('/').filter(Boolean)[1]
    const key = section ? PAGE_LABEL_KEYS[section] : undefined
    return key ? t(key) : path
}

// similarFeedback returns the open items sharing a significant word (4+
// letters, case/accent-folded) with title, most shared words first.
export function similarFeedback(title: string, items: Feedback[], max = 3): Feedback[] {
    const words = new Set(normalizeForMatch(title).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4))
    if (words.size === 0)
        return []
    return items
        .map(item => {
            const itemWords = new Set(normalizeForMatch(item.title).split(/[^\p{L}\p{N}]+/u))
            let shared = 0
            for (const word of words)
                if (itemWords.has(word)) shared++
            return {item, shared}
        })
        .filter(entry => entry.shared > 0)
        .sort((a, b) => b.shared - a.shared || b.item.vote_count - a.item.vote_count)
        .slice(0, max)
        .map(entry => entry.item)
}

// Admin queue.

export type FeedbackAdminTab = 'new' | 'open' | 'done' | 'declined' | 'all'

export function adminListFeedback(tab: FeedbackAdminTab, limit = 20, offset = 0) {
    return apiFetchJson<FeedbackList>('/admin/feedback', 'GET', null, {tab, limit, offset})
}

export function adminSetFeedbackStatus(id: string, status: FeedbackStatus) {
    return apiFetchJson<Feedback>(`/admin/feedback/${id}/status`, 'POST', {status})
}

export function adminMarkFeedbackSeen(id: string) {
    return apiFetchJson<object>(`/admin/feedback/${id}/seen`, 'POST')
}

// pendingFeedbackCount is how many feedback items no admin has opened yet;
// it joins the other pending counts behind the admin badge.
export const pendingFeedbackCount = writable(0)

export async function refreshPendingFeedbackCount() {
    const {response, data} = await adminListFeedback('new', 1)
    if (response.ok && data)
        pendingFeedbackCount.set(data.length)
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60],
]

// relativeTime renders an ISO date as "3 days ago" in locale.
export function relativeTime(iso: string, locale: string, now = Date.now()): string {
    const seconds = (new Date(iso).getTime() - now) / 1000
    const format = new Intl.RelativeTimeFormat(locale, {numeric: 'auto'})
    for (const [unit, size] of RELATIVE_UNITS)
        if (Math.abs(seconds) >= size)
            return format.format(Math.round(seconds / size), unit)
    return format.format(0, 'second')
}
