---
name: injection-probe
description: Probe discovered endpoints for injection flaws with bounded proof-of-concept runs - sqlmap, PayloadsAllTheThings payloads. Use when the user asks to test SQLi, XSS, SSTI or NoSQL injection. Proof only, never bulk exfiltration.
user-invocable: true
---

# Injection probe

Fourth phase. Consume the content-discovery evidence; write proofs
to `engagements/<slug>/injection/`.

## Run

1. `sqlmap` against candidate parameters, bounded to proof of
   concept: banner, DBMS banner, marker reads - never bulk
   extraction.
2. PayloadsAllTheThings payloads for XSS, SSTI and NoSQL variants.
3. Save each proof - request, response, marker evidence - inside
   the engagement directory.

## Rules

At most 2 concurrent probes, at least 20 s between bursts. Forbidden:
bulk exfiltration, destructive writes, load testing. Stop on WAF block
pages or sustained 429/449 responses.
