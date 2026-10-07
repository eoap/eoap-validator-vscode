# Choose a validator environment

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

For setup failures, see [Troubleshoot validation](troubleshooting.md).
