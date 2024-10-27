---
title: Passing URL params to Javascript modules
date: 2024-10-27
summary: One weird trick our tools apparently don't want us to use
---

Recent problems led me to discovering a new (to me) little trick. When you load a [JavaScript as a module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), you get access to [`import.meta.url`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta#url), which contains the URL of the module itself. The main way most people probably encounter this is when creating a Web Worker with the specific incantation supported by modern bundlers:
```js
new Worker(
  new URL('./worker', import.meta.url),
  { type: "module" },
);
```

We'll come back to this.

The interesting thing I realized was that if I could add params to my import
```js
import "./mymodule?hello=world"
```

I could actually read them back in `./mymodule`
```js
const hello = new URL(import.meta.url).searchParams.get('hello');
```

Which just seems... neat? I don't think this is a technique with a ton of uses, but it does have a few interesting ramifications. For example, from the browser's perspective `import "mymodule?hello=world"` and `import "mymodule?hello=none"` are two different modules with different scopes. So you can create multiple instances of a module, which some minor customization.
## Layers of Indirection

I've been using asset pipelines and bundling tools since long before [Webpack](/webpack-tutorial) took over, and am very much not a [#nobuild](https://world.hey.com/dhh/you-can-t-get-faster-than-no-build-7a44131c) advocate (though I do sympathize). I have no desire to ditch Typescript.

That said, this little technique starts running into problems as soon as you try to type it:
```ts
import {something} from "./mymodule?hello=world"
// error TS2307: Cannot find module './mymodule?hello=world' or its corresponding type declarations.
```

Even if you work around that, the bundlers that I've tried all complain or just drop the custom param from the final generated output. Usually this path manipulation is for our convenience (letting us omit file extensions, etc...).

What this means is that in order to use this technique, we need to do something to work around the bundler (and Typescript). Something gross like:
```ts
const mod: typeof import("./mymodule") = await import(
  /* @vite-ignore */
  new URL("./mymodule.js?hello=world", import.meta.url) as any
);
```

In order, we:
- Redeclare the bare path to the actual file on disk for Typescript to find.
- Use top level await just so we can use a dynamic `import(...)`.
- `as any`

So even after committing at least two misdemeanors and a felony (depending on jurisdiction), you're still not out of the woods because we're responsible for making sure the path in the `new URL` is actually valid at runtime. This will probably require adding a new entry point to your bundler config.

Is it worth the trouble?
## Case Study: Web Workers in a strict CSP environment
We've established that the tools do not make this easy to use. So when is it worth it? I have one case where I've decided to actually use it.

[Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) are great in theory, but actually using them can be tricky. First, they're constrained by the [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), which essentially means the URL you pass to the `Worker` constructor must come from the same origin as the parent page (or Worker). This is a problem if you host your built static assets on a separate CDN host.

For reasons I don't completely understand, `blob:` URLs are considered fine for these purposes, so a common workaround (implemented in most bundlers) is to use this (or a Data URL) to load a worker. For example
```js
const blob = await fetch('./worker.js').then(r => r.blob());
const worker = new Worker(URL.createObjectURL(blob));
```

This works well enough until you need to slap a strict [CSP (Content-Security-Policy)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) on your page. You can actually add `blob:` to the allowed origins, but it's likely that whatever drove you to add the policy in the first place will make that undesirable.

Enter the shim:

```js
const url = new URL(import.meta.url).searchParams.get('url');
if (!/.*.mydomain.com$/.exec(url.origin)) {
  throw new Error(`shim?url=${url} not from allowed origin`);
}
import(url);
```

If you serve this little snippet up from an endpoint on the same origin as your pages, it satisfy the Same-origin requirements for Web Workers AND is compatible with a strict CSP policy.

The `import.meta.url` helps to keep things decoupled. You could totally have this shim contain a hardcoded `import "https://mycdn.example.com/mymodule.js"`, but what if your file is cache busted into `mymodule.a23dfg.js` or something? This lets you keep this concern in your asset pipeline instead of needing this endpoint to also get involved.

Note that this essentially creates an open relay of sorts. I'm not sure what vulnerabilities that might create, but a simple check against an allowed pattern feels like it maintains the spirit of the CSP while letting us get this thing done.

To use the shim, you just need to pass the actual script URL to the shim as a param.
```js
new Worker(
  "/shim.js?url=https://cdn.mydomain.com/mymodule.js",
  {type: "module},
)
```

In my case, this pays off because I was already doing a very tricky and custom pre-bundling setup for an internal library. I need to maintain precise control over how various modules are loaded, so I had already been forced to break out of the bundler system in a few key places.

You have to understand what the tool is doing, at least a level or so below where you typically operation. The web platform can be a chaotic mess sometimes, but there's a lot of rich capability as well if you know how to find it.