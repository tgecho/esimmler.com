---
title: "Large WebAssembly builds with Rust and regex"
date: "2022-02-06"
---

I wanted to share a few functions between a Rust server and web app client, so I decided to finally try out [WebAssembly (WASM)](https://developer.mozilla.org/en-US/docs/WebAssembly). After a few tweaks to [get data marshalled between the Javascript/WASM worlds](https://rustwasm.github.io/docs/wasm-bindgen/reference/arbitrary-data-with-serde.html), it actually worked really well... except the final `.wasm` file size was about 720K for a ~100 line function (plus dependencies, of course).

<!-- more -->

Working through the [code size guide](https://rustwasm.github.io/book/reference/code-size.html#the-twiggy-code-size-profiler) eventually made it clear that the [regex crate](https://github.com/rust-lang/regex) was contributing a lot to the total size. Removing it brought the size down to ~24K. And I got to [learn about parser combinators with nom](https://github.com/Geal/nom)!

This appears to be one of the fundamental points of friction when using WASM. Either compile in everything you need (increasing filesize) or [inject it from the host environment](https://rustwasm.github.io/docs/wasm-bindgen/examples/import-js.html) (increasing complexity). In fact, one of the reasons Rust is so well suited to WASM is that [doesn't need to bring an entire garbage collector](https://rustwasm.github.io/docs/book/why-rust-and-webassembly.html).

This is extra unfortunate since regex support is available even in Javascript's rudimentary "standard" lib. I imagine some sort of Rust crate that automatically defers to the host's regex implementation could exist (initial searches didn't turn anything up). Until then, I'll avoid using regex when I intend to compile into WASM.
