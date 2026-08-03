# Loop controller output

Return one controller decision plus the updated compact durable baton.

- `outcome`: `continue`, `retry`, or `finish`
- matching typed `decision`
- concise reason and user-visible progress update
- complete updated baton with cumulative compact evidence

Do not perform task work. Use the non-blocking-stop control channel instead of completing the step when help or approval is missing.
