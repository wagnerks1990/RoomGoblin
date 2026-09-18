'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const controller = fs.readFileSync(path.join(__dirname, '..', 'public', 'controller', 'app.js'),'utf8');
const branding = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'branding.js'),'utf8');

test('scheduled automation selectors use resolved occurrence time and time ordering', () => {
  assert.match(controller, /function scheduledAutomationSortKey\(e\)/);
  assert.match(controller, /resolvedOccurrences/);
  assert.match(controller, /localeCompare/);
  assert.match(controller, /syncScheduledAutomationSelectors/);
});

test('linked schedule descriptions use resolved occurrences without a browser hotfix', () => {
  assert.match(controller, /function scheduledAutomationDescription\(e\)/);
  assert.match(controller, /scheduleDescription\(occ\)/);
  assert.match(controller, /\.join\(" \| "\)/);
  assert.doesNotMatch(branding, /automation-hotfix\.js/);
});
