import { getCollection } from "astro:content";

export async function getTags() {
    const posts = await getCollection("blog");
    const tags = posts.flatMap((post) => post.data.tags || []);
    return Array.from(new Set(tags)).sort()
}
