import { spawn } from 'node:child_process';

const MAX_STDOUT_BYTES = 10 * 1024 * 1024;

export function runJsonSubprocess({ command, args, stdin, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const ownsProcessGroup = process.platform !== 'win32';
    const child = spawn(command, args, {
      detached: ownsProcessGroup,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const stdout = [];
    let stdoutBytes = 0;
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

    child.on('error', (error) => finish(new Error(`failed to start call function process: ${error.message}`)));
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        terminateProcessTree();
        finish(new Error(`call function output exceeded ${MAX_STDOUT_BYTES} bytes`));
        return;
      }
      stdout.push(chunk);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(`call function process failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`));
        return;
      }
      const text = Buffer.concat(stdout).toString('utf8');
      try {
        finish(undefined, JSON.parse(text));
      } catch {
        finish(new Error('call function process did not return valid JSON'));
      }
    });
    child.stdin.on('error', (error) => {
      terminateProcessTree();
      finish(new Error(`failed to write call function input: ${error.message}`));
    });
    child.stdin.end(stdin);
  });
}
