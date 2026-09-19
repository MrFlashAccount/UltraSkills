const chunks = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));

try {
  const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('input', `'use strict';\n${request.source}`);
  const result = await execute(request.input);
  process.stdout.write(JSON.stringify(result));
} catch {
  process.exitCode = 1;
}
