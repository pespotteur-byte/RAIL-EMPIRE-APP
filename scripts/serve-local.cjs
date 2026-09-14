// Optional cross-platform launcher: node scripts/serve-local.cjs. No npm dependency.
// This serves only the game directory. It is NOT a proxy to OSM or an upload API.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const packedTypes = new Set(['.js','.json','.css','.csv','.svg']);
// An explicit gzip;q=0 overrides a wildcard. Never force gzip on an identity client.
function acceptsGzip(header='') {
 let wildcard=0,explicit;
 for(const item of String(header).toLowerCase().split(',')){const [name,...params]=item.trim().split(';');let q=1;
  for(const p of params){if(p.trim().startsWith('q=')){q=Number(p.trim().slice(2));if(!Number.isFinite(q)||q<0||q>1)q=0;}}
  if(name==='gzip')explicit=q;if(name==='*')wildcard=q;
 }return (explicit===undefined?wildcard:explicit)>0;
}
const rootDefault = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
 '.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg',
 '.m4a':'audio/mp4','.csv':'text/csv; charset=utf-8','.wasm':'application/wasm','.onnx':'application/octet-stream','.bin':'application/octet-stream','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf'};
function createLocalServer(root = rootDefault) {
 root = fs.realpathSync(root);
 const server = http.createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  const fail = code => {res.writeHead(code,{'Content-Length':'0','Cache-Control':'no-store'});res.end();};
  const authority = '127.0.0.1:' + server.address().port;
  if(req.headers.host !== authority || (req.headers.origin && req.headers.origin !== 'http://' + authority)) return fail(403);
  if(req.method !== 'GET' && req.method !== 'HEAD') return fail(405);
  let url;
  try {url=decodeURIComponent(req.url.split('?')[0]);}catch{return fail(400);}
  if(!url.startsWith('/') || url.startsWith('//') || /[\\:\0%]/.test(url) || url.split('/').some(x=>x.startsWith('.')))return fail(403);
  if(url === '/')url = '/index.html';
  if(!['/index.html','/admin.html','/style.css','/VERSION.txt','/AIDE_CARTE_OSM.html'].includes(url) && !/^\/(js|data|img|audio)\//.test(url))return fail(403);
  if(url.includes('/__tests__/'))return fail(403);
  const requestedFile=path.resolve(root,'.'+url),ext=path.extname(requestedFile).toLowerCase();
  try {
   if(!requestedFile.startsWith(root+path.sep))return fail(403);
   const type=mime[ext];if(!type)return fail(403);
   // In the LIGHT package text files may exist only as precompressed .gz. Plain
   // files take precedence, so stale sidecars cannot shadow an edited source.
   let file=requestedFile,packed=false;
   if(!fs.existsSync(file)&&packedTypes.has(ext)){file += '.gz';packed=true;}
   let item=file;
   while(item.length>root.length){if(fs.lstatSync(item).isSymbolicLink())return fail(403);item=path.dirname(item);}
   if(!fs.realpathSync(file).startsWith(root+path.sep))return fail(403);
   const stat=fs.statSync(file);if(!stat.isFile())return fail(404);
   const gzip=packed&&acceptsGzip(req.headers['accept-encoding']);
   const etag='"'+stat.size.toString(16)+'-'+Math.trunc(stat.mtimeMs).toString(16)+(packed?(gzip?'-g':'-i'):'')+'"';
   res.setHeader('ETag',etag);res.setHeader('Cache-Control','private, max-age=0, must-revalidate');res.setHeader('Content-Type',type);
   if(packed)res.setHeader('Vary','Accept-Encoding');
   if(gzip)res.setHeader('Content-Encoding','gzip');
   if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
   if(!packed||gzip)res.setHeader('Content-Length',stat.size);
   if(req.method==='HEAD'){res.end();return;}
   const input=fs.createReadStream(file),decoder=packed&&!gzip?zlib.createGunzip():null;
   const failStream=()=>{if(!res.headersSent){res.removeHeader('Content-Encoding');fail(500);}else res.destroy();};
   input.on('error',failStream);decoder?.on('error',failStream);
   res.on('close',()=>{input.destroy();decoder?.destroy();});
   if(decoder)input.pipe(decoder).pipe(res);else input.pipe(res);
  }catch(e){fail(e.code==='ENOENT'?404:403);}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=64;
 return server;
}
module.exports={createLocalServer};
if(require.main===module){
 const server=createLocalServer();
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 8765 occupé : fermer l’ancien lanceur, sans changer de port.':e.message);process.exitCode=1;});
 server.listen(8765,'127.0.0.1',()=>console.log('Rail Empire : http://127.0.0.1:8765/index.html\nServeur local en lecture seule. Ctrl+C pour arrêter.'));
}
