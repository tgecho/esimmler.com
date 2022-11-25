---
title: "Building Canrun: A constraint logic programming library for Rust (part 2)"
---

_Be sure to have read [Building Canrun: A statically typed logic programming library for Rust (part 1)](@/2020-07-08-building-canrun-part-1.md)_ to put this article in context.

I had static types. I had a shiny new Rustified approach to managing `State`. Alongside this work[^timelines], I was plotting my next move: trying to bolt a [constraint system](https://en.wikipedia.org/wiki/Constraint_logic_programming) on top of my creation.

In basic [μKanren](http://webyrd.net/scheme-2013/papers/HemannMuKanren2013.pdf), any interactions must be modeled in a way that can be expressed through unification. While impressive results can be achieved with a bit of creativity (see: [math with Peano numbers](https://codon.com/hello-declarative-world#numbers)), I wanted something more direct, understandable and arbitrarily powerful.

```rust

```

---

[^timelines]: All timelines depicted in this series, implied or otherwise, are not meant to be taken literally. Believe it or not, this rambling mess is actually an attempt to emphasize understandability over historical accuracy.
