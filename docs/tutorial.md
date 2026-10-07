# Validate your first package

In this tutorial, you will create a small CWL package, validate it, introduce a
missing-field finding and fix it. You will see how source diagnostics change
when you save and revalidate.

## Before you start

Use VS Code 1.95 or newer with the extension installed, Python 3.10+ with `venv`
and `pip` on the workspace host, and access to your configured pip index.
If you need to install the extension, follow [Build and install a VSIX](build.md).

Open a folder in VS Code and trust the workspace. For this exercise, open
workspace Settings JSON and use only the package profile:

```json
{
  "eoapValidator.profiles": ["eoap-package"]
}
```

This lets you explore package checks without adding Transpiler-Mate metadata.

## Create a package

Create `hello.cwl` in the folder and save this content:

```yaml
cwlVersion: v1.2
class: Workflow
id: main
label: Hello package
doc: A small workflow for learning validation.
inputs: []
outputs: []
steps: []
```

## Run validation

Right-click `hello.cwl` in Explorer and choose **EOAP validation**. This document
has one workflow, so no workflow selection is needed. If prompted, choose
**Save and validate**.

On first use, wait for the managed validator environment to be prepared. Open
**View → Output**, select **EOAP Validator**, and inspect the result. The report
identifies the selected workflow and its findings. The validator does not run
this workflow.

## Introduce and fix a finding

Remove the `label` line, save the file and run **EOAP validation** again. Open
**View → Problems** and find the missing-label finding. Select it to navigate to
its source location; hover its underline to read the message. The full report
remains available in Output.

Restore `label: Hello package`, save, and run the command again. Check that the
missing-label finding is gone. Editing a tracked source clears its previous
diagnostics until you validate again.

## Continue with your own package

You have completed the create, validate and repair cycle. Repeat it with a saved
CWL package of your own. If its root document has multiple workflows, select an
ID when prompted.

To return to the extension's default profiles, remove the `profiles` override.
Then use the [how-to guides](index.md#how-to-guides) for staging checks,
automatic revalidation or a different Python environment. See
[Validation lifecycle](lifecycle.md) to understand how results stay current.
