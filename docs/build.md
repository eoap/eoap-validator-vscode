# Build and install a VSIX

## Install from a GitHub release

On Linux or macOS, download the release asset and install the local file:

```sh
curl -fL -o /tmp/eoap-validator-vscode-0.2.0.vsix \
  https://github.com/eoap/eoap-validator-vscode/releases/download/0.2.0/eoap-validator-vscode-0.2.0.vsix &&
code --install-extension /tmp/eoap-validator-vscode-0.2.0.vsix
```

`code --install-extension` takes a local VSIX path. Download the file first;
passing the GitHub release URL directly is not supported by the documented CLI.
The `&&` runs installation only after a successful download.

On any supported desktop platform, you can also download the VSIX from the
[release page](https://github.com/eoap/eoap-validator-vscode/releases/tag/0.2.0)
and select **Extensions: Install from VSIX...** in the Command Palette.

## Build from source

To build the extension from a source checkout, install Node.js
22 or newer and npm, then run from the repository root:

```sh
npm ci
npm run package
code --install-extension eoap-validator-vscode-0.2.0.vsix
```

The package command compiles, lints, runs tests and produces the VSIX. To run
checks without packaging, use `npm run check`.

For a downloaded VSIX, run `code --install-extension /path/to/extension.vsix`,
or select **Extensions: Install from VSIX...** in the Command Palette.

In Remote SSH, WSL or a Dev Container, install the extension on the workspace
host. Validation also requires Python there; see
[Choose a validator environment](configuration.md).
