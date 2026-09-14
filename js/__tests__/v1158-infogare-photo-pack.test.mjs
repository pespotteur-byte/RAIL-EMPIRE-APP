import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');

const directPhotoHashes={
  'img/infogare/AFL-DP.png':'fb2fbfc0276dde7d9dc9532fd97412b52478ace6ac50c43de095188b11eeb56a',
  'img/infogare/AFL-AR.png':'d6a05d3abd1d4494f97a7a30d2205e9bd37629a63940e4635bdb8621056f2b7a',
  'img/infogare/CATI-3-3.png':'490b97c8f8bf260f072d1cd99ee11aab216c3f72f9afd8a61b29ec18c0c9e01a',
  'img/infogare/CATI-AR.png':'729e9175107c736052f590d809a803d7579436b4d03b540ad2869d1e1510ee5b',
  'img/infogare/CATI-COMPLET.png':'3b6651996b5d17c4a33858855e19071b7198b3eae3a6212c9271a0df6f9414d7',
  'img/infogare/ECRAN-QUAI.png':'4f29096a50863b6d6d23ebaf1b141efb5329f6f81aaa1ac9e5436f7e747c2c03',
  'img/infogare/FLASH-CIRCULATION.png':'f8e4387587ccc4ccfbae5fcb9f6423f51aadd50a0f7ec5738fabfeae9e61d36e',
  'img/infogare/PALETTE.png':'9cfee19dbc1afec95b3028f2041cdce0fb5621b37d6de29f0eb8c6cd42b0c068',
};

test('v1.1.59: SNCF flat reference assets use the latest user-supplied templates',()=>{
  for(const [p,h] of Object.entries(directPhotoHashes)){
    assert.ok(fs.statSync(path.join(root,p)).size>20_000,p);
    assert.equal(sha(p),h,p);
  }
});

test('v1.1.61: original RATP/Transilien/DB references remain archived in the pack',()=>{
  const sourceHashes={
    'img/infogare/reference-sources/RER-RATP_SOURCE.jpg':'0d2a079270e093a1e3442a317d63d95ee13b057a542fabe6f05a91e8c4c827c9',
    'img/infogare/reference-sources/RER-SNCF_SOURCE.jpg':'0fe73760db70a7c0059e11b9d0bfe4088f4c95d11effa5e1342e46baafe821ce',
    'img/infogare/reference-sources/DB-ABFAHRT_SOURCE.jpg':'18332c66e8b90c7439563b37c122f947c9c435a414ff3c2250cad5fa5fdd7f3b',
  };
  for(const [p,h] of Object.entries(sourceHashes)){
    assert.ok(fs.existsSync(path.join(root,p)),p);
    assert.equal(sha(p),h,p);
  }
  for(const p of ['img/infogare/RER-RATP.jpg','img/infogare/RER-SNCF.jpg','img/infogare/DB-ABFAHRT.jpg'])
    assert.equal(fs.existsSync(path.join(root,p)),false,`unused derivative removed: ${p}`);
});

test('RC24: old photographic selector is replaced by the original Rail Empire board',()=>{
  const html=read('index.html'),current=read('js/infogare-re.js');
  assert.doesNotMatch(html,/id="infogare-display"/);
  assert.match(html,/id="infogare-board"/);
  assert.match(current,/re-board-brand/);assert.match(current,/Ajouter les 24 h suivantes/);
  assert.doesNotMatch(current,/img\/infogare\//);
});

test('RC24: archived historic assets are no longer selected by the gameplay Infogare',()=>{
  const ui=read('js/ui.js'),board=read('js/infogare-re.js'),html=read('index.html');
  assert.match(ui,/new RailEmpireBoard/);
  assert.match(board,/re-board-brand/);
  assert.doesNotMatch(html,/id="infogare-display"/);
  assert.doesNotMatch(board,/reference-sources\/|AFL-DP\.png|CATI|RER-RATP|DB-ABFAHRT/);
});
test('RC24: FILE core bundle ships the Rail Empire continuous board contract',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  assert.match(bundle,/Rail Empire v1\.1\.[0-9]+ FILE:\/\/ CORE bundle/);
  for(const ref of ['RailEmpireBoard','re-board-list','Ajouter les 24 h suivantes','défilement continu'])
    assert.match(bundle,new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),ref);
  assert.match(bundle,/rail-empire\.catalog\.bundle\.js\?v=1199repair24/);
});
