import GhostContentAPI, { type GhostAPI } from "@tryghost/content-api";
import GhostAdminAPI from "@tryghost/admin-api";

const { GHOST_SERVER_URL, GHOST_ADMIN_API_KEY, GHOST_CONTENT_API_KEY } =
  import.meta.env;

let client: GhostAPI;

if (GHOST_ADMIN_API_KEY) {
  client = new GhostAdminAPI({
    url: GHOST_SERVER_URL,
    key: GHOST_ADMIN_API_KEY,
    version: "v5.0",
  });
} else if (GHOST_CONTENT_API_KEY) {
  client = new GhostContentAPI({
    url: GHOST_SERVER_URL,
    key: GHOST_CONTENT_API_KEY,
    version: "v5.0",
  });
} else {
  throw new Error("No Ghost API key provided");
}

export function allPosts(limit: "all" | number = "all") {
  return client.posts.browse({
    limit,
  });
}

export function postFromSlug(slug: string) {
  return client.posts.read({ slug }, { formats: ["html"], include: ["tags"] });
}
