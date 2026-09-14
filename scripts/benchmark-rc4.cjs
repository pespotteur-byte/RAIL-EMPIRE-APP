const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const baselineArg=process.argv.indexOf('--baseline-root');
const baseline=baselineArg>=0?path.resolve(process.argv[baselineArg+1],'js'):path.join(root,'QA/RE_REPAIR_RC4/reference');
const worker=path.join(__dirname,'benchmark-rc4-worker.mjs');
const cases=[];
for(const scenario of ['physics-500km','physics-1500km','cantons-1000','cantons-5000']){
 const pair={scenario};
 // Isolated processes: high-water memory never inherits the other version.
 for(const [label,moduleRoot] of [['RC3',baseline],['RC4',path.join(root,'js')]]){
  const result=spawnSync(process.execPath,['--expose-gc',worker,moduleRoot,scenario],{encoding:'utf8',timeout:90000,maxBuffer:1024*1024});
  if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr||`worker exit ${result.status}`);
  pair[label]=JSON.parse(result.stdout.trim());
 }
 if(JSON.stringify(pair.RC3.result)!==JSON.stringify(pair.RC4.result))throw Error(`Result parity mismatch: ${scenario}`);
 pair.speedup=pair.RC3.medianMs/pair.RC4.medianMs;
 pair.peakRssReductionPercent=(1-pair.RC4.peakRssKiB/pair.RC3.peakRssKiB)*100;
 cases.push(pair); console.error(`${scenario}: ${pair.RC3.medianMs.toFixed(2)} -> ${pair.RC4.medianMs.toFixed(2)} ms; x${pair.speedup.toFixed(2)}`);
}
const report={build:'S3_GAMEPLAY_REPAIR_RC4',measurement:'microbenchmarks; NOT whole-game FPS or a capacity certification',cpu:os.cpus()[0]?.model,node:process.version,platform:process.platform,architecture:process.arch,warmupIterations:3,samplesPerVersion:9,cases};
const target=path.join(root,'QA/RE_REPAIR_RC4/BENCHMARK.json');fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
