import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { actionable, Finding, localPath, Report, utf16Column } from './report';
import { runValidator } from './runner';
import { ValidatorEnvironment } from './environment';
import { workflowIds } from './workflows';
import { missingMetadataAnchor } from './metadata-location';

function digest(uri: vscode.Uri): string {
  return createHash('sha256').update(readFileSync(uri.fsPath)).digest('hex');
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('EOAP Validator');
  const environment = new ValidatorEnvironment(context.globalStorageUri.fsPath, context.extensionUri.fsPath);
  const diagnostics = vscode.languages.createDiagnosticCollection('eoap-validator');
  let active: ValidationSession | undefined;
  let request = 0;
  context.subscriptions.push(output, diagnostics, vscode.commands.registerCommand('eoapValidator.validate', async (uri?: vscode.Uri) => {
    if (!vscode.workspace.isTrusted) return;
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target || !['file', 'vscode-remote'].includes(target.scheme) || !target.path.endsWith('.cwl')) return;
    const current = ++request;
    active?.dispose(); active = undefined;
    try {
      const document = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(document);
      const ids = workflowIds(document.getText());
      const entrypoint = ids.length > 1 ? await vscode.window.showQuickPick(ids, {
        title: 'EOAP validation', placeHolder: 'Select the workflow ID to validate',
      }) : '';
      if (entrypoint === undefined || current !== request) return;
      active = new ValidationSession(target, entrypoint, output, diagnostics, environment);
      await active.validate();
    } catch (error) { void vscode.window.showErrorMessage(message(error)); }
  }), { dispose: () => { request++; active?.dispose(); } });
}

class ValidationSession implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private controller?: AbortController;
  private generation = 0;
  private disposed = false;
  private saving = false;
  private timer?: ReturnType<typeof setTimeout>;
  private watched = new Map<string, vscode.Uri>();
  private fileWatchers: vscode.Disposable[] = [];
  private snapshots = new Map<string, string>();
  private changes = new Set<string>();

  constructor(readonly root: vscode.Uri, private entrypoint: string,
    private output: vscode.OutputChannel, private diagnostics: vscode.DiagnosticCollection, private environment: ValidatorEnvironment) {
    this.watched.set(root.toString(), root);
    this.watchFiles();
    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
      if (!event.contentChanges.length) return;
      this.changes.add(event.document.uri.toString());
      if (!this.saving && this.watched.has(event.document.uri.toString())) this.invalidate('Source changed. Save and validate to refresh findings.');
    }), vscode.workspace.onDidSaveTextDocument(document => {
      if (!this.saving && this.watched.has(document.uri.toString()) && this.config().get<boolean>('validateOnSave', false)) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.validate(), 300);
      }
    }));
  }

  private config(): vscode.WorkspaceConfiguration { return vscode.workspace.getConfiguration('eoapValidator', this.root); }
  private invalidate(reason: string): void {
    this.generation++;
    this.controller?.abort(); this.controller = undefined;
    this.diagnostics.clear();
    this.output.appendLine(reason);
  }
  private editorUri(uri: string): vscode.Uri | undefined {
    const filename = localPath(uri);
    if (!filename) return undefined;
    const local = vscode.Uri.file(filename);
    return this.root.scheme === 'vscode-remote' ? local.with({ scheme: this.root.scheme, authority: this.root.authority }) : local;
  }
  private watchFiles(): void {
    this.fileWatchers.forEach(w => w.dispose()); this.fileWatchers = [];
    for (const [key, uri] of this.watched) {
      const directory = uri.with({ path: uri.path.slice(0, uri.path.lastIndexOf('/')) });
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(directory, path.basename(uri.fsPath)));
      const changed = (): void => {
        if (this.saving) return;
        try { if (this.snapshots.get(key) === digest(uri)) return; } catch { /* File was removed. */ }
        this.changes.add(key);
        this.invalidate('A package source changed on disk. Validate to refresh findings.');
      };
      this.fileWatchers.push(watcher, watcher.onDidChange(changed), watcher.onDidDelete(changed), watcher.onDidCreate(changed));
    }
  }
  private async cleanSources(): Promise<boolean> {
    const dirty = vscode.workspace.textDocuments.filter(d => d.isDirty && this.watched.has(d.uri.toString()));
    if (!dirty.length) return true;
    const answer = await vscode.window.showWarningMessage('Validation uses saved files. Save the modified package sources first?', 'Save and validate');
    if (answer !== 'Save and validate') return false;
    this.saving = true;
    try {
      for (const document of dirty) {
        if (!await document.save()) return false;
        this.snapshots.set(document.uri.toString(), digest(document.uri));
      }
      return true;
    } finally { this.saving = false; }
  }

  async validate(): Promise<void> {
    if (this.disposed || !vscode.workspace.isTrusted) return;
    this.invalidate('Preparing validation…');
    const token = this.generation;
    if (!await this.cleanSources() || token !== this.generation || this.disposed) return;
    const config = this.config();
    const staging = config.get<string>('stagingFile', '');
    const stagingFile = staging ? path.resolve(path.dirname(this.root.fsPath), staging) : '';
    if (stagingFile) {
      const uri = this.editorUri(vscode.Uri.file(stagingFile).toString());
      if (uri) this.watched.set(uri.toString(), uri);
      if (!await this.cleanSources() || token !== this.generation) return;
    }
    this.changes.clear();
    const before = new Map<string, string>();
    for (const [key, uri] of this.watched) { try { before.set(key, digest(uri)); } catch { /* The validator reports missing files. */ } }
    const controller = new AbortController(); this.controller = controller;
    this.output.appendLine('Validating saved application package…');
    this.output.appendLine(`Validating ${this.root.fsPath}${this.entrypoint ? '#' + this.entrypoint : ''}`);
    try {
      let executable = config.get<string>('executable', '').trim();
      let prefixArgs = config.get<string[]>('arguments', []);
      if (!executable) {
        this.output.appendLine('Preparing bundled eoap-validator 0.1.0…');
        executable = await this.environment.ensure(
          config.get<string>('pythonExecutable', '').trim() || (process.platform === 'win32' ? 'python' : 'python3'),
          { signal: controller.signal, log: text => this.output.append(text) });
        prefixArgs = ['-m', 'eoap_validator'];
      }
      if (token !== this.generation || this.disposed || controller.signal.aborted) return;
      this.output.appendLine('Validating saved application package…');
      const report = await runValidator({
        executable, prefixArgs,
        filename: this.root.fsPath, entrypoint: this.entrypoint, profiles: config.get<string[]>('profiles', ['eoap-package', 'metadata']),
        stagingFile, failOn: config.get<string>('failOn', 'error'), cwd: path.dirname(this.root.fsPath),
        timeoutMs: Math.min(3600, Math.max(1, config.get<number>('timeoutSeconds', 120))) * 1000,
        signal: controller.signal, onStderr: text => this.output.append(text),
      });
      if (token !== this.generation || this.disposed) return;
      this.output.appendLine(JSON.stringify(report, null, 2));
      this.snapshots.clear();
      const next = new Map<string, vscode.Uri>([[this.root.toString(), this.root]]);
      for (const source of report.dependencies) {
        const uri = this.editorUri(source); if (uri) next.set(uri.toString(), uri);
      }
      if (stagingFile) {
        const uri = this.editorUri(vscode.Uri.file(stagingFile).toString()); if (uri) next.set(uri.toString(), uri);
      }
      // Keep previous dependencies after incomplete runs so a repair can retrigger validation.
      if (report.operational_failure) for (const [key, uri] of this.watched) next.set(key, uri);
      this.watched = next;
      this.watchFiles();
      let changed = false;
      for (const [key, uri] of next) {
        if (this.changes.has(key) || vscode.workspace.textDocuments.some(d => d.uri.toString() === key && d.isDirty)) changed = true;
        try {
          const hash = digest(uri); this.snapshots.set(key, hash);
          if (before.has(key) && before.get(key) !== hash) changed = true;
        } catch { /* Missing source findings remain visible but non-navigable. */ }
      }
      if (changed) { this.output.appendLine('Sources changed during validation. Validate again.'); return; }
      await this.publishDiagnostics(report, token);
      if (token !== this.generation || this.disposed) return;
      const unlocated = report.findings.filter(actionable).length - this.publishedCount;
      void vscode.window.showInformationMessage(`EOAP validation: ${report.findings.filter(actionable).length} issue(s).${unlocated ? ` ${unlocated} without usable source positions; see Output → EOAP Validator.` : ''}`);
    } catch (error) {
      if (token === this.generation && !this.disposed) {
        this.output.appendLine(message(error));
        void vscode.window.showErrorMessage(message(error));
      }
    } finally { if (this.controller === controller) this.controller = undefined; }
  }

  private async findingRange(finding: Finding): Promise<{ uri: vscode.Uri; range: vscode.Range; note?: string } | undefined> {
    const uri = this.editorUri(finding.location.uri);
    if (!uri || !this.watched.has(uri.toString()) || finding.location.line === null) return undefined;
    if (!this.snapshots.has(uri.toString()) || digest(uri) !== this.snapshots.get(uri.toString())) return undefined;
    const document = await vscode.workspace.openTextDocument(uri);
    if (document.isDirty) return undefined;
    const anchor = missingMetadataAnchor(document.getText(), finding);
    if (anchor) return { uri, range: new vscode.Range(anchor.line, anchor.column, anchor.line, document.lineAt(anchor.line).text.length), note: anchor.note };
    const line = finding.location.line - 1;
    if (line < 0 || line >= document.lineCount) return undefined;
    const text = document.lineAt(line).text;
    const column = utf16Column(text, finding.location.column ?? 1);
    return { uri, range: new vscode.Range(line, column, line, text.length) };
  }
  private publishedCount = 0;
  private async publishDiagnostics(report: Report, token: number): Promise<void> {
    let located = 0;
    const grouped = new Map<string, { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }>();
    for (const finding of report.findings.filter(actionable)) {
      try {
        const target = await this.findingRange(finding); if (!target) continue;
        located++;
        const severity = finding.severity === 'error' ? vscode.DiagnosticSeverity.Error : finding.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
        const diagnostic = new vscode.Diagnostic(target.range, `${finding.message}${target.note ? '\n' + target.note : ''}${finding.suggestion ? '\n' + finding.suggestion : ''}`, severity);
        diagnostic.source = 'eoap-validator'; diagnostic.code = finding.rule_id;
        const group = grouped.get(target.uri.toString()) ?? { uri: target.uri, diagnostics: [] };
        if (!group.diagnostics.some(d => d.code === diagnostic.code && d.message === diagnostic.message && d.range.isEqual(diagnostic.range))) group.diagnostics.push(diagnostic);
        grouped.set(target.uri.toString(), group);
      } catch { /* A source can disappear while constructing diagnostics. */ }
    }
    if (token !== this.generation || this.disposed) return;
    this.diagnostics.clear();
    this.publishedCount = located;
    for (const group of grouped.values()) this.diagnostics.set(group.uri, group.diagnostics);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.generation++; this.controller?.abort(); clearTimeout(this.timer);
    this.fileWatchers.forEach(w => w.dispose());
    this.diagnostics.clear(); this.subscriptions.forEach(d => d.dispose());
  }
}
