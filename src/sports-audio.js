"use strict";
// Sound intent belongs to the scheduled scene; the referenced board must exist.
function commandAudio(command,config){
 if(command?.type!=="display.text")return null;
 const layers=command.payload?.scene?.layers;
 if(!Array.isArray(layers))return null;
 const ids=layers.filter(l=>l.type==='widget'&&l.widget==='sports-board'&&l.visible!==false);
 if(!ids.length)return null;
 return ids.some(layer=>layer.sportsAudio===true&&layer.sportsVolume>0&&config.boards.some(b=>b.id===layer.sportsBoardId));
}
module.exports={commandAudio};
