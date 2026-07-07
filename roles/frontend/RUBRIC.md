# Frontend Rubric

Derived checklist for the Frontend role.

Use this as a compact checklist when a calling skill wants frontend implementation or review judgment. `ROLE.md` remains the canonical role contract.

## Checklist

- **Contracts**: Does the client consume backend data/contracts correctly and defensively?
- **State/async flow**: Are state ownership, derived data, and async transitions clear and stable? Are independent promises started together and awaited only when needed?
- **States**: Are loading, pending, empty, success, error/retry, focus, disabled, and permission/partial-data states handled intentionally where applicable?
- **Routing/hydration**: Are route transitions and client/server boundary assumptions safe?
- **Mandatory findings**: Are all actionable `must_fix` and `should_fix` findings fixed before pass? A frontend review with unresolved actionable `should_fix` items should return `needs_changes`, not `passed`; reserve `can_delay` for explicit out-of-scope future cleanup.
- **Documentation and best practices**: For named frameworks, routers, UI kits, accessibility primitive libraries, or build/runtime integrations, did the implementer/reviewer inspect relevant current docs or repo-local examples and cite the evidence? If docs were unavailable, is the uncertainty explicit rather than guessed through?
- **Component architecture**: Are user-facing files/components kept near the ~200 LOC pressure rule, with extraction seams or explicit approved justification for larger slices?
  New or materially rewritten user-facing source files over ~200 lines are must-fix unless the approved plan grants an exception; frontend-authored source/test files over 400 lines after a change are blockers unless explicitly justified as generated, vendor, lock, snapshot, data fixture, or migration exceptions; existing oversized files must not be made worse.
  For non-trivial user-facing UI, did the plan or implementation handoff include a component map naming screen/page containers, feature components, layout components, primitives/UI-kit usage, overlays, forms, lists/cards, state surfaces, hooks/selectors, and file zones before or alongside implementation?
  Are data/orchestration, controls, overlays, lists/cards, detail sections, and focus/interaction policy split into named components/hooks/selectors when that clarifies behavior?
  Are reusable components named in the handoff with purpose, boundary, expected inputs/outputs, and reuse scope?
  Does the page/route component stay mostly orchestration/composition rather than owning control styling, repeated card/list markup, modal/drawer internals, loading/error/empty surfaces, and business-state transitions inline?
- **Colocation**: Are component implementation, component-local types, styles, tests/stories/fixtures where present, and component-specific helpers colocated rather than smeared across broad UI files?
- **Canonical values**: Are client-visible statuses, actions, artifact kinds, route/state names, and similar symbolic values reused through canonical constants/names instead of scattered raw strings, except definitions, tests/fixtures, or explicit migration compatibility?
- **Side-effect boundaries**: Do functions/hooks avoid mixing side effects with compute/transform logic unless the reason is local and explicit?
- **State placement**: Is state kept in the narrowest correct home: local, lifted, context, URL, server/cache, or global client store?
- **Code docs**: Are file purpose, state ownership, async/data-contract assumptions, critical UI states, and exported hook/helper/component contracts documented where they would otherwise be non-obvious?
- **Design-system discipline**: Does the UI identify and use existing UI kit primitives, semantic native elements, tokens, and scales instead of raw colors, arbitrary spacing, inline style escapes, mixed primitive systems, or local visual law?
  Are repeated className/token clusters, repeated controls, repeated overlay/list/form scaffolds, and repeated status-state branches extracted or routed through existing primitives rather than copy-pasted?
- **Baseline UI red flags**: Are destructive actions confirmed, mobile viewport/fixed UI safe, errors near their fields/actions, paste allowed, data/text formatted robustly, z-index layered by scale, and empty states given one clear next action?
- **Interaction/motion craft**: If motion exists, does it have a purpose, frequency-appropriate duration, origin-aware behavior, interruptible transitions/gestures, reduced-motion fallback, and transform/opacity-first performance?
- **Performance mechanics**: Does the implementation avoid async waterfalls, broad/barrel imports, unnecessary render churn, duplicated client I/O, and repeated browser/JS hot-path work?
- **Maintainability**: Is UI logic localized and understandable instead of brittle or smeared?
- **Accessibility/interaction correctness**: Are native semantics preferred, controls keyboard reachable, accessible names present, focus visible, color not the only signal, and disabled/busy/error semantics correct?
- **Responsive QA**: Were touched layouts checked at relevant breakpoints, defaulting to 320/768/1024/1440 CSS px when no repo breakpoints are known?
- **Verification**: Do build/lint/typecheck/tests and, when relevant, screenshots, preview/browser smoke, axe/a11y, or keyboard walkthrough evidence prove the claimed frontend behavior?
- **Scope**: Is the role staying inside frontend correctness and implementation root causes rather than drifting into visual-taste symptom review or invention?
- **Learnings**: Were relevant durable learnings from `LEARNINGS.md` applied before making role judgments?

## Notes

This rubric is phase-agnostic.
A calling skill decides whether it is using Frontend as an implementer, reviewer, or earlier-phase frontend judgment source.

## Final role evidence

When this file is loaded as role material, add this exact path to the final role evidence loaded list:

- `roles/frontend/RUBRIC.md`

Only list this file if it was actually loaded.
