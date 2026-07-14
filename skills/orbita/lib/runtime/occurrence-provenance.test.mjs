import assert from "node:assert/strict";
import { test } from "bun:test";
import { batonWithAcceptedOutputProvenance } from "../runner/workflow-runner-occurrence.mjs";
import {
  advanceOccurrence,
  currentOccurrenceIsAvailable,
  ensureOccurrenceProvenance,
  initialOccurrenceProvenance,
  occurrenceIsAvailable,
} from "./occurrence-provenance.mjs";

test("legacy seed exposes an explicit forward boundary and only a successful route opens coverage", () => {
  const seeded = ensureOccurrenceProvenance(
    {
      cursor: "implementation",
      status: "running",
      state: { artifacts: [], results: [] },
    },
    { historyBytes: 8192 },
  );
  assert.deepEqual(seeded.state.$occurrenceProvenance.coverage, {
    mode: "forward_only",
    historyBytes: 8192,
    currentAvailable: false,
    firstAvailableByStep: {},
  });
  assert.equal(currentOccurrenceIsAvailable(seeded), false);

  const routed = advanceOccurrence({ ...seeded, cursor: "review" }, "review");
  assert.deepEqual(routed.state.$occurrenceProvenance.current, {
    ownerStepId: "review",
    occurrence: 1,
  });
  assert.equal(currentOccurrenceIsAvailable(routed), true);
  assert.equal(
    occurrenceIsAvailable(routed.state.$occurrenceProvenance, "implementation", 1),
    false,
  );
  assert.equal(occurrenceIsAvailable(routed.state.$occurrenceProvenance, "review", 1), true);

  const returned = advanceOccurrence({ ...routed, cursor: "implementation" }, "implementation");
  assert.deepEqual(returned.state.$occurrenceProvenance.current, {
    ownerStepId: "implementation",
    occurrence: 2,
  });
  assert.equal(
    occurrenceIsAvailable(returned.state.$occurrenceProvenance, "implementation", 1),
    false,
  );
  assert.equal(
    occurrenceIsAvailable(returned.state.$occurrenceProvenance, "implementation", 2),
    true,
  );
});

test("new runs begin with complete occurrence one coverage", () => {
  const provenance = initialOccurrenceProvenance("planning");
  assert.equal(provenance.current.occurrence, 1);
  assert.equal(provenance.coverage.currentAvailable, true);
});

test("legacy seeded output cannot receive exact artifact capability until a forward route", () => {
  const seeded = ensureOccurrenceProvenance(
    {
      cursor: "implementation",
      status: "running",
      state: { artifacts: [], results: [] },
    },
    { historyBytes: 4096 },
  );
  const acceptedFiles = [
    {
      id: "packet",
      acceptedFileStamp: { device: 1, inode: 2, size: 3, mtimeMs: 4, ctimeMs: 5 },
    },
  ];
  const unavailable = batonWithAcceptedOutputProvenance({
    baton: seeded,
    stepId: "implementation",
    output: { artifacts: [{ id: "packet", content_type: "text/plain", path: "/private/packet" }] },
    ownerStepId: "implementation",
    acceptedFiles,
  });
  assert.deepEqual(unavailable.state.$occurrenceProvenance.pendingArtifactAcceptances, {});

  const routed = advanceOccurrence({ ...seeded, cursor: "review" }, "review");
  const available = batonWithAcceptedOutputProvenance({
    baton: routed,
    stepId: "review",
    output: { artifacts: [{ id: "packet", content_type: "text/plain", path: "/private/packet" }] },
    ownerStepId: "review",
    acceptedFiles,
  });
  assert.equal(
    available.state.$occurrenceProvenance.pendingArtifactAcceptances.review.ownerOccurrence,
    1,
  );
});
