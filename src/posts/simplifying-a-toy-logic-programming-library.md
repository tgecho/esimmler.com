---
title: "Simplifying a toy logic programming library"
---
**TLDR:** I made a toy logic programming library in Rust called Canrun ([original announcement](https://esimmler.com/announcing-canrun/)). I just published a new version with fixes for several serious design flaws: [canrun v0.4.0 on docs.rs](https://docs.rs/canrun/0.4.0/canrun/index.html).

One of the early design challenges I encountered when building out the early versions of [Canrun](https://github.com/tgecho/canrun_rs) was how to allow storing a mix of arbitrary types. I eventually settled on an approach where [you had to explicitly define your "domain" up front](https://esimmler.com/building-canrun-part-1/#typing-the-domain).

<!-- more -->

I learned enough about [procedural macros](https://doc.rust-lang.org/reference/procedural-macros.html) to cobble together a relatively clean API:

```rust
domain! {
    pub MyDomain {
        i32,
        String
    }
}
```

This wasn't terrible in practice, but it had several troublesome ramifications.

The [`State`](https://docs.rs/canrun/0.3.0/canrun/state/struct.State.html) container needed to be parameterized with the domain currently in use. As did any [`Goal`](https://docs.rs/canrun/0.3.0/canrun/goals/struct.Goal.html). I never ran into any unsolvable problems stemming from this, but it did mean that the [`D: DomainType<'a, T>`](https://docs.rs/canrun/0.3.0/canrun/domains/trait.DomainType.html) constraint became a pervasive and often confusing addition to nearly every other part of the library.

I knew I wanted to take another stab at this. I knew the answer probably involved using [`std::any`](https://doc.rust-lang.org/std/any/index.html), but I got lost in a morass of [lifetime](https://doc.rust-lang.org/rust-by-example/scope/lifetime.html) and [object safety](https://doc.rust-lang.org/reference/items/traits.html#object-safety) woes the first time. I wish I'd kept better notes on what exactly didn't work before. But I got it working this time!

Everything got better. Here's the core of the new `State` struct. No more type parameters needed! Even the fields (which are private) are relatively simpler.
```rust
pub struct State {
	values: im_rc::HashMap<VarId, AnyVal>,
	forks: im_rc::Vector<Rc<dyn Fork>>,
	constraints: MKMVMap<VarId, Rc<dyn Constraint>>,
}
```

Here's the old `State`.
```rust
pub struct State<'a, D: Domain<'a> + 'a> {
	domain: D,
	forks: im_rc::Vector<Rc<dyn Fork<'a, D> + 'a>>,
	constraints: MKMVMap<LVarId, Rc<dyn Constraint<'a, D> + 'a>>,
}
```

Note the `domain` field, which is what gets filled in by that `domain!` macro. It worked, but good luck trying to actually follow the tendrils if you didn't know what you were looking for. Or just revisiting after a year...

This type simplifications radiated out into every other part of the library. With few exceptions, the change was mechanical and consisted primarily of removing stuff. For example, here's the where clause from `lvec::get` before:
```rust
T: UnifyIn<'a, D> + 'a,
LVec<T>: UnifyIn<'a, D>,
IntoT: IntoVal<T>,
Index: IntoVal<usize>,
Collection: IntoVal<LVec<T>>,
D: DomainType<'a, usize> + DomainType<'a, T> + DomainType<'a, LVec<T>>,
```

And after:
```rust
T: Unify,
IntoT: Into<Value<T>>,
Index: Into<Value<usize>>,
Collection: Into<Value<LVec<T>>>,
```
No more interlocking `DomainType<'a, T>'` and `UnifyIn<'a, D>` constraints! Also, because of the trickiness of how all the types fit together before, I hadn't been able to get the regular `From`/`Into` implementations working for `Value` and so made a custom `IntoVal` trait. The new version has a few extra characters, but it is much more "normal". 

## Bonus: `Goal` is now a trait instead of an enum
Another compromise I made in the face of type complexity was to make `Goal` an enum instead of a trait that could be implemented by library users. This wasn't too bad in practice, but it still felt ugly and arbitrary. Now [`Goal` can be implemented for custom types](https://docs.rs/canrun/0.4.0/canrun/goals/trait.Goal.html).

## Conclusion
I still consider this little project a personal success. Even if I never get around to using this for what I originally intended, I have a learned a ton about both logic programming and library design in Rust.