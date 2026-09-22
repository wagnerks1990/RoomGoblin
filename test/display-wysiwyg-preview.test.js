'use strict';
const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

const display=()=>fs.readFileSync('public/display/index.html','utf8');
const studio=()=>fs.readFileSync('public/controller/display.html','utf8');
const controller=()=>fs.readFileSync('public/controller/app.js','utf8');

test('receiver accepts draft state only from its same-origin parent in preview mode',()=>{
  const source=display();
  assert.match(source,/if\(preview\)window\.addEventListener\('message'/);
  assert.match(source,/event\.origin!==location\.origin\|\|event\.source!==window\.parent/);
  assert.match(source,/message\.type!=='roomgoblin\.preview\.state'/);
  assert.match(source,/applyState\(message\.state\)/);
});

test('display studio WYSIWYG uses the exact receiver renderer without sending commands',()=>{
  const source=studio();
  assert.match(source,/WYSIWYG preview uses the same renderer as the TV/);
  assert.match(source,/roomgoblin\.preview\.state/);
  assert.match(source,/displayDraftState\(\)/);
  assert.match(source,/frame\.src=\`\/display\/\$\{encodeURIComponent\(id\)\}\?preview=1\`/);
  assert.match(source,/Nothing is sent to physical displays until you press a Send button/);
});

test('automation display-text editor embeds the exact receiver WYSIWYG preview',()=>{
  const source=controller();
  assert.match(source,/function setupAutomationTextPreview\(\)/);
  assert.match(source,/roomgoblin\.preview\.state/);
  assert.match(source,/id="autoWysiwygFrame"/);
  assert.match(source,/same receiver renderer used on classroom TVs/);
  assert.match(source,/Editing does not send commands or save the automation/);
});
