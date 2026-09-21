import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface Finding {
  rule_id: string;
  profile: string;
  status: 'passed' | 'failed' | 'needs-review' | 'not-applicable' | 'blocked';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: { uri: string; path: string; line: number | null; column: number | null };
  suggestion: string | null;
  instance_path: string[];
}
export interface Report {
  schema_version: string;
  source: string;
  entrypoint: string | null;
  findings: Finding[];
  counts: Record<string, number>;
  dependencies: string[];
  exit_code: number;
  fail_on: string;
  operational_failure: boolean;
}
const ajv = new Ajv2020({ strict: false });
const validate = ajv.compile<Report>(JSON.parse(readFileSync(join(__dirname, '../schemas/report.json'), 'utf8')));

export function parseReport(text: string, exitCode: number): Report {
  const value: unknown = JSON.parse(text);
  if (!validate(value)) throw new Error(`Invalid validator report: ${ajv.errorsText(validate.errors)}`);
  if (value.schema_version !== '1.0') throw new Error(`Unsupported report schema ${value.schema_version}`);
  if (value.exit_code !== exitCode) throw new Error('Validator exit status disagrees with its report.');
  return value;
}

export function sourceArgument(filename: string, entrypoint: string): string {
  return pathToFileURL(filename).href + (entrypoint ? `#${encodeURIComponent(entrypoint)}` : '');
}

export function localPath(uri: string): string | undefined {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'file:' ? fileURLToPath(parsed) : undefined;
  } catch { return undefined; }
}

/** Python report columns count code points, VS Code columns count UTF-16 units. */
export function utf16Column(line: string, oneBasedColumn: number): number {
  return Array.from(line).slice(0, Math.max(0, oneBasedColumn - 1)).join('').length;
}

export function actionable(finding: Finding): boolean {
  return finding.status !== 'passed' && finding.status !== 'not-applicable';
}
