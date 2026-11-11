"use strict";
// Preserve bookmarked class/assignment context while retiring the duplicate UI.
const target=new URL('/learn/teacher/',location.origin);
for(const [key,value]of new URLSearchParams(location.search))if(['class','activity','view'].includes(key))target.searchParams.set(key,value);
if(!target.searchParams.has('view'))target.searchParams.set('view',location.hash==='#settings'?'setup':'classroom');
location.replace(target.pathname+target.search);
