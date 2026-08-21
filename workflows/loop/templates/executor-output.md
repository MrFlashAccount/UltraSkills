# Loop executor output

Report exactly one cycle in compact structured form.

- `outcome`: `cycle_reported`
- exact iteration and status (`completed`, `partial`, or `no-progress`)
- concise result and reproducible evidence
- `touched`: files, PRs, issues, and notes changed or created during the cycle
- optional `artifacts`: standard Orbita artifact metadata for files emitted through the artifact output channel
- verification checks and observed results
- open risks, progress flag, retry context, and one next recommendation

Do not start or decide the next cycle. Use the non-blocking-stop control channel instead of this completed output when help or approval is missing.
