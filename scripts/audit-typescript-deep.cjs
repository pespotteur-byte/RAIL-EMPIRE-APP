const fs=require('node:fs'),path=require('node:path'),ts=require('./typescript-api.cjs')();
const root=path.resolve(__dirname,'..'),config=ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
// Probe only: do not change production options or generate JS with errors.
const files=parsed.fileNames.filter(f=>!f.endsWith('s3-final-legacy-compat.d.ts'));
const program=ts.createProgram(files,{...parsed.options,noEmit:true,skipLibCheck:false});
const errors=ts.getPreEmitDiagnostics(program),byCode={},byFile={},examples=[];
for(const d of errors){byCode[d.code]=(byCode[d.code]||0)+1;const name=d.file?path.relative(root,d.file.fileName):'<config>';byFile[name]=(byFile[name]||0)+1;
 if(examples.length<80){const loc=d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start):{};examples.push({file:name,line:loc.line===undefined?null:loc.line+1,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});}}
const report={probe:'Remove the five blanket any index signatures; skipLibCheck=false. Existing DOM compatibility overloads still present.',productionChanged:false,compiler:ts.version,diagnostics:errors.length,byCode,byFile,examples,meaning:'Zero errors in the shipped permissive compatibility build is not proof of full safe typing. This is a stricter diagnostic experiment, not a release test to suppress.'};
fs.writeFileSync(path.join(root,'QA/RE_REPAIR_RC18/TYPESCRIPT_STRICTNESS_PROBE.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({diagnostics:errors.length,byCode,topFiles:Object.entries(byFile).sort((a,b)=>b[1]-a[1]).slice(0,10)}));
