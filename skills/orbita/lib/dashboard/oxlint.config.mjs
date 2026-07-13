import base from "@sergeigarin/hygene";

export default {
  ...base,
  ignorePatterns: [
    ...(base.ignorePatterns ?? []),
    "skills/orbita/lib/dashboard/ui/.output/**",
    "skills/orbita/lib/dashboard/ui/e2e/proof/**",
    "skills/orbita/lib/dashboard/ui/e2e/results/**",
    "skills/orbita/lib/dashboard/ui/src/routeTree.gen.ts",
  ],
  overrides: [
    ...(base.overrides ?? []),
    {
      files: ["observer/**", "projection/**", "ui/src/server/**", "**/*.test.ts", "**/*.test.tsx"],
      rules: {
        // Durable MJS adapters and adversarial fixtures are validated at explicit schema boundaries.
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
    {
      files: ["observer/**"],
      rules: {
        // Observer reconciliation and bounded durable reads intentionally preserve sequence.
        "react-doctor/async-await-in-loop": "off",
        "react-doctor/async-defer-await": "off",
      },
    },
    {
      files: ["observer/runs-root-observer-reader.server.ts"],
      rules: {
        // Namespace import keeps the legacy MJS suppression attached after formatting.
        "import-x/no-namespace": "off",
      },
    },
    {
      files: ["ui/src/features/board/VirtualLane.tsx"],
      rules: {
        // TanStack Virtual is the selected virtualization boundary and opts this component out.
        "react-hooks-js/incompatible-library": "off",
      },
    },
    {
      files: ["ui/src/features/board/hooks/use-stable-lane-order.ts"],
      rules: {
        // This hook deliberately keeps non-rendering position identity across reconciliations.
        "react-hooks-js/refs": "off",
      },
    },
    {
      files: ["projection/exposure-policy.ts"],
      rules: {
        // The sanitizer intentionally matches the complete Unicode control-character ranges.
        "no-control-regex": "off",
      },
    },
    {
      files: ["ui/e2e/**"],
      rules: {
        // Browser instrumentation needs native brand checks for optional platform APIs.
        "@nkzw/no-instanceof": "off",
      },
    },
    {
      files: ["projection/project-run.ts"],
      rules: {
        // Projection passes are separately bounded and keep omission semantics explicit.
        "react-doctor/js-combine-iterations": "off",
      },
    },
    {
      files: ["ui/src/server/dashboard-http.server.ts"],
      rules: {
        // Mutable cleanup is shared by ReadableStream start/cancel lifecycle callbacks.
        "unicorn/consistent-function-scoping": "off",
      },
    },
    {
      files: ["ui/src/features/board/hooks/use-lane-disclosure.ts"],
      rules: {
        // Disclosure state preserves an explicit user choice across live count changes.
        "react-doctor/no-derived-state": "off",
        "react-doctor/no-event-handler": "off",
      },
    },
    {
      files: ["ui/src/features/board/hooks/use-roving-run-focus.ts"],
      rules: {
        // The effect maintains an imperative DOM focus registry after live reconciliation.
        "react-doctor/no-event-handler": "off",
      },
    },
    {
      files: ["ui/src/features/freshness/use-dashboard-events.ts"],
      rules: {
        // EventSource callbacks synchronize an external transport and share one coalescing timer.
        "react-doctor/exhaustive-deps": "off",
        "react-doctor/no-cascading-set-state": "off",
        "react-doctor/no-event-handler": "off",
      },
    },
    {
      files: ["ui/src/features/run-detail/RunDetailSurface.tsx"],
      rules: {
        // Responsive focus restoration and region-level Escape handling are accessibility behavior.
        "react-doctor/no-event-handler": "off",
        "react-doctor/no-noninteractive-element-interactions": "off",
      },
    },
    {
      files: ["ui/src/components/ui/sheet.tsx"],
      rules: {
        // Exit presence outlives route state, so focus restoration must retain the open-state callback.
        "react-doctor/no-event-handler": "off",
      },
    },
  ],
  rules: {
    ...base.rules,
    // Contract and lane object order is intentional and observable in serialized DTOs and UI.
    "perfectionist/sort-objects": "off",
    // Small colocated state variants and TanStack route modules are framework-owned boundaries.
    "react-doctor/no-multi-comp": "off",
    "react-doctor/only-export-components": "off",
    // Zod migration is separate from adopting the shared frontend toolchain.
    "react-doctor/zod-v4-no-deprecated-schema-apis": "off",
    "react-doctor/zod-v4-prefer-top-level-string-formats": "off",
    // The route's browser-only dynamic import must remain guarded during SSR.
    "unicorn/prefer-top-level-await": "off",
  },
};
