# Frontend UI PR Smoke Workflow

Small experimental workflow for testing the frontend design-to-implementation path without running the full SPDD.

Flow:

1. Draft a UI intent/design artifact.
2. Run a pre-implementation hostile frontend-taste attack.
3. Obtain explicit human approval; user-requested revisions return directly to the same approval gate.
4. Implement the frontend slice from the exact approved HTML artifact and approval evidence.
5. Run frontend engineering review and frontend taste review against rendered proof.
6. Open or prepare a pull request after clean review.

The design artifact must capture UI applicability and product/surface route, design-basis preflight, user/task and actions, user decisions, first-read hierarchy, screen zones, data hierarchy, selected pattern contracts, states, motion/reduced-motion, responsive containment, evidence/rendered-proof expectations, and open tensions. Card/list and drawer/sidebar contracts apply only when those patterns are selected. Compact controls and status surfaces must not wrap unless explicitly approved; long tokens need deliberate truncation or detail placement.

Taste-sensitive or materially new UI compares 3-4 viable directions inside the available design basis before approval. The hostile attack checks hierarchy, typography/rhythm, spacing/composition, color/emphasis/contrast, focus-visible and target affordance, responsive containment, motion/reduced-motion, fidelity, and generic UI slop without inventing `DESIGN.md`.

Use this for small UI feature experiments where the goal is to inspect the resulting PR and tune the workflow. It is not a replacement for `spdd`.
