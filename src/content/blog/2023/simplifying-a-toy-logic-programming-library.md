---
title: "Simplifying a toy logic programming library"
date: "2023-01-02"
tags: ["rust", "canrun"]
summary: "I made a toy logic programming library in Rust called Canrun. I just published a new version with fixes for several serious design flaws."
---

**TLDR:** I made a toy logic programming library in Rust called Canrun ([original announcement](/announcing-canrun)). I just published a new version with fixes for several serious design flaws: [canrun v0.4.0 on docs.rs](https://docs.rs/canrun/0.4.0/canrun/index.html).

One design challenge in building out the early versions of [Canrun](https://github.com/tgecho/canrun_rs) was how to store a mix of arbitrary types. I eventually settled on an approach where [you had to explicitly define your "domain" up front](/building-canrun-part-1#typing-the-domain).

<!-- more -->

I learned enough about [procedural macros](https://doc.rust-lang.org/reference/procedural-macros.html) to cobble together a relatively clean API:

```rust
domain! {
    pub MyDomain { i32, String }
}
```

This wasn't terrible in practice, but it had several undesirable ramifications.

Everything needed to be parameterized with the domain currently in use. This didn't seem to cause any unsolvable problems, but it did mean that constraints like [`D: DomainType<'a, T>`](https://docs.rs/canrun/0.3.0/canrun/domains/trait.DomainType.html) became a pervasive and often confusing addition to nearly every other part of the library.

I wanted to take another stab at this. I knew the answer probably involved using [`std::any`](https://doc.rust-lang.org/std/any/index.html), but the first time around I got lost in a morass of [lifetime](https://doc.rust-lang.org/rust-by-example/scope/lifetime.html) and [object safety](https://doc.rust-lang.org/reference/items/traits.html#object-safety) woes. I wish I'd kept better notes on what exactly didn't work before. But I got it working this time!

Now everything is better. Here's the core of the new `State` struct. No more type parameters needed!

```rust
pub struct State {
	values: im_rc::HashMap<VarId, AnyVal>,
	forks: im_rc::Vector<Rc<dyn Fork>>,
	constraints: MKMVMap<VarId, Rc<dyn Constraint>>,
}
```

For comparison, here's the old `State`, with a lifetime AND domain param.

```rust
pub struct State<'a, D: Domain<'a> + 'a> {
	domain: D,
	forks: im_rc::Vector<Rc<dyn Fork<'a, D> + 'a>>,
	constraints: MKMVMap<LVarId, Rc<dyn Constraint<'a, D> + 'a>>,
}
```

Note the `domain: D` field, which is what gets filled in by that [`domain!` proc macro](https://github.com/tgecho/canrun_rs/blob/v0.3.0/codegen/src/lib.rs). It worked, but good luck trying to actually follow the tendrils without a guide.

The type simplification radiated out into every other part of the library. With a few exceptions, the changes were mechanical and consisted primarily of removing things. For example, here's the [where clause](https://doc.rust-lang.org/rust-by-example/generics/where.html) from [`lvec::get`](https://docs.rs/canrun/latest/canrun/collections/lvec/fn.get.html) function in the old version:

```rust
T: UnifyIn<'a, D> + 'a,
LVec<T>: UnifyIn<'a, D>,
IntoT: IntoVal<T>,
Index: IntoVal<usize>,
Collection: IntoVal<LVec<T>>,
D: DomainType<'a, usize> + DomainType<'a, T> + DomainType<'a, LVec<T>>,
```

And the new version:

```rust
T: Unify,
IntoT: Into<Value<T>>,
Index: Into<Value<usize>>,
Collection: Into<Value<LVec<T>>>,
```

No more weird, interlocking `DomainType<'a, T>'` and `UnifyIn<'a, D>` constraints. No more explicit lifetimes. Before, because of the trickiness of how all the types fit together, I hadn't been able to get the regular [`From`/`Into`](https://doc.rust-lang.org/rust-by-example/conversion/from_into.html) implementations reliably working for `Value` and so made a custom `IntoVal` trait. The new version has a few extra characters, but is much more "normal".

## Bonus: `Goal` is now a trait instead of an enum

Another compromise I previously made in the face of type complexity was to let [`Goal`](https://docs.rs/canrun/0.4.0/canrun/goals/index.html) be an enum instead of a trait that could be implemented by library users. This wasn't too bad in practice, but it still felt ugly and arbitrary. Now the new [`Goal` trait can be implemented for custom types](https://docs.rs/canrun/0.4.0/canrun/goals/trait.Goal.html).

## Conclusion

I still consider this little project a personal success. Even if I never get around to using this for what I originally intended, I've a learned a ton about both logic programming and Rust.
