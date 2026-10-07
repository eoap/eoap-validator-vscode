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

The extension bundles eoap-validator 0.2.0 and installs it in private extension
storage on first use. You can also configure an existing validator executable.
Remote SSH, WSL and Dev Containers use Python and paths on the workspace host.
Browser-only and virtual workspaces are unsupported.

## Tutorials

Learn through a complete exercise: [Validate your first package](tutorial.md).

## How-to guides

Follow a guide for a specific task:

- [Build and install a VSIX](build.md).
- [Choose a validator environment](configuration.md).
- [Enable staging checks](staging.md).
- [Revalidate on save and adjust the failure threshold](automation.md).
- [Troubleshoot validation](troubleshooting.md).

## Reference

Look up [commands, settings and the report contract](reference.md).

## Explanation

Understand the [validation lifecycle](lifecycle.md), including saved sources,
dependency tracking and diagnostic locations.
