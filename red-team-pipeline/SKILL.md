---
name: red-team-pipeline
description: Single entry point that initiates the full offensive pipeline - recon, vuln-scan, content-discovery, injection-probe, identity-paths, then red-team-report - against the target named in the request. Use when the user asks for a full red-team engagement or pipeline run, or to scan a target end to end.
user-invocable: true
---

# Red-Team Pipeline

One surface to launch the whole offensive skill set. This skill orchestrates the six phases in order; each phase skill does its own work and saves evidence under the target's engagement directory.

## Step 0 - Resolve the target

- The target (domain, host, or IP range) must be named in the request. If it is missing, ask for it before doing anything.
- Derive the slug: lowercase, dots replaced with underscores (`utlyze.com` -> `utlyze_com`).
- Create `engagements/<slug>/` and one subdirectory per phase: `recon/`, `scan/`, `content/`, `injection/`, `identity/`, `report/`.
- Never write evidence outside `engagements/<slug>/`.

## Phase order

Run the phases strictly in sequence; each phase consumes the previous phase's evidence:

1. **recon** - subfinder subdomain enumeration, ProjectDiscovery `httpx` live probing, katana crawling -> `engagements/<slug>/recon/`
2. **vuln-scan** - Nuclei against recon's live-host list, SARIF export -> `engagements/<slug>/scan/`
3. **content-discovery** - ffuf and parameter fuzzing -> `engagements/<slug>/content/`
4. **injection-probe** - bounded sqlmap / PayloadsAllTheThings PoC runs -> `engagements/<slug>/injection/`
5. **identity-paths** - cookie scope, SSO/gate behavior, NetExec/Impacket/BloodHound probes -> `engagements/<slug>/identity/`
6. **red-team-report** - aggregates all phase evidence into the client deliverable -> `engagements/<slug>/report/`

## Default rules (travel with every phase)

- At most 2 concurrent probes, ~2 requests/second, at least 20 seconds between bursts.
- Forbidden without explicit approval: bulk exfiltration, destructive writes, brute force, load testing.
- Stop on WAF block pages or sustained 429/449 responses and report before continuing.
- Preflight each binary before use; fail with an install hint rather than guessing.

## Completion

Report to the user: the engagement directory path, per-phase evidence counts, and the final report file path.
