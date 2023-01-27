import type { CollectionEntry } from "astro:content";
import removeMarkdown from "remove-markdown";

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

export function getPlainTextSummary(entry: CollectionEntry<"blog">, minLength = 50, maxLength = 140) {
    if (entry.data.description) {
        return entry.data.description;
    }
    const tokens = removeMarkdown(getSummary(entry)).trim().split(/\s+/);
    let summary = []
    let length = 0
    for (const token of tokens) {
        summary.push(token);
        length += token.length;
        if (length > maxLength) {
            return summary.join(' ') + '...';
        } else if (length > minLength && token.endsWith('.')) {
            break;
        }

    }
    return summary.join(' ');
}

