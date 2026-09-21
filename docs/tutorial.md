# Validate a package

Install Python 3.10+ with venv and pip and this extension on your workspace host.
The first validation automatically installs `eoap-validator==0.1.0` and its
dependencies in a private environment.
Open a CWL file, then choose **EOAP: Validate Application Package** from the command
palette or editor title. A report panel opens beside the file.

If multiple workflows exist, type the workflow ID in the panel and select
**Validate**. Enter `main`, not `#main`; the extension constructs the source fragment.
The default profile selection checks EOAP packaging and software metadata.

Review **Issues and review findings** first. **All checks** includes successful
checks, which are informational. Select **Go to source** to open a located finding.
Edit the CWL, save and validate again. The panel remains pinned to the original
package while you inspect referenced tools. Use the command on a different file
to switch packages.
