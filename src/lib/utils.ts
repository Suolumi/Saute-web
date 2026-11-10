import {toast} from "@zerodevx/svelte-toast";
import {_} from "svelte-i18n";
import {get} from "svelte/store";
import {apiErrorReason} from "$lib/api";

// svelte-toast renders messages as HTML.
function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function toastSuccess(msg: string) {
    toast.push(escapeHtml(msg), {
        theme: {
            '--toastColor': 'mintcream',
            '--toastBackground': 'rgba(72,187,120,0.9)',
            '--toastBarBackground': '#2F855A'
        }
    })
}

// toastError shows what failed and, when known, why on a second line.
export function toastError(msg: string, reason?: string) {
    const html = reason
        ? `<strong>${escapeHtml(msg)}</strong><br>${escapeHtml(reason)}`
        : escapeHtml(msg)
    toast.push(html, {
        duration: reason ? 6000 : 4000,
        pausable: true,
        theme: {
            '--toastBackground': 'rgba(192, 21, 26, 0.95)',
            '--toastColor': '#ffffff',
            '--toastBarBackground': '#8c0000'
        }
    })
}

// toastApiError reports a failed API call: `context` says what failed, the
// response says why. Reads the body when `data` isn't given and it's unread.
export async function toastApiError(context: string, response: Response, data?: unknown) {
    if (data === undefined && !response.bodyUsed)
        data = await response.json().catch(() => undefined)
    const reason = apiErrorReason(response, data)
    if (!reason)
        return toastError(context)
    toastError(context, 'key' in reason ? get(_)(reason.key) : reason.detail)
}

// pictureUrl resolves a recipe/step picture for display. Most of the time
// `picture` is a filename that needs the API's static-file prefix; but a
// locally-staged, not-yet-uploaded photo (the create/edit wizard's live
// preview) is already a full blob: object URL, and must be used as-is.
export function pictureUrl(serverUrl: string, picture: string): string {
    return /^(blob|data|https?):/.test(picture) ? picture : `${serverUrl}/recipe-pictures/${picture}`;
}