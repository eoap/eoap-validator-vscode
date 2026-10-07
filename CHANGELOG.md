# Changelog

## [0.2.0] - 2026-10-07

- Audit dependencies in CI and upload the VSIX as a GitHub release asset when
  a release is published.

- Upgrade `@vscode/vsce` to 4.0.0 to remove the vulnerable packaging dependency
  chain; building now requires Node.js 22 or newer.

- Show missing required document metadata fields at the parsed metadata section
  with an explicit missing-field message instead of underlining `$graph`.

- Replace the report webview with CWL-only Explorer/editor context menus named
  **EOAP validation**, native workflow ID selection and source-line diagnostics.
- Bundle the official eoap-validator 0.2.0 PyPI wheel and its attribution files.
- Add `task retrieve-validator` with a pinned release/checksum configuration and
  isolate managed environments by artifact checksum.

## [0.1.0] - 2026-09-21

### Added

- Automatic first-use installation of `eoap-validator==0.1.0` in a private
  virtual environment, with configurable Python, cancellation and reuse.

- Standalone-validator integration with configurable executable, profiles, staging
  configuration, timeout and error/warning threshold.
- A themed report panel, Problems diagnostics and source navigation.
- Workflow fragment selection, optional save validation, stale-result protection,
  cancellation and remote-workspace URI mapping.
