// highlightSegments splits `text` into plain/matched runs around every
// case-insensitive occurrence of `rawQuery`, so a search result can show
// which part of it actually matched what was typed (e.g. "Fl" highlighted
// wherever it appears in "Flan"), rather than just relying on the list
// already being filtered/searched down to matches.
export function highlightSegments(text: string, rawQuery: string): {text: string, match: boolean}[] {
    const q = rawQuery.trim();
    if (!q) return [{text, match: false}];
    const lowerText = text.toLowerCase();
    const lowerQuery = q.toLowerCase();
    const segments: {text: string, match: boolean}[] = [];
    let i = 0;
    while (i < text.length) {
        const idx = lowerText.indexOf(lowerQuery, i);
        if (idx === -1) {
            segments.push({text: text.slice(i), match: false});
            break;
        }
        if (idx > i) segments.push({text: text.slice(i, idx), match: false});
        segments.push({text: text.slice(idx, idx + q.length), match: true});
        i = idx + q.length;
    }
    return segments;
}
