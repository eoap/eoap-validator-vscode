const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../package.json');
const artifact = require('../vendor/validator.json');
const { createHash } = require('node:crypto');

test('bundled official wheel matches the pinned checksum', () => {
  const wheel = fs.readFileSync(path.join(__dirname, '../vendor', artifact.filename));
  assert.equal(createHash('sha256').update(wheel).digest('hex'), artifact.sha256);
});

test('extension runs alongside files on a trusted workspace host', () => {
  assert.deepEqual(manifest.extensionKind,['workspace']);
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported,false);
  assert.equal(manifest.contributes.commands[0].command,'eoapValidator.validate');
});
test('CWL-only editor and Explorer menus replace the custom UI', () => {
  assert.equal(manifest.contributes.commands[0].title, 'EOAP validation');
  assert.equal(manifest.contributes.menus['editor/title'], undefined);
  for (const menu of ['editor/context','explorer/context']) {
    assert.match(manifest.contributes.menus[menu][0].when, /resourceExtname == \.cwl/);
  }
  assert.match(manifest.contributes.menus['explorer/context'][0].when, /!explorerResourceIsFolder/);
  assert.ok(!fs.existsSync(path.join(__dirname,'../media/report.html')));
  assert.ok(fs.existsSync(path.join(__dirname,'../vendor',artifact.filename)));
});
