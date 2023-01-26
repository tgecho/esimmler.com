---
title: "Deploying web apps"
date: "2023-01-16"
---

Deploying a website is harder than it might first appear. Even a simple html page with a single Javascript or CSS file is a distributed system prone to race conditions. A "modern" [Single Page Application](https://developer.mozilla.org/en-US/docs/Glossary/SPA) with [code splitting](https://webpack.js.org/guides/code-splitting/) is worse.

<!-- more -->

Consider our simple HTML page. We have `v1` deployed to our live site. It depends on a couple of `.js`  and `.css` files. A visitor requesting our page will get `v1`, which will in turn trigger requests additional files, which will also be `v1`. All good so far!

Now we've started to deploy `v2`. A visitor comes along a split second before our deploy and gets `v1` of the page. In the time it takes for their browser to get the HTML and send requests for the rest of the files, `v1` has been replaced with `v2`.

What happens now?

Maybe nothing! Depending on which files we changed, and how backwards **and** forwards compatible those changes are, there may be no user perceivable impact.

Or, it could fail with varying levels of severity, from minor styling glitches to a Javascript exception resulting in a dead, white page.

"But it mostly works most of the time", you say. "They just need to refresh and we'll call it a caching bug!"

It gets worse.

A Single Page Application can run for days without reloading the page. If you take no measures to force a reload (politely, I hope) when you deploy a new version, it could persist across several updates. The entire time it's active, it may expect to be able to lazy load arbitrarily old versions of your assets (not to mention hitting other API endpoints).

It's a problem. What are our options?

# Cache busting?
For starters, we can add a version to the names of our static assets. When a user gets `v1` of the page, they send a request for `main.v1.js`[^hashbusting]. Except this happened just after we deploy `v2`, so now they get 404. Which is more likely to reliably break things than a subtle version mismatch.

Have we made it worse?

# Use a CDN?
We keep the cache buster file names, but put a CDN in front of our web server. Now if a `v1` page requests `main.v1.js` they'll get it from the CDN, right? Well, hopefully. If their [edge location](https://www.cloudflare.com/learning/cdn/glossary/edge-server/) happens to have a copy, and you've set the [caching headers properly](https://hacks.mozilla.org/2017/01/using-immutable-caching-to-speed-up-the-web/) so it doesn't try to fetch it from your freshly updated server. It may work for you personally, since you'll be constantly refreshing the page and priming your local cache.

Great! We've managed to get back into intermittently broken territory.

# Consolidate assets

In [You Don't Want Atomic Deploys](https://kevincox.ca/2021/08/24/atomic-deploys/), Kevin Cox distinguishes between "Entries" and "Assets". Entries are the stably named locations that visitors access directly. `hello.html` is an entry point, and visitors need to be able to navigate to it without knowledge of the current version. "Assets" are all of the files that "Entries" depend on, such as `.js`/`.css` files.

The key insight to solving this problem robustly is that all assets must remain available for as long as an entry point might request them.

The simplest way I've found to accomplish this goal is to upload static assets to a shared file store like [S3](https://aws.amazon.com/s3/), [B2](https://www.backblaze.com/b2/cloud-storage.html) or even a server you host yourself (also, keep the CDN!). Multiple versions of the same file must be able to coexist (the cache busted file names help), and you MUST do this before you deploy any of your entry points.

That's it. Not actually very complicated. Just tedious.

# Cleaning up
In terms of making a race condition filled space predictable and deterministic, this technique is pretty solid. It does have a bit of upfront setup cost, and it makes deploys a little less... discrete. Some day you also may want to garbage collect really old versions from the shared file storage.

It also does not address API versioning problems. However, there are plenty of documented approaches here. None of them are silver bullets, but there are at least plenty of ideas floating around to work with.

# How is everyone else handling this?
It's hard to say. I remember first reading about this at least ten years ago, though I haven't been able to figure out where. I keep looking for resources to share with others as I try to explain the problem, but there's actually very little I can find written down[^findafterwriting]. I can only assume that places sophisticated enough to have solved this also don't see it as worth talking about.

## Good: Fly's static asset caching
One notable exception is [Fly.io](https://fly.io)'s static asset caching. When you deploy a container, you can specify folders inside your container to be served up directly from their edge caching servers. Here's what they say in [First look: static asset caching](https://community.fly.io/t/first-look-static-asset-caching/1375):
> _And_ we keep a few versions around so you don’t get blank pages mid deploy, people who request outdated static URLs will get what they expect.

I haven't thoroughly tested this. It also doesn't completely solve the problem for arbitrarily long lived SPA clients. But *still*, this sounds both awesome and unique.

## Mixed: Static site hosting services
[Vercel](https://vercel.com/features/infrastructure), [Netlify](https://www.netlify.com/), [Render](https://render.com/docs/static-sites#instant-cache-invalidation) and many other similar services advertise their "atomic deploys" and "instant cache invalidation". This sounds great, but at best it only partially solves the problem outlined in this post. To be clear, I haven't tested each individual service, but I haven't found any documented indication that any of them take measures to avoid it.

I did test Vercel, which (as of this writing) hosts this site. To test, I opened a page and grabbed a cache busted `.css` URL. Then I pushed a minor update to the file, waited for it to deploy and got a 404 back when I re-requested the file. No joy.

So. In this specific case? My site is very static, has no Javascript and very little CSS. It even renders completely fine without CSS. Vercel is super convenient, so for now I choose to live dangerously and accept the risk.

# Further Reading
- [You Don't Want Atomic Deploys](https://kevincox.ca/2021/08/24/atomic-deploys/) (Kevin Cox)
- [Static assets in an eventually consistent webapp deployment](https://www.rea-group.com/about-us/news-and-insights/blog/static-assets-in-an-eventually-consistent-webapp-deployment/) (REA Group)

[^hashbusting]:  Instead of `main.v2.js`, this should ideally be the hash of the contents of each file. For example:  `main.6f5902a.js`. This way files that don't change can be reused from the cache.

[^findafterwriting]: I'm sure I will suddenly find dozens of more clearly written articles within days of publishing this one.
