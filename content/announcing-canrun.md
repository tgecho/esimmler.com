+++
title = "Announcing Canrun: A logic thing I don't fully understand (draft)"
date = 2020-07-02
draft = true
+++

I keep bumping into [logic programming](https://en.wikipedia.org/wiki/Logic_programming), especially in the form of the [\*Kanren](http://minikanren.org/) family of DSLs. In keeping with tradition, this is my attempt to implement it in my current hobby language of choice: Rust.

After a few fits and starts, I got a not completely horrific proof of concept running. Then I rewrote it once or twice to improve usability, make it internally type safe and add a form of [constraints](https://en.wikipedia.org/wiki/Constraint_logic_programming). The sordid history is [buried in git](https://github.com/tgecho/canrun_rs/commits/master?before=9a7f39310cc73f1e692490f80a84a3d670fe4f52+245).

The end result? I'm pretty satisfied with the learning experience I got out of it, so any value in the actual artifact is just gravy.

## An Introduction

I'm still a novice, so take everything I say with a grain of salt.

Logic programming is weird. You can essentially write a bunch of statements in (somewhat) arbitrary order and query the possible values of things.

```rust
use canrun::{Goal, both, unify, var};
use canrun::domains::example::I32;

let x = var();
let y = var();
let goal: Goal<I32> = both(unify(x, y), unify(1, x));
let result: Vec<_> = goal.query(y).collect();
assert_eq!(result, vec![1])
```

Breaking this down...

### Imports

```rust
use canrun::{Goal, both, unify, var};
use canrun::domains::example::I32;
```

First are some imports, including a domain that represents all of the types that will be valid in our little logic program. In this case, only `i32` values.

### Logic Variables

```rust
let x = var();
let y = var();
```

These are typed "logic variables" (`LVar<i32>`), which can be bound to values in our program.

### Goals

```rust
let goal: Goal<I32> = both(unify(x, y), unify(1, x));
```

The `both` and `unify` functions are `Goal` constructors. A `Goal` contains one or more relations between logical values. They can be evaluated to generate zero or more possible results. Note that it is constrained by the `I32` domain type.

`unify(x, y)` essentially declares that `x` and `y` are equal to each other. Or, more precisely, that they must [unify](<https://en.wikipedia.org/wiki/Unification_(computer_science)>) with each other. This distinction matters for more complicated values.

`both` combines the two `unify` goals into a goal that will only succeed if both sub goals succeed.

### Querying

```rust
let result: Vec<_> = goal.query(y).collect();
assert_eq!(result, vec![1])
```

To get results from a `Goal`, we can query it with one or more logic variables to get an iterator of possible results. We can take the first result with `.nth(0)`, `.collect()` them all, or use any of the other `Iterator` trait methods.

For example, querying the goal `either(unify(x, 1), unify(2, x))` for the value of `x` would return two possible results: `vec![1, 2]`.

## Getting More Advanced

Unification means something quite a bit more interesting than simple equality when applied to structures.

The library provides a few "logically superpowered" structures such as `LVec` and `LMap` (Note: These are experimental even by Canrun standards).

```rust
use canrun::{Goal, val, var, all, unify};
use canrun_collections::{lvec, example::Collections};

let x = var();
let goal: Goal<Collections> = unify(lvec![x, 2, 3], lvec![1, 2, 3]);
let results: Vec<_> = goal.query(x).collect();
assert_eq!(results, vec![1]);
```

In this case, we can actually pluck a value out of a structure by unifying a compatible structure containing our `LVar`.

Additional specialized goal constructors are available, with more coming as needs arise and ability allows.

### Member

```rust
let results: Vec<_> = member(x, lvec![1, 2, 3]).query(x).collect();
assert_eq!(results, vec![1, 2, 3]);
```

### Subset

```rust
let results: Vec<_> = subset(lvec![1, x], lvec![1, 2, 3]).query(x).collect();
assert_eq!(results, vec![2]);
```

## What's Next

Apart from random needs based additions...

### Ergonomics

The biggest obvious pain point to me is how annoying it is to implement many of traits such as `UnifyIn` and `ReifyIn`. I think 99% of the use cases can be handled with a derive macro.

### Even Fancier DSL

The function based API is not bad at all, but I still dream about doing some sort of fancy custom parser macro magic overkill to unlock something like:

```rust
let goal = logic! {
    y = x
    x = 1
}
goal.query(y)
```

This is mostly so I can type `logic!`

### General Correctness

I've approached this as an engineering problem, with very little rigor or prior understanding of the space. This has been fun and enlightening, but I have no doubt that there are theoretical holes.

## Conclusion

Sometimes the types get a little scary, but overall I'm quite pleased with how fluent Rust is able to be with a little architectural care and feeding.

How much I'll actually work on this project is completely dependant on how applicable it actually ends up being to my other experiments. Or how much I keep [nerd sniping](https://xkcd.com/356/) myself.
