"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {arbiter,sourceUrl}=require('../src/sports-arbiter'),model=require('../src/sports'),{createSportsService}=require('../src/sports-service');
const url='https://www.arbiterlive.com/Teams/Schedule/123',team={id:'t',name:'Example soccer',sport:'Girls soccer',category:'girls',level:'varsity',season:'2026-27'};
function page({label='Girls Varsity Soccer',season='2026-27',date='Fri Oct 23 7:00 PM',result='L 0-3',status='Normal',game='1234',venue='Example Stadium',home='@'}={}){
 return `<div class="layout"><div class="sport-header">${label} <span>(0 - 1)</span></div></div><select id="SelectedSchoolYearID"><option>2025-26</option><option selected="selected">${season}</option></select><table class="table table-schedule"><thead><tr><th>Date/Time</th><th><span>Home or Away</span>&nbsp;</th><th>Opponent</th><th>Location</th><th>Results</th><th>Status</th></tr></thead><tbody><tr data-gameid="${game}" data-isgame="true"><td>${date}</td><td>${home}</td><td>Example &amp; Visitors</td><td>${venue}</td><td>${result}</td><td>${status}</td></tr></tbody></table>`;
}
const parse=opts=>arbiter(page(opts),url,team,'America/New_York').events;
test('public Arbiter schedules import verified team scores, venue and school-timezone dates',()=>{
 const e=parse()[0];assert.equal(e.startAt,'2026-10-23T23:00:00.000Z');assert.equal(e.score,0);assert.equal(e.opponentScore,3);assert.equal(e.status,'final');assert.equal(e.opponent,'Example & Visitors');assert.equal(e.homeAway,'away');assert.equal(e.venue,'Example Stadium');
 assert.equal(parse({date:'Mon Jan 18 4:00 PM',home:''})[0].startAt,'2027-01-18T21:00:00.000Z');assert.equal(parse({home:''})[0].homeAway,'neutral');
 assert.equal(parse({result:'T 2-2 (2OT)'})[0].status,'final');assert.equal(parse({result:'W 3-0 SETS'})[0].score,3);
 assert.equal(parse({venue:'A &amp;#39; B &#x26; C'})[0].venue,'A &#39; B & C');
});
test('Arbiter identity survives reschedules and distinguishes cancellations from missing results',()=>{
 const a=parse({result:''})[0],b=parse({date:'Sat Oct 24 10:00 AM',result:''})[0];assert.equal(a.id,b.id);assert.equal(a.sourceId,b.sourceId);assert.equal(a.score,null);assert.equal(a.status,'scheduled');assert.equal(parse({status:'Canceled'})[0].status,'cancelled');assert.equal(parse({status:'Postponed'})[0].status,'postponed');assert.equal(parse({status:'Canceled'})[0].score,null);assert.equal(parse({date:'Fri Oct 23 TBA'}).length,0);
});
test('Arbiter parser fails closed on wrong team, season, schema or contradictory results',()=>{
 for(const opts of [{label:'Boys Varsity Soccer'},{label:'Girls JV Soccer'},{label:'Girls Varsity Soccerball'},{season:'2025-26'},{season:'2026-28'},{result:'W 0-3'},{date:'Fri Feb 30 7:00 PM'},{game:'missing'}])assert.throws(()=>parse(opts));
 assert.throws(()=>arbiter(page().replace('Results','Score'),url,team,'UTC'),/columns/);
 assert.throws(()=>arbiter(page().replace('table-schedule','other'),url,team,'UTC'),/table/);
});
test('Arbiter accepts only public team URLs, including numeric school selectors',()=>{
 assert.equal(sourceUrl(url+'?activeEntityId=456').hostname,'www.arbiterlive.com');
 for(const bad of ['https://evil.example/Teams/Schedule/123','https://www.arbiterlive.com/School/Calendar/123',url+'?unreviewed=x',url+'?activeEntityId=abc',url+'?token=secret','http://www.arbiterlive.com/Teams/Schedule/123'])assert.throws(()=>sourceUrl(bad));
 assert.throws(()=>model.normalize({teams:[{...team,sources:[{id:'s',kind:'arbiter',url:'https://example.org/Teams/Schedule/123',enabled:true,approved:true}]}]}));
});
test('Arbiter refresh updates one existing game and keeps the last verified score after a source regression',async()=>{
 let html=page({result:'',date:'Fri Oct 23 7:00 PM'});const values=new Map([[model.KEY,model.normalize({timezone:'America/New_York',teams:[{...team,sources:[{id:'official',kind:'arbiter',url,enabled:true,approved:true}]}]})]]);
 const s=createSportsService({store:require('./helpers/preference-store.cjs')(values),fetchImpl:async()=>({body:Buffer.from(html)})});
 await s.refresh(true);const id=s.read().events[0].id;html=page({date:'Sat Oct 24 10:00 AM',result:'W 3-0'});await s.refresh(true);assert.equal(s.read().events.length,1);assert.equal(s.read().events[0].id,id);assert.equal(s.read().events[0].startAt,'2026-10-24T14:00:00.000Z');assert.equal(s.read().events[0].score,3);
 html=page({date:'Sat Oct 24 10:00 AM',result:''});await s.refresh(true);assert.equal(s.read().events[0].status,'final');html=page({season:'2027-28'});await s.refresh(true);assert.equal(s.read().events[0].score,3);assert.equal(s.status()['t:official'].state,'unavailable');
});
