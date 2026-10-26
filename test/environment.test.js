const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ValidatorEnvironment } = require('../dist/environment');
const artifact = require('../vendor/validator.json');

test('managed installation pins package, checks dependencies and reuses healthy environment', async t => {
  const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'eoap-env-'));
  t.after(() => fs.rm(storage, {recursive:true, force:true}));
  const calls = [];
  const run = async (exe, args) => {
    calls.push({exe,args});
    if (args[1] === 'venv') {
      const python = path.join(args[2], process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
      await fs.mkdir(path.dirname(python), {recursive:true});
      await fs.writeFile(python, '');
    }
  };
  const env = new ValidatorEnvironment(storage, '/extension', run);
  const options = {signal:new AbortController().signal, log:()=>{}};
  const python = await env.ensure('/host/python', options);
  assert.equal(path.basename(path.dirname(path.dirname(python))), `validator-bundled-${artifact.version}-${artifact.sha256}`);
  assert.equal(calls.length, 6);
  assert.equal(calls[2].args.at(-2), '--upgrade');
  assert.match(calls[2].args.at(-1), /^pip @ https:\/\/files\.pythonhosted\.org\/.+#sha256=[a-f0-9]{64}$/);
  assert.deepEqual(calls[3].args, ['-m','pip','install','--disable-pip-version-check','--no-input','certifi>=2026.10.19',path.join('/extension','vendor',artifact.filename)]);
  assert.deepEqual(calls[4].args, ['-m','pip','check']);
  assert.equal(await env.ensure('/host/python', options), python);
  assert.equal(calls.length, 7);
  assert.ok(calls[6].args[1].includes(`version('eoap-validator') == '${artifact.version}'`));
  assert.ok(calls[6].args[1].includes("version('pip')"));
  assert.ok(calls[6].args[1].includes("version('certifi')"));
});

test('failed setup can retry and cancelled setup invokes no commands', async t => {
  const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'eoap-env-'));
  t.after(() => fs.rm(storage, {recursive:true, force:true}));
  let count = 0;
  const env = new ValidatorEnvironment(storage, '/extension', async () => { count++; throw new Error('pip unavailable'); });
  const options = {signal:new AbortController().signal, log:()=>{}};
  await assert.rejects(env.ensure('python',options), /pip unavailable/);
  await assert.rejects(env.ensure('python',options), /pip unavailable/);
  assert.equal(count, 2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(env.ensure('python',{...options,signal:controller.signal}), /cancelled/);
  assert.equal(count, 2);
});

test('repairs a cached environment whose trust health check fails', async t => {
  const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'eoap-env-'));
  t.after(() => fs.rm(storage, {recursive:true, force:true}));
  const directory = path.join(storage, `validator-bundled-${artifact.version}-${artifact.sha256}`);
  const python = path.join(directory, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  await fs.mkdir(path.dirname(python), {recursive:true});
  await fs.writeFile(python, '');
  const installs = [];
  let healthChecks = 0;
  const run = async (exe, args) => {
    if (exe === python && args[0] === '-c' && healthChecks++ === 0) {
      throw new Error('Outdated certificate bundle');
    }
    if (args.includes('install')) installs.push(args);
  };
  const env = new ValidatorEnvironment(storage, '/extension', run);
  const options = {signal:new AbortController().signal, log:()=>{}};
  assert.equal(await env.ensure('/host/python', options), python);
  assert.match(installs[0].at(-1), /^pip @ https:/);
  assert.ok(installs[1].includes('certifi>=2026.10.19'));
  assert.equal(await env.ensure('/host/python', options), python);
  assert.equal(installs.length, 2);
});
