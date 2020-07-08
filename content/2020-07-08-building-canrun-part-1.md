+++
title = "Building Canrun: A statically typed logic programming library for Rust (part 1)"
+++

[Canrun](https://github.com/tgecho/canrun_rs) is a new logic programming library for Rust with static types and constraints.

In the [announcement post](./announcing-canrun/) I mentioned going through multiple fundamental revisions before settling on the current approach. Here I'll try to do a quick recap for two reasons: 1) I think it's neat, and 2) hopefully I'll snag the attention of someone with deeper experience and a willingness to share tips.

I'm sorry to say that despite [The Reasoned Schemer](http://minikanren.org/#trs)'s status as the classic book on [miniKanren](http://minikanren.org/), it never really clicked for me. Similarly, most of the other resources I've found on logic programming were either too deep or too toylike. This is not a critism or complaint! This space is a niche, and I'm very grateful to those who have shared their work.

One of the first articles that really helped was Tom Stuart's ["Hello, declarative world"](https://codon.com/hello-declarative-world), which described a way to implement [μKanren](http://webyrd.net/scheme-2013/papers/HemannMuKanren2013.pdf) in Ruby[^languages].

## First Attempt

I'm going to gloss over a lot of the "why" of logic programming here. A skim through the ["Hello, declarative world" article](https://codon.com/hello-declarative-world) I linked above should give you a good understanding of where I started.

The core moving part is the `State` object. In it's most basic form, it consists of a mapping between "logical variables" (we'll call them `LVar`) and "logical values" (or `Val<T>`).

_Note: These code samples are heavily abridged. Many things including lifetime annotations have been left out for the sake of clarity._

```rust
pub struct State<T> {
    values: HashMap<LVar, Val<T>>,
}

pub enum Val<T> {
    Var(LVar),
    Resolved(Rc<T>),
}
```

The public API essentially provides a way to "attempt" adding new bindings and resolve existing bindings.

```rust
impl State<T> {
    pub fn unify(&self, a: &Val<T>, b: &Val<T>) -> StateIter<T>;
    pub fn resolve(&self, val: &LVar) -> Option<Val<T>>;
}
```

A key characteristic of this model is that `.unify(...)` returns a new `State` instead of mutating `Self`. This seemed like a core requirement, so that's what I did.

The return type of `.unify(...)` is an alias:

```rust
pub type StateIter<T> = Box<dyn Iterator<Item = State<T>>>;
```

`Goal`s are structs that simply return an `Iterator` of potential states (yes, I said "_simply_ return an `Iterator`"... what's so funny?).

```rust
pub enum Goal<T> {
    Unify {a: Val<T>, b: Val<T>},
    Either { a: Box<Goal<T>>, b: Box<Goal<T>> },
    // ... truncated
}

impl Goal<T> {
    fn run<T: CanT>(&self, state: &State<T>) -> StateIter<T> {
        match self {
            Unify {a, b} => {
                Box::new(once(state.unify(a, b)))
            },
            Either {a, b} => {
                let a_iter = a.run(state);
                let b_iter = b.run(state);
                Box::new(a_iter.interleave(b_iter))
            }
            // ... truncated
        }
    }
}
```

A goal can return as many new states as needed. It worked! Eventually. After a small war of attrition against the borrow checker, I finally managed get the streams flowing. Many clones were sacrificed.

With a few helper functions and some trait driven type coercion, the API wasn't too bad!

```rust
let state = State::new();
let goal: Goal<i32> = either(
    unify(x, 1),
    unify(x, 2),
);
goal.run(state)
```

## Smooth Sailing?

I pushed forward, implementing the basic goal types and learning more about ownership, how and when to use enums vs trait objects and more. But I couldn't shake the feeling that I was fighting more than just the borrow checker.

On top of the excessive cloning, I was also struggling with a lack of type safety. My initial plan was for the `T` type parameter to be a user defined enum, but this meant all relations in "logic world" were essentially dynamically typed.

I needed a new approach.

## Rust is Different

A weird thing about Rust is that it pulls so much from functional programming, but trying to use a "pure immutable" style as you would in a classic garbage collected language can get really uncomfortable.

I finally came up with an approach in which I could embrace more idiomatic mutation patterns and clean up many of the ergonomic and performance compromises made in the first version.

My new mutable `State` adds a new core `.fork(...)` operation and tweaks `.unify(...)`:

```rust
impl State<T> {
    pub fn unify(mut self, a: &Val<T>, b: &Val<T>) -> Option<Self>;
    pub fn fork(mut self, fork: Rc<dyn Fork<T>>) -> Option<Self>;
}

pub trait Fork<T> {
    fn run(&self, state: State<T>) -> StateIter<T>;
}
```

Note that both of these take a `mut self` and return an `Option<Self>`. The `.unify(...)` function eagerly attempts to reconcile bindings with those already contained in the state. If unification fails, the entire state is now invalid and we can bail right away with a `None`. Used with the `?` try operator, this can actually be quite smooth.

```rust
State::new()
    .unify(x, 1)? // <- returns Some(state)
    .unify(x, 2)? // <- returns None
```

The simplest `Goal` that would use `Fork` is `Either`, where you'll get zero or more results states for both sides:

```rust
let goal = either(
    unify(x, 1),
    unify(x, 2),
);
```

By deferring evaluation of the `Fork` objects, the end result is that we do as much work to disprove as many goals as possible _before_ we eventually split into an arbitrary number of potential result states.

The `Fork` trait's `.run(...)` is not invoked until we query for results. At that point, we recurse our way through the list of `Fork`s as a queue, branching out at each iteration.

```rust
fn iter_forks(mut self) -> StateIter<'a, D> {
    let fork = self.forks.pop_front();
    match fork {
        None => Box::new(once(self)),
        Some(fork) => Box::new(fork.run(self).flat_map(State::iter_forks)),
    }
}
```

Note that `iter_forks(..)` does not clone the `State`. The struct that implements `Fork` _may_ clone the `State` at the last moment, but only if actually needed.

In a nutshell:

- `.unify(...)` eagerly converges, constraining the `State` into zero or one possible outcomes.
- `.fork(...)` lazily diverges, splitting a `State` into zero or more alternate possibilities.

## Typing the Domain

_Statically typed_ logic programming seems to be a small niche within the niche that is regular logic programming.[^typedlogic]

After a walking down a few dead ends, I settled on an approached based on procedural macros.

```rust
domain! {
    pub MyDomain {
        i32,
        String
    }
}
```

The `domain!` macro will create a struct with various impls that is able to store and retrieve values compatible with the domain. The generated struct looks (roughly) like this:

```rust
pub struct MyDomain {
    t0: HashMap<LVar<i32>, Val<i32>>,
    t1: HashMap<LVar<String>, Val<String>>,
}
```

With pseudo-private[^privacy] accessors that can be used to gain access to the inner containers:

```rust
impl<'a> DomainType<'a, i32> for MyDomain {
    fn values_as_ref(&self) -> &HashMap<LVar<i32>, Val<i32>> {
        &self.t0
    }
    fn values_as_mut(&mut self) -> &mut HashMap<LVar<i32>, Val<i32>> {
        &mut self.t0
    }
}
```

The `State` struct is now parameterized with a `Domain` type, which it uses to manage the actual `Val<T>` containers (some of this is actually spread into other traits/impls, but this is essentially what happens):

```rust
impl <D: Domain> State<D> {
    pub fn resolve_val<T>(&self, val: &Val<T>) -> &Val<T>
    where
        D: DomainType<T>,
    {
        match val {
            Val::Var(var) => {
                let resolved = self.domain.values_as_ref().get(var);
                match resolved {
                    Some(Val::Var(found)) if found == var => val,
                    Some(found) => self.resolve(found),
                    _ => val,
                }
            }
            value => value,
        }
    }
}
```

Goals are also parameterized by `Domain`:

```rust
// Compiles!
let goal = Goal<MyDomain> = unify(x, 1);
// Does not compile :)
let goal = Goal<MyDomain> = unify(x, vec![1, 2]);
```

While the approach feels a bit idiosyncratic, it actually has a few really nice properties. Most notably: explicitly defining all of the types that should be valid in your _logical_ domain greatly increases the helpfulness of compiler errors.

## Takeaways

- In Rust (as elsewhere), pain is an indication that you may want to reconsider your approach.
- Studying prior art is important, but take its original context into account to avoid imitating badly. A different context might require different choices.
- [David Tolnay's](https://github.com/dtolnay) [quote](https://github.com/dtolnay/quote) and [syn](https://github.com/dtolnay/syn) libraries make my rather raw proc macro way nicer than it has any business being.

## Onward!

As time allows, I'll dig into constraints, the [`UnifyIn`](https://docs.rs/canrun/latest/canrun/trait.UnifyIn.html)/[`Query`](https://docs.rs/canrun/latest/canrun/trait.Query.html)/[`ReifyIn`](https://docs.rs/canrun/latest/canrun/trait.ReifyIn.html) traits, collections and more!

- Github: [https://github.com/tgecho/canrun_rs](https://github.com/tgecho/canrun_rs)
- Crate: [https://crates.io/crates/canrun](https://crates.io/crates/canrun)
- Docs: [https://docs.rs/crate/canrun](https://docs.rs/crate/canrun)

---

[^languages]: I actually used TypeScript for some of the very earliest prototyping due to its familiarity and relative malleability. So I learned about a logic programming approach that originated in Lisp from a Rubyist, started in TypeScript and finally built the thing in Rust.

---

[^typedlogic]: The most substantial prior art for statically typed logic programming I found was [Mercury](http://www.mercurylang.org/) and [OCanren](https://github.com/JetBrains-Research/OCanren). As is typical, I did not spend nearly enough time trying to glean insight before I set out on my own.

---

[^privacy]: Macro generated code is odd. Since it exists inside the the user's module, normal visibility tools do not really work for the macro author. My actual implementation of the `domain!` macro has some additional indirection that has a secondary effect of providing a bit of privacy. Ultimately I just had to slap `#[doc(hidden)]` all over it and ask nicely to be left alone.

---
