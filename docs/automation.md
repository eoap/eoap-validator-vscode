# Revalidate on save and adjust the failure threshold

Open workspace Settings JSON and add:

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

Save the settings, then run **EOAP validation** on your package to start a
session. Edit and save a tracked source to refresh its findings.

See [Validation lifecycle](lifecycle.md) for dependency-tracking limits.
