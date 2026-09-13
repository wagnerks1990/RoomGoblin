/* Navigation presentation only; authorization and page activation stay in app.js. */
(()=>{
  'use strict';
  const sidebar=document.getElementById('workspaceSidebar');
  const menu=document.getElementById('workspaceMenu');
  const search=document.getElementById('workspaceSearch');
  const groups=[...sidebar.querySelectorAll('.rg-nav-group')];
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.id='workspaceClose';closeButton.className='rg-menu-close';closeButton.textContent='Close navigation';sidebar.prepend(closeButton);closeButton.addEventListener('click',()=>closeMenu(true));
  const mobile=matchMedia('(max-width:1000px)');
  function closeMenu(restore=false){document.body.classList.remove('rg-menu-open');menu.setAttribute('aria-expanded','false');if(restore)menu.focus()}
  menu.addEventListener('click',()=>{const open=!document.body.classList.contains('rg-menu-open');document.body.classList.toggle('rg-menu-open',open);menu.setAttribute('aria-expanded',String(open));if(open)search.focus()});
  document.getElementById('workspaceBackdrop').addEventListener('click',()=>closeMenu(true));
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('rg-menu-open'))return;
    if(event.key==='Escape'){closeMenu(true);return}
    if(event.key==='Tab'){
      const items=[...sidebar.querySelectorAll('button,input,a,summary')].filter(x=>!x.hidden&&x.getClientRects().length&&!x.disabled);
      if(!items.length)return;const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  });
  mobile.addEventListener('change',()=>closeMenu());
  function sync(){
    const active=document.querySelector('.page.active');
    sidebar.querySelectorAll('[data-page]').forEach(button=>{if(button.dataset.page===active?.id){button.setAttribute('aria-current','page');const group=button.closest('details');if(group)group.open=true;document.getElementById('workspaceLocation').textContent=button.textContent}else button.removeAttribute('aria-current')});
  }
  sidebar.addEventListener('click',event=>{if(event.target.closest('[data-page]')){sync();if(mobile.matches){closeMenu();document.getElementById('workspaceMain').focus()}}});
  const observer=new MutationObserver(sync);document.querySelectorAll('.page').forEach(page=>observer.observe(page,{attributes:true,attributeFilter:['class']}));
  let previousOpen=null;
  function filterNavigation(){
    const query=search.value.trim().toLowerCase();
    if(query&&previousOpen===null)previousOpen=groups.map(group=>group.open);
    let matches=0;
    sidebar.querySelectorAll('nav [data-page],nav a').forEach(item=>{const match=item.textContent.toLowerCase().includes(query);item.style.display=match?'':'none';if(match&&!item.hidden)matches++});
    groups.forEach((group,index)=>{const any=[...group.querySelectorAll('[data-page],a')].some(item=>!item.hidden&&item.style.display!=='none');group.hidden=!any;if(query)group.open=any;else if(previousOpen)group.open=previousOpen[index]});
    document.getElementById('workspaceSearchEmpty').hidden=matches>0;
    if(!query){previousOpen=null;sync()}
  }
  search.addEventListener('input',filterNavigation);
  function syncAuthorization(){
    sidebar.querySelectorAll('[data-managed-displays-link]').forEach(link=>{link.hidden=typeof userCan==='function'?!userCan('admin'):true});
    filterNavigation();
  }
  window.addEventListener('roomgoblin:authchange',syncAuthorization);
  syncAuthorization();
  sync();
})();
