const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ValidatorEnvironment } = require('../dist/environment');

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
  assert.equal(calls.length, 5);
  assert.deepEqual(calls[2].args, ['-m','pip','install','--disable-pip-version-check','--no-input',path.join('/extension','vendor','eoap_validator-0.1.0-py3-none-any.whl')]);
  assert.deepEqual(calls[3].args, ['-m','pip','check']);
  assert.equal(await env.ensure('/host/python', options), python);
  assert.equal(calls.length, 6);
  assert.match(calls[5].args[1], /version\('eoap-validator'\) == '0.1.0'/);
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
