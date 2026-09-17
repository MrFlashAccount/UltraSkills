# Dialectic workflow protocol

This package is the normative reference for the bounded dialectic lifecycle used by SPDD, create-architecture, and Hegel. It is documentation only: executable prompts, schemas, fingerprints, routing, and artifact policy remain inside each owning workflow package.

The lifecycle adapts the Agentic Soulmates paper's Dialectic pattern: isolated Visionary and Pragmatist positions, followed by independent synthesis and convergence. The source describes that mechanism; the `hegel` workflow name and other repository-specific framing belong to this project. Source: <https://whitepaper.soulmates.md/#4-soul-architecture-designing-agentic-soulmates>.

## One bounded cycle

1. An owning workflow freezes one typed shared input.
2. Visionary A and Pragmatist B receive the same input in isolation and produce complete evidence-backed positions. B changes at least one material axis or records an evidenced `no_viable_antithesis`.
3. The owner accepts both file-backed artifacts, then publishes a frozen manifest containing only typed artifact metadata and semantic fingerprints.
4. The same logical A and B identities independently synthesize from the frozen pair. A host may restore their earlier workers or start fresh workers; correctness depends only on the explicit role contract and accepted artifacts.
5. The owner compares package-owned decision fingerprints, never prose similarity. Synthesis peers do not see each other's synthesis.
6. Convergence selects one lineage. Divergence, a user-owned decision, or invalid protocol state reaches one separate adjudicator at most once.
7. Adjudication may select A, select B, emit one traceable third result, or reject both with evidence. A non-blocking stop is valid only for concrete help that can resume the same adjudication.
8. The owning workflow materializes its canonical artifact and always keeps hostile review independent from comparison and adjudication. A legitimate no-synthesis result terminates through a typed unresolved route.

## Context firewall

The firewall guarantees peer isolation, not amnesia. A restored worker may retain its own prior session, but peer information crosses only through accepted typed artifacts. Initial positions cannot receive peer output or a shared mutable draft. Synthesis A cannot receive synthesis B, and synthesis B cannot receive synthesis A. Hidden reasoning, transcripts, and host-private state are never protocol inputs.

## Lineage and fingerprints

Every canonical result records the two position artifact ids, two synthesis artifact ids, convergence outcome, optional adjudication id, selected candidate, and canonical logical owner. Fingerprints compare decisions and evidence interpretation along package-owned axes. SPDD and create-architecture own architecture dimensions; Hegel owns diagnostic dimensions. No shared executable fingerprint schema exists.

## Bounds and ownership

There is exactly one position fanout, one synthesis fanout, and at most one adjudication. Technical schema retries do not replay the cycle. SPDD owns its Canvas and downstream implementation/review gates. Create-architecture owns proposal and architecture-artifact policy. Hegel owns its read-only report and bounded hostile-review exit. This reference must not become a runtime dependency or a generic debate engine.
