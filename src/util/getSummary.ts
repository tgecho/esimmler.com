import type { CollectionEntry } from "astro:content";
import removeMarkdown from "remove-markdown";

export function getSummary(entry: CollectionEntry<"blog">): string | undefined {
  return entry.data.summary;
}

export function getPlainTextSummary(
  entry: CollectionEntry<"blog">,
  minLength = 50,
  maxLength = 140,
) {
  if (entry.data.description) {
    return entry.data.description;
  }
  const content = getSummary(entry) || entry.body;
  const tokens = removeMarkdown(content).trim().split(/\s+/);
  let summary = [];
  let length = 0;
  for (const token of tokens) {
    summary.push(token);
    length += token.length;
    if (length > maxLength) {
      return summary.join(" ") + "...";
    } else if (length > minLength && token.endsWith(".")) {
      break;
    }
  }
  return summary.join(" ");
}
