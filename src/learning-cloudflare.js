'use strict';
// Add only the student hostname. Existing admin Access policies, ingress rules,
// connector installation, and zone settings are deliberately left untouched.
const {publicOrigin}=require('./learning-public');
const ROUTE='learning.publicRoute',DESTINATION='http://127.0.0.1:3030';
const fail=message=>{throw Object.assign(Error(message),{status:409});};
function mergeRoute(config,hostname){
 if(!config||!Array.isArray(config.ingress)||!config.ingress.length)fail('An existing tunnel configuration is required.');
 const rules=config.ingress,matching=rules.filter(r=>r.hostname?.toLowerCase()===hostname);
 if(matching.some(r=>r.service!==DESTINATION||r.path))fail('The student hostname already has a different tunnel route.');
 if(rules.at(-1).hostname||rules.at(-1).path||rules.at(-1).service!=='http_status:404')fail('The existing tunnel must end in a deny rule.');
 if(matching.length>1)fail('The student hostname has conflicting routes.');
 // Exact student route must precede catch-all or wildcard host rules; otherwise
 // a public student hostname could be sent to the full administrative origin.
 return {...config,ingress:[matching[0]||{hostname,service:DESTINATION},...rules.filter(rule=>rule.hostname?.toLowerCase()!==hostname)]};
}
async function publishStudentConnector(manager,{probe}={}){
 const storage=manager.storage,origin=publicOrigin(storage);if(!origin)fail('Enable and configure the student gateway first.');
 const settings=manager.saved(),hostname=new URL(origin).hostname;
 if(!settings.ids?.tunnelId||!settings.ids?.zoneId||!settings.ids?.accountId)fail('The existing managed tunnel must be provisioned first.');
 if(hostname===settings.hostname||hostname===settings.musicAssistantHostname||!hostname.endsWith('.'+settings.zone))fail('Use a separate student hostname inside the configured zone.');
 if(typeof probe!=='function'||!await probe(origin))fail('The isolated student listener did not pass its readiness check.');
 const client=manager.client(settings),account=settings.ids.accountId,zone=settings.ids.zoneId,tunnel=settings.ids.tunnelId,path=`/accounts/${account}/cfd_tunnel/${tunnel}/configurations`;
 const existing=await client.get(path),config=mergeRoute(existing?.config,hostname);
 const apps=await client.get(`/accounts/${account}/access/apps?per_page=100`);
 if(!Array.isArray(apps)||apps.length>=100)fail('Review Access coverage before publishing the student hostname.');
 const covered=value=>{const domain=String(value||'').toLowerCase().replace(/^https?:\/\//,'').split('/')[0];const pattern=domain.split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');return !!domain&&new RegExp('^'+pattern+'$').test(hostname);};
 if(apps.some(app=>[app.domain,...(app.self_hosted_domains||[]),...(app.destinations||[]).map(destination=>destination.uri||destination.hostname||'')].some(covered)))fail('An Access application covers the student hostname. Review it without weakening the admin policy.');
 const rows=await client.get(`/zones/${zone}/dns_records?name=${encodeURIComponent(hostname)}&per_page=100`),target=tunnel+'.cfargotunnel.com';
 if(!Array.isArray(rows)||rows.length>1||rows.some(r=>r.type!=='CNAME'||r.content!==target||r.proxied!==true))fail('The student hostname has a conflicting DNS record.');
 // Save rollback information privately in the encrypted-backup-managed database.
 const previous=storage.getPreference('learning.publicRoute.previous',null);
 if(previous&&previous.hostname!==hostname)fail('A previous student route has rollback information. Reconcile it before changing hostnames.');
 const rollback=previous||{config:existing.config,hostname,at:new Date().toISOString(),createdDns:false};
 storage.setPreference('learning.publicRoute.previous',rollback);
 await client.put(path,{config});
 let record=rows[0];
 if(!record)record=await client.post(`/zones/${zone}/dns_records`,{type:'CNAME',name:hostname,content:target,proxied:true,ttl:1,comment:'RoomGoblin isolated student connector'});
 const createdDns=!rows.length||(rollback.createdDns===true&&rollback.dnsId===record.id);
 storage.setPreference(ROUTE,{hostname,dnsId:record.id,createdDns,service:DESTINATION});
 storage.setPreference('learning.publicRoute.previous',{...rollback,createdDns,dnsId:record.id});
 return {ok:true,origin,adminAccessUnchanged:true};
}
module.exports={publishStudentConnector,mergeRoute,ROUTE,DESTINATION};
