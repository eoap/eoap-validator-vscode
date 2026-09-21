// Exercise extension-host interactions with a small VS Code API double.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
const Module=require('node:module');
const handlers={}, publications=[], picks=[];
const disposable=()=>({dispose(){}});
class Uri {
 constructor(value){this.url=new URL(value);this.scheme=this.url.protocol.slice(0,-1);this.authority=this.url.host;this.path=decodeURIComponent(this.url.pathname);this.fsPath=this.scheme==='file'?fileURLToPath(this.url):this.path;}
 toString(){return this.url.href;}
 with(change){const next=new URL(this.url);if(change.scheme)next.protocol=change.scheme+':';if(change.authority!==undefined)next.host=change.authority;if(change.path!==undefined)next.pathname=change.path;return new Uri(next.href);}
 static file(filename){return new Uri(pathToFileURL(filename).href);}
 static joinPath(base,...parts){return Uri.file(path.join(base.fsPath,...parts));}
}
class Range {
 constructor(line,char,endLine,endChar){this.start={line,character:char};this.end={line:endLine,character:endChar};}
 isEqual(other){return JSON.stringify(this)===JSON.stringify(other);}
}
let document, opened=0;
const diagnostics={clear(){publications.length=0;},set(uri,values){publications.push({uri,values});},dispose(){}};
const vscode={
 Uri,Range,Selection:class {constructor(start,end){this.start=start;this.end=end;}},
 Diagnostic:class {constructor(range,message,severity){Object.assign(this,{range,message,severity});}},
 DiagnosticSeverity:{Error:0,Warning:1,Information:2},ViewColumn:{One:1,Beside:2},TextEditorRevealType:{InCenterIfOutsideViewport:0},RelativePattern:class {},
 commands:{registerCommand(id,fn){handlers.command=fn;return disposable();}},languages:{createDiagnosticCollection(){return diagnostics;}},
 workspace:{isTrusted:true,textDocuments:[],getConfiguration(){return {get(key,fallback){return fallback;}};},
  onDidChangeTextDocument(fn){handlers.change=fn;return disposable();},onDidSaveTextDocument(fn){handlers.save=fn;return disposable();},
  createFileSystemWatcher(){return {dispose(){},onDidChange:()=>disposable(),onDidCreate:()=>disposable(),onDidDelete:()=>disposable()};},
  async openTextDocument(){return document;}
 },
 window:{activeTextEditor:undefined,createOutputChannel(){return {append(){},appendLine(){},dispose(){}};},
  showWarningMessage:async()=>undefined,showInformationMessage:async()=>undefined,showErrorMessage:async m=>{throw new Error(m);},
  showQuickPick:async ids=>{picks.push(ids);return ids[1];},
  async showTextDocument(){opened++;return {revealRange(){},set selection(value){handlers.selection=value;}};},

 }
};
const original=Module._load;
Module._load=function(name,...args){return name==='vscode'?vscode:original.call(this,name,...args);};
const runner=require('../dist/runner');
const {ValidatorEnvironment}=require('../dist/environment');
ValidatorEnvironment.prototype.ensure=async()=>'/managed/python';
const {activate}=require('../dist/extension');
Module._load=original;

test('clicked CWL selects workflow and publishes underlines without a webview',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eoap-extension-'));
 const filename=path.join(dir,'workflow.cwl');
 const source='$graph:\n- {class: Workflow, id: "#first"}\n- {class: Workflow, id: "#second"}\n# 😀marker\n$namespaces: {s: https://schema.org/}\ns:name: Example\n';
 fs.writeFileSync(filename,source);
 const uri=Uri.file(filename);
 document={uri,isDirty:false,getText:()=>source,lineCount:6,lineAt(index){return {text:source.split('\n')[index]};}};
 vscode.workspace.textDocuments=[document];
 vscode.window.activeTextEditor={document:{uri:Uri.file(path.join(dir,'different.cwl'))}};
 let args, runs=0;
 runner.runValidator=async options=>{runs++;args=options;return {source:uri.toString(),dependencies:[uri.toString()],counts:{failed:1},exit_code:1,operational_failure:false,findings:[{rule_id:'EOAP.TEST',status:'failed',severity:'error',message:'Missing doc',suggestion:'Add doc',location:{uri:uri.toString(),path:'second',line:4,column:4},instance_path:[]},{rule_id:'TM.METADATA.MODEL',profile:'metadata',status:'failed',severity:'error',message:'dateCreated: Field required',location:{uri:uri.toString(),path:'metadata/dateCreated',line:1,column:1},suggestion:'Correct the field',instance_path:[]}]};};
 const context={globalStorageUri:Uri.file(path.join(dir,'storage')),extensionUri:Uri.file(path.resolve(__dirname,'..')),subscriptions:[]};
 try{
  activate(context);await handlers.command(uri);
  assert.equal(args.filename,filename);assert.equal(args.entrypoint,'second');
  assert.deepEqual(picks.at(-1),['first','second']);assert.equal(opened,1);
  assert.equal(publications.length,1);
  const diagnostic=publications[0].values[0];
  assert.equal(diagnostic.range.start.line,3);assert.equal(diagnostic.range.start.character,4);
  assert.equal(diagnostic.range.end.character,10);assert.match(diagnostic.message,/Add doc/);
  const metadata=publications[0].values[1];
  assert.equal(metadata.range.start.line,5);assert.match(metadata.message,/s:dateCreated/);
  handlers.change({document,contentChanges:[{text:'edited'}]});assert.equal(publications.length,0);
  await handlers.command(Uri.file(path.join(dir,'file.yaml')));assert.equal(runs,1);
  vscode.window.showQuickPick=async()=>undefined;
  await handlers.command(uri);assert.equal(runs,1);
  vscode.window.showQuickPick=async ids=>ids[0];
  document.isDirty=true;
  vscode.window.showWarningMessage=async()=> 'Save and validate';
  document.save=async()=>{
    handlers.change({document,contentChanges:[{text:'formatted'}]});
    document.isDirty=false;handlers.save(document);return true;
  };
  await handlers.command(uri);assert.equal(runs,2);assert.equal(publications.length,1);
  let complete;
  runner.runValidator=options=>{args=options;return new Promise(resolve=>{complete=resolve;});};
  const pending=handlers.command(uri);
  while(!complete) await new Promise(resolve=>setTimeout(resolve,1));
  handlers.change({document,contentChanges:[{text:'edited'}]});
  assert.equal(args.signal.aborted,true);
  complete({findings:[],dependencies:[]});await pending;
  assert.equal(publications.length,0);
  vscode.workspace.isTrusted=false;await handlers.command(uri);assert.equal(runs,2);
 }finally{context.subscriptions.forEach(d=>d.dispose());fs.rmSync(dir,{recursive:true,force:true});}
});
