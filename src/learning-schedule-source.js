'use strict';
const crypto=require('node:crypto');

// Delegate calendar/cycle/exception resolution to the existing classroom planner.
function resolveLearningSchedule({classes,date,day,suppression,matches,segments,start,end,isTransition}){
 const catalog=classes.map(c=>({id:c.id,title:c.name,enabled:c.enabled!==false,transition:isTransition(c)})),active=[];
 if(!suppression.blocked){
  for(const cls of classes){
   if(cls.enabled===false||isTransition(cls)||!matches(cls,date))continue;
   for(const segment of segments(cls,date)){
    const startAt=start(cls,date,segment)?.getTime(),endAt=end(cls,date,segment)?.getTime();
    if(!Number.isSafeInteger(startAt)||!Number.isSafeInteger(endAt)||startAt>date.getTime()||endAt<=date.getTime())continue;
    const key=crypto.createHash('sha256').update(JSON.stringify([cls.id,day,segment.segmentId||segment.startTime,segment.endTime])).digest('hex');
    active.push({scheduleId:cls.id,key,startAt,endAt});
   }
  }
 }
 return {classes:catalog,active,day,blocked:suppression.blocked,reason:suppression.reason||''};
}
module.exports={resolveLearningSchedule};
