import { spawn } from 'node:child_process';
import { Report, parseReport, sourceArgument } from './report';

export interface RunOptions {
  executable: string;
  prefixArgs: string[];
  filename: string;
  entrypoint: string;
  profiles: string[];
  stagingFile: string;
  failOn: string;
  cwd: string;
  timeoutMs: number;
  signal: AbortSignal;
  onStderr: (text: string) => void;
}

export function validatorArgs(options: RunOptions): string[] {
  const profiles = options.profiles;
  if (!profiles.length || profiles.some(p => !['eoap-package', 'eoap-staging', 'metadata'].includes(p))) {
    throw new Error('Configure at least one supported validation profile.');
  }
  if (options.stagingFile && !profiles.includes('eoap-staging')) throw new Error('A staging file requires the eoap-staging profile.');
  if (!['error', 'warning'].includes(options.failOn)) throw new Error('Invalid failure threshold.');
  return [...options.prefixArgs, ...profiles.flatMap(p => ['--profile', p]),
    '--fail-on', options.failOn, '--format', 'json',
    ...(options.stagingFile ? ['--staging', options.stagingFile] : []),
    '--', sourceArgument(options.filename, options.entrypoint)];
}

export function runValidator(options: RunOptions): Promise<Report> {
  const args = validatorArgs(options);
  if (options.signal.aborted) return Promise.reject(new Error('Validation cancelled.'));
  return new Promise((resolve, reject) => {
    const child = spawn(options.executable, args, {
      cwd: options.cwd, shell: false, windowsHide: true, detached: process.platform !== 'win32',
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const kill = (): void => {
      if (child.pid && process.platform !== 'win32') {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
      } else child.kill('SIGKILL');
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal.removeEventListener('abort', cancel);
      kill();
      reject(error);
    };
    const cancel = (): void => fail(new Error('Validation cancelled.'));
    const timer = setTimeout(() => fail(new Error('Validation timed out.')), options.timeoutMs);
    options.signal.addEventListener('abort', cancel, { once: true });
    child.on('error', error => fail(new Error(`Cannot start validator: ${error.message}. Check eoapValidator.executable and its environment.`)));
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 32 * 1024 * 1024) { fail(new Error('Validator report exceeds 32 MiB.')); return; }
      chunks.push(chunk);
    });
    let stderrBytes = 0;
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderrBytes < 1024 * 1024) options.onStderr(chunk.toString('utf8'));
      stderrBytes += chunk.length;
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal.removeEventListener('abort', cancel);
      try {
        if (code === null || ![0, 1, 2].includes(code)) throw new Error(`Validator terminated with exit status ${code}. See EOAP Validator output.`);
        resolve(parseReport(Buffer.concat(chunks).toString('utf8'), code));
      } catch (error) {
        reject(new Error(`Cannot read validator result: ${error instanceof Error ? error.message : String(error)}. See EOAP Validator output.`));
      }
    });
  });
}
