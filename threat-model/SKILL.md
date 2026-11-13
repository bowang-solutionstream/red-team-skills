---
name: threat-model
description: Map assets, trust boundaries, security controls and gaps from a repository or supplied design. Use for defensive threat modeling, tabletop scenario design, and evidence-based security priorities.
user-invocable: true
---

# Defensive threat model

Start with the user's system or component and scope. Use the design and evidence
they supply in chat for an inline model. For a repository review, call
`defensive_tabletop_report` once with a focus such as `Map trust boundaries and
evaluate session revocation`. This uses the selected worktree and the pinned
threat-modeling instructions in the local Strata worker. If the tool is
unavailable, ask the user to select Local Qwen through Strata. Relay the saved
path from the tool result.

## Map the design

- Identify protected data, identities, privileged operations and availability
  requirements. Describe entry points and the components that receive data.
- Locate trust boundaries where the caller, privilege, tenant or data owner
  changes. Name the required identity, authorization or validation at each
  boundary. Separate documented expectations from observed controls.
- Create a few plausible control-failure scenarios. State the boundary, asset,
  preconditions and potential impact at the level needed to choose a defense.
  Keep scenarios at the level of policy violations and control outcomes.

## Prepare the handoff

- Cite the supplied source, design, policy or existing test result. Mark a
  scenario supported, gap or unverified. Use gap only when reviewed evidence
  demonstrates a specific deviation from policy. State missing evidence and
  assumptions that could change severity.
- Give the owner a defensive mitigation and a measurable acceptance criterion.
  Use synthetic test outcomes for verification. Include important ordering,
  such as denial before access to protected storage.
- Prioritize by impact and evidence. Keep the analysis and handoff read-only.

The local worker's pinned reference is the
[Anthropic threat-model skill](https://github.com/anthropics/defending-code-reference-harness/blob/d3bea6b5793b5f3d59a75ebe69a58efa88383145/.claude/skills/threat-model/SKILL.md).
