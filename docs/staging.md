# Enable staging checks

Use this guide when you have a staging applicability JSON file for your package.

Open workspace Settings JSON and add:

Add `eoap-staging` to the profiles and supply a staging JSON file:

```json
{
  "eoapValidator.profiles": ["eoap-package", "metadata", "eoap-staging"],
  "eoapValidator.stagingFile": "staging.json"
}
```

Relative staging paths resolve against the root CWL file's directory. Absolute
paths are also accepted. A staging file configured without the `eoap-staging`
profile prevents validation.

Save the settings and run **EOAP validation** on the root CWL file. Review the
report in **Output → EOAP Validator** for staging findings and coverage.

For profile defaults and accepted values, see [Reference](reference.md).
