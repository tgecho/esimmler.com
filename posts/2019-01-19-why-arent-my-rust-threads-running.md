---
title: Why aren't my Rust threads running?
---

I got a bit tangled up while experimenting with threads and channels in Rust. The compiler prevented any undefined behavior or memory corruption, but it can only do so much. My problems came from a shaky understanding of the language's fundamentals and the inherent complexity of parallel programming. Or, in my case, attempted parallel programming.

<!--more-->

The following code is the result of stripping away a lot of channel manipulation and other unrelated complexity (a story for another time). The Rust compiler did not directly point out that my logic was faulty, but much of the friction I ran into hinted at the underlying problem.

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handles = (0..2).map(|worker_id| {
        println!("Spawning worker {}", worker_id);
        let handle = thread::spawn(move || {
            println!("Worker {} is running", worker_id);
            for _ in 0..2 {
                thread::sleep(Duration::from_millis(10));
                println!("Worker {} did some work", worker_id);
            };
        });
        println!("Worker {} has spawned", worker_id);
        handle
    });

    println!("Joining workers from the main thread");
    for handle in handles {
        handle.join().unwrap();
    }
}
```
[Rust Playground](https://play.rust-lang.org/?version=stable&mode=debug&edition=2018&gist=d0b3006c3c84906c5e19ce26ec0ca873)

The intent was that the threads run in parallel. At the end of the function, we'd wait on them to complete before exiting. Unfortunately, the output showed that they were running one after another.

```
Joining workers from the main thread
Spawning worker 0
Worker 0 has spawned
Worker 0 is running
Worker 0 did some work
Worker 0 did some work
Spawning worker 1
Worker 1 has spawned
Worker 1 is running
Worker 1 did some work
Worker 1 did some work
```

I was confused. The threads had spawned as intended in the first version of my code. I later realized the key difference was that I had used a `for` loop.

```rust
for worker_id in 0..2 {
    thread::spawn(move || {
        //...
    });
}
```

When I decided to capture the `JoinHandle`s so I could explicitly wait for them to complete, my first inclination was to `.map` over the range.

```rust
let handles = (0..2).map(|worker_id| {
    thread::spawn(move || {
        //...
    });
}
// ...
for handle in handles {
    handle.join().unwrap();
}
```

This seemed to work at first. I didn't have the step by step logging in place, so I didn't notice that only one thread was running at a time.

I began to have issues. Channels dropped unexpectedly. Lifetimes requirements got weird. I should have realized I had a fundamental misunderstanding much sooner. I tried a bunch of sanity checks, but the one that finally made it click was to add an explicit type annotation.

```rust
let handles: Vec<thread::JoinHandle<()>> = (0..2).map(|worker_id| {
    //...
}
```

Which failed to compile with:

```
error[E0308]: mismatched types
  --> src/main.rs:5:48
   |
5  |       let handles: Vec<thread::JoinHandle<()>> = (0..2).map(|worker_id| {
   |  ________________________________________________^
6  | |         println!("Spawning worker {}", worker_id);
7  | |         let handle = thread::spawn(move || {
8  | |             println!("Worker {} is running", worker_id);
...  |
15 | |         handle
16 | |     });
   | |______^ expected struct `std::vec::Vec`, found struct `std::iter::Map`
   |
   = note: expected type `std::vec::Vec<std::thread::JoinHandle<()>>`
              found type `std::iter::Map<std::ops::Range<{integer}>, [closure@src/main.rs:5:59: 16:6]>`
```

All became clear! One great characteristic of iterators in Rust is that they are often lazy. When I called `(0..2).map(...)`, it didn't actually run anything until I tried to work with the results. The `for` loop only pulled one item out of the iterator at a time and then waiting for it to complete, which meant that it was only spawning one thread at a time.

With this understanding came the solution: force the iterator to run. The most straightforward way to do this is to add `.collect()` to the chain (with a type annotation).

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handles = (0..2).map(|worker_id| {
        println!("Spawning worker {}", worker_id);
        let handle = thread::spawn(move || {
            println!("Worker {} is running", worker_id);
            for _ in 0..2 {
                thread::sleep(Duration::from_millis(10));
                println!("Worker {} did some work", worker_id);
            };
        });
        println!("Worker {} has spawned", worker_id);
        handle
    }).collect::<Vec<thread::JoinHandle<()>>>();

    println!("Joining workers from the main thread");
    for handle in handles {
        handle.join().unwrap();
    }
}
```
[Rust Playground](https://play.rust-lang.org/?version=stable&mode=debug&edition=2018&gist=115ba06cbc7d8e9c1c699503e3ae5127)

It worked!
```
Spawning worker 0
Worker 0 has spawned
Spawning worker 1
Worker 0 is running
Worker 1 has spawned
Joining workers from the main thread
Worker 1 is running
Worker 0 did some work
Worker 1 did some work
Worker 0 did some work
Worker 1 did some work
```

Each factor that fed into my confusion is relatively simple by itself:

- Rust does a good job of inferring most types
- Iterators often don't run intermediate steps until needed
- `for` loops consume iterators automatically
- Calling `.join()` blocks the `for` loop until the thread completes

I wouldn't change any of these things. My main takeaway is a reminder to verify assumptions earlier in the process. Taking wild stabs may pay off at times, but after the first dead end or two it's usually worth stepping back. Fill in some type annotations, log the flow of data and make sure everything matches up with your intuition.
