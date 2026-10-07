"""Retrieve the pinned official wheel and refresh its bundled attribution."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

vendor = Path(__file__).resolve().parents[1] / "vendor"
config = json.loads((vendor / "validator.json").read_text())
version = config["version"]
filename = config["filename"]
requirement = f"eoap-validator=={version}"

with tempfile.TemporaryDirectory(prefix="eoap-wheel-") as temporary:
    subprocess.run(
        [sys.executable, "-m", "pip", "download", "--no-deps",
         "--only-binary=:all:", "--index-url", "https://pypi.org/simple",
         "--dest", temporary, requirement],
        check=True,
    )
    wheel = Path(temporary) / filename
    content = wheel.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    if digest != config["sha256"]:
        raise SystemExit(f"Wheel SHA-256 mismatch: expected {config['sha256']}, got {digest}")
    with zipfile.ZipFile(wheel) as archive:
        prefix = f"eoap_validator-{version}.dist-info/licenses/"
        license_text = archive.read(prefix + "LICENSE")
        notice = archive.read(prefix + "NOTICE")
    (vendor / filename).write_bytes(content)
    (vendor / "EOAP-VALIDATOR-LICENSE").write_bytes(license_text)
    (vendor / "EOAP-VALIDATOR-NOTICE").write_bytes(notice)
    (vendor / "README.md").write_text(
        f"""# Bundled EOAP Validator

- Package: `eoap-validator` {version}
- Artifact: `{filename}`
- Release: https://pypi.org/project/eoap-validator/{version}/
- Source: https://github.com/eoap/eoap-validator
- Retrieved with `task retrieve-validator` using `pip download` from PyPI.
- SHA-256: `{digest}`
- License and attribution extracted from the wheel: `EOAP-VALIDATOR-LICENSE`, `EOAP-VALIDATOR-NOTICE`.

The extension installs this bundled official PyPI wheel. Transitive Python
requirements are resolved by pip on first use. They and Python itself are not
included in this directory.

The release and expected checksum are pinned in `validator.json`. To upgrade,
update that file using the release's published SHA-256, run
`task retrieve-validator`, and check CLI/report compatibility with `task`.
""",
        encoding="utf-8",
    )
print(f"Bundled {requirement} ({digest})")
