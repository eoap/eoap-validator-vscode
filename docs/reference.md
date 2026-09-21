# Commands and settings

Command: **EOAP: Validate Application Package** (`eoapValidator.validate`).
Requires an active `.cwl` document in a trusted, local or remote workspace.

| Setting | Default |
| --- | --- |
| `eoapValidator.executable` | Empty: managed installation |
| `eoapValidator.pythonExecutable` | Empty: `python3`, or `python` on Windows |
| `eoapValidator.arguments` | `[]` |
| `eoapValidator.profiles` | `["eoap-package", "metadata"]` |
| `eoapValidator.stagingFile` | Empty |
| `eoapValidator.failOn` | `error` |
| `eoapValidator.validateOnSave` | `false` |
| `eoapValidator.timeoutSeconds` | `120` |

The subprocess receives `--format json` and a file URI with an optional workflow
fragment. Report schema 1.0 is validated against the bundled JSON Schema. Exit
codes 0, 1 and 2 are meaningful report outcomes. Other exit codes, malformed
reports, timeouts and launch failures are shown as execution errors.

The extension limits report stdout to 32 MiB and forwards up to approximately
1 MiB of stderr per run to its output channel. It never asks the validator to
execute the workflow. Nonlocal source findings remain visible without navigation.
