# Frontend UI PR Smoke Workflow

Small experimental workflow for testing the frontend design-to-implementation path without running the full Dev Harness.

Flow:

1. Draft a UI intent/design artifact.
2. Implement the frontend slice from that artifact.
3. Run frontend engineering review and frontend taste review.
4. Open or prepare a pull request after clean review.

Use this for small UI feature experiments where the goal is to inspect the resulting PR and tune the workflow. It is not a replacement for `dev-harness`.
