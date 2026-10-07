# Configure the validator

Set options in VS Code Settings by searching for `eoapValidator`, or edit your
user or workspace `settings.json`. Settings are read for the selected root CWL
file. See [Reference](reference.md) for all defaults and allowed values.

## Managed installation

Leave `eoapValidator.executable` empty to use the bundled eoap-validator 0.2.0
wheel. The extension installs it into a private virtual environment in VS Code
extension storage on first validation, then checks and reuses that environment.
Python itself is not bundled.

Python 3.10+ with `venv` and `pip` is required. The default executable is `python3`
on POSIX and `python` on Windows. To choose a Python executable for setup:

```json
{
  "eoapValidator.pythonExecutable": "/usr/bin/python3"
}
```

This setting is used when creating or repairing the managed environment; changing
it does not replace an existing healthy environment. `eoapValidator.arguments`
is ignored in managed mode.

The validator wheel is bundled, but its transitive dependencies are downloaded
through your configured pip index. Each setup command has a ten-minute timeout,
separate from `eoapValidator.timeoutSeconds`.

## Existing validator

Set an executable to bypass managed setup. For an existing Python environment:

```json
{
  "eoapValidator.executable": "/path/to/venv/bin/python",
  "eoapValidator.arguments": ["-m", "eoap_validator"]
}
```

On Windows, use a path such as `C:\venvs\eoap\Scripts\python.exe`, escaping
backslashes as `\\` in JSON. You can also point `eoapValidator.executable` directly
to the validator CLI and leave `eoapValidator.arguments` empty.

The executable must support the validator's CLI arguments and JSON report schema
1.0. Arguments are separate strings passed without a shell; shell expansion,
redirection and command chaining are unavailable. Paths and executables refer to
the workspace host, including in remote workspaces.

## Staging checks

Add `eoap-staging` to the profiles and supply a staging JSON file:

```json
{
  "eoapValidator.profiles": ["eoap-package", "metadata", "eoap-staging"],
  "eoapValidator.stagingFile": "staging.json"
}
```

Relative staging paths resolve against the root CWL file's directory. Absolute
paths are also accepted. A staging file configured without the `eoap-staging`
profile prevents validation.

## Validation on save and failure threshold

```json
{
  "eoapValidator.validateOnSave": true,
  "eoapValidator.failOn": "warning",
  "eoapValidator.timeoutSeconds": 120
}
```

Validation on save refreshes the last selected package when its root, a tracked
local dependency or its staging file is saved. It does not start a session until
you run **EOAP validation**. The selected workflow ID is reused; run the command
again to select another workflow.

`failOn` controls the validator's failure threshold. It does not hide findings of
other severities. The timeout applies to each validator run and accepts 1–3600
seconds.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Python cannot start or setup fails | Check Python 3.10+, `venv` and `pip` on the workspace host; set `pythonExecutable` if needed. Read setup output in **Output → EOAP Validator**. |
| Dependency download fails | Check the workspace host's network access and pip index configuration, then run validation again. |
| Custom validator cannot start | Check `executable`, its permissions and separate prefix `arguments`. |
| Multiple workflows cannot be selected | Give each root workflow a distinct, nonempty ID. |
| No source underline for a reported issue | Check the full report in Output. Some findings lack usable local source positions. |
| Findings disappear after an edit | Save and revalidate, or enable validation on save. Stale diagnostics are cleared when tracked sources change. |
| Validation times out | Increase `timeoutSeconds` within its allowed range if the package needs more time. |
| The command does nothing | Use a saved `.cwl` file in a trusted local or remote workspace; the Command Palette requires an active CWL editor. |
