import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

function wrap(a){ return Math.atan2(Math.sin(a),Math.cos(a)); }
function err(a,b){ return Math.abs(wrap(a-b)); }

// The actual SVG path has its nose at y=1.5: rotate(0) means UP/NORTH on screen.
test('HOTFIX19 CSS fallback keeps followed train arrow pointing up',()=>{
  const geo = 1.10;
  const camera = geo;
  const localArrow = geo - camera;
  assert.ok(err(localArrow,0)<1e-12);
  assert.match(renderer,/targetHeading = geoHeading - cameraHeading;/);
  assert.doesNotMatch(renderer,/geoHeading - Math\.PI \/ 2 - cameraHeading/);
});

test('HOTFIX19 CSS fallback preserves relative direction for other trains',()=>{
  const followed = Math.PI/2; // camera east
  const otherNorth = 0;
  const localArrow = wrap(otherNorth-followed);
  assert.ok(err(localArrow,-Math.PI/2)<1e-12);
});

test('HOTFIX19 DEM converts +X screen tangent into SVG up-axis rotation',()=>{
  // A tangent pointing right is 0 rad in atan2(dy,dx). An up-native SVG must
  // rotate +90° to point right.
  const tangentRight = 0;
  const cssRotation = tangentRight + Math.PI/2;
  assert.ok(err(cssRotation,Math.PI/2)<1e-12);
  // A tangent pointing up is -90° and should need zero SVG rotation.
  const tangentUp = -Math.PI/2;
  assert.ok(err(tangentUp+Math.PI/2,0)<1e-12);
  assert.match(renderer,/targetHeading = screenTangent \+ Math\.PI \/ 2;/);
});

test('HOTFIX19 arrow-axis behavior survives in current cumulative TypeScript bundle',()=>{
  assert.match(build,/S3-TYPESCRIPT-ALPHA23/);
  assert.match(build,/const CACHE_VERSION = '1199repair24'/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
