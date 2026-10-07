# EOAP Validator for VS Code

Right-click a `.cwl` file in Explorer or its editor and choose **EOAP validation**.
The extension opens the file and, if its `$graph` contains multiple workflows,
asks you to select a workflow ID using VS Code's native picker. Cancelling the
picker stops validation. Single-workflow documents use the validator's automatic
selection.

Validation issues appear as underlines in the source editor and entries in
**Problems**. Hover an underline for the rule message and suggested fix. Positions
come from the validator. Missing required document metadata fields are marked at
an existing metadata key, with an explicit explanation that the field is absent.
Other findings without usable local source positions are
reported in **Output → EOAP Validator**, alongside the full JSON report. There is
no custom report panel. The validator does not execute workflows.

## Install

Use VS Code 1.95 or newer. For the default managed validator, Python 3.10+
with `venv` and `pip` must be available on the workspace host.
The VSIX bundles `vendor/eoap_validator-0.2.0-py3-none-any.whl`, its license and
notice. On first use, the extension installs this wheel into private VS Code
extension storage. Its transitive Python dependencies are downloaded using your
configured pip index; Python and those dependencies are not bundled.

To build from a checkout, install Node.js 22 or newer and npm, then run:

```sh
npm ci
npm run package
code --install-extension eoap-validator-vscode-0.2.0.vsix
```

Use a trusted workspace. Remote SSH, WSL and Dev Containers run the extension and
Python on the workspace host. Browser-only and virtual workspaces are unsupported.

## Settings

| Setting | Default / purpose |
| --- | --- |
| `eoapValidator.executable` | Empty: install and use the bundled wheel |
| `eoapValidator.pythonExecutable` | Empty: `python3` on POSIX, `python` on Windows |
| `eoapValidator.arguments` | Prefix arguments for a custom executable only |
| `eoapValidator.profiles` | `["eoap-package", "metadata"]` |
| `eoapValidator.stagingFile` | Optional JSON path; requires `eoap-staging` profile |
| `eoapValidator.failOn` | `error`, or `warning` |
| `eoapValidator.validateOnSave` | `false`; enable to refresh the last selected package on tracked saves |
| `eoapValidator.timeoutSeconds` | `120` |

A custom executable bypasses managed installation. For example:

```json
{
  "eoapValidator.executable": "/path/to/venv/bin/python",
  "eoapValidator.arguments": ["-m", "eoap_validator"]
}
```

Arguments are passed without shell expansion. Relative staging paths resolve
against the root CWL directory. Setup commands time out after ten minutes.

## Validation lifecycle

Validation reads saved files; modified tracked files require saving first.
Edits and filesystem changes to tracked sources clear stale diagnostics. Running
validation again replaces the previous session and stops its active process.
Optional validation on save reuses the selected workflow ID; invoke the context
menu again to change it after modifying the workflow graph.

The validator's dependency manifest is partial. Changes to imports/includes not
reported as dependencies require manual revalidation. Concurrent changes to newly
discovered dependencies cannot always be detected. Nonlocal findings are retained
in Output. Python code-point columns are converted to VS Code UTF-16 positions.
Windows process termination covers the direct process; POSIX also terminates its
process group.

## Development

`npm run check` compiles, lints and runs the Node tests. `npm run package` also
builds the VSIX. Tests cover process execution, report schema validation, bundled
installation, workflow selection and extension interactions using a VS Code API
double. Interactive desktop and remote-host testing are separate checks.

`schemas/report.json` is the validator's report schema 1.0. See
[vendor/README.md](vendor/README.md) for the bundled official PyPI artifact's provenance.

Refresh the pinned wheel and its license/notice files with:

```sh
task retrieve-validator
# Override Python if needed (for example, on Windows):
task retrieve-validator PYTHON=python
```

The task uses `pip download --no-deps` from PyPI and verifies the SHA-256 pinned
in `vendor/validator.json` before replacing the bundled files. To upgrade, update
the version, filename and published checksum in that file, retrieve the wheel,
and run `task` to check the extension. Managed environments are keyed by version
and checksum so a refreshed artifact gets a fresh environment.

## Documentation

Start with the [tutorial](docs/tutorial.md), then see
[configuration and troubleshooting](docs/configuration.md), the complete
[command and settings reference](docs/reference.md), and the
[validation lifecycle](docs/lifecycle.md).

To preview the documentation site in a separate Python environment:

```sh
python3 -m venv build/docs-venv
build/docs-venv/bin/python -m pip install -r requirements-docs.txt
build/docs-venv/bin/python -m mkdocs serve
```

On Windows, use `build\docs-venv\Scripts\python.exe`. To check the site without serving
it, run the same Python executable with `-m mkdocs build --strict --site-dir build/docs`.
