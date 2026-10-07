# Validate a package

## Install

Use VS Code 1.95 or newer. For the default managed installation, make Python
3.10+ with `venv` and `pip` available on the workspace host. First-use setup
requires access to your configured pip index to download dependencies.

To build from a checkout, install Node.js and npm, then run from the repository
root:

```sh
npm ci
npm run package
code --install-extension eoap-validator-vscode-0.2.0.vsix
```

Alternatively, install an already-built VSIX with **Extensions: Install from
VSIX...** in the Command Palette. Open a trusted workspace containing your CWL
package. In Remote SSH, WSL or a Dev Container, install the extension on the
workspace host and make Python available there.

## Run validation

1. Right-click a `.cwl` file in Explorer or its editor and choose
   **EOAP validation**. You can also run the command from the Command Palette
   with the CWL file active.
2. If the root `$graph` contains multiple workflows, choose a workflow ID.
   Cancelling the picker stops validation. A single workflow uses the validator's
   automatic selection.
3. If prompted, choose **Save and validate** to save modified tracked files.
   Validation reads the files on disk.
4. On first use, wait for the bundled validator and its dependencies to install.
   Open **View → Output** and choose **EOAP Validator** to follow setup and
   validation output.

Multiple root workflows need distinct, nonempty IDs. Fix missing or duplicate
IDs before retrying if the picker cannot be shown.

## Review and fix findings

Open **View → Problems** to browse findings, or hover source underlines for the
rule message and any suggested fix. Each diagnostic includes its validator rule
ID. Findings without usable local positions remain in **Output → EOAP Validator**,
which also contains the complete JSON report.

A missing required document metadata field may be underlined at an existing
metadata key. The message explicitly identifies the missing field and explains
that it belongs at document level; the existing key is an anchor for the message.

Edit the package, save it and run **EOAP validation** again. Editing a tracked
source clears stale diagnostics. To refresh automatically on tracked saves,
enable `eoapValidator.validateOnSave`; first select a package with the command.
Use the command again to choose another workflow after changing the graph.

See [Configuration](configuration.md) for staging checks and setup troubleshooting,
and [Validation lifecycle](lifecycle.md) for dependency-tracking limits.
