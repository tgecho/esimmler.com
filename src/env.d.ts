/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly GHOST_SERVER_URL: string;
  readonly GHOST_CONTENT_API_KEY: string;
}

// There aren't any types available, but it's close enough, and we're only using
// this to get at draft posts, so this should be fine for now.
declare module "@tryghost/admin-api" {
  import GhostContentAPI from "@tryghost/content-api";
  export default class GhostAdminAPI extends GhostContentAPI {}
}
