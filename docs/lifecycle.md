# Validation lifecycle

## Saved sources and active sessions

Validation uses saved sources. The extension prompts to save modified tracked
files before running; declining stops that run. Each command invocation replaces
the previous session and clears its diagnostics, even if the new workflow picker
is subsequently cancelled.

Tracked edits and filesystem changes invalidate results and clear diagnostics.
Replacement validation cancels the previous process; late results cannot
overwrite newer diagnostics. POSIX cancellation includes the process group, while
Windows terminates the direct process.

When enabled, validation on save waits 300 milliseconds after a tracked save
before refreshing the current session. It reuses the selected workflow ID and
reads settings again for the root file. It does not automatically select a
package or track every CWL file in the workspace.

## Dependency tracking

The root CWL file, configured staging file and local dependencies reported by the
validator are tracked. After an operational failure, previously tracked
dependencies are retained so saving a repaired source can trigger validation.

The dependency manifest may omit imports/includes. Manually revalidate after
changing unreported sources. Newly discovered dependencies lack a pre-run digest,
so concurrent external edits cannot always be detected. Detected changes during
a run suppress publication of diagnostics; save and validate again. Dirty sources
do not receive diagnostics.

## Diagnostic locations

Diagnostic positions normally use the validator's original source locations,
with one-based Python code-point columns converted to VS Code UTF-16 positions.
Local report paths are mapped back to the workspace host for remote editors.
Findings without usable local locations remain in Output alongside the full
report.

For a missing required document metadata field reported by `TM.METADATA.MODEL`,
the extension can anchor the diagnostic at an existing document-level schema.org
metadata key. The message names the missing field and explains the anchor.
This handles namespace prefixes declared for `https://schema.org/` and full
schema.org property URIs. Existing fields, nested metadata errors, documents
with `@context`, and documents without a suitable metadata key retain the
validator's original location handling.

## Verification scope

Node tests use a VS Code API double for extension interactions and also cover
process execution, report parsing, managed installation, workflow selection and
metadata locations. Interactive desktop and remote-host testing remain separate
acceptance checks.
