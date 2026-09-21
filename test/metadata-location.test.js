const {test}=require('node:test');
const assert=require('node:assert/strict');
const {missingMetadataAnchor}=require('../dist/metadata-location');
const finding={rule_id:'TM.METADATA.MODEL',profile:'metadata',status:'failed',message:'dateCreated: Field required',location:{path:'metadata/dateCreated',line:1,column:1}};
const source='$graph:\n  - {class: Workflow, id: main}\n$namespaces:\n  s: https://schema.org/\ns:name: Burned Area Severity\ns:softwareVersion: 3.0.1\n';
test('missing dateCreated is marked at actual document metadata, not $graph',()=>{
 const anchor=missingMetadataAnchor(source,finding);
 assert.equal(anchor.line,4);assert.equal(anchor.column,0);
 assert.match(anchor.note,/s:dateCreated/);assert.match(anchor.note,/add the field at document level/);
});
test('existing fields, nested errors and unknown JSON-LD contexts keep validator positions',()=>{
 assert.equal(missingMetadataAnchor(source+'s:dateCreated: invalid\n',finding),undefined);
 assert.equal(missingMetadataAnchor(source,{...finding,message:'author/0/name: Field required',location:{path:'metadata/author/0/name'}}),undefined);
 assert.equal(missingMetadataAnchor(source+'"@context": {}\n',finding),undefined);
 assert.equal(missingMetadataAnchor('class: Workflow\n',finding),undefined);
});
test('alternate namespace prefixes and full schema URIs are located from parsed keys',()=>{
 assert.match(missingMetadataAnchor(source.replace(/^(\s*)s:/gm, '$1schema:'),finding).note,/schema:dateCreated/);
 assert.equal(missingMetadataAnchor('https://schema.org/name: Example\n',finding).line,0);
});
