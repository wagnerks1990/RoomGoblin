'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const source = fs.readFileSync(path.join(__dirname, '../public/shared/branding.js'), 'utf8');
function runtime() {
  const mark = {getAttribute(name){return this[name];}};
  const icon = {removeAttribute(name){delete this[name];}};
  const window = {dispatchEvent(){}, addEventListener(){}};
  const document = {
    documentElement: {lang:'en', dataset:{}, style:{setProperty(){}}},
    title:'Classroom Control Hub', body:{}, head:{append(){}},
    querySelector(selector){return selector === 'link[data-roomgoblin-brand]' ? {} : null;},
    querySelectorAll(selector){return selector === "link[rel~='icon']" ? [icon] : selector === '[data-brand-logo], .brandWrap .logo img' ? [mark] : [];},
    getElementById(){return null;}, createElement(){return {dataset:{}};}
  };
  vm.runInNewContext(source, {window, document, location:{pathname:'/display/'}, CustomEvent:class{}, fetch:()=>new Promise(()=>{})});
  return {api:window.RoomGoblinBranding, mark, icon, document, window};
}
test('brand defaults render before network and preserve shared compatibility aliases', () => {
  const {api, window, mark, icon, document} = runtime();
  assert.equal(window.ControlHubBranding, api);
  assert.equal(mark.src, '/brand/roomgoblin_app_192x192.png');
  assert.equal(icon.href, '/brand/roomgoblin_app_32x32.png');
  assert.equal(document.title, 'RoomGoblin');
  assert.equal(api.normalize({productName:'Classroom Hub',logoUrl:'/brand/roomgoblin_primary_400w.png'}).logoUrl, mark.src);
});
test('deliberate site identity survives; a broken custom logo falls back without retry loop', () => {
  const {api, mark, icon} = runtime();
  const profile=api.apply({productName:'Science Lab',school:'Example School',logoUrl:'/uploads/site.png',faviconUrl:'/uploads/site.ico',theme:{primary:'#123456'}});
  assert.equal(profile.productName,'Science Lab');
  assert.equal(profile.theme.primary,'#123456');
  assert.equal(mark.src,'/uploads/site.png');
  assert.equal(mark.alt,'Example School logo');
  assert.equal(icon.href,'/uploads/site.ico');
  assert.equal(icon.type,undefined);
  assert.equal(icon.sizes,undefined);
  mark.onerror();
  assert.equal(mark.src,'/brand/roomgoblin_app_192x192.png');
  mark.onerror();
  assert.equal(mark.onerror,null);
  assert.equal(mark.hidden,true);
});
test('every bundled PNG contains a complete decodable image stream and IEND', () => {
  for(const name of fs.readdirSync(path.join(__dirname,'../public/brand')).filter(x=>x.endsWith('.png'))){
    const bytes=fs.readFileSync(path.join(__dirname,'../public/brand',name));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name);
    const chunks=[];let end=false,width,height;
    for(let offset=8;offset<bytes.length;){
      const length=bytes.readUInt32BE(offset), type=bytes.toString('ascii',offset+4,offset+8);
      assert.ok(offset+length+12<=bytes.length,`${name}: truncated ${type}`);
      const data=bytes.subarray(offset+8,offset+8+length);
      if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6);}
      if(type==='IDAT')chunks.push(data);
      if(type==='IEND')end=true;
      offset+=length+12;
    }
    assert.ok(end,`${name}: missing IEND`);
    assert.equal(zlib.inflateSync(Buffer.concat(chunks)).length,(width*4+1)*height,name);
  }
});
