import {writable} from "svelte/store";
import {apiFetchJson} from "$lib/api";
import type {User} from "$lib/user";
import type {GetRecipesRequest, RecipePreview, Ingredient, Step, TranslationSuggestion} from "$lib/recipes";

// AdminUser is the full user document the back-office sees (unlike the
// public User type, which the API redacts for non-admin callers).
export type AdminUser = User

export type GetAdminUsersResponse = {
    length: number
    items: AdminUser[]
}

export type GetAdminRecipesResponse = {
    length: number
    items: RecipePreview[]
}

export type AdminStats = {
    total_users: number
    total_admins: number
    total_recipes: number
    recipes_by_category: Record<string, number>
}

export type CleanupImagesResult = {
    removed: Record<string, number>
}

// AdminRouteParam/AdminRouteDescriptor mirror the backend's
// models.AdminRouteParam/AdminRouteDescriptor (see SautéAPI's
// admin_manifest.go) - the shape driving the generic admin console.
export type AdminRouteParam = {
    name: string
    in: 'path' | 'query' | 'body'
    type: 'string' | 'int' | 'bool' | 'file'
    picker?: 'user' | 'recipe'
    required: boolean
    label: string
}

export type AdminRouteCategory = 'users' | 'recipes' | 'system' | 'translations'

export type AdminRouteDescriptor = {
    id: string
    method: string
    path: string
    label: string
    category: AdminRouteCategory
    description: string
    destructive: boolean
    params: AdminRouteParam[]
}

export function getAdminRoutes() {
    return apiFetchJson<AdminRouteDescriptor[]>('/admin/routes')
}

export function getAdminUsers(params: { username?: string, limit?: number, offset?: number }) {
    return apiFetchJson<GetAdminUsersResponse>('/admin/users', 'GET', null, params)
}

// adminUpdateUser/adminDeleteUser/adminUpdateUserPicture/adminDeleteUserPicture
// call the original (pre-/admin-group) admin routes - user CRUD that already
// existed before the back-office, reused as-is.
export function adminUpdateUser(id: string, fields: { username?: string, email?: string, password?: string }) {
    return apiFetchJson<AdminUser>(`/users/${id}`, 'PUT', fields)
}

export function adminDeleteUser(id: string) {
    return apiFetchJson<AdminUser>(`/users/${id}`, 'DELETE')
}

export function adminUpdateUserPicture(id: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return apiFetchJson<{ id: string }>(`/users/${id}/picture`, 'POST', formData, null, {})
}

export function adminDeleteUserPicture(id: string) {
    return apiFetchJson<{ message: string }>(`/users/${id}/picture`, 'DELETE')
}

export function setAdminStatus(id: string, admin: boolean) {
    return apiFetchJson<AdminUser>(`/admin/users/${id}/admin-status`, 'PATCH', {admin})
}

export function sendPasswordReset(id: string, locale?: string) {
    return apiFetchJson<{ message: string }>(`/admin/users/${id}/send-password-reset`, 'POST', null, locale ? {locale} : null)
}

export function revokeMcpToken(id: string) {
    return apiFetchJson<{ message: string }>(`/admin/users/${id}/mcp-token`, 'DELETE', null)
}

export function getAdminRecipes(params: Omit<GetRecipesRequest, 'own_recipes' | 'variation_of' | 'exclude_family' | 'favorite'>) {
    return apiFetchJson<GetAdminRecipesResponse>('/admin/recipes', 'GET', null, params)
}

export function retranslateRecipe(id: string) {
    return apiFetchJson<{ message: string }>(`/recipes/${id}/retranslate`, 'POST', null)
}

// RecipeFavoriter is the identity-only view of a user who favorited a
// recipe (backend's models.UserView: no email, no admin flag).
export type RecipeFavoriter = {
    id: string
    username: string
    picture?: string
}

export type GetRecipeFavoritesResponse = {
    length: number
    items: RecipeFavoriter[]
}

export function getAdminRecipeFavorites(id: string, params: { limit?: number, offset?: number }) {
    return apiFetchJson<GetRecipeFavoritesResponse>(`/admin/recipes/${id}/favorites`, 'GET', null, params)
}

export function getAdminStats() {
    return apiFetchJson<AdminStats>('/admin/system/stats')
}

export function cleanupImages() {
    return apiFetchJson<CleanupImagesResult>('/admin/system/cleanup-images', 'POST')
}

// TranslationSuggestionView is one row in the admin review list: the
// suggestion's own content plus its resolved recipe title/submitter
// username, and the *current* live translation it would replace - so the
// tab can render an old-vs-suggested comparison per field without a second
// request.
export type TranslationSuggestionView = {
    id: string
    recipe_id: string
    recipe_title: string
    locale: string
    submitted_by: string
    submitted_by_username: string
    status: 'pending' | 'approved' | 'rejected' | 'stale'
    created_at: string
    reviewed_at?: string
    suggested_title: string
    suggested_description: string
    suggested_ingredients: Ingredient[]
    suggested_steps: Step[]
    current_title: string
    current_description: string
    current_ingredients: Ingredient[]
    current_steps: Step[]
}

export type ListTranslationSuggestionsResponse = {
    length: number
    items: TranslationSuggestionView[]
}

export function getTranslationSuggestions(status?: string, limit?: number) {
    const params: Record<string, unknown> = {};
    if (status) params.status = status;
    if (limit) params.limit = limit;
    return apiFetchJson<ListTranslationSuggestionsResponse>('/admin/translation-suggestions', 'GET', null, Object.keys(params).length > 0 ? params : null)
}

export function approveTranslationSuggestion(id: string) {
    return apiFetchJson<TranslationSuggestion>(`/admin/translation-suggestions/${id}/approve`, 'POST')
}

export function rejectTranslationSuggestion(id: string) {
    return apiFetchJson<TranslationSuggestion>(`/admin/translation-suggestions/${id}/reject`, 'POST')
}

// Durable-override view/clear actions (admin.translations.listOverrides/
// clearOverride) are deliberately not wired here - they're used through the
// generic manifest console instead (see admin/console), consistent with how
// this feature's suggestion-review routes are console-usable too.

// pendingTranslationSuggestionCount backs the notification badge on the
// admin nav's "Translations" tab (see (admin)/+layout.svelte, which owns
// polling it) - a plain runtime store, not persisted, since it's just a
// cheap reflection of server state. limit: 1 keeps the request light; the
// response's `length` is still the true total count (CountDocuments over
// the full filter), not the page size.
export const pendingTranslationSuggestionCount = writable(0);

export async function refreshPendingTranslationSuggestionCount() {
    const {response, data} = await getTranslationSuggestions('pending', 1);
    if (response.ok && data)
        pendingTranslationSuggestionCount.set(data.length);
}

// callAdminRoute fires an arbitrary route from the manifest. pathAndQuery is
// the already-resolved request target (e.g.
// "/admin/users/507f.../admin-status?locale=en"), taken verbatim from the
// console's editable path+query field - no further param substitution
// happens here. body is the parsed JSON body (or null for actions with none);
// file, when given, is appended to a multipart body alongside body's fields
// (JSON can't hold a File, so the two never combine into one JSON payload).
export function callAdminRoute(descriptor: AdminRouteDescriptor, pathAndQuery: string, body: Record<string, unknown> | null, file?: { field: string, value: File } | null) {
    let payload: object | FormData | null = body
    if (file?.value) {
        const formData = new FormData()
        formData.append(file.field, file.value)
        if (body)
            for (const [key, value] of Object.entries(body))
                formData.append(key, String(value))
        payload = formData
    }
    return apiFetchJson<unknown>(pathAndQuery, descriptor.method, payload)
}
