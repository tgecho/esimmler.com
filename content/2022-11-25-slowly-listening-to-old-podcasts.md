+++
title = "Slowly listening to old podcasts"
date = 2022-11-25
+++

**tl;dr** I made a service that lets you replay old podcast feeds as if they are just starting out: [PodReplay.com](https://podreplay.com/). Continue reading if you're curious to read a smattering of design notes and half remembered anecdotes.

<!-- more -->

# The long version

I have a bad habit. Well, maybe more than one, but I'll try to suppress the one about trying to talk about too many ideas at once and focus on the one about trying to experiment on too many new technologies at the same time. Baby steps.

I like listening to podcasts. Maybe too many podcasts? Also not the bad habit we're talking about here. Many good podcasts are about current events or trends and don't tend to age well. However, there are others (often history or fiction oriented) where an episode from several years ago is still just as good today.

So I wanted a simple way to intersperse old episodes of a podcast in my feed as if picking up from the start. A nice trickle over time until caught up. I kept searching in vain[^priorart] and it sat in my pile of "things I want to exist" for a while.

In parallel, I've been lightly dabbling with [Rust](https://www.rust-lang.org/) and [Svelte](https://svelte.dev/). I've also read glowing reviews of [Fly.io](https://fly.io/). It was time to try them out for real. All at once [^noveltybudget].

# The plan

This is a "coffee table project"[^coffeetable], which means I get to set the rules. For my own sake, I want to not worry too much about long term maintenance. Which means I should minimize moving parts ~~and the use of novel technologies~~[^ha]. But hey, I get to both set _and_ interpret the rules.

The basic idea was to have a web service that takes a podcast feed URL, a start timestamp and some sort of schedule. The server would fetch the feed, modify the dates according to the specified schedule and drop any items that fall after the current date. Take for example, a podcast with the following episodes:

```
2022-01-24  One
2022-02-20  Two
2022-03-22  Three
```

A request comes in on 2022-11-24 for a replay that was started 2022-10-20.

```
/replay?feed=https://example.com/feed&start=2022-10-20T21:05:36Z&rule=1m
```

They would receive in a response with a new episode every month up to the current date, looking something like:

```
2022-10-20  One
2022-11-20  Two
```

Once the current date advances far enough, the third episode will appear:

```
2022-10-20  One
2022-11-20  Two
2022-12-20  Three
```

# The first problem

There are several existing [feed parsing libraries for Rust](https://crates.io/keywords/feed), and the few that I tried seemed fine. The thing about feed parsing, especially for podcasts, is that publishers do all kinds of _interesting_ things with their feeds. The bulk of the effort goes into normalizing all of these eccentricities down into a simpler structure for the host app to consume.

In my case, I only really need to be able to identify the timestamp of the episode (so I can change it) and the boundaries of the item in the feed (so I can drop them). Everything else should be left as untouched as possible.

So I had to drop down to lower level XML parsing. I ended up using [quick-xml](https://github.com/tafia/quick-xml), which allowed me to stream in the original feed, and write directly back to a new xml document on the fly. A super rough excerpt:

```rust
match reader.read_event(&mut buf) {
    Ok(Event::Eof) => break,
    Ok(Event::Start(start)) => match start.name() {
        b"item" | b"entry" => {
            rewrite_or_skip_item(start, &mut reader, &mut writer, schedule)?;
        }
// ... snip ...
```

Apart from the usual borrow checker shenanigans, I actually got an initial working web server (based on [Axum](https://github.com/tokio-rs/axum)) up and running fairly quickly!

# The second problem

Many podcasts only maintain something like the last one hundred episodes in their feeds (sometimes substantially less!). Whether it's for practical reasons (they publish new items every day) or for business model reasons (old episodes are only available to subscribers), I needed to account for this in some way. If not, my naive approach would get confused and start replaying the episodes earlier. Say the feed from our earlier example stops containing the first episode: now "Two" and "Three" will be scheduled a month earlier than before, shifting the entire replay forward an episode.

```
2022-10-20  Two
2022-11-20  Three
```

This error would accumulate with every old episode that drops off the end of the feed.

## Adding state

So I needed to keep some state. I figured that if I just tracked all of the item GUIDs/timestamps observed for a given feed, I could reconstruct enough history to reliably reschedule the rest long after older items have expired. I won't include them in the replayed feed (since I'm not caching enough data to reconstruct them in full), but I can account for them when scheduling out the items that _are_ still available.

Once I determined that I needed to store some persistant state, I decided it was time to pull another thing off my "want to try" pile: [Litestream](https://litestream.io/). Litestream can backup SQLite databases to an external blob storage in the background. If my server goes down or I deploy a new version, the most recent backup is automatically restored and everything carries on.

This is completely sufficient for the nature of the data I'm storing (and the amount of long term effort/money I'm interested in spending). This would let me keep a relatively small SQLite database file locally on the single [Fly.io](https://fly.io/) instance I was planning to run and not mess with managing a separate database[^beyondlitestream].

# The front end

I built out the front end with [SvelteKit](https://kit.svelte.dev/). I was running low on steam at this point, so the UI design is... basic.

I wanted to be able to show a live preview of the effect various options can have on the replayed feed. In order to keep this snappy, I tried to do as much of the incremental updating on the client as practical. Which required either porting or sharing the relatively involved rescheduling code. A perfect excuse to throw [WebAssembly](https://webassembly.org/) into the mix!

So to preview a feed, first we fetch the feed from the server and parse it to extract a summary, containing just a guid/title/timestamp for each item. The core rescheduling code (now a standalone Rust lib compilable to WASM) takes this summary and the scheduling config to generate a preview.

## WebAssembly asides

It's very easy to accidentally generate [very large bundle sizes](@/2022-02-06-large-wasm-builds-with-rust-regex.md) depending on the dependencies you're using. This is not unlike similar problems in the Javascript ecosystem, but the extra opaqueness of WASM makes it harder to debug.

[wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) does a really good job of gluing the WASM/JavaScript worlds together. However, there is a pretty substantial cost to serializing and transferring complex datastructures across the boundary between worlds. For the sake of performance, I ended up simplifying most of my transferrable data to a simple [Float64Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array) containing timestamps. Strictly necessary? Not really.

# Deployment

Frankly, this was kind of anticlimactic, which is actually a real testament to [Fly.io](https://fly.io). Once I got a docker container sorted out locally it only took a bit of fiddling to get things up and running. It reminded me of all the best feelings of using [Heroku](https://www.heroku.com/) back in the day.

One really neat thing I'd like to call out is their slick static file support, specifically [how it works when a deploy is in progress](https://community.fly.io/t/first-look-static-asset-caching/1375).

# Conclusion

As with many side projects the most important outcome is often not the final artifact, but what was learned along the way. I left out several details, either because I've forgotten them (I wrote most of this post several months after I wrapped up work) or because they could blow up into complete standalone posts (e.g. feed autodiscovery).

If you're still interested after all that, here's the link again: [PodReplay.com](https://podreplay.com). Or, you can check out the actual code at [github.com/tgecho/podreplay](https://github.com/tgecho/podreplay).

## Potential future enhancements

- Add the ability to pause/resume/skip replay without creating a new feed. This will require some additional per replay state.
- Add more robust autodiscovery, possibly based on something like the [ListenNotes API](https://www.listennotes.com/api/).

## Stuff I used

An incomplete list of notable tools/libraries used to build PodReplay, many for the first time:

- [Rust](https://www.rust-lang.org/) (used to implement server and part of client)
- [TypeScript](https://www.typescriptlang.org/) (used where Rust didn't make sense)
- [Axum](https://github.com/tokio-rs/axum) (Rust web server framework)
- [quick-xml](https://github.com/tafia/quick-xml) (XML reading/writing)
- [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) (gluing WASM/JavaScript together in the browser)
- [chrono](https://github.com/chronotope/chrono) (Rust date/time library)
- [chronoutil](https://github.com/olliemath/chronoutil) (provided a really nice DateRule iterator)
- [SQLite](https://www.sqlite.org/) (a lightweight embeddable database engine that seems to be going places)
- [sqlx](https://github.com/launchbadge/sqlx) (Rust database toolkit)
- [Svelte](https://svelte.dev/)/[SvelteKit](https://kit.svelte.dev/) (front end UI library)
- [pnpm](https://pnpm.io/) (fast and economical npm replacement)
- [vite](https://vitejs.dev/) (JavaScript bundler)

---

[^priorart]: I later discovered [Recast](https://recastthis.com/) and [a few other possible solutions](https://old.reddit.com/r/podcasts/comments/8o2mbi/play_old_episodes_in_order/), some of which require manual management. Recast looks quite nice, though it wouldn't really cover the part of my use case that involves building new things.

---

[^noveltybudget]: I like the idea of a [novelty budget](https://shimweasel.com/2018/08/25/novelty-budgets), but I'm terrible at applying this to my own hobby projects. This is how I end up trying to learn [Kafka](https://kafka.apache.org/), [spaCy](https://spacy.io/) and [Docker Compose](https://docs.docker.com/compose/) while exploring topical RSS feed clustering back in ~2015. Multiple pieces of complicated bleeding edge tech (at least to me) applied to an Unsolved Problem. What could go wrong?

---

[^coffeetable]: I made this up. If I was into wood working, I might build a coffee table not because it makes practical or economic sense, but because I derive satisfaction from making something in whatever way I see fit. It may even be functional. That's a bonus!

---

[^ha]: Oh wait, not really the goal this time.

---

[^beyondlitestream]: Since I built this out, Ben Johnson (Litestream creator) announced a new project called [LiteFS](https://github.com/superfly/litefs), which is oriented at replication, as opposed to the distaster recovery focus of Litestream. Also, [Fly.io has a partially managed Postgres](https://fly.io/docs/postgres/) offering. Both are interesting, but overkill for my needs.
