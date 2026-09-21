# Changelog

## Unreleased

- Show missing required document metadata fields at the parsed metadata section
  with an explicit missing-field message instead of underlining `$graph`.

- Replace the report webview with CWL-only Explorer/editor context menus named
  **EOAP validation**, native workflow ID selection and source-line diagnostics.
- Bundle eoap-validator 0.1.0 as a licensed wheel in `vendor` and install from it.

## [0.1.0] - 2026-09-21

### Added

- Automatic first-use installation of `eoap-validator==0.1.0` in a private
  virtual environment, with configurable Python, cancellation and reuse.

- Standalone-validator integration with configurable executable, profiles, staging
  configuration, timeout and error/warning threshold.
- A themed report panel, Problems diagnostics and source navigation.
- Workflow fragment selection, optional save validation, stale-result protection,
  cancellation and remote-workspace URI mapping.
