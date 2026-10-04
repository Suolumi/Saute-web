// Ligatures that don't decompose via Unicode NFD (unlike accented letters,
// e.g. "é" -> "e" + a combining accent) - these need an explicit expansion so
// "oeuf"/"boeuf" (typed with plain letters) can match "œuf"/"bœuf" (stored
// with the ligature character).
const LIGATURES: Record<string, string> = {
    'œ': 'oe', 'Œ': 'OE', 'æ': 'ae', 'Æ': 'AE'
};

function normalizeChar(ch: string): string {
    const expanded = LIGATURES[ch] ?? ch;
    return expanded.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Builds a lowercased, accent/ligature-folded version of `text` for matching,
// alongside a parallel array mapping each character of that normalized
// string back to the [start, end) range of the original text it came from -
// a ligature like "œ" expands to two normalized characters ("oe") that both
// map back to that same one original character.
function buildNormalizedMapping(text: string): { normalized: string, ranges: [number, number][] } {
    let normalized = '';
    const ranges: [number, number][] = [];
    for (let i = 0; i < text.length; i++) {
        const piece = normalizeChar(text[i]);
        for (let j = 0; j < piece.length; j++) ranges.push([i, i + 1]);
        normalized += piece;
    }
    return {normalized, ranges};
}

// normalizeForMatch is the one place both search-filtering and ranking
// (IngredientCombobox.svelte) and highlighting (below) fold case/accents/
// ligatures, so a typed "oeuf" finds and ranks against a stored "Bœuf" the
// same way everywhere.
export function normalizeForMatch(text: string): string {
    return buildNormalizedMapping(text).normalized;
}

// highlightSegments splits `text` into plain/matched runs around every
// occurrence of `rawQuery` - case/accent/ligature-insensitive - so a search
// result can show which part of it actually matched what was typed (e.g.
// "Fl" highlighted wherever it appears in "Flan"), rather than just relying
// on the list already being filtered/searched down to matches.
export function highlightSegments(text: string, rawQuery: string): {text: string, match: boolean}[] {
    const q = rawQuery.trim();
    if (!q) return [{text, match: false}];
    const {normalized: normText, ranges} = buildNormalizedMapping(text);
    const normQuery = normalizeForMatch(q);
    if (!normQuery) return [{text, match: false}];
    const segments: {text: string, match: boolean}[] = [];
    let cursor = 0;
    let searchFrom = 0;
    while (cursor < text.length) {
        const idx = normText.indexOf(normQuery, searchFrom);
        if (idx === -1) {
            segments.push({text: text.slice(cursor), match: false});
            break;
        }
        const origStart = ranges[idx][0];
        const origEnd = ranges[idx + normQuery.length - 1][1];
        if (origStart > cursor) segments.push({text: text.slice(cursor, origStart), match: false});
        segments.push({text: text.slice(origStart, origEnd), match: true});
        cursor = origEnd;
        searchFrom = idx + normQuery.length;
    }
    return segments;
}
