---
title: "Building Canrun: A statically typed logic programming library for Rust"
date: "2020-07-08"
tags: ["rust", "canrun"]
---

> Update 2 Jan, 2023: Many aspects of this library have been redesigned, especially relating to the domain stuff: [Simplifying a toy logic programming library](/simplifying-a-toy-logic-programming-library)

[Canrun](https://github.com/tgecho/canrun_rs) is a new logic programming library for Rust with static types and constraints.

In my [initial post](/announcing-canrun) I mentioned going through a few fundamental revisions before settling on the current approach. Here I'll try to do a quick recap for two reasons: 1) I think it's neat, and 2) with luck I'll snag the attention of someone with deeper experience and a willingness to share some tips.

<!-- more -->

My first successful attempt was actually based on an article by Tom Stuart titled ["Hello, declarative world"](https://codon.com/hello-declarative-world)[^reading], which described a way to implement [μKanren](http://webyrd.net/scheme-2013/papers/HemannMuKanren2013.pdf) in Ruby[^languages]. I recommend reading that if you find yourself confused about any of the "why" I gloss over here.

# Starting Out

The core moving part is the `State`. In its most basic form, it consists of a mapping between "logic variables" (we'll call them `LVar`) and "logic values" (or `Val<T>`). Note that a `Val<T>` can contain an `LVar` _or_ a resolved `T`.

_Note: These code samples are heavily abridged. Many aspects including lifetime annotations have been elided for the sake of clarity._

```rust
pub struct State<T> {
    values: HashMap<LVar, Val<T>>,
}

pub enum Val<T> {
    Var(LVar),
    Resolved(Rc<T>),
}
```

The public API essentially provides a way to "attempt" the addition of new bindings (through [unification](https://codon.com/hello-declarative-world#unification)) and resolve existing bindings.

```rust
impl State<T> {
    pub fn unify(&self, a: &Val<T>, b: &Val<T>) -> StateIter<T>;
    pub fn resolve(&self, val: &LVar) -> Option<Val<T>>;
}
```

A key characteristic of this model is that `.unify(...)` returns a new `State` instead of mutating `Self`.

The return type of `.unify(...)` is an alias:

```rust
pub type StateIter<T> = Box<dyn Iterator<Item = State<T>>>;
```

A `Goal` is a struct that simply returns an `Iterator` of potential states (yes, I said "_simply_ returns an `Iterator`"... what's so funny?).

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

These goals can be combined arbitrarily to create more complicated goals.

```rust
let goal = Either {
    a: Unify { a: x, b: 1},
    b: Both {
        a: Unify { a: x, b: 2 },
        a: Unify { a: y, b: 1 },
    },
};
```

A goal can return as many new states as needed. It worked! Well, eventually. After a small war of attrition against the borrow checker, I finally managed get the streams flowing. Many clones were sacrificed.

With a few helper functions and some trait driven type coercion, the API wasn't too bad!

```rust
let state = State::new();
let goal: Goal<i32> = either(
    unify(x, 1),
    both(unify(x, 2 ), unify(y, 1 )),
);
goal.run(state) // <- returns an iterator of potential states
```

# Smooth Sailing?

I pushed forward, implementing the other types of goals and learning more about ownership, how and when to use enums vs trait objects and more. But I couldn't shake the feeling that I was fighting more than just the borrow checker.

On top of excessive cloning, I was also struggling with a lack of type safety. My initial plan was for the `T` type parameter to be a user defined enum.

```rust
enum MyType {
    Number(i32),
    Word(String),
}

// This compiles, but can never succeed!
let goal: Goal<MyType> = unify(
    MyType::Number(42),
    MyType::Word("42"),
);
```

Essentially, all relations in the "logic world" were dynamically typed.

I needed a new approach.

# Rust is Different

An interesting thing about Rust is that it pulls so much from functional programming, but trying to use a "pure immutable" style as in a typical garbage collected language can get really uncomfortable. This sort of pain is usually a sign that something needs to change.

My new mutable `State` adds a `.fork(...)` operation and tweaks `.unify(...)`:

```rust
impl State<T> {
    pub fn unify(mut self, a: &Val<T>, b: &Val<T>) -> Option<Self>;
    pub fn fork(mut self, fork: Rc<dyn Fork<T>>) -> Option<Self>;
}

pub trait Fork<T> {
    fn run(&self, state: State<T>) -> StateIter<T>;
}
```

Note that both functions take a `mut self` and return an `Option<Self>`. The `.unify(...)` function eagerly attempts to reconcile bindings with those already contained in the state. If unification fails, the entire state is now invalid. We can bail right away with `None` and avoid processing any additional updates. Used with the `?` try operator, this can actually be quite smooth.

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

By deferring evaluation of the `Fork` objects, we do as much work to disprove as many goals as possible _before_ we eventually split into an arbitrary number of result states.

The `Fork` trait's `.run(...)` is not invoked until we query for results. At that point, we recurse our way through the list of `Fork` items as a queue, branching out at each iteration.

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

# Typing the Domain

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

The `domain!` macro can create a struct with associated functions that enable it to store and retrieve collections of values compatible with a user defined domain _by type_[^anymap]. The generated struct looks (roughly) like this:

```rust
pub struct MyDomain {
    t0: HashMap<LVar<i32>, Val<i32>>,
    t1: HashMap<LVar<String>, Val<String>>,
}
```

With pseudo-private[^privacy] accessors that can be used to retreive the inner containers:

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

The `State` struct is now parameterized with a `Domain` type, to which it delegates management of the individual `Val<T>` containers (some of this is actually spread into other traits/impls, but this is essentially what happens):

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
                    // We found another Var, try to resolve deeper
                    Some(found) => self.resolve_val(found),
                    // We didn't find a binding, return the Var
                    None => val,
                }
            }
            // This isn't a Var, just return it
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

While the macro approach feels a bit idiosyncratic, it does have a few really nice properties. Most notably: explicitly defining all of the types that should be valid in the _logic_ domain greatly increases the helpfulness of compiler errors.

# Takeaways

- In Rust (as elsewhere), pain is an indication that you may want to reconsider your approach.
- Studying prior art is important, but take its original context into account to avoid imitating badly. A different context might require different choices.
- [David Tolnay's](https://github.com/dtolnay) [quote](https://github.com/dtolnay/quote) and [syn](https://github.com/dtolnay/syn) libraries make my rather raw proc macro way nicer than it has any business being.

# Onward!

As time allows, I'll dig into constraints, the [`UnifyIn`](https://docs.rs/canrun/0.3.0/canrun/trait.UnifyIn.html)/[`Query`](https://docs.rs/canrun/0.3.0/canrun/trait.Query.html)/[`ReifyIn`](https://docs.rs/canrun/0.3.0/canrun/trait.ReifyIn.html) traits, collections and more!

- Github: [https://github.com/tgecho/canrun_rs](https://github.com/tgecho/canrun_rs)
- Crate: [https://crates.io/crates/canrun](https://crates.io/crates/canrun)
- Docs: [https://docs.rs/crate/canrun](https://docs.rs/crate/canrun)

---

[^reading]: I'm sorry to say that despite [The Reasoned Schemer](http://minikanren.org/#trs)'s status as the classic book on [miniKanren](http://minikanren.org/), it never really clicked for me. Similarly, most of the other resources I've found on were either too deep or too toylike. This is not a critism or complaint! Logic programming is a niche, and I'm very grateful to those who have shared their work.

---

[^languages]: I actually used TypeScript for some of the very earliest prototyping due to its familiarity and relative malleability. So I learned about a logic programming approach that originated in Lisp from a Rubyist, started coding in TypeScript and finally built the thing in Rust. 'cause why not?

---

[^typedlogic]: The most substantial prior art for statically typed logic programming I found was [Mercury](http://www.mercurylang.org/) and [OCanren](https://github.com/JetBrains-Research/OCanren). As is typical, I did not spend nearly enough time trying to glean insight before I set out on my own.

---

[^anymap]: This is not quite the same as something like [AnyMap](https://github.com/chris-morgan/anymap), which depends on [types having a `'static` lifetime](https://doc.rust-lang.org/std/any/struct.TypeId.html) for reasons I don't claim to fully understand.

---

[^privacy]: Macro generated code is odd. Since it exists inside the the user's module, normal visibility tools do not really work for the macro author. My actual implementation of the `domain!` macro has some additional indirection that has a secondary effect of providing a bit of privacy. Ultimately I just had to slap `#[doc(hidden)]` all over it and ask nicely to be left alone.

---
