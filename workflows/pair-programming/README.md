# Pair Programming

## What it is

A runner-owned driver/navigator workflow. The two tracks can run in parallel, but write ownership is explicit and a separate integration owner reconciles their output before review.

## Use when

A small change has meaningful ambiguity, cross-cutting trade-offs, or enough review risk that two simultaneous perspectives are cheaper than a serial retry.

## Do not use when

One agent plus a deterministic test is sufficient, safe ownership cannot be separated, or the task needs broad architecture/research before implementation.

## Runtime contract

- `isolated_workspaces`: both tracks may create candidates in separate workspaces.
- `disjoint_zones`: each track writes only its declared files or zones.
- `shared_zone`: driver writes; navigator stays read-only.
- Concurrent writes to the same path are forbidden.
- The integration owner inspects actual filesystem state and resolves disagreements.
- A distinct reviewer permits one bounded integration rework pass.
