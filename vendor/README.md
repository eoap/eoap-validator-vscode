# Bundled EOAP Validator

- Package: `eoap-validator` 0.2.0
- Artifact: `eoap_validator-0.2.0-py3-none-any.whl`
- Release: https://pypi.org/project/eoap-validator/0.2.0/
- Source: https://github.com/eoap/eoap-validator
- Retrieved with `task retrieve-validator` using `pip download` from PyPI.
- SHA-256: `6f6bbbf18c20fb33d6072d6da135ec4cb9a92237eb663c19596ad78c6a4735fa`
- License and attribution extracted from the wheel: `EOAP-VALIDATOR-LICENSE`, `EOAP-VALIDATOR-NOTICE`.

The extension installs this bundled official PyPI wheel. Transitive Python
requirements are resolved by pip on first use. They and Python itself are not
included in this directory.

The release and expected checksum are pinned in `validator.json`. To upgrade,
update that file using the release's published SHA-256, run
`task retrieve-validator`, and check CLI/report compatibility with `task`.
