import {toast} from "@zerodevx/svelte-toast";

export function toastSuccess(msg: string) {
    toast.push(msg, {
        theme: {
            '--toastColor': 'mintcream',
            '--toastBackground': 'rgba(72,187,120,0.9)',
            '--toastBarBackground': '#2F855A'
        }
    })
}

export function toastError(msg: string) {
    toast.push(msg, {
        theme: {
            '--toastBackground': 'rgba(192, 21, 26, 0.95)',
            '--toastColor': '#ffffff',
            '--toastBarBackground': '#8c0000'
        }
    })
}

// pictureUrl resolves a recipe/step picture for display. Most of the time
// `picture` is a filename that needs the API's static-file prefix; but a
// locally-staged, not-yet-uploaded photo (the create/edit wizard's live
// preview) is already a full blob: object URL, and must be used as-is.
export function pictureUrl(serverUrl: string, picture: string): string {
    return /^(blob|data|https?):/.test(picture) ? picture : `${serverUrl}/recipe-pictures/${picture}`;
}