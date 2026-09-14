const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const{spawnSync}=require('node:child_process');const root=path.resolve(__dirname,'..'),cases=[];
for(const scenario of ['physics-uniform-50k','physics-varied-50k','physics-dense-150k','movement-authority']){
 const pair={scenario};for(const version of ['RC5','RC6']){
  const p=spawnSync(process.execPath,['--expose-gc',path.join(__dirname,'benchmark-rc6-worker.mjs'),version,scenario],{cwd:root,encoding:'utf8',timeout:100000,maxBuffer:2**20});
  if(p.error||p.status)throw Error(p.error?.message||p.stderr);pair[version]=JSON.parse(p.stdout.trim());
 }
 if(JSON.stringify(pair.RC5.result)!==JSON.stringify(pair.RC6.result))throw Error('Output mismatch '+scenario);
 pair.speedup=pair.RC5.medianMs/pair.RC6.medianMs;cases.push(pair);
 console.error(`${scenario}: ${pair.RC5.medianMs.toFixed(3)} -> ${pair.RC6.medianMs.toFixed(3)} ms; x${pair.speedup.toFixed(2)}`);
}
const report={build:'S3_GAMEPLAY_REPAIR_RC6R',previousLabel:'RC5',candidateLabel:'RC6R (worker alias RC6)' ,scope:'Matched-function microbenchmarks with identical outputs. Uniform control and artificial dense stress route included; NOT whole-game FPS or user hardware.',cpu:os.cpus()[0]?.model,node:process.version,platform:process.platform,warmup:3,samples:9,isolatedProcesses:true,cases};
fs.writeFileSync(path.join(root,'QA/RE_REPAIR_RC6_REPRISE/BENCHMARK.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
