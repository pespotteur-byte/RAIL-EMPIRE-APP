const fs=require('node:fs'),path=require('node:path');
const ts=require('./typescript-api.cjs')();
const root=path.resolve(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function literal(node){
 if(!node)return false;
 if(ts.isStringLiteral(node)||ts.isNumericLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||[ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(node.kind))return true;
 if(ts.isPrefixUnaryExpression(node))return [ts.SyntaxKind.MinusToken,ts.SyntaxKind.PlusToken].includes(node.operator)&&ts.isNumericLiteral(node.operand);
 if(ts.isArrayLiteralExpression(node))return node.elements.every(literal);
 if(ts.isObjectLiteralExpression(node))return node.properties.every(p=>ts.isPropertyAssignment(p)&&!ts.isComputedPropertyName(p.name)&&literal(p.initializer));
 return false;
}
/** Only JSON-equivalent tables pass: functions, calls, getters, spreads and computation fail. */
function dataOnly(text,name='data.js'){
 const file=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(file.parseDiagnostics.length)return false;
 const names=new Set();
 return file.statements.length>0&&file.statements.every(s=>{
  if(ts.isVariableStatement(s))return (s.declarationList.flags&ts.NodeFlags.Const)!==0&&s.declarationList.declarations.every(d=>{
   if(!ts.isIdentifier(d.name)||!literal(d.initializer))return false;names.add(d.name.text);return true;
  });
  if(ts.isExportAssignment(s))return literal(s.expression)||(ts.isIdentifier(s.expression)&&names.has(s.expression.text));
  if(ts.isExpressionStatement(s)&&ts.isBinaryExpression(s.expression)){
   const e=s.expression,left=e.left;
   return e.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(left)&&ts.isIdentifier(left.expression)&&['window','globalThis'].includes(left.expression.text)&&/^__RAILNET_/.test(left.name.text)&&literal(e.right);
  }
  return ts.isEmptyStatement(s);
 });
}
function anyDetails(file,text){
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);const locations=[];
 const visit=n=>{if(n.kind===ts.SyntaxKind.AnyKeyword){const lc=ast.getLineAndCharacterOfPosition(n.getStart(ast));locations.push({line:lc.line+1,column:lc.character+1});}ts.forEachChild(n,visit);};visit(ast);return locations;
}
function audit(){
 const rel=p=>path.relative(root,p).replaceAll('\\','/');
 const files=walk(path.join(root,'src/ts')).filter(f=>f.endsWith('.ts'));
 const implementation=files.filter(f=>!f.endsWith('.d.ts')),declarations=files.filter(f=>f.endsWith('.d.ts'));
 const outputNames=new Set(implementation.map(f=>'js/'+path.relative(path.join(root,'src/ts'),f).replace(/\.ts$/,'.js').replaceAll('\\','/')));
 const bundleNames=new Set(['js/rail-empire.file.bundle.js','js/rail-empire.catalog.bundle.js','js/rail-empire.admin.bundle.js']);
 const runtime=walk(path.join(root,'js')).filter(f=>f.endsWith('.js')&&!f.includes('/__tests__/'));
 const dataFiles=walk(path.join(root,'data')).filter(f=>f.endsWith('.js'));
 const data=[],compiled=[],bundles=[],unexpected=[];
 for(const f of [...runtime,...dataFiles]){
  const name=rel(f);if(outputNames.has(name)){compiled.push(name);continue;}
  if(bundleNames.has(name)){bundles.push(name);continue;}
  if(dataOnly(fs.readFileSync(f,'utf8'),name))data.push(name);else unexpected.push(name);
 }
 const anyByFile={},suppressions={ignore:0,nocheck:0,expectError:0};let lines=0;
 for(const f of files){const text=fs.readFileSync(f,'utf8');lines+=text.split(/\r?\n/).length;const positions=anyDetails(rel(f),text);if(positions.length)anyByFile[rel(f)]={count:positions.length,positions};
  suppressions.ignore+=(text.match(/@ts-ignore\b/g)||[]).length;suppressions.nocheck+=(text.match(/@ts-nocheck\b/g)||[]).length;suppressions.expectError+=(text.match(/@ts-expect-error\b/g)||[]).length;}
 const inline=[],inlineHandlers=[],externalScripts=[];
 for(const name of ['index.html','admin.html']){const html=fs.readFileSync(path.join(root,name),'utf8');for(const m of html.matchAll(/<[^>]+\s(on[a-z]+)\s*=\s*["'][^>]*>/gi))inlineHandlers.push({html:name,attribute:m[1]});for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const src=m[1].match(/\bsrc\s*=\s*['"]([^'"]+)/i);if(src){if(/^https?:/.test(src[1]))externalScripts.push({html:name,src:src[1]});}else if(m[2].trim())inline.push(name);
 }}
 const budgetFile=path.join(__dirname,'typescript-debt-budget.json');
 const budget=JSON.parse(fs.readFileSync(budgetFile,'utf8'));const debtRegressions=[];
 for(const [name,x] of Object.entries(anyByFile))if(x.count>(budget.anyByFile[name]||0))debtRegressions.push(`${name}: ${x.count} any > ${budget.anyByFile[name]||0}`);
 if(suppressions.expectError>budget.expectError)debtRegressions.push('New @ts-expect-error suppression');
 const absentOutputs=[...outputNames].filter(f=>!fs.existsSync(path.join(root,f)));
 const config=JSON.parse(fs.readFileSync(path.join(root,'tsconfig.json'),'utf8')).compilerOptions;
 const report={build:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).railEmpireBuild,compilerVersion:ts.version,implementationModules:implementation.length,declarationContractFiles:declarations.length,sourceLines:lines,compiledRuntimeModules:compiled.length,unpairedExecutableJs:unexpected,inlineExecutableScripts:inline,inlineEventHandlers:inlineHandlers,missingCompilerOutputs:absentOutputs,generatedBundles:bundles,dataOnlyAssets:data,externalScripts,config,explicitAnyTotal:Object.values(anyByFile).reduce((a,x)=>a+x.count,0),anyByFile,suppressions,debtRegressions,scope:'Authored game/admin runtime. JS data is verified JSON-equivalent. Build/test/QA tools and external vendor libraries are separate, not claimed TypeScript.',strictnessCaveat:'Legacy global HTMLElement/Array/UI/ORMClient/RailEmpire index signatures and DOM overloads still weaken checking. Authoring coverage is NOT strictness completeness.'};
 report.pass=!unexpected.length&&!inline.length&&!inlineHandlers.length&&!absentOutputs.length&&!suppressions.ignore&&!suppressions.nocheck&&!debtRegressions.length&&config.strict===true&&config.noEmitOnError===true;
 const release=report.build.match(/RC\d+/)?.[0];if(!release)throw new Error('Missing RC identity for TypeScript audit');const out=path.join(root,'QA','RE_REPAIR_'+release);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'TYPESCRIPT_AUDIT.json'),JSON.stringify(report,null,2)+'\n');return report;
}
module.exports={dataOnly,anyDetails,audit};
if(require.main===module){const report=audit();console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
