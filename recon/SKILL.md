---
name: recon
description: Map the attack surface of any target named in the request - subdomain enumeration (subfinder), live-host probing (ProjectDiscovery httpx), endpoint crawling (katana). Target-agnostic; writes evidence to engagements/<slug>/recon/.
user-invocable: true
---

# Recon

First phase of the offensive pipeline. The target comes from the
request - nothing is baked into the skill. Convert the target to a slug
(dots to underscores) and write evidence to
`engagements/<slug>/recon/` in the workspace.

## Preflight

Check the binaries before running: `subfinder`, `httpx` (the
ProjectDiscovery scanner - the Python `httpx` library answers
differently to `-version`), `katana`. On a missing binary, stop and
report the install command; do not silently substitute.

## Run

1. `subfinder -d <domain> -silent` - enumerate subdomains.
2. `httpx` - probe discovered hosts, keep live ones, record status
   codes, TLS and technology fingerprints.
3. `katana` - crawl live hosts for endpoints.

## Rules

At most 2 concurrent probes, ~2 requests per second, at least 20 s
between bursts. No bulk extraction. Stop on WAF block pages or
sustained 429/449 responses. Save raw output inside the engagement
directory; prefer SARIF where the tool supports it.
