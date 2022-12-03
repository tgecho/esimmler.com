---
title: "How to mark a podcast feed as private"
date: "2021-12-30"
---

Adding an `<itunes:block>Yes</itunes:block>` tag to a feed will instruct complying podcast directories (such as [Overcast](https://marco.org/2018/03/13/overcast41) or [iTunes](https://help.apple.com/itc/podcasts_connect/#/itcb54353390)) to not list that feed publicly. I also found mentions of a `<googleplay:block>` tag, but even [Google's own docs](https://support.google.com/podcast-publishers/answer/9889544?hl=en) only seem to mention the iTunes tag.

I haven't found an equivalent for [JSON Feed](https://www.jsonfeed.org/), but I'm still not sure how widespread support actually is, especially among podcast players.

I'm only writing this up because it was strangely difficult to find any useful info when I initially searched for things like "mark podcast feed private" or "rss private tag". Most of the results were from paid podcasts hosts with no technical details.
