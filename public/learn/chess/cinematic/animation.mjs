// Original presentation choreography. Only the renderer's confirmed snapshot starts it.
// This module neither reads a game service nor infers a capture or a winner.
const TAU=Math.PI*2;
const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const pulse=(t,center,width)=>Math.max(0,1-Math.abs(t-center)/width);
const angleDelta=(from,to)=>((to-from+Math.PI*3)%TAU)-Math.PI;
const point=p=>({x:Number.isFinite(p?.x)?p.x:0,y:Number.isFinite(p?.y)?p.y:0,z:Number.isFinite(p?.z)?p.z:0});
const arrayMix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));

// Leg points down local -Y; +X at the hip steps toward local -Z.
// A negative knee bends backward. The ankle compensates to keep the foot level.
export function solveLegIK(forward,height,upper=0.26,lower=0.26){
 upper=clamp(upper,0.05,2);lower=clamp(lower,0.05,2);height=clamp(height,0.01,upper+lower);
 forward=clamp(forward,-upper-lower,upper+lower);
 const distance=clamp(Math.hypot(forward,height),Math.abs(upper-lower)+0.0001,upper+lower-0.0001);
 const hip=Math.atan2(forward,height)+Math.acos(clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
 const knee=-(Math.PI-Math.acos(clamp((upper*upper+lower*lower-distance*distance)/(2*upper*lower),-1,1)));
 return {hip,knee,ankle:-hip-knee};
}
function stance(){return {joints:[0,0,0.12,0.12],lower:[0,0,0.30,0.30],side:[0,0,0.06,-0.06],twist:[0,0,0,0],chest:[0,0,0],head:[0,0,0],weapon:-0.12,crouch:0,lean:0,lift:0};}
function pose(values={}){return {...stance(),...values};}
function blend(a,b,t){const result={};for(const key of ['joints','lower','side','twist','chest','head'])result[key]=arrayMix(a[key],b[key],t);for(const key of ['weapon','crouch','lean','lift'])result[key]=lerp(a[key],b[key],t);return result;}
function keypose(t,frames){if(t<=frames[0][0])return frames[0][1];for(let i=1;i<frames.length;i++)if(t<=frames[i][0])return blend(frames[i-1][1],frames[i][1],ramp(t,frames[i-1][0],frames[i][0]));return frames.at(-1)[1];}
function walking(distance,weight,kind,legLength){
 const result=stance(),stride=kind==='r'?0.60:kind==='n'?0.76:0.68,phase=distance/stride;
 for(let i=0;i<2;i++){
  const cycle=((phase+i*0.5)%1+1)%1,contact=0.64,range=stride*contact/2,swing=clamp((cycle-contact)/(1-contact));
  const forward=cycle<contact?range-stride*cycle:lerp(-range,range,ease(swing));
  const lift=cycle<contact?0:Math.sin(swing*Math.PI)*0.085;
  const leg=solveLegIK(forward,legLength*2-0.055-lift,legLength,legLength),neutral=solveLegIK(0,legLength*2-0.055,legLength,legLength);
  result.joints[i]=(leg.hip-neutral.hip)*weight;result.lower[i]=(leg.knee-neutral.knee)*weight;
  result.joints[2+i]=-Math.sin(TAU*(phase+i*0.5))*0.20*weight+0.16;result.lower[2+i]=0.35+0.12*weight;
 }
 result.chest=[-0.04*weight,Math.sin(TAU*phase)*0.035*weight,-Math.sin(TAU*phase)*0.022*weight];
 result.head=[0,Math.sin(TAU*phase)*-0.025*weight,0];result.lean=-0.035*weight;
 result.weapon=-0.10+Math.sin(TAU*phase)*0.045*weight;
 return {pose:result,bob:(Math.cos(TAU*phase*2)-1)*0.009*weight,sway:Math.sin(TAU*phase)*0.017*weight};
}
function quietPose(values={}){return pose({joints:[0,0,0,0],lower:[0,0,0,0],side:[0,0,0,0],weapon:0,...values});}
function horseWalking(distance,weight){
 const phase=distance/0.78,result=quietPose();
 // Diagonal pairs: left hind/right fore, then right hind/left fore.
 for(const [i,offset]of [0,0.5,0.5,0].entries()){
  const step=Math.sin(TAU*(phase+offset));result.joints[i]=step*0.34*weight;result.lower[i]=-Math.max(0,-step)*0.52*weight;
 }
 result.chest=[Math.sin(TAU*phase*2)*0.018*weight,0,0];result.head=[Math.sin(TAU*phase*2+0.6)*0.025*weight,0,0];result.lean=-0.045*weight;
 return {pose:result,bob:Math.abs(Math.sin(TAU*phase*2))*0.038*weight,sway:Math.sin(TAU*phase)*0.010*weight};
}
function formFrames(kind,defender=false){
 const rest=quietPose();
 if(kind==='r')return [[0,rest],[0.43,rest],[0.50,quietPose({lean:0.035})],[0.548,quietPose({lean:-0.07})],[0.59,rest],[0.655,quietPose({lean:defender?-0.07:0.045})],[0.72,quietPose({lean:0.05})],[0.785,quietPose({lean:-0.12,crouch:0.02})],[0.85,rest],[1,rest]];
 if(kind!=='n')return null;
 const guard=quietPose({joints:[-0.04,-0.04,0.06,0.06],lower:[-0.03,-0.03,-0.08,-0.08],head:[-0.025,0,0]});
 const rear=quietPose({joints:[-0.14,-0.14,0.32,0.32],lower:[-0.16,-0.16,-0.45,-0.45],chest:[0.06,0,0],head:[-0.08,0,0],lean:0.18,lift:0.07});
 const hoof=quietPose({joints:[0.08,0.08,-0.35,-0.35],lower:[-0.06,-0.06,0.26,0.26],chest:[-0.06,0,0],head:[0.09,0,0],lean:-0.07});
 const flinch=quietPose({joints:[0.14,0.04,0.17,0.06],lower:[-0.28,-0.18,-0.25,-0.15],chest:[0.10,-0.04,0.06],head:[0.15,0.08,0.10],lean:0.09,crouch:0.03});
 const leap=quietPose({...rear,joints:[-0.2,-0.2,0.44,0.44],lower:[-0.35,-0.35,-0.60,-0.60],lean:0.25,lift:0.18});
 const folded=quietPose({joints:[0.35,0.40,0.30,0.35],lower:[-0.85,-0.9,-0.8,-0.9],chest:[0.18,0.06,0.10],head:[0.25,0.08,0.15],crouch:0.10,lean:0.14});
 return defender?[[0,rest],[0.36,guard],[0.50,rear],[0.548,flinch],[0.60,rear],[0.655,hoof],[0.71,guard],[0.77,rear],[0.80,flinch],[0.90,folded],[1,folded]]:[[0,rest],[0.10,guard],[0.43,guard],[0.50,rear],[0.548,hoof],[0.59,guard],[0.655,flinch],[0.72,leap],[0.785,hoof],[0.84,guard],[1,rest]];
}
function actor(position,yaw,action,scale=1){return {position,rotation:{x:action.lean,y:yaw,z:0},scale,action};}

/** Deterministic, bounded shot. Elapsed time never changes a chess result. */
export function createChoreography({from,to,defenderFrom,baseYaw=0,defenderYaw=Math.PI,capture=false,kind='p',defenderKind='p',fast=false,reduced=false,legLength=0.26}={}){
 from=point(from);to=point(to);const defenderOrigin=point(defenderFrom||to),target=capture?defenderOrigin:to,dx=target.x-from.x,dz=target.z-from.z,distance=Math.hypot(dx,dz),direction=distance>0.00001?{x:dx/distance,z:dz/distance}:{x:0,z:-1};
 const facing=Math.atan2(-direction.x,-direction.z),defenderFacing=facing+Math.PI;
 const duration=reduced?0:fast?(capture?950:620):capture?clamp(8200+distance*300,8500,12200):clamp(1800+distance*620,2200,6200);
 const engagement=Math.min(0.72,distance*0.65),walkDistance=capture?Math.max(0,distance-engagement):distance;
 const finalStep={x:to.x-from.x-direction.x*walkDistance,z:to.z-from.z-direction.z*walkDistance},finalDistance=Math.hypot(finalStep.x,finalStep.z);
 const approachEnd=capture?clamp(0.25+distance*0.018,0.26,0.41):0.84;
 const guard=pose({joints:[0.08,0.04,0.42,0.28],lower:[-0.10,-0.08,0.90,0.55],chest:[-0.035,0,0],weapon:-0.30,crouch:0.018});
 const windup=pose({joints:[0.17,-0.10,0.72,kind==='p'?0.42:2.12],lower:[-0.3,-0.17,0.9,0.82],chest:[0.02,-0.28,-0.04],head:[-0.05,0.16,0],weapon:kind==='p'?-0.40:0.48,crouch:0.028,lean:0.035});
 const strike=pose({joints:[0.24,-0.09,0.58,kind==='p'?0.92:1.10],lower:[-0.35,-0.14,0.72,0.26],chest:[-0.08,0.21,0.04],head:[-0.05,-0.08,0],weapon:kind==='p'?-1.18:-1.25,crouch:0.015,lean:-0.065});
 const recover=pose({joints:[0.09,0.1,0.72,0.72],lower:[-0.20,-0.18,1.10,0.7],chest:[0.10,-0.10,-0.05],head:[0.08,0.03,0.03],weapon:-0.60,crouch:0.04,lean:0.055});
 const duck=pose({joints:[0.50,0.46,0.95,0.52],lower:[-0.92,-0.88,1.22,1.02],chest:[-0.16,-0.12,0.07],head:[0.10,0.10,-0.04],weapon:-0.76,crouch:0.08,lean:-0.035});
 const heavyWind=pose({joints:[0.28,-0.08,0.62,2.44],lower:[-0.48,-0.12,0.9,0.90],chest:[0.06,-0.37,-0.08],head:[-0.08,0.12,0],weapon:0.65,crouch:0.045,lean:0.025});
 const finish=pose({joints:[0.42,-0.12,0.64,1.20],lower:[-0.64,-0.15,0.9,0.34],chest:[-0.13,0.30,0.06],head:[-0.08,-0.08,0],weapon:kind==='p'?-1.36:-1.62,crouch:0.03,lean:-0.11});
 const follow=pose({joints:[0.25,0.04,0.45,0.69],lower:[-0.4,-0.2,0.8,0.45],chest:[-0.09,0.17,0.025],weapon:-2.0,crouch:0.025,lean:-0.07});
 const block=pose({joints:[0.15,-0.10,1.12,0.72],lower:[-0.27,-0.12,0.90,1.02],chest:[0.04,-0.15,0.06],head:[-0.04,0.05,-0.04],weapon:-0.92,crouch:0.025,lean:0.025});
 const hit=pose({joints:[0.30,-0.1,0.86,0.40],lower:[-0.55,-0.13,1.10,0.70],chest:[0.17,-0.28,0.12],head:[0.17,0.1,0.14],weapon:0.24,crouch:0.05,lean:0.095});
 const collapse=pose({joints:[0.76,0.62,0.65,0.42],lower:[-1.35,-1.40,1.0,0.85],chest:[0.58,-0.15,0.24],head:[0.36,0.18,0.30],weapon:0.40,crouch:0.12,lean:0.28});
 const attFrames=[[0,stance()],[0.10,guard],[0.43,guard],[0.49,windup],[0.548,strike],[0.59,recover],[0.66,duck],[0.72,heavyWind],[0.785,finish],[0.83,follow],[0.89,guard],[1,stance()]];
 const defFrames=[[0,stance()],[0.36,guard],[0.50,block],[0.548,hit],[0.59,block],[0.62,windup],[0.655,strike],[0.70,guard],[0.76,block],[0.79,hit],[0.89,collapse],[1,collapse]];
 return {duration,fast,reduced,contacts:capture?[0.548,0.655,0.785]:[],sample(elapsed){
  const t=duration?clamp(elapsed/duration):1,finished=t===1;
  if(finished)return {finished:true,t,phase:'settled',attacker:actor({...to},baseYaw,pose({joints:[0,0,0,0],lower:[0,0,0,0],side:[0,0,0,0]})),defender:null,camera:{x:0,y:0,z:0},dust:0,collapse:1,chipAge:Infinity,halo:1};
  const walk=ramp(t,0.10,approachEnd),settle=capture?ramp(t,0.90,1):0;
  const traveled=walkDistance*walk+(capture?finalDistance*settle:0),walkWeight=Math.sin(Math.PI*walk)*0.65+Math.min(walk*8,(1-walk)*8,1)*0.35;
  const gait=kind==='n'?horseWalking(traveled,clamp(walkWeight)):kind==='r'?{pose:quietPose({lean:-Math.sin(Math.PI*walk)*0.018}),bob:Math.sin(traveled*9)*0.004*walkWeight,sway:0}:walking(traveled,clamp(walkWeight),kind,legLength);
  let action=gait.pose;
  if(kind==='n'&&!capture){
   const flight=Math.sin(Math.PI*ramp(walk,0.08,0.92)),fold=clamp(flight*1.6);
   const tucked=quietPose({joints:[-0.18,-0.18,0.30,0.30],lower:[-0.65,-0.65,-0.58,-0.58],chest:[-0.025,0,0],head:[0.04,0,0],lean:0.09*Math.cos(Math.PI*walk),lift:0.76*flight});
   action=blend(gait.pose,tucked,fold);action.lift=0.76*flight;
  }
  if(capture){const combat=keypose(t,formFrames(kind)||attFrames),combatWeight=ramp(t,approachEnd-0.02,approachEnd+0.07)*(1-ramp(t,0.89,0.99));action=blend(action,combat,combatWeight);}
  const anticipation=Math.sin(Math.PI*ramp(t,0,0.10))*0.016;
  const lunge=capture?(pulse(t,0.548,0.04)*0.09-pulse(t,0.655,0.045)*0.10+pulse(t,0.785,0.045)*0.12):0;
  const lateral=gait.sway*(1-ramp(t,0.88,1)),attPosition={x:from.x+direction.x*(walkDistance*walk+lunge)+(capture?finalStep.x*settle:0)+direction.z*lateral,y:from.y+gait.bob-anticipation-action.crouch+action.lift,z:from.z+direction.z*(walkDistance*walk+lunge)+(capture?finalStep.z*settle:0)-direction.x*lateral};
  const turnIn=ramp(t,0.01,0.13),turnOut=ramp(t,capture?0.91:0.84,1),yaw=baseYaw+angleDelta(baseYaw,facing)*turnIn*(1-turnOut);
  const attacker=actor(attPosition,yaw,action);
  let defender=null,fall=0;
  if(capture){const defAction=keypose(t,formFrames(defenderKind,true)||defFrames),recoil=pulse(t,0.556,0.038)*0.06-pulse(t,0.655,0.04)*0.075+ramp(t,0.785,0.88)*0.18;fall=ramp(t,0.80,0.95);const defPosition={x:defenderOrigin.x+direction.x*recoil+direction.z*fall*0.11,y:defenderOrigin.y-defAction.crouch*0.65+defAction.lift,z:defenderOrigin.z+direction.z*recoil-direction.x*fall*0.11};defender=actor(defPosition,defenderYaw+angleDelta(defenderYaw,defenderFacing)*ramp(t,0.25,0.43),defAction,1-ramp(t,0.95,1));defender.rotation.z=fall*1.18;}
  const camera={x:0,y:0,z:0};if(capture&&!fast)for(const [contact,amplitude]of [[0.548,0.010],[0.655,0.013],[0.785,0.032]]){const age=(t-contact)*duration/1000;if(age>=0&&age<0.25){const beat=Math.sin(age*76)*Math.exp(-age*18)*amplitude;camera.x+=beat;camera.y+=Math.cos(age*62)*Math.exp(-age*21)*amplitude*0.45;camera.z+=beat*0.30;}}
  const chipAge=capture?(t-0.785)*duration/1000:-1,dust=capture?Math.max(pulse(t,0.55,0.025)*0.35,pulse(t,0.79,0.075),pulse(t,0.88,0.04)*0.5):0;
  return {finished:false,t,phase:t<0.10?'anticipation':t<approachEnd?'approach':!capture?'settle':t<0.49?'challenge':t<0.60?'block':t<0.70?'counter':t<0.81?'finisher':t<0.94?'collapse':'recover',attacker,defender,camera,dust,collapse:fall,chipAge,halo:1+Math.sin(t*Math.PI)*0.2};
 }};
}
function setRotation(object,angles){if(object?.rotation)object.rotation.set(angles[0],angles[1],angles[2]);}
function applyActor(mesh,actorPose,time=0){
 if(!mesh||!actorPose)return;mesh.position.set(actorPose.position.x,actorPose.position.y,actorPose.position.z);mesh.rotation.set(actorPose.rotation.x,actorPose.rotation.y,actorPose.rotation.z);mesh.scale.setScalar((mesh.userData.baseScale||1)*Math.max(0.001,actorPose.scale));
 const p=actorPose.action,joints=mesh.userData.joints||[],rig=mesh.userData.rig||{},rest=mesh.userData.restJoints||[],restLower=mesh.userData.restLower||[];
 const restValue=value=>typeof value==='number'?value:(value?.x||0);
 for(let i=0;i<joints.length;i++){setRotation(joints[i],[restValue(rest[i])+(p.joints[i]||0),p.twist[i]||0,p.side[i]||0]);const lower=joints[i].userData.lower;if(lower)lower.rotation.x=restValue(restLower[i])+(p.lower[i]||0);if(i<2&&rig.feet?.[i])rig.feet[i].rotation.x=-(p.joints[i]+p.lower[i]);}
 setRotation(rig.chest,[(mesh.userData.restChest||0)+p.chest[0],p.chest[1],p.chest[2]]);setRotation(rig.head,[(mesh.userData.restHead||0)+p.head[0],p.head[1],p.head[2]]);
 // A hand-parented weapon pivot keeps its point in the intended contact plane.
 if(rig.weapon){const restAngle=restValue(rest[3])+restValue(restLower[3]),weight=ramp(time,0,0.10)*(1-ramp(time,0.91,1)),desired=lerp(restAngle,p.weapon,weight);rig.weapon.rotation.x=desired-(joints[3]?.rotation.x||0)-(joints[3]?.userData.lower?.rotation.x||0);}
}
function cameraImpact(cinema,a,shot){
 if(!cinema.camera?.position)return;const current=cinema.camera.position,last=a.lastCameraPosition;
 if(!a.cameraBase||last&&Math.hypot(current.x-last.x,current.y-last.y,current.z-last.z)>0.002)a.cameraBase={x:current.x,y:current.y,z:current.z};
 const base=a.cameraBase,offset=shot.camera;
 // Overview is the default. A host-controlled optional battle camera is
 // presentation only and returns completely to the seat's overview at the end.
 const enabled=!!(a.battleCamera??cinema.battleCamera)&&!!a.captured&&!a.choreography.fast&&!a.choreography.reduced;
 const push=enabled?ramp(shot.t,0.15,0.40)*(1-ramp(shot.t,0.84,0.99)):0;
 const focus={x:((shot.defender?.position.x??a.to.x)+shot.attacker.position.x)*0.5,y:0.75,z:((shot.defender?.position.z??a.to.z)+shot.attacker.position.z)*0.5},flat=Math.hypot(base.x,base.z)||1;
 const desired={x:focus.x+base.x/flat*5.5,y:focus.y+3.6,z:focus.z+base.z/flat*5.5};
 current.set(lerp(base.x,desired.x,push)+offset.x,lerp(base.y,desired.y,push)+offset.y,lerp(base.z,desired.z,push)+offset.z);
 if(enabled||a.hadBattleCamera)cinema.camera.lookAt?.(focus.x*push,lerp(0.15,focus.y,push),focus.z*push);
 a.hadBattleCamera=enabled;a.lastCameraPosition={x:current.x,y:current.y,z:current.z};cinema.cameraBusy=push>0.01;
}

function stoneChips(cinema,a,shot){
 if(shot.finished||shot.chipAge<0||!a.captured)return;const origin=a.defenderFrom||a.to;
 if(!a.chips&&cinema.makeStoneChips)a.chips=cinema.makeStoneChips({x:origin.x,y:0.88,z:origin.z},a.captured.userData.token,8)||[];
 for(const [index,chip]of (a.chips||[]).entries()){
  const angle=index*2.399963229728653,radius=0.055+(index%3)*0.018,speed=0.34+(index%4)*0.10,age=Math.max(0,shot.chipAge),landing=(1.4+Math.sqrt(1.96+2*4.2*0.88))/4.2;
  const air=Math.min(age,landing),height=age<landing?0.88+1.4*air-2.1*air*air:Math.max(0,0.08-Math.abs(Math.sin((age-landing)*16))*0.06)*Math.exp(-(age-landing)*4);
  chip.position.set(origin.x+Math.cos(angle)*speed*air,Math.max(radius,height),origin.z+Math.sin(angle)*speed*air);chip.rotation.set(index+air*3.4,index*0.6+air*2.5,air*4.1);chip.scale.setScalar(Math.max(0.001,1-ramp(shot.t,0.96,1)));
 }
}

export function advanceCinema(cinema,now){
 const a=cinema.animation;if(!a)return;
 if(!a.choreography){a.defenderFrom=point(a.captured?.position||a.to);a.choreography=createChoreography({from:a.from,to:a.to,defenderFrom:a.defenderFrom,baseYaw:a.baseYaw,defenderYaw:a.captured?.userData.baseYaw||0,capture:!!a.captured,kind:a.moving?.userData.token?.toLowerCase()||'p',defenderKind:a.captured?.userData.token?.toLowerCase()||'p',fast:!!(a.fast||cinema.fast),legLength:a.moving?.userData.rig?.legLength||0.26});a.duration=a.choreography.duration;}
 const shot=a.choreography.sample(Math.max(0,now-a.start));applyActor(a.moving,shot.attacker,shot.t);if(a.captured)applyActor(a.captured,shot.defender,shot.t);cameraImpact(cinema,a,shot);
 if(a.dust){a.dust.position.y=0.08;a.dust.scale.setScalar(Math.max(0.001,shot.dust*1.4));}if(a.halo)a.halo.scale.setScalar(shot.halo);stoneChips(cinema,a,shot);
 if(!shot.finished)cinema.frame=requestAnimationFrame(()=>{cinema.frame=0;cinema.render();});
 else{if(a.moving)a.moving.position.copy(a.to);cinema.restFigure(a.moving);cinema.bakeFigure?.(a.moving);for(const mesh of [a.captured,a.halo,a.dust,...(a.chips||[])])if(mesh){cinema.pieces.remove(mesh);cinema.disposeGeometry(mesh);}cinema.animation=null;}
}
