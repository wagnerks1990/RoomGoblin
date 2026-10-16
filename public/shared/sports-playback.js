/* Progress evidence and bounded recovery for the Sports receiver's own video. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RoomGoblinSportsPlayback=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function frames(video){
    try{
      const quality=video.getVideoPlaybackQuality?.();
      if(Number.isFinite(quality?.totalVideoFrames))return Math.max(0,quality.totalVideoFrames-(quality.droppedVideoFrames||0));
      if(Number.isFinite(video.webkitDecodedFrameCount))return video.webkitDecodedFrameCount;
    }catch{}
    return null;
  }
  function watchdog(){
    let time=0,count=null,timeAt=0,frameAt=0,nextAt=0,recoveredAt=0,stage=0;
    function reset(at,current=0,decoded=null){time=current;count=decoded;timeAt=frameAt=at;nextAt=at+12;recoveredAt=at;stage=0;}
    function jumped(current,decoded){time=current;count=decoded;}
    function observe(at,current,decoded){
      const delta=current-time;
      if(delta>.1||delta<0){if(delta>0&&delta<2)timeAt=at;time=current;}
      if(Number.isFinite(decoded)){
        if(count!==null&&decoded>count)frameAt=at;
        count=decoded;
      }
      const timeFresh=at-timeAt<2,framesFresh=decoded===null||at-frameAt<2;
      if(timeFresh&&framesFresh&&at-recoveredAt>3)stage=0;
      if(at<nextAt||at-timeAt<12&&(decoded===null||at-frameAt<12))return 'none';
      const action=['resume','seek','reattach','skip'][Math.min(stage++,3)];
      recoveredAt=at;nextAt=at+12;return action;
    }
    reset(0);return {reset,jumped,observe};
  }
  function pageDuration(board,height,cycle){
    return Math.max(board.minimumSeconds,cycle?board.entryDelay+2+(height+cycle)/board.rosterSpeed:0);
  }
  return {frames,watchdog,pageDuration};
});
