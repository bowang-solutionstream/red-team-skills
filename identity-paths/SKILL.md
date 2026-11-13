---
name: identity-paths
description: Map identity and authentication surfaces - token types, cookie scope, SSO and gate behavior, BloodHound paths, NetExec and Impacket probes. Use when the user asks to assess identity, auth flows or internal service exposure.
user-invocable: true
---

# Identity paths

Fifth phase. Assess the identity and auth surface of the target
named in the request; write evidence to
`engagements/<slug>/identity/`.

## Run

1. Derive auth mechanisms from recon evidence: token types, cookie
   scope, SSO or gate behavior.
2. NetExec and Impacket probes for service auth behavior; BloodHound
   for internal path mapping where domain access exists.
3. Record each identity path with its evidence artifact.

## Rules

Read-only probes. No brute force or password spraying. Stop on WAF
block pages or sustained 429/449 responses.
