import type { CollectionEntry } from "astro:content"

export function getSlug(entry: CollectionEntry<"blog">) {
    const match = /\/?([^\/]+)\.\w+$/.exec(entry.id);
    return match?.[1] ?? entry.id;
}

export function getLink(entry: CollectionEntry<"blog">) {
    return `/${getSlug(entry)}`;
}
