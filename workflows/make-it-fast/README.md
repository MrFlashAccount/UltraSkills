# Make It Fast

## What it is

A profile-guided optimization workflow with a frozen workload and metric, an unchanged-system baseline, one causal hypothesis, comparable before/after measurement, and independent review.

## Use when

Performance is the primary requirement, the painful workload is reproducible, and a decision threshold can be stated before editing.

## Do not use when

There is no stable workload, no representative metric, correctness is unresolved, or optimization is merely speculative cleanup.

## Runtime contract

- Workload, metric, environment controls, sample policy, and threshold are frozen at intake.
- Baseline and profiler evidence come from unchanged production code.
- Implementation follows one evidence-backed causal hypothesis.
- Comparison uses the same method and includes correctness guards.
- Review rejects incomparable measurements, hidden variance, proxy wins, and complexity that outweighs the gain.
- One bounded optimization rework pass is allowed.
