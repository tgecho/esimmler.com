import GhostContentAPI from "@tryghost/content-api";

export const ghostClient = new GhostContentAPI({
  url: import.meta.env.GHOST_SERVER_URL,
  key: import.meta.env.GHOST_CONTENT_API_KEY,
  version: "v5.0",
});

export function allPosts(limit: "all" | number = "all") {
  return ghostClient.posts.browse({
    limit,
  });
}

export function postFromSlug(slug: string) {
  return ghostClient.posts.read({ slug }, { include: "tags" });
}
