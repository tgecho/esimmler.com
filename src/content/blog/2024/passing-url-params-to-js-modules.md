---
title: Passing URL params to Javascript modules
date: 2024-10-27
summary: One weird trick our tools apparently don't want us to use
---

When you load [JavaScript as a module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), you get access to [`import.meta.url`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta#url), which contains the URL of the module script itself. I first encountered this feature through the [Web Worker incantation](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) supported by modern bundlers:
```js
new Worker(
  new URL('./worker', import.meta.url),
  { type: "module" },
);
```

We'll come back to this.

The interesting thing I realized was that I could add params to my import
```js
import "./mymodule.js?hello=world"
```

and read them back inside `./mymodule.js`.
```js
const hello = new URL(import.meta.url).searchParams.get('hello');
```

Which just seems... neat? I'm not sure how widely applicable this is, but it does have a few interesting ramifications. For example, from the browser's perspective `import "mymodule.js?hello=world"` and `import "mymodule.js?hello=none"` are two different modules, each with their own scope. So you can create multiple instances of a module with some minor customization. I'm sure that could come in handy?
## Indirection Problems

I've been using asset pipelines and bundling tools since long before [Webpack](/webpack-tutorial) took over, and am very much not a [#nobuild](https://world.hey.com/dhh/you-can-t-get-faster-than-no-build-7a44131c) advocate (though I do sympathize). I have no desire to ditch tools like Vite and Typescript. That said, this little technique starts running into problems as soon as you try to type it:
```ts
import {something} from "./mymodule?hello=world"
// error TS2307: Cannot find module './mymodule?hello=world' or its corresponding type declarations.
```

Even if you work around the type errors, bundlers don't really seem to make much of an attempt to preserve the full utility of `import.meta.url`. They either try to be helpful but end up transforming it down to something like a bogus `file://mymodule.js` path (Webpack and Parcel) or just drop it completely in the process of merging modules together (Vite).

In order to use this technique, we have to do something to work around the bundler (and Typescript). Something gross like:
```ts
const mod: typeof import("./mymodule") = await import(
  /* @vite-ignore */
  new URL("./mymodule.js?hello=world", import.meta.url) as any
);
```

In order, we:
- Redeclare the bare path to the actual file on disk for Typescript to find.
- Use top level await just so we can use a dynamic `import(...)`.
- Add bundler specific comments (you'll need a different one to quiet Webpack).
- `as any`

Even after committing a few misdemeanors and a felony (depending on jurisdiction), we're still not out of the woods because we're responsible for making sure the path in the `new URL` is actually valid at runtime, likely by creating a custom entry point for the target of the import.

Is it worth the trouble?
## Case Study: Web Workers in a strict CSP environment
We've established that the tools do not make this easy to use. So when is it worth it? So far I have one place where I've decided that it is.

[Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) are great in theory, but actually using them can be tricky. First, they're constrained by the [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), which essentially means the URL you pass to the `Worker` constructor must come from the same origin as their parent. This is a pain if you host your built static assets on a separate CDN host.

For reasons I don't completely understand, `blob:` URLs are considered fine for these purposes, so a common workaround (built into most bundlers) is to use this (or a Data URL) to load the worker.
```js
const blob = await fetch('./worker.js').then(r => r.blob());
const worker = new Worker(URL.createObjectURL(blob));
```

This works well enough until you need to add a strict [CSP (Content-Security-Policy)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) to your page. You can actually allow `blob:` in the CSP, but it's likely that whatever drove you to add the policy in the first place will make that undesirable.

Enter the shim:

```js
const url = new URL(import.meta.url).searchParams.get('url');
if (!/.*.mydomain.com$/.exec(url.origin)) {
  throw new Error(`shim?url=${url} not from allowed origin`);
}
import(url);
```

If you serve this little snippet up from an endpoint on the same origin as your page, it will satisfy the same-origin requirements for Web Workers AND is compatible with a strict CSP policy.

The `import.meta.url` helps to keep things decoupled. You could totally have this shim contain a hardcoded `import "https://mycdn.example.com/mymodule.js"`, but what if your file is cache busted into something like `mymodule.a23dfg1.js`? Or you have more than one worker module? The shim lets you keep this concern in your asset pipeline instead of needing the endpoint to also get overly complicated.

Note that this essentially creates a sort of open relay. I'm not sure what vulnerabilities that might create, but a simple check against an allowed pattern feels like it maintains the spirit of the CSP while letting us get this thing done.

To use the shim, you just need to pass the target script URL as a param.
```js
new Worker(
  "/shim.js?url=https://cdn.mydomain.com/mymodule.js",
  {type: "module},
)
```

In my case, this pays off because I was already doing a very tricky and custom pre-bundling step for an internal library. I needed to maintain precise control over how various modules were loaded, so I had already been forced to break out of the bundler system in a few key spots.

You have to understand what the tools are doing, at least a level or so below where you typically work. The web platform can be a chaotic mess, but there's a lot of rich capability if you know how to find it.