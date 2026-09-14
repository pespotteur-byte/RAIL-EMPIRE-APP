import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';

const source=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');

test('v1.1.50 train number/name are lightweight live metadata edits with no ORM recomputation',()=>{
  const start=source.indexOf('  _bindPanelEvents(){');
  const end=source.indexOf('\n\n  _setReturnName',start);
  const block=source.slice(start,end);
  assert.match(block,/\[data-f="number"\],\[data-f="name"\]/);
  assert.match(block,/addEventListener\('input'/);
  const metadata=block.slice(block.indexOf('// Metadata edits'),block.indexOf("this.panelContent.querySelectorAll('[data-f]:not"));
  assert.doesNotMatch(metadata,/_recomputeActivePath/);
  assert.doesNotMatch(metadata,/_markRecordChanged/);
  assert.match(metadata,/_updateHeader\(\)/);
  assert.match(metadata,/_autosaveSoon\(\)/);
});

test('v1.1.86 physical fields retime current geometry first and reroute only for topology/compatibility needs',()=>{
  const start=source.indexOf('  _bindPanelEvents(){');
  const end=source.indexOf('\n\n  _setReturnName',start);
  const block=source.slice(start,end);
  assert.match(block,/\[data-f\]:not\(\[data-f="number"\]\):not\(\[data-f="name"\]\)/);
  assert.match(block,/_retimeCurrentPath\(v\)/);
  assert.match(block,/_routeCompatibilityErrors\(report\)/);
  assert.match(block,/_recomputeActivePath\(\{topologyChanged:false\}\)/);
});

test('v1.1.50 panel rerender preserves folds scroll focus and caret',()=>{
  assert.match(source,/_capturePanelUiState\(\)/);
  assert.match(source,/_restorePanelUiState\(state\)/);
  assert.match(source,/details\.sv2-fold/);
  assert.match(source,/scrollTop/);
  assert.match(source,/selectionStart/);
  assert.match(source,/setSelectionRange/);
  assert.match(source,/data-fold-key="train-params"/);
  assert.match(source,/data-fold-key="version-calendars"/);
  assert.match(source,/this\._restorePanelUiState\(uiState\)/);
});

test('v1.1.50 panel control key is stable for text and stop fields',()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  assert.equal(ed._panelControlKey({dataset:{f:'name'},hasAttribute(){return false;}}),'f:name');
  assert.equal(ed._panelControlKey({dataset:{stop:'loc-1:dep'},hasAttribute(){return false;}}),'stop:loc-1:dep');
});
