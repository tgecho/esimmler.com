/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly GHOST_SERVER_URL: string;
  readonly GHOST_CONTENT_API_KEY: string;
}
