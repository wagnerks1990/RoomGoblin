export const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
export const retired=()=>Object.assign(Error('The workspace changed.'),{retired:true});
export const dateText=value=>value?new Date(value).toLocaleString():'—';
export function field(form,label,type='text',value='',attrs={}){
 const wrap=node('label',label),input=node(['textarea','select'].includes(type)?type:'input');
 if(!['textarea','select'].includes(type))input.type=type;
 input.setAttribute('aria-label',label);Object.assign(input,attrs);if(type==='checkbox'){input.checked=value===true;wrap.className='check';}else input.value=value??'';
 wrap.append(input);form.append(wrap);return input;
}
export function choices(select,items,selected){select.replaceChildren(...items.map(x=>new Option(x.label,x.id)));if(selected!==undefined&&items.some(x=>x.id===String(selected)))select.value=String(selected);}
export function detail(title,key){const d=node('details');if(key)d.dataset.key=key;d.append(node('summary',title));return d;}
export function table(rows,columns,empty='No records for this class yet.'){
 if(!rows.length)return node('p',empty,'muted');
 const t=node('table'),head=node('thead'),tr=node('tr');
 for(const [label]of columns){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);t.append(head);
 const body=node('tbody');for(const row of rows){const line=node('tr');for(const [,value]of columns)line.append(node('td',value(row)));body.append(line);}t.append(body);return t;
}
export function createUI({api,notice,context,owned,onSaved,onCatalog,onTools}){
 const dirty=new Set();let signatures=new WeakMap();
 const ui={api,notice,context,owned,onSaved,onCatalog,onTools,dirty,node,field,choices,detail,table};
 ui.assert=ctx=>{if(!owned(ctx))throw retired();};
 ui.run=async(button,fn)=>{if(button.disabled)return;const owner=context();button.disabled=true;try{await fn();}catch(error){if(!error.retired&&(!owner||owned(owner)))notice(error.message);}finally{if(button.isConnected)button.disabled=false;}};
 ui.button=(label,fn,attrs={})=>{const b=node('button',label);b.type='button';Object.assign(b,attrs);b.onclick=()=>ui.run(b,fn);return b;};
 ui.save=(form,label,fn,ctx,{refresh=true}={})=>{
  const b=node('button',label);b.type='submit';form.append(b);
  form.onsubmit=event=>{event.preventDefault();ui.run(b,async()=>{ui.assert(ctx);await fn();ui.assert(ctx);dirty.delete(form);if(refresh)await onSaved(ctx);notice(dirty.size?'Saved. Other unsaved drafts remain open.':'Saved to RoomGoblin.');});};return b;
 };
 ui.canLeave=()=>!dirty.size||confirm('Discard unsaved changes?');
 ui.clear=()=>{dirty.clear();signatures=new WeakMap();};
 ui.draw=(host,value,render,{force=false}={})=>{
  const signature=JSON.stringify(value);if(!force&&signatures.get(host)===signature)return true;
  const hasDraft=[...dirty].some(form=>host.contains(form)),focused=host.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select');
  if(hasDraft||focused&&!force)return false;
  const open=new Set([...host.querySelectorAll('details[open][data-key]')].map(d=>d.dataset.key));
  render();for(const d of host.querySelectorAll('details[data-key]'))if(open.has(d.dataset.key))d.open=true;
  signatures.set(host,signature);return true;
 };
 for(const type of ['input','change'])document.addEventListener(type,event=>{const f=event.target.closest('form');if(f&&f.id!=='login-form')dirty.add(f);});
 window.addEventListener('beforeunload',event=>{if(dirty.size){event.preventDefault();event.returnValue='';}});
 return ui;
}
