# EOAP Validator for VS Code

Validate a saved CWL EO Application Package, review the report beside your source,
and navigate to findings in the editor or Problems panel. This companion extension
invokes the standalone **eoap-validator** Python CLI; it does not execute workflows.

The project follows cwl-metadata-editor's TypeScript extension, themed webview,
command/menu integration, Node tests and VSIX packaging structure.

## Install and use

1. Install Python 3.10 or newer with `venv` and `pip` on your workspace host.
   On first validation, the extension creates a private virtual environment and
   installs `eoap-validator==0.1.0` and its dependencies automatically.
2. Build/install the extension:

   ```sh
   npm ci
   npm run package
   code --install-extension eoap-validator-vscode-0.1.0.vsix
   ```

3. Open a `.cwl` file in a trusted workspace and run **EOAP: Validate Application Package**.
4. If the package has multiple workflows, enter the workflow ID in the panel and
   select **Validate**. The extension passes `workflow.cwl#<id>` to the CLI.
   Leave the ID empty for the validator's automatic single-workflow selection.
5. Review findings in the panel or Problems. **Go to source** opens a locally
   available source position. Findings without source positions remain visible
   in the panel; no line numbers are invented.

The panel remains bound to the file it was opened for. Running the command on
another CWL file replaces that panel. The default profiles are `eoap-package`
and `metadata`; change profiles through VS Code settings.

## Configure the executable

Leave `eoapValidator.executable` empty to use automatic installation. The extension
uses `python3` (`python` on Windows); set `eoapValidator.pythonExecutable` to an
absolute Python path if needed. The environment lives in VS Code extension storage
under `validator-0.1.0` and is reused after checking the installed version.
Installation needs network access to your configured pip index; packages are not
embedded in the VSIX. Each setup command has a ten-minute timeout. Cancel stops
setup; another validation retries it. See **Output → EOAP Validator** for progress
and installation errors.

To use an existing installation instead, set a custom executable:

```json
{
  "eoapValidator.executable": "/path/to/venv/bin/eoap-validator"
}
```

Or use a Python executable with separate arguments:

```json
{
  "eoapValidator.executable": "/path/to/venv/bin/python",
  "eoapValidator.arguments": ["-m", "eoap_validator"],
  "eoapValidator.profiles": ["eoap-package", "metadata"],
  "eoapValidator.validateOnSave": true
}
```

Do not put a shell command into the executable setting. Arguments and source URIs
are passed separately without shell expansion. Relative staging paths resolve
against the root CWL's directory:

```json
{
  "eoapValidator.profiles": ["eoap-package", "metadata", "eoap-staging"],
  "eoapValidator.stagingFile": "staging.json",
  "eoapValidator.failOn": "warning",
  "eoapValidator.timeoutSeconds": 120
}
```

## Reports, saves and cancellation

- Exit codes 0, 1 and 2 all display valid JSON reports. Validation failure is not
  mistaken for failure to launch the executable.
- Successful checks are available under **All checks** and never create Problems.
- Failed, review and blocked findings with usable source locations create Problems.
- Editing a tracked source clears diagnostics and marks the report stale. Saving
  tracked documents can trigger validation when `validateOnSave` is enabled.
- Filesystem changes invalidate existing results. The validator reports only a
  partial dependency manifest: changes to unreported `$include`/`$import` sources
  may require a manual refresh. It does not provide snapshot-isolated reads.
- Navigation verifies the file digest and dirty-editor state. Python code-point
  columns are converted to VS Code UTF-16 columns.
- **Cancel**, a replacement run, or closing the panel terminates the active
  invocation; late results cannot overwrite a newer report. Timeouts default to
  120 seconds. On Windows cancellation terminates the direct validator process;
  descendant-process cleanup is not guaranteed.
- Diagnostics and navigation to remote HTTP/OCI source documents are unavailable;
  their findings are still shown as text.
- Open **Output → EOAP Validator** for launch and parser diagnostics.

## Remote workspaces and trust

The extension runs on the workspace host (Remote SSH, WSL or Dev Containers).
Install Python there; the extension installs the validator there automatically.
Configure executable paths for that host. File URIs in
reports map back to the remote workspace authority. The extension requires a
trusted workspace and does not support browser-only or virtual workspaces.
No workflow or image execution is requested, but resolving CWL/schema references
may use the network through the validator.

## Development

```sh
npm ci
npm run check
npm run package
```

`media/report.html` is a static, nonce-protected webview. Report content is inserted
using text nodes; reports cannot inject HTML, scripts or navigation commands.
The host accepts only current-report finding indices, never arbitrary URLs from
the webview. `schemas/report.json` is the bundled JSON representation of
`../eoap-validator/schemas/report.yaml` (schema 1.0). Update it when the report
contract changes. Tests cover the runner, report contract and UI safety properties;
a real VS Code/remote-host smoke test is still recommended before publication.
