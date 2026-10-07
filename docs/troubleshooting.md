# Troubleshoot validation

Open **View → Output** and select **EOAP Validator** to inspect setup errors,
validator stderr and the complete JSON report. Use the following table to choose
your next action.

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
