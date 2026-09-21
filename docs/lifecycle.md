# Validation lifecycle

Each refresh starts a new Python CLI process. A monotonically increasing request
number prevents older results or navigation messages from acting on newer state.
Cancellation kills the active invocation; POSIX descendants are included through
a process group. Windows kills only the direct process.

Reports are saved-source observations. Edits and filesystem changes invalidate
results and clear Problems. Source navigation also checks file digests and dirty
editor state, and converts Python's code-point columns into UTF-16 columns.
A newly discovered dependency has no pre-run digest, and the validator does not
provide snapshot-isolated input reads. Revalidate when concurrent external edits
are possible. Local reported dependencies are tracked; the report explicitly does
not claim to list all imported or included files.

The webview uses a nonce CSP and textContent for report data. The host resolves
navigation only through a finding index in the current report. No arbitrary
webview-provided filesystem path or command URI is executed. Workspace trust is
required for launching the configured executable.

Automated tests exercise subprocess behavior and extension-host interactions
using a VS Code API double. These tests do not replace an interactive desktop or
remote-host acceptance test.
