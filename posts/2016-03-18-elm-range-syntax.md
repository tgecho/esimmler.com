---
title: Elm range syntax
---

test

I recently stumbled around for more than a few moments searching for a canonical way to generate a range of numbers in [Elm](http://elm-lang.org). I finally found a working example by searching for "[haskell range syntax](https://www.google.com/search?q=haskell+range+syntax)".

```elm
> [1..2]
[1,2] : List number
```

Elm doesn't appear to support the more advanced variants such as `[1,3..20]`, but this definitely covers 95% of my use cases.

This **is** actually documented [under the Lists section of the syntax docs](http://elm-lang.org/docs/syntax#lists), but there aren't any useful words for a search to match on. Hopefully this post will save a few minutes for a few people.
