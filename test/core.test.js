const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseReport, sourceArgument, utf16Column, localPath, actionable } = require('../dist/report');
const { runValidator, validatorArgs } = require('../dist/runner');

function report(code = 0) {
  return {schema_version:'1.0',validator_version:'0.1.0',source:'file:///tmp/test.cwl',entrypoint:'main',profiles:{'eoap-package':'1.1'},tool_versions:{},dependencies:['file:///tmp/test.cwl'],dependency_coverage:'test',findings:[],operational_failure:code===2,counts:{passed:0,failed:0,'needs-review':0,'not-applicable':0,blocked:0},exit_code:code,fail_on:'error'};
}
function options(script, extra = {}) {
  return {executable:process.execPath,prefixArgs:['-e',script,'--'],filename:path.resolve('some name;echo.cwl'),entrypoint:'main',profiles:['metadata'],stagingFile:'',failOn:'error',cwd:process.cwd(),timeoutMs:5000,signal:new AbortController().signal,onStderr:()=>{},...extra};
}

test('source URI protects spaces, hashes and shell characters', () => {
  const arg = sourceArgument(path.resolve('a #file;$(hello).cwl'), 'main/name');
  assert.match(arg, /%23file/); assert.ok(arg.endsWith('#main%2Fname'));
  assert.equal(localPath('https://example.org/tool.cwl'), undefined);
});
test('Python columns convert to UTF16, including non-BMP characters', () => {
  assert.equal(utf16Column('a😀b', 3), 3);
  assert.equal(utf16Column('abc', 500), 3);
});
test('arguments are separate, with repeated profiles and source terminator', () => {
  const args = validatorArgs(options('', {profiles:['eoap-package','metadata']}));
  assert.equal(args.filter(a=>a==='--profile').length, 2);
  assert.equal(args.at(-2), '--'); assert.match(args.at(-1), /file:/);
  assert.throws(()=>validatorArgs(options('', {stagingFile:'stage.json'})), /requires/);
});
test('malformed and incompatible reports are rejected', () => {
  assert.throws(()=>parseReport('not json',0));
  const data=report(); data.findings=[{message:'missing everything'}];
  assert.throws(()=>parseReport(JSON.stringify(data),0), /Invalid validator report/);
  assert.throws(()=>parseReport(JSON.stringify({...report(),schema_version:'2.0'}),0), /Unsupported/);
  assert.throws(()=>parseReport(JSON.stringify(report(1)),0), /disagrees/);
});
for (const code of [0,1,2]) test(`exit ${code} returns a valid report and keeps stderr separate`, async () => {
  const data=JSON.stringify(report(code)); let stderr='';
  const parsed=await runValidator(options(`process.stderr.write('diagnostics');process.stdout.write(${JSON.stringify(data)});process.exitCode=${code}`,{onStderr:t=>stderr+=t}));
  assert.equal(parsed.exit_code,code); assert.equal(stderr,'diagnostics');
});
test('missing executable has an actionable error', async () => {
  await assert.rejects(runValidator(options('',{executable:path.resolve('no-such-validator')})), /Cannot start validator/);
});
test('timeout terminates the validator', async () => {
  await assert.rejects(runValidator(options('setInterval(()=>{},1000)',{timeoutMs:50})), /timed out/);
});
test('cancellation terminates an active invocation', async () => {
  const controller=new AbortController();
  const pending=runValidator(options('setInterval(()=>{},1000)',{signal:controller.signal}));
  controller.abort(); await assert.rejects(pending,/cancelled/);
});
test('unexpected exit and non-JSON output do not become findings', async () => {
  await assert.rejects(runValidator(options('process.exit(7)')), /exit status 7/);
  await assert.rejects(runValidator(options('console.log("hello")')), /Cannot read validator result/);
});
test('passed findings never appear as Problems', () => {
  assert.equal(actionable({status:'passed'}),false);
  assert.equal(actionable({status:'not-applicable'}),false);
  assert.equal(actionable({status:'needs-review'}),true);
});
