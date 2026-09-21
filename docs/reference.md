# Commands and settings

## Command

**EOAP validation** (`eoapValidator.validate`) is available from the context menu
of `.cwl` files in Explorer and the editor. Explorer folders are excluded. The
Command Palette uses the active CWL editor. A trusted workspace is required.

The command opens the selected file. If its root `$graph` contains multiple
workflows, a native picker lists their IDs with any leading `#` removed.
Cancelling the picker stops validation. Single-workflow documents use automatic
selection. Only one package validation session is active at a time.

## Settings

All settings use the `eoapValidator.` prefix.

| Setting | Default | Values and behavior |
| --- | --- | --- |
| `executable` | `""` | Empty uses the bundled validator in managed storage; otherwise starts the specified executable. |
| `pythonExecutable` | `""` | Python 3.10+ used to create the managed environment. Empty selects `python3` on POSIX or `python` on Windows. |
| `arguments` | `[]` | Array of prefix argument strings for a custom executable; ignored in managed mode. |
| `profiles` | `["eoap-package", "metadata"]` | Nonempty array of unique profiles: `eoap-package`, `eoap-staging`, `metadata`. |
| `stagingFile` | `""` | Optional staging JSON path, absolute or relative to the root CWL directory; requires `eoap-staging`. |
| `failOn` | `"error"` | `error` or `warning`; determines validation failure, not which findings are displayed. |
| `validateOnSave` | `false` | Revalidates the last selected package on tracked saves, reusing its selected workflow ID. |
| `timeoutSeconds` | `120` | Integer from 1 to 3600; limits validator execution, excluding managed setup. |

See [Configuration](configuration.md) for examples and troubleshooting.

## Validator invocation and reports

The subprocess runs in the root CWL directory with separate arguments and no
shell. After any custom prefix arguments, it receives:

```text
--profile <profile> [--profile <profile> ...] --fail-on <threshold> --format json [--staging <absolute-path>] -- <file-uri>[#<encoded-workflow-id>]
```

Reports are checked against the bundled JSON schema and must declare schema
version `1.0`. Exit codes 0, 1 and 2 are accepted report outcomes only when the
report's `exit_code` matches the process status. Other codes, invalid JSON,
schema failures and mismatched statuses are execution errors.

Full reports and stderr are written to **Output → EOAP Validator**. Stdout is
limited to 32 MiB; approximately 1 MiB of stderr is forwarded per run.

Findings with status `failed`, `needs-review` or `blocked` are considered issues.
Findings marked `passed` or `not-applicable` do not produce diagnostics. Located
issues use their report severity (`error`, `warning` or `info`) and rule ID.
Duplicate diagnostics with the same location, rule and message are collapsed.
The completion notification counts report issues, so its count can exceed the
number of distinct entries in Problems.
