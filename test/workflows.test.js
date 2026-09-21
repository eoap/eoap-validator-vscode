const {test}=require('node:test');
const assert=require('node:assert/strict');
const {workflowIds}=require('../dist/workflows');
test('selects root workflows, excluding tools and embedded steps',()=>{
 assert.deepEqual(workflowIds('$graph:\n- {class: Workflow, id: "#one"}\n- {class: CommandLineTool, id: tool}\n- {class: Workflow, id: two}\n'),['one','two']);
 assert.deepEqual(workflowIds(JSON.stringify({$graph:[{class:'Workflow',id:'one'},{class:'Workflow',id:'two'}]})),['one','two']);
 assert.deepEqual(workflowIds('class: Workflow\nsteps:\n  nested:\n    run: {class: Workflow, id: nested}'),[]);
 assert.deepEqual(workflowIds('class: Workflow'),[]);
 assert.deepEqual(workflowIds('not: [valid'),[]);
});
test('does not invent IDs for ambiguous workflows',()=>{
 assert.throws(()=>workflowIds('$graph:\n- {class: Workflow}\n- {class: Workflow, id: two}'),/distinct, nonempty/);
 assert.throws(()=>workflowIds('$graph:\n- {class: Workflow, id: one}\n- {class: Workflow, id: "#one"}'),/distinct, nonempty/);
});
