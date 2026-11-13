---
name: content-discovery
description: Discover hidden files, directories and parameters with ffuf and Param Miner-style checks. Use when the user asks for content discovery, hidden endpoint hunting or parameter fuzzing on a named target.
user-invocable: true
---

# Content discovery

Third phase. Consume the recon host list; write evidence to
`engagements/<slug>/content/`.

## Run

1. `ffuf` with a curated wordlist against live hosts; record status,
   length and word-count deltas - not status alone.
2. Param Miner-style checks for hidden parameters on live endpoints.
3. Save raw results per host inside the engagement directory.

## Rules

At most 2 concurrent fuzz streams, at least 20 s between bursts. No
bulk exfiltration. Stop on WAF block pages or sustained 429/449
responses.
