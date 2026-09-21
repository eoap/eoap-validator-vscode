const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../package.json');

test('extension runs alongside files on a trusted workspace host', () => {
  assert.deepEqual(manifest.extensionKind,['workspace']);
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported,false);
  assert.equal(manifest.contributes.commands[0].command,'eoapValidator.validate');
});
test('webview uses nonce CSP and text rendering for report content', () => {
  const html=fs.readFileSync(path.join(__dirname,'../media/report.html'),'utf8');
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes('nonce="__NONCE__"'));
  assert.ok(html.includes('textContent'));
  assert.ok(!html.includes('innerHTML'));
  assert.ok(!html.includes('command:'));
});
