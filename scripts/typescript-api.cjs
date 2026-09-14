const path=require('node:path');
/** Prefer project-pinned TypeScript; permit the same version installed globally for CI. */
module.exports=function loadTypeScript(){
  try{return require('typescript');}catch(localError){
    const globalPath=process.env.TYPESCRIPT_PATH || path.resolve(path.dirname(process.execPath),'../lib/node_modules/typescript');
    try{return require(globalPath);}catch{throw new Error('TypeScript is required. Install package.json dependencies before running this command.',{cause:localError});}
  }
};
