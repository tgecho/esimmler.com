import type { CollectionEntry } from "astro:content";

export function byDate(a: CollectionEntry<"blog">, b: CollectionEntry<"blog">) {
    return (b.data.date.valueOf() || Infinity) -
        (a.data.date.valueOf() || Infinity)
}
