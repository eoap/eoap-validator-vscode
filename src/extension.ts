import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { actionable, Finding, localPath, Report, utf16Column } from './report';
import { runValidator } from './runner';
import { ValidatorEnvironment } from './environment';

function digest(uri: vscode.Uri): string {
  return createHash('sha256').update(readFileSync(uri.fsPath)).digest('hex');
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('EOAP Validator');
  const environment = new ValidatorEnvironment(context.globalStorageUri.fsPath);
  const diagnostics = vscode.languages.createDiagnosticCollection('eoap-validator');
  let active: ValidationPanel | undefined;
  context.subscriptions.push(output, diagnostics, vscode.commands.registerCommand('eoapValidator.validate', () => {
    if (!vscode.workspace.isTrusted) { void vscode.window.showWarningMessage('Trust this workspace before running EOAP Validator.'); return; }
    const document = vscode.window.activeTextEditor?.document;
    if (!document || !['file', 'vscode-remote'].includes(document.uri.scheme) || !document.uri.path.toLowerCase().endsWith('.cwl')) {
      void vscode.window.showWarningMessage('Open a CWL file in the workspace first.'); return;
    }
    if (active && !active.isDisposed && active.root.toString() === document.uri.toString()) { active.reveal(); void active.validate(); return; }
    active?.dispose();
    active = new ValidationPanel(context, document.uri, output, diagnostics, environment);
  }), { dispose: () => active?.dispose() });
}

class ValidationPanel implements vscode.Disposable {
  private readonly panel: vscode.WebviewPanel;
  private readonly subscriptions: vscode.Disposable[] = [];
  private controller?: AbortController;
  private generation = 0;
  private entrypoint = '';
  private report?: Report;
  private stale = true;
  private disposed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private watched = new Map<string, vscode.Uri>();
  private fileWatchers: vscode.Disposable[] = [];
  private snapshots = new Map<string, string>();
  private changes = new Set<string>();
  private state: Record<string, unknown> = { type: 'state', message: 'Preparing validation…', running: false };

  constructor(context: vscode.ExtensionContext, readonly root: vscode.Uri,
    private output: vscode.OutputChannel, private diagnostics: vscode.DiagnosticCollection, private environment: ValidatorEnvironment) {
    this.watched.set(root.toString(), root);
    this.panel = vscode.window.createWebviewPanel('eoapValidator', `EOAP: ${path.basename(root.fsPath)}`, vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] });
    const nonce = randomBytes(24).toString('hex');
    this.panel.webview.html = readFileSync(vscode.Uri.joinPath(context.extensionUri, 'media', 'report.html').fsPath, 'utf8')
      .replaceAll('__NONCE__', nonce);
    this.watchFiles();
    this.subscriptions.push(this.panel.onDidDispose(() => this.dispose()), this.panel.webview.onDidReceiveMessage((data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const m = data as Record<string, unknown>;
      if (m.type === 'ready') { this.send(this.state); if (!this.report && !this.controller) void this.validate(); }
      if (m.type === 'validate' && typeof m.entrypoint === 'string' && m.entrypoint.length <= 1024 && !/[\r\n#]/.test(m.entrypoint)) {
        this.entrypoint = m.entrypoint.trim(); void this.validate();
      }
      if (m.type === 'cancel') this.invalidate('Validation cancelled.');
      if (m.type === 'navigate' && m.generation === this.generation && Number.isInteger(m.index)) void this.navigate(m.index as number);
    }), vscode.workspace.onDidChangeTextDocument(event => {
      if (!event.contentChanges.length) return;
      this.changes.add(event.document.uri.toString());
      if (this.watched.has(event.document.uri.toString())) this.invalidate('Source changed. Save and validate to refresh findings.');
    }), vscode.workspace.onDidSaveTextDocument(document => {
      if (this.watched.has(document.uri.toString()) && this.config().get<boolean>('validateOnSave', false)) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.validate(), 300);
      }
    }));
  }

  private config(): vscode.WorkspaceConfiguration { return vscode.workspace.getConfiguration('eoapValidator', this.root); }
  get isDisposed(): boolean { return this.disposed; }
  reveal(): void { this.panel.reveal(vscode.ViewColumn.Beside); }
  private send(state: Record<string, unknown>): void {
    this.state = { ...state, type: 'state', root: this.root.fsPath, entrypoint: this.entrypoint, generation: this.generation };
    if (!this.disposed) void this.panel.webview.postMessage(this.state);
  }
  private invalidate(reason: string): void {
    this.generation++;
    this.controller?.abort(); this.controller = undefined;
    this.stale = true; this.diagnostics.clear();
    this.send({ report: this.report, stale: true, running: false, message: reason });
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
    for (const document of dirty) if (!await document.save()) return false;
    return true;
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
    this.send({ report: this.report, stale: true, running: true, message: 'Validating saved application package…' });
    this.output.appendLine(`Validating ${this.root.fsPath}${this.entrypoint ? '#' + this.entrypoint : ''}`);
    try {
      let executable = config.get<string>('executable', '').trim();
      let prefixArgs = config.get<string[]>('arguments', []);
      if (!executable) {
        this.send({ report: this.report, stale: true, running: true, message: 'Preparing eoap-validator 0.1.0 (first use installs dependencies)…' });
        executable = await this.environment.ensure(
          config.get<string>('pythonExecutable', '').trim() || (process.platform === 'win32' ? 'python' : 'python3'),
          { signal: controller.signal, log: text => this.output.append(text) });
        prefixArgs = ['-m', 'eoap_validator'];
      }
      if (token !== this.generation || this.disposed || controller.signal.aborted) return;
      this.send({ report: this.report, stale: true, running: true, message: 'Validating saved application package…' });
      const report = await runValidator({
        executable, prefixArgs,
        filename: this.root.fsPath, entrypoint: this.entrypoint, profiles: config.get<string[]>('profiles', ['eoap-package', 'metadata']),
        stagingFile, failOn: config.get<string>('failOn', 'error'), cwd: path.dirname(this.root.fsPath),
        timeoutMs: Math.min(3600, Math.max(1, config.get<number>('timeoutSeconds', 120))) * 1000,
        signal: controller.signal, onStderr: text => this.output.append(text),
      });
      if (token !== this.generation || this.disposed) return;
      this.report = report;
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
      this.stale = changed;
      if (changed) { this.send({ report, stale: true, running: false, message: 'Sources changed during validation. Validate again.' }); return; }
      await this.publishDiagnostics(report, token);
      if (token !== this.generation || this.disposed) return;
      this.send({ report, stale: false, running: false, message: report.exit_code === 0 ? 'Assessment completed below the failure threshold.' : report.exit_code === 1 ? 'Validation findings exceed the failure threshold.' : 'Assessment incomplete. Review operational findings.' });
    } catch (error) {
      if (token === this.generation && !this.disposed) this.send({ report: this.report, stale: true, running: false, message: message(error) });
    } finally { if (this.controller === controller) this.controller = undefined; }
  }

  private async findingRange(finding: Finding): Promise<{ uri: vscode.Uri; range: vscode.Range } | undefined> {
    const uri = this.editorUri(finding.location.uri);
    if (!uri || !this.watched.has(uri.toString()) || finding.location.line === null) return undefined;
    if (!this.snapshots.has(uri.toString()) || digest(uri) !== this.snapshots.get(uri.toString())) return undefined;
    const document = await vscode.workspace.openTextDocument(uri);
    if (document.isDirty) return undefined;
    const line = finding.location.line - 1;
    if (line < 0 || line >= document.lineCount) return undefined;
    const text = document.lineAt(line).text;
    const column = utf16Column(text, finding.location.column ?? 1);
    return { uri, range: new vscode.Range(line, column, line, Math.min(text.length, column + 1)) };
  }
  private async publishDiagnostics(report: Report, token: number): Promise<void> {
    const grouped = new Map<string, { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }>();
    for (const finding of report.findings.filter(actionable)) {
      try {
        const target = await this.findingRange(finding); if (!target) continue;
        const severity = finding.severity === 'error' ? vscode.DiagnosticSeverity.Error : finding.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
        const diagnostic = new vscode.Diagnostic(target.range, `${finding.message}${finding.suggestion ? '\n' + finding.suggestion : ''}`, severity);
        diagnostic.source = 'eoap-validator'; diagnostic.code = finding.rule_id;
        const group = grouped.get(target.uri.toString()) ?? { uri: target.uri, diagnostics: [] };
        if (!group.diagnostics.some(d => d.code === diagnostic.code && d.message === diagnostic.message && d.range.isEqual(diagnostic.range))) group.diagnostics.push(diagnostic);
        grouped.set(target.uri.toString(), group);
      } catch { /* A source can disappear while constructing diagnostics. */ }
    }
    if (token !== this.generation || this.disposed) return;
    this.diagnostics.clear();
    for (const group of grouped.values()) this.diagnostics.set(group.uri, group.diagnostics);
  }
  private async navigate(index: number): Promise<void> {
    if (this.stale || !this.report || index < 0 || index >= this.report.findings.length) return;
    const token = this.generation;
    try {
      const target = await this.findingRange(this.report.findings[index]);
      if (token !== this.generation || this.disposed) return;
      if (!target) { void vscode.window.showInformationMessage('Source navigation is unavailable or stale. Save sources and validate again.'); return; }
      const editor = await vscode.window.showTextDocument(target.uri, { viewColumn: vscode.ViewColumn.One });
      editor.selection = new vscode.Selection(target.range.start, target.range.end);
      editor.revealRange(target.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } catch (error) { void vscode.window.showWarningMessage(message(error)); }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.generation++; this.controller?.abort(); clearTimeout(this.timer);
    this.fileWatchers.forEach(w => w.dispose());
    this.diagnostics.clear(); this.subscriptions.forEach(d => d.dispose()); this.panel.dispose();
  }
}
