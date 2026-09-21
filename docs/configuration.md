# Configure the validator environment

Set `eoapValidator.executable` to the absolute path to your environment's
`eoap-validator` executable. Alternatively, choose its Python executable and set
`eoapValidator.arguments` to `["-m", "eoap_validator"]`.

In Remote SSH, WSL and Dev Containers, these paths refer to the workspace host.
By default, leave `eoapValidator.executable` empty. The extension creates a private
virtual environment in its VS Code storage and installs `eoap-validator==0.1.0`
with pip on first validation. Python 3.10+ with venv and pip is required. Set
`eoapValidator.pythonExecutable` to choose Python; otherwise it uses `python3`
(`python` on Windows). Installation needs access to your configured pip index.
The VSIX does not contain Python or wheels. Subsequent runs reuse the environment.

Output → EOAP Validator shows setup progress and errors. Cancel interrupts setup;
retry by validating again. Each setup command times out after ten minutes.
A nonempty custom executable bypasses installation; `arguments` applies only to
that executable. In remote workspaces, installation takes place on the remote host.

Set `eoapValidator.validateOnSave` to true for automatic refresh on tracked document
saves. With multiple workflows, select the entrypoint in the panel first. The
reported dependency manifest is partial: manually refresh after edits to imports
or includes absent from the report.

For staging checks, enable `eoap-staging` in `eoapValidator.profiles` and point
`eoapValidator.stagingFile` to the applicability JSON. Relative paths are resolved
against the root CWL directory. Open Output → EOAP Validator if execution fails.
