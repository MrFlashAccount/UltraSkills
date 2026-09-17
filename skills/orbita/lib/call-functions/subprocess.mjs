import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export function runSubprocess({ command, args, cwd, stdin, timeoutMs, captureStderr }) {
  return new Promise((resolve, reject) => {
    const ownsProcessGroup = process.platform !== 'win32';
    const child = spawn(command, args, {
      cwd,
      detached: ownsProcessGroup,
      stdio: captureStderr ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'ignore'],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      terminateProcessTree();
      finish(new Error(`call function exceeded timeout of ${timeoutMs}ms`));
    }, timeoutMs);

    function terminateProcessTree() {
      if (!child.pid) return;
      if (ownsProcessGroup) {
        try {
          process.kill(-child.pid, 'SIGKILL');
          return;
        } catch (error) {
          if (error?.code === 'ESRCH') return;
        }
      }
      child.kill('SIGKILL');
    }

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    }

    function capture(chunks, chunk) {
      if (settled) return;
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        terminateProcessTree();
        finish(new Error(`call function output exceeded ${MAX_OUTPUT_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    }

    child.on('error', (error) => finish(new Error(`failed to start call function process: ${error.message}`)));
    child.stdout.on('data', (chunk) => capture(stdout, chunk));
    if (captureStderr) child.stderr.on('data', (chunk) => capture(stderr, chunk));
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code === null) {
        finish(new Error(`call function process failed with ${signal ? `signal ${signal}` : 'no exit code'}`));
        return;
      }
      finish(undefined, {
        exitCode: code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    child.stdin.on('error', (error) => {
      terminateProcessTree();
      finish(new Error(`failed to write call function input: ${error.message}`));
    });
    child.stdin.end(stdin);
  });
}

export async function runJsonSubprocess(options) {
  const result = await runSubprocess(options);
  if (result.exitCode !== 0) {
    throw new Error(`call function process failed with exit code ${result.exitCode}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('call function process did not return valid JSON');
  }
}
