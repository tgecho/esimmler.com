import type { CollectionEntry } from "astro:content";

export function getSummary(entry: CollectionEntry<"blog">): string {
    if (entry.data.summary) {
        return entry.data.summary;
    }
    const summaryMatch = entry.body && /<!-- ?more ?-->/.exec(entry.body);
    if (summaryMatch) {
        return entry.body.slice(0, summaryMatch.index);
    }
    return ''
}

