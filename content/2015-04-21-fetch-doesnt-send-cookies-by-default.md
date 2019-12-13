+++
title = "Fetch() Doesn't Send Cookies By Default"
+++

Fetch is a [lovely little api](http://updates.html5rocks.com/2015/03/introduction-to-fetch) for making ajax requests. I've been using the  [github/fetch](https://github.com/github/fetch) polyfill [in lieu of full browser support](http://caniuse.com/#search=fetch), but with a recent chrome update all requests were being sent without cookies. At first it seemed to be a strangely obvious glitch in Chrome's implementation, but the behavior turns out to be [according to the spec](https://fetch.spec.whatwg.org/#concept-request-credentials-mode).

I think it's an odd default, but I'm sure they had their reasons. The difficulty comes from the fact that the polyfill [can't effectively mimic this behavior](https://github.com/github/fetch/pull/56). Setting the `credentials` option to `'include'` will cause fetch to add the appropriate cookie headers.

```js
fetch(url, {
  credentials: 'include'
})
```

In my case all requests go through a central wrapper, so it's no big deal to add this as the default.

Reference: [Fetch - Living Standard](https://fetch.spec.whatwg.org/) | [HTML5 Rocks - Introduction to fetch()](http://updates.html5rocks.com/2015/03/introduction-to-fetch#sending-credentials-with-a-fetch-request)
