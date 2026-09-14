import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('HOTFIX66 Horaires makes the novice direct-Rame workflow explicit and prominent',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const start=src.indexOf('renderList(){');
  const end=src.indexOf('_duplicateScheduleDialog',start);
  const block=src.slice(start,end);
  assert.match(block,/Mode simple actif/);
  assert.match(block,/Valider l’horaire/);
  assert.match(block,/🚆 Affecter une rame/);
  assert.match(block,/sv2-primary/);
  assert.match(block,/Rame : \$\{directRame\.name/);
  assert.match(block,/rotationsRequired/);
});

test('HOTFIX66 keeps the existing direct assignment engine behind the restored button',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const start=src.indexOf('_directAssignmentDialog(scheduleId)');
  const end=src.indexOf('_markRecordChanged',start);
  const block=src.slice(start,end);
  assert.match(block,/Mode simple — affecter une rame à l’horaire/);
  assert.match(block,/setDirectRameAssignment/);
  assert.match(block,/removeDirectAssignment/);
});
