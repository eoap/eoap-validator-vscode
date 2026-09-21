// Exercise extension-host interactions with a small VS Code API double.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
const Module=require('node:module');
const handlers={}, panels=[], publications=[];
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
  showWarningMessage:async()=>undefined,showInformationMessage:async()=>undefined,
  async showTextDocument(){opened++;return {revealRange(){},set selection(value){handlers.selection=value;}};},
  createWebviewPanel(){let disposed=false;const p={states:[],reveal(){},webview:{html:'',postMessage(state){p.states.push(state);return Promise.resolve(true);},onDidReceiveMessage(fn){p.receive=fn;return disposable();}},onDidDispose(fn){p.onDispose=fn;return disposable();},dispose(){if(disposed)return;disposed=true;p.onDispose?.();}};panels.push(p);return p;}
 }
};
const original=Module._load;
Module._load=function(name,...args){return name==='vscode'?vscode:original.call(this,name,...args);};
const runner=require('../dist/runner');
const {ValidatorEnvironment}=require('../dist/environment');
ValidatorEnvironment.prototype.ensure=async()=>'/managed/python';
const {activate}=require('../dist/extension');
Module._load=original;
async function waitFor(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for extension state');}

test('panel publishes Problems, navigates Unicode positions, invalidates edits and can reopen',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eoap-extension-'));
 const filename=path.join(dir,'workflow.cwl');fs.writeFileSync(filename,'alpha\n😀marker\n');
 const uri=Uri.file(filename);
 document={uri,isDirty:false,lineCount:2,lineAt(index){return {text:index===1?'😀marker':'alpha'};}};
 vscode.workspace.textDocuments=[document];vscode.window.activeTextEditor={document};
 let args;
 runner.runValidator=async options=>{args=options;return {source:uri.toString(),dependencies:[uri.toString()],counts:{failed:1},exit_code:1,operational_failure:false,findings:[{rule_id:'EOAP.TEST',status:'failed',severity:'error',message:'Missing doc',suggestion:'Add doc',location:{uri:uri.toString(),path:'main/outputs/result',line:2,column:2},instance_path:['main']}]};};
 const context={globalStorageUri:Uri.file(path.join(dir,'storage')),extensionUri:Uri.file(path.resolve(__dirname,'..')),subscriptions:[]};
 try{
  activate(context);handlers.command();const panel=panels.at(-1);panel.receive({type:'ready'});
  await waitFor(()=>panel.states.at(-1)?.stale===false);
  assert.equal(args.executable,'/managed/python');assert.deepEqual(args.prefixArgs,['-m','eoap_validator']);assert.equal(args.filename,filename);assert.equal(publications.length,1);
  assert.equal(publications[0].values[0].range.start.character,2);
  const generation=panel.states.at(-1).generation;
  panel.receive({type:'navigate',generation,index:0});await waitFor(()=>opened===1);
  assert.equal(handlers.selection.start.character,2);
  handlers.change({document,contentChanges:[{text:'edited'}]});
  assert.equal(publications.length,0);assert.equal(panel.states.at(-1).stale,true);
  panel.receive({type:'navigate',generation,index:0});await new Promise(r=>setTimeout(r,20));assert.equal(opened,1);
  panel.dispose();handlers.command();assert.equal(panels.length,2);
  panels.at(-1).dispose();
  vscode.workspace.isTrusted=false;handlers.command();assert.equal(panels.length,2);
 }finally{context.subscriptions.forEach(d=>d.dispose());fs.rmSync(dir,{recursive:true,force:true});}
});
