# EOAP Validator for VS Code

Validate saved CWL EO Application Packages from VS Code. Right-click a `.cwl`
file in Explorer or the editor and choose **EOAP validation**. If the document
contains multiple root workflows, select the workflow ID from the picker.
The validator checks the package without executing its workflows.

Findings appear as source underlines and entries in **Problems**. Hover an
underline to read the rule message and any suggested fix. The full JSON report,
including findings without usable source positions, is available in
**Output → EOAP Validator**.

## Requirements

- VS Code 1.95 or newer with a trusted workspace.
- For the managed validator, Python 3.10+ with `venv` and `pip` on the workspace
  host, plus access to your configured pip index for first-use dependencies.
- A saved local or remote-workspace `.cwl` file.

The extension bundles eoap-validator 0.1.0 and installs it in private extension
storage on first use. You can also configure an existing validator executable.
Remote SSH, WSL and Dev Containers use Python and paths on the workspace host.
Browser-only and virtual workspaces are unsupported.

## Documentation

- [Tutorial](tutorial.md): install the extension and validate a package.
- [Configuration](configuration.md): choose Python, use an existing validator,
  enable save validation and troubleshoot setup.
- [Reference](reference.md): command, settings and report format.
- [Validation lifecycle](lifecycle.md): saved sources, diagnostic locations,
  cancellation and dependency tracking.
