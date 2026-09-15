"use strict";

(function(){
  const natural=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:"base"});
  const cardId=card=>card.querySelector("[data-topology-id]")?.dataset.topologyId||"";
  const numericField=(card,field)=>Number(card.querySelector(`[data-topology-field="${field}"]`)?.value)||Number.MAX_SAFE_INTEGER;
  function sortColumn(column,kind){
    const current=[...column.children].filter(node=>node.classList?.contains("card"));
    const sorted=[...current].sort((a,b)=>{
      if(kind==="tv")return numericField(a,"output")-numericField(b,"output")||natural(cardId(a),cardId(b));
      if(kind==="source")return numericField(a,"input")-numericField(b,"input")||natural(cardId(a),cardId(b));
      return natural(cardId(a),cardId(b));
    });
    if(sorted.every((card,index)=>card===current[index]))return;
    for(const card of sorted)column.append(card);
  }
  function apply(){
    for(const editor of document.querySelectorAll("[data-room-topology-editor]")){
      const grid=editor.querySelector(":scope > .grid");if(!grid)continue;
      const columns=[...grid.children];
      if(columns[0])sortColumn(columns[0],"tv");
      if(columns[1])sortColumn(columns[1],"display");
      if(columns[2])sortColumn(columns[2],"source");
    }
  }
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;apply();});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener("change",event=>{
    if(event.target?.matches?.('[data-topology-field="output"],[data-topology-field="input"]'))apply();
  });
  window.addEventListener("load",apply);
  window.RoomGoblinTopologyOrder={apply};
})();
