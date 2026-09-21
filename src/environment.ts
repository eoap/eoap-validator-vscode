/** Install the pinned validator into extension-owned workspace-host storage. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';

export const VALIDATOR_REQUIREMENT = 'eoap-validator==0.1.0';
export interface CommandOptions { signal: AbortSignal; log: (text: string) => void }
export type Executor = (executable: string, args: string[], options: CommandOptions) => Promise<void>;

export const execute: Executor = (executable, args, options) => new Promise((resolve, reject) => {
  if (options.signal.aborted) { reject(new Error('Installation cancelled.')); return; }
  const child = spawn(executable, args, { shell: false, windowsHide: true, detached: process.platform !== 'win32' });
  let settled = false;
  let pendingError: Error | undefined;
  const finish = (error?: Error): void => {
    if (settled) return;
    settled = true; clearTimeout(timer); options.signal.removeEventListener('abort', cancel);
    if (error) reject(error); else resolve();
  };
  const stop = (error: Error): void => {
    pendingError = error;
    if (child.pid && process.platform !== 'win32') {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    } else child.kill('SIGKILL');
    // Wait for close before allowing another setup to mutate the same environment.
  };
  const cancel = (): void => stop(new Error('Installation cancelled.'));
  const timer = setTimeout(() => stop(new Error('Dependency installation timed out after 10 minutes.')), 600000);
  options.signal.addEventListener('abort', cancel, { once: true });
  child.stdout.on('data', (chunk: Buffer) => options.log(chunk.toString('utf8')));
  child.stderr.on('data', (chunk: Buffer) => options.log(chunk.toString('utf8')));
  child.on('error', error => finish(new Error(`Cannot run ${executable}: ${error.message}. Configure eoapValidator.pythonExecutable (Python 3.10+ with venv and pip).`)));
  child.on('close', code => finish(pendingError ?? (code === 0 ? undefined : new Error(`Dependency setup exited with status ${code}. See Output → EOAP Validator.`))));
});

export class ValidatorEnvironment {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: string, private extensionPath: string, private run: Executor = execute) {}

  ensure(python: string, options: CommandOptions): Promise<string> {
    // A cancelled/replaced validation must not race another pip process in the same venv.
    const operation = this.queue.catch(() => undefined).then(() => this.prepare(python, options));
    this.queue = operation;
    return operation;
  }

  private async prepare(python: string, options: CommandOptions): Promise<string> {
    if (options.signal.aborted) throw new Error('Installation cancelled.');
    const directory = path.join(this.storage, 'validator-bundled-0.1.0');
    const executable = path.join(directory, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const health = ['-c', "import sys; from importlib.metadata import version; import eoap_validator.cli; assert sys.version_info >= (3, 10); assert version('eoap-validator') == '0.1.0'"];
    if (existsSync(executable)) {
      try { await this.run(executable, health, options); return executable; }
      catch (error) { if (options.signal.aborted) throw error; }
    }
    await mkdir(this.storage, { recursive: true });
    options.log(`Preparing managed environment for ${VALIDATOR_REQUIREMENT}\n`);
    await this.run(python, ['-c', "import sys; assert sys.version_info >= (3, 10), 'Python 3.10 or newer is required'"], options);
    await this.run(python, ['-m', 'venv', directory], options);
    await this.run(executable, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', path.join(this.extensionPath, 'vendor', 'eoap_validator-0.1.0-py3-none-any.whl')], options);
    await this.run(executable, ['-m', 'pip', 'check'], options);
    await this.run(executable, health, options);
    options.log('Managed validator is ready.\n');
    return executable;
  }
}
