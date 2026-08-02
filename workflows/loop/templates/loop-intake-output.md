# Loop intake output

Return only the compact normalized state required by the output schema. Keep large evidence, logs, and file contents out of the baton.

- `outcome`: `ready`
- `baton`: normalized inputs, effective/static iteration bounds, first action, safety boundaries, and empty progress state

Use the non-blocking-stop control channel instead of this completed output when input, capability, permission, or approval is missing.
