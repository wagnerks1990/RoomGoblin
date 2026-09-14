'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('public/controller/app.js', 'utf8');
const lighting = app.slice(app.indexOf('async function loadGovee()'), app.indexOf("const days=['Sun'"));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('lighting cards escape names and aliases while retaining command routes and settings IDs', () => {
  const context = {esc, inlineJsArg: value => `decodeInlineValue('${Buffer.from(value).toString('base64')}')`};
  vm.createContext(context); vm.runInContext(lighting, context);
  const markup = context.lightCard('front-light', '<img onerror="bad">', {}, false, {}, {}, {groups:['<hall>']});
  assert.ok(!markup.includes('<img'));
  assert.ok(markup.includes('&lt;img onerror=&quot;bad&quot;&gt;'));
  assert.ok(markup.includes('id="edit_front-light_name"'));
  assert.ok(markup.includes('id="l_front_light_s"'));
  for (const action of ['on','off','brightness','color','temp','scene']) assert.ok(markup.includes(`'${action}'`));
  assert.ok(markup.includes('data-command-unavailable="true"'));
});

test('invalid MQTT color channels produce valid bounded color input values', () => {
  const context = {}; vm.createContext(context); vm.runInContext(lighting, context);
  assert.equal(context.colorToHex({r:999,g:-20,b:'bad'}), '#ff0000');
  assert.equal(context.colorToHex({r:15,g:118,b:110}), '#0f766e');
});

test('failed lighting commands report an error without refreshing away pending edits', async () => {
  const message = {textContent:''}; let refreshed = false;
  const context = {document:{getElementById:()=>message}, jpost:async()=>{throw new Error('MQTT unavailable')},setTimeout:()=>{refreshed=true}};
  vm.createContext(context); vm.runInContext(lighting, context);
  assert.equal(await context.goveeCmd('front light','on'), null);
  assert.equal(message.textContent, 'front light: MQTT unavailable');
  assert.equal(refreshed, false);
});
