/* RoomGoblin procedural cinematic prototype. Bundled Three.js 0.187.0, MIT; see THREE-LICENSE.txt and NOTICE.txt. */
var Qe=Math.PI*2,Oe=(i,t=0,e=1)=>Math.max(t,Math.min(e,Number.isFinite(i)?i:t)),m0=(i,t,e)=>i+(t-i)*e,y1=i=>(i=Oe(i),i*i*i*(i*(i*6-15)+10)),be=(i,t,e)=>y1((i-t)/(e-t)),W0=(i,t,e)=>Math.max(0,1-Math.abs(i-t)/e),p1=(i,t)=>(t-i+Math.PI*3)%Qe-Math.PI,xs=i=>({x:Number.isFinite(i?.x)?i.x:0,y:Number.isFinite(i?.y)?i.y:0,z:Number.isFinite(i?.z)?i.z:0}),U3=(i,t,e)=>i.map((n,s)=>m0(n,t[s],e));function m1(i,t,e=.26,n=.26){e=Oe(e,.05,2),n=Oe(n,.05,2),t=Oe(t,.01,e+n),i=Oe(i,-e-n,e+n);let s=Oe(Math.hypot(i,t),Math.abs(e-n)+1e-4,e+n-1e-4),r=Math.atan2(i,t)+Math.acos(Oe((e*e+s*s-n*n)/(2*e*s),-1,1)),a=-(Math.PI-Math.acos(Oe((e*e+n*n-s*s)/(2*e*n),-1,1)));return{hip:r,knee:a,ankle:-r-a}}function li(){return{joints:[0,0,.12,.12],lower:[0,0,.3,.3],side:[0,0,.06,-.06],twist:[0,0,0,0],chest:[0,0,0],head:[0,0,0],weapon:-.12,crouch:0,lean:0,lift:0}}function Ke(i={}){return{...li(),...i}}function Ta(i,t,e){let n={};for(let s of["joints","lower","side","twist","chest","head"])n[s]=U3(i[s],t[s],e);for(let s of["weapon","crouch","lean","lift"])n[s]=m0(i[s],t[s],e);return n}function g1(i,t){if(i<=t[0][0])return t[0][1];for(let e=1;e<t.length;e++)if(i<=t[e][0])return Ta(t[e-1][1],t[e][1],be(i,t[e-1][0],t[e][0]));return t.at(-1)[1]}function F3(i,t,e,n){let s=li(),r=e==="r"?.6:e==="n"?.76:.68,a=i/r;for(let o=0;o<2;o++){let l=((a+o*.5)%1+1)%1,c=.64,h=r*c/2,u=Oe((l-c)/(1-c)),d=l<c?h-r*l:m0(-h,h,y1(u)),f=l<c?0:Math.sin(u*Math.PI)*.085,_=m1(d,n*2-.055-f,n,n),v=m1(0,n*2-.055,n,n);s.joints[o]=(_.hip-v.hip)*t,s.lower[o]=(_.knee-v.knee)*t,s.joints[2+o]=-Math.sin(Qe*(a+o*.5))*.2*t+.16,s.lower[2+o]=.35+.12*t}return s.chest=[-.04*t,Math.sin(Qe*a)*.035*t,-Math.sin(Qe*a)*.022*t],s.head=[0,Math.sin(Qe*a)*-.025*t,0],s.lean=-.035*t,s.weapon=-.1+Math.sin(Qe*a)*.045*t,{pose:s,bob:(Math.cos(Qe*a*2)-1)*.009*t,sway:Math.sin(Qe*a)*.017*t}}function Ve(i={}){return Ke({joints:[0,0,0,0],lower:[0,0,0,0],side:[0,0,0,0],weapon:0,...i})}function O3(i,t){let e=i/.78,n=Ve();for(let[s,r]of[0,.5,.5,0].entries()){let a=Math.sin(Qe*(e+r));n.joints[s]=a*.34*t,n.lower[s]=-Math.max(0,-a)*.52*t}return n.chest=[Math.sin(Qe*e*2)*.018*t,0,0],n.head=[Math.sin(Qe*e*2+.6)*.025*t,0,0],n.lean=-.045*t,{pose:n,bob:Math.abs(Math.sin(Qe*e*2))*.038*t,sway:Math.sin(Qe*e)*.01*t}}function _1(i,t=!1){let e=Ve();if(i==="r")return[[0,e],[.43,e],[.5,Ve({lean:.035})],[.548,Ve({lean:-.07})],[.59,e],[.655,Ve({lean:t?-.07:.045})],[.72,Ve({lean:.05})],[.785,Ve({lean:-.12,crouch:.02})],[.85,e],[1,e]];if(i!=="n")return null;let n=Ve({joints:[-.04,-.04,.06,.06],lower:[-.03,-.03,-.08,-.08],head:[-.025,0,0]}),s=Ve({joints:[-.14,-.14,.32,.32],lower:[-.16,-.16,-.45,-.45],chest:[.06,0,0],head:[-.08,0,0],lean:.18,lift:.07}),r=Ve({joints:[.08,.08,-.35,-.35],lower:[-.06,-.06,.26,.26],chest:[-.06,0,0],head:[.09,0,0],lean:-.07}),a=Ve({joints:[.14,.04,.17,.06],lower:[-.28,-.18,-.25,-.15],chest:[.1,-.04,.06],head:[.15,.08,.1],lean:.09,crouch:.03}),o=Ve({...s,joints:[-.2,-.2,.44,.44],lower:[-.35,-.35,-.6,-.6],lean:.25,lift:.18}),l=Ve({joints:[.35,.4,.3,.35],lower:[-.85,-.9,-.8,-.9],chest:[.18,.06,.1],head:[.25,.08,.15],crouch:.1,lean:.14});return t?[[0,e],[.36,n],[.5,s],[.548,a],[.6,s],[.655,r],[.71,n],[.77,s],[.8,a],[.9,l],[1,l]]:[[0,e],[.1,n],[.43,n],[.5,s],[.548,r],[.59,n],[.655,a],[.72,o],[.785,r],[.84,n],[1,e]]}function ba(i,t,e,n=1){return{position:i,rotation:{x:e.lean,y:t,z:0},scale:n,action:e}}function B3({from:i,to:t,defenderFrom:e,baseYaw:n=0,defenderYaw:s=Math.PI,capture:r=!1,kind:a="p",defenderKind:o="p",fast:l=!1,reduced:c=!1,legLength:h=.26}={}){i=xs(i),t=xs(t);let u=xs(e||t),d=r?u:t,f=d.x-i.x,_=d.z-i.z,v=Math.hypot(f,_),p=v>1e-5?{x:f/v,z:_/v}:{x:0,z:-1},m=Math.atan2(-p.x,-p.z),y=m+Math.PI,b=c?0:l?r?950:620:r?Oe(8200+v*300,8500,12200):Oe(1800+v*620,2200,6200),x=Math.min(.72,v*.65),w=r?Math.max(0,v-x):v,T={x:t.x-i.x-p.x*w,z:t.z-i.z-p.z*w},g=Math.hypot(T.x,T.z),S=r?Oe(.25+v*.018,.26,.41):.84,C=Ke({joints:[.08,.04,.42,.28],lower:[-.1,-.08,.9,.55],chest:[-.035,0,0],weapon:-.3,crouch:.018}),R=Ke({joints:[.17,-.1,.72,a==="p"?.42:2.12],lower:[-.3,-.17,.9,.82],chest:[.02,-.28,-.04],head:[-.05,.16,0],weapon:a==="p"?-.4:.48,crouch:.028,lean:.035}),L=Ke({joints:[.24,-.09,.58,a==="p"?.92:1.1],lower:[-.35,-.14,.72,.26],chest:[-.08,.21,.04],head:[-.05,-.08,0],weapon:a==="p"?-1.18:-1.25,crouch:.015,lean:-.065}),F=Ke({joints:[.09,.1,.72,.72],lower:[-.2,-.18,1.1,.7],chest:[.1,-.1,-.05],head:[.08,.03,.03],weapon:-.6,crouch:.04,lean:.055}),H=Ke({joints:[.5,.46,.95,.52],lower:[-.92,-.88,1.22,1.02],chest:[-.16,-.12,.07],head:[.1,.1,-.04],weapon:-.76,crouch:.08,lean:-.035}),P=Ke({joints:[.28,-.08,.62,2.44],lower:[-.48,-.12,.9,.9],chest:[.06,-.37,-.08],head:[-.08,.12,0],weapon:.65,crouch:.045,lean:.025}),G=Ke({joints:[.42,-.12,.64,1.2],lower:[-.64,-.15,.9,.34],chest:[-.13,.3,.06],head:[-.08,-.08,0],weapon:a==="p"?-1.36:-1.62,crouch:.03,lean:-.11}),X=Ke({joints:[.25,.04,.45,.69],lower:[-.4,-.2,.8,.45],chest:[-.09,.17,.025],weapon:-2,crouch:.025,lean:-.07}),k=Ke({joints:[.15,-.1,1.12,.72],lower:[-.27,-.12,.9,1.02],chest:[.04,-.15,.06],head:[-.04,.05,-.04],weapon:-.92,crouch:.025,lean:.025}),et=Ke({joints:[.3,-.1,.86,.4],lower:[-.55,-.13,1.1,.7],chest:[.17,-.28,.12],head:[.17,.1,.14],weapon:.24,crouch:.05,lean:.095}),W=Ke({joints:[.76,.62,.65,.42],lower:[-1.35,-1.4,1,.85],chest:[.58,-.15,.24],head:[.36,.18,.3],weapon:.4,crouch:.12,lean:.28}),Q=[[0,li()],[.1,C],[.43,C],[.49,R],[.548,L],[.59,F],[.66,H],[.72,P],[.785,G],[.83,X],[.89,C],[1,li()]],tt=[[0,li()],[.36,C],[.5,k],[.548,et],[.59,k],[.62,R],[.655,L],[.7,C],[.76,k],[.79,et],[.89,W],[1,W]];return{duration:b,fast:l,reduced:c,contacts:r?[.548,.655,.785]:[],sample(Tt){let rt=b?Oe(Tt/b):1;if(rt===1)return{finished:!0,t:rt,phase:"settled",attacker:ba({...t},n,Ke({joints:[0,0,0,0],lower:[0,0,0,0],side:[0,0,0,0]})),defender:null,camera:{x:0,y:0,z:0},dust:0,collapse:1,chipAge:1/0,halo:1};let ot=be(rt,.1,S),Et=r?be(rt,.9,1):0,Lt=w*ot+(r?g*Et:0),yt=Math.sin(Math.PI*ot)*.65+Math.min(ot*8,(1-ot)*8,1)*.35,Pt=a==="n"?O3(Lt,Oe(yt)):a==="r"?{pose:Ve({lean:-Math.sin(Math.PI*ot)*.018}),bob:Math.sin(Lt*9)*.004*yt,sway:0}:F3(Lt,Oe(yt),a,h),se=Pt.pose;if(a==="n"&&!r){let D=Math.sin(Math.PI*be(ot,.08,.92)),ce=Oe(D*1.6),Bt=Ve({joints:[-.18,-.18,.3,.3],lower:[-.65,-.65,-.58,-.58],chest:[-.025,0,0],head:[.04,0,0],lean:.09*Math.cos(Math.PI*ot),lift:.76*D});se=Ta(Pt.pose,Bt,ce),se.lift=.76*D}if(r){let D=g1(rt,_1(a)||Q),ce=be(rt,S-.02,S+.07)*(1-be(rt,.89,.99));se=Ta(se,D,ce)}let Ut=Math.sin(Math.PI*be(rt,0,.1))*.016,Wt=r?W0(rt,.548,.04)*.09-W0(rt,.655,.045)*.1+W0(rt,.785,.045)*.12:0,Yt=Pt.sway*(1-be(rt,.88,1)),j={x:i.x+p.x*(w*ot+Wt)+(r?T.x*Et:0)+p.z*Yt,y:i.y+Pt.bob-Ut-se.crouch+se.lift,z:i.z+p.z*(w*ot+Wt)+(r?T.z*Et:0)-p.x*Yt},ct=be(rt,.01,.13),lt=be(rt,r?.91:.84,1),bt=n+p1(n,m)*ct*(1-lt),mt=ba(j,bt,se),Gt=null,wt=0;if(r){let D=g1(rt,_1(o,!0)||tt),ce=W0(rt,.556,.038)*.06-W0(rt,.655,.04)*.075+be(rt,.785,.88)*.18;wt=be(rt,.8,.95);let Bt={x:u.x+p.x*ce+p.z*wt*.11,y:u.y-D.crouch*.65+D.lift,z:u.z+p.z*ce-p.x*wt*.11};Gt=ba(Bt,s+p1(s,y)*be(rt,.25,.43),D,1-be(rt,.95,1)),Gt.rotation.z=wt*1.18}let Xt={x:0,y:0,z:0};if(r&&!l)for(let[D,ce]of[[.548,.01],[.655,.013],[.785,.032]]){let Bt=(rt-D)*b/1e3;if(Bt>=0&&Bt<.25){let he=Math.sin(Bt*76)*Math.exp(-Bt*18)*ce;Xt.x+=he,Xt.y+=Math.cos(Bt*62)*Math.exp(-Bt*21)*ce*.45,Xt.z+=he*.3}}let $t=r?(rt-.785)*b/1e3:-1,ne=r?Math.max(W0(rt,.55,.025)*.35,W0(rt,.79,.075),W0(rt,.88,.04)*.5):0;return{finished:!1,t:rt,phase:rt<.1?"anticipation":rt<S?"approach":r?rt<.49?"challenge":rt<.6?"block":rt<.7?"counter":rt<.81?"finisher":rt<.94?"collapse":"recover":"settle",attacker:mt,defender:Gt,camera:Xt,dust:ne,collapse:wt,chipAge:$t,halo:1+Math.sin(rt*Math.PI)*.2}}}}function Ea(i,t){i?.rotation&&i.rotation.set(t[0],t[1],t[2])}function x1(i,t,e=0){if(!i||!t)return;i.position.set(t.position.x,t.position.y,t.position.z),i.rotation.set(t.rotation.x,t.rotation.y,t.rotation.z),i.scale.setScalar((i.userData.baseScale||1)*Math.max(.001,t.scale));let n=t.action,s=i.userData.joints||[],r=i.userData.rig||{},a=i.userData.restJoints||[],o=i.userData.restLower||[],l=c=>typeof c=="number"?c:c?.x||0;for(let c=0;c<s.length;c++){Ea(s[c],[l(a[c])+(n.joints[c]||0),n.twist[c]||0,n.side[c]||0]);let h=s[c].userData.lower;h&&(h.rotation.x=l(o[c])+(n.lower[c]||0)),c<2&&r.feet?.[c]&&(r.feet[c].rotation.x=-(n.joints[c]+n.lower[c]))}if(Ea(r.chest,[(i.userData.restChest||0)+n.chest[0],n.chest[1],n.chest[2]]),Ea(r.head,[(i.userData.restHead||0)+n.head[0],n.head[1],n.head[2]]),r.weapon){let c=l(a[3])+l(o[3]),h=be(e,0,.1)*(1-be(e,.91,1)),u=m0(c,n.weapon,h);r.weapon.rotation.x=u-(s[3]?.rotation.x||0)-(s[3]?.userData.lower?.rotation.x||0)}}function z3(i,t,e){if(!i.camera?.position)return;let n=i.camera.position,s=t.lastCameraPosition;(!t.cameraBase||s&&Math.hypot(n.x-s.x,n.y-s.y,n.z-s.z)>.002)&&(t.cameraBase={x:n.x,y:n.y,z:n.z});let r=t.cameraBase,a=e.camera,o=!!(t.battleCamera??i.battleCamera)&&!!t.captured&&!t.choreography.fast&&!t.choreography.reduced,l=o?be(e.t,.15,.4)*(1-be(e.t,.84,.99)):0,c={x:((e.defender?.position.x??t.to.x)+e.attacker.position.x)*.5,y:.75,z:((e.defender?.position.z??t.to.z)+e.attacker.position.z)*.5},h=Math.hypot(r.x,r.z)||1,u={x:c.x+r.x/h*5.5,y:c.y+3.6,z:c.z+r.z/h*5.5};n.set(m0(r.x,u.x,l)+a.x,m0(r.y,u.y,l)+a.y,m0(r.z,u.z,l)+a.z),(o||t.hadBattleCamera)&&i.camera.lookAt?.(c.x*l,m0(.15,c.y,l),c.z*l),t.hadBattleCamera=o,t.lastCameraPosition={x:n.x,y:n.y,z:n.z},i.cameraBusy=l>.01}function G3(i,t,e){if(e.finished||e.chipAge<0||!t.captured)return;let n=t.defenderFrom||t.to;!t.chips&&i.makeStoneChips&&(t.chips=i.makeStoneChips({x:n.x,y:.88,z:n.z},t.captured.userData.token,8)||[]);for(let[s,r]of(t.chips||[]).entries()){let a=s*2.399963229728653,o=.055+s%3*.018,l=.34+s%4*.1,c=Math.max(0,e.chipAge),h=(1.4+Math.sqrt(1.96+2*4.2*.88))/4.2,u=Math.min(c,h),d=c<h?.88+1.4*u-2.1*u*u:Math.max(0,.08-Math.abs(Math.sin((c-h)*16))*.06)*Math.exp(-(c-h)*4);r.position.set(n.x+Math.cos(a)*l*u,Math.max(o,d),n.z+Math.sin(a)*l*u),r.rotation.set(s+u*3.4,s*.6+u*2.5,u*4.1),r.scale.setScalar(Math.max(.001,1-be(e.t,.96,1)))}}function v1(i,t){let e=i.animation;if(!e)return;e.choreography||(e.defenderFrom=xs(e.captured?.position||e.to),e.choreography=B3({from:e.from,to:e.to,defenderFrom:e.defenderFrom,baseYaw:e.baseYaw,defenderYaw:e.captured?.userData.baseYaw||0,capture:!!e.captured,kind:e.moving?.userData.token?.toLowerCase()||"p",defenderKind:e.captured?.userData.token?.toLowerCase()||"p",fast:!!(e.fast||i.fast),legLength:e.moving?.userData.rig?.legLength||.26}),e.duration=e.choreography.duration);let n=e.choreography.sample(Math.max(0,t-e.start));x1(e.moving,n.attacker,n.t),e.captured&&x1(e.captured,n.defender,n.t),z3(i,e,n);for(let s of e.companions||[]){let r=be(n.t,.1,.84);s.mesh.position.set(m0(s.from.x,s.to.x,r),s.to.y,m0(s.from.z,s.to.z,r))}if(e.dust&&(e.dust.position.y=.08,e.dust.scale.setScalar(Math.max(.001,n.dust*1.4))),e.halo&&e.halo.scale.setScalar(n.halo),G3(i,e,n),!n.finished)i.frame=requestAnimationFrame(()=>{i.frame=0,i.render()});else{e.moving&&e.moving.position.copy(e.to),i.restFigure(e.moving),i.bakeFigure?.(e.moving);for(let s of e.companions||[])s.mesh.position.copy(s.to),i.restFigure(s.mesh),i.bakeFigure?.(s.mesh);for(let s of[e.captured,e.halo,e.dust,...e.chips||[]])s&&(i.pieces.remove(s),i.disposeGeometry(s));i.animation=null,i.nextPresentation?.()}}var S1=Array.from({length:64},(i,t)=>"abcdefgh"[t%8]+(8-Math.floor(t/8)));function M1(i){let t=String(i||"").split(" ")[0].replace(/[1-8]/g,e=>".".repeat(Number(e))).replaceAll("/","");return/^[prnbqkPRNBQK.]{64}$/.test(t)?new Map(S1.flatMap((e,n)=>t[n]==="."?[]:[[e,t[n]]])):null}function wa(i){return Array.from({length:8},(t,e)=>S1.slice(e*8,e*8+8).map(n=>i.get(n)||".").join("").replace(/\.+/g,n=>String(n.length))).join("/")}function k3(i,t){if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t||""))return!1;let e=t.slice(0,2),n=t.slice(2,4),s=i.get(e);if(!s)return!1;if(s.toLowerCase()==="p"&&e[0]!==n[0]&&!i.has(n)&&i.delete(n[0]+e[1]),s.toLowerCase()==="k"&&Math.abs(e.charCodeAt(0)-n.charCodeAt(0))===2){let r=(n[0]==="g"?"h":"a")+e[1],a=(n[0]==="g"?"f":"d")+e[1],o=i.get(r);if(o!==(s==="K"?"R":"r"))return!1;i.delete(r),i.set(a,o)}return i.delete(e),i.set(n,t.length===5?s===s.toUpperCase()?t[4].toUpperCase():t[4]:s),!0}function b1(i,t,{animate:e=!0}={}){if(!e||!i||i.id!==t?.id||!Number.isSafeInteger(t.revision)||t.revision!==i.revision+1||!Array.isArray(i.moves)||!Array.isArray(t.moves))return[];let n=t.moves.length-i.moves.length;if(n!==1&&!(n===2&&t.mode==="computer"))return[];if(!i.moves.every((o,l)=>o===t.moves[l]))return[];let s=M1(i.fen),r=M1(t.fen);if(!s||!r)return[];let a=[];for(let o of t.moves.slice(i.moves.length)){if(!k3(s,o))return[];a.push({move:o,fen:wa(s)})}return wa(s)===wa(r)?a:[]}var ci=Object.freeze({angled:58,overhead:88,player:38}),X0=(i,t)=>typeof i=="number"&&Number.isFinite(i)?i:t,hi=(i,t,e)=>Math.max(t,Math.min(e,i));function ys(i={},t={}){let e=Object.hasOwn(ci,t?.preset)?t.preset:Object.hasOwn(ci,i?.preset)?i.preset:"angled",n=Object.hasOwn(ci,t?.preset);return{preset:e,orbit:hi(X0(t?.orbit,n?0:X0(i?.orbit,0)),-180,180),tilt:hi(X0(t?.tilt,n?ci[e]:X0(i?.tilt,ci[e])),25,88),zoom:hi(X0(t?.zoom,n?1:X0(i?.zoom,1)),.7,1.6)}}function E1(i,t="white",e=1,n=39){let s=ys({},i),r=(s.orbit+(t==="black"?180:0))*Math.PI/180,a=s.tilt*Math.PI/180,o={x:Math.sin(r)*Math.cos(a),y:Math.sin(a),z:Math.cos(r)*Math.cos(a)},l={x:Math.cos(r),y:0,z:-Math.sin(r)},c={x:-Math.sin(a)*Math.sin(r),y:Math.cos(a),z:-Math.sin(a)*Math.cos(r)},h={x:0,y:.15,z:0},u=Math.tan(hi(X0(n,39),20,80)*Math.PI/360),d=u*hi(X0(e,1),.3,4),f=(v,p)=>v.x*p.x+v.y*p.y+v.z*p.z,_=0;for(let v of[-4.4,4.4])for(let p of[-4.4,4.4])for(let m of[-.45,2.15]){let y={x:v,y:m-h.y,z:p},b=f(y,o);_=Math.max(_,b+Math.abs(f(y,l))/d,b+Math.abs(f(y,c))/u)}return _=Math.max(7.5,_*1.06/s.zoom),{position:{x:o.x*_,y:h.y+o.y*_,z:o.z*_},target:h}}/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */var s2=0,co=1,r2=2;var ns=1,Ar=2,ti=3,rn=0,Ye=1,E0=2,xn=0,ei=1,ho=2,uo=3,fo=4,a2=5;var yn=100,o2=101,l2=102,c2=103,h2=104,u2=200,d2=201,f2=202,p2=203,po=204,mo=205,m2=206,g2=207,_2=208,x2=209,y2=210,v2=211,M2=212,S2=213,b2=214,Xs=0,qs=1,Ys=2,zn=3,Zs=4,Js=5,$s=6,Ks=7,go=0,E2=1,T2=2,T0=0,_o=1,xo=2,yo=3,is=4,vo=5,Mo=6,So=7;var bo=300,vn=301,ni=302,Rr=303,Cr=304,Gn=1e3,_0=1001,Qs=1002,Pe=1003,w2=1004;var ss=1005;var qe=1006,Ir=1007;var B0=1008;var $e=1009,Eo=1010,To=1011,ii=1012,Pr=1013,f0=1014,o0=1015,p0=1016,Lr=1017,Dr=1018,Mn=1020,wo=35902,Ao=35899,Ro=1021,Co=1022,s0=1023,U0=1026,z0=1027,Nr=1028,Ur=1029,an=1030,Fr=1031;var Or=1033,rs=33776,as=33777,os=33778,ls=33779,Br=35840,zr=35841,Gr=35842,kr=35843,Hr=36196,Vr=37492,Wr=37496,Xr=37488,qr=37489,cs=37490,Yr=37491,Zr=37808,Jr=37809,$r=37810,Kr=37811,Qr=37812,jr=37813,ta=37814,ea=37815,na=37816,ia=37817,sa=37818,ra=37819,aa=37820,oa=37821,la=36492,ca=36494,ha=36495,ua=36283,da=36284,hs=36285,fa=36286;var Mi=2300,js=2301,Vs=2302,Qa=2303,ja=2400,to=2401,eo=2402;var A2=3200;var pa=0,R2=1,G0="",We="srgb",Si="srgb-linear",bi="linear",ue="srgb";var Ws=7680;var C2=519,I2=512,P2=513,L2=514,Io=515,D2=516,N2=517,Po=518,Lo=519,U2=35044;var Do="300 es",a0=2e3,kn=2001;function H3(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function V3(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function Ei(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function F2(){let i=Ei("canvas");return i.style.display="block",i}var T1={},Hn=null;function No(...i){let t="THREE."+i.shift();Hn?Hn("log",t,...i):console.log(t,...i)}function O2(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Ot(...i){i=O2(i);let t="THREE."+i.shift();if(Hn)Hn("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function zt(...i){i=O2(i);let t="THREE."+i.shift();if(Hn)Hn("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function xi(...i){let t=i.join(" ");t in T1||(T1[t]=!0,Ot(...i))}function B2(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var z2={[Xs]:Xs,[Ys]:$s,[Zs]:Zs,[zn]:Js,[qs]:qs,[$s]:Ys,[Ks]:Ks,[Js]:zn},x0=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}},Be=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Aa=Math.PI/180,tr=180/Math.PI;function si(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Be[i&255]+Be[i>>8&255]+Be[i>>16&255]+Be[i>>24&255]+"-"+Be[t&255]+Be[t>>8&255]+"-"+Be[t>>16&15|64]+Be[t>>24&255]+"-"+Be[e&63|128]+Be[e>>8&255]+"-"+Be[e>>16&255]+Be[e>>24&255]+Be[n&255]+Be[n>>8&255]+Be[n>>16&255]+Be[n>>24&255]).toLowerCase()}function Kt(i,t,e){return Math.max(t,Math.min(e,i))}function W3(i,t){return(i%t+t)%t}function Ra(i,t,e){return(1-e)*i+e*t}function G2(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Uo(i){switch(i.constructor){case Uint32Array:return 4294967295;case Uint16Array:return 65535;case Uint8Array:case Uint8ClampedArray:return 255;case Int32Array:return 2147483647;case Int16Array:return 32767;case Int8Array:return 127;default:return}}function X3(i,t){if(t.constructor===Float32Array)return i;let e=Uo(t);if(e===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.max(i/e,-1)}function q3(i,t){if(t.constructor===Float32Array)return i;let e=Uo(t);if(e===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.round(i*e)}var ko=class ko{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Kt(this.x,t.x,e.x),this.y=Kt(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=Kt(this.x,t,e),this.y=Kt(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Kt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Kt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};ko.prototype.isVector2=!0;var nt=ko,y0=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3],d=r[a+0],f=r[a+1],_=r[a+2],v=r[a+3];if(u!==v||l!==d||c!==f||h!==_){let p=l*d+c*f+h*_+u*v;p<0&&(d=-d,f=-f,_=-_,v=-v,p=-p);let m=1-o;if(p<.9995){let y=Math.acos(p),b=Math.sin(y);m=Math.sin(m*y)/b,o=Math.sin(o*y)/b,l=l*m+d*o,c=c*m+f*o,h=h*m+_*o,u=u*m+v*o}else{l=l*m+d*o,c=c*m+f*o,h=h*m+_*o,u=u*m+v*o;let y=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=y,c*=y,h*=y,u*=y}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,s,r,a){let o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[a],d=r[a+1],f=r[a+2],_=r[a+3];return t[e]=o*_+h*u+l*f-c*d,t[e+1]=l*_+h*d+c*u-o*f,t[e+2]=c*_+h*f+o*d-l*u,t[e+3]=h*_-o*u-l*d-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),u=o(r/2),d=l(n/2),f=l(s/2),_=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*f*_,this._y=c*f*u-d*h*_,this._z=c*h*_+d*f*u,this._w=c*h*u-d*f*_;break;case"YXZ":this._x=d*h*u+c*f*_,this._y=c*f*u-d*h*_,this._z=c*h*_-d*f*u,this._w=c*h*u+d*f*_;break;case"ZXY":this._x=d*h*u-c*f*_,this._y=c*f*u+d*h*_,this._z=c*h*_+d*f*u,this._w=c*h*u-d*f*_;break;case"ZYX":this._x=d*h*u-c*f*_,this._y=c*f*u+d*h*_,this._z=c*h*_-d*f*u,this._w=c*h*u+d*f*_;break;case"YZX":this._x=d*h*u+c*f*_,this._y=c*f*u+d*h*_,this._z=c*h*_-d*f*u,this._w=c*h*u-d*f*_;break;case"XZY":this._x=d*h*u-c*f*_,this._y=c*f*u-d*h*_,this._z=c*h*_+d*f*u,this._w=c*h*u+d*f*_;break;default:Ot("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){let f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(a-s)*f}else if(n>o&&n>u){let f=2*Math.sqrt(1+n-o-u);this._w=(h-l)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+c)/f}else if(o>u){let f=2*Math.sqrt(1+o-n-u);this._w=(r-c)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+u-n-o);this._w=(a-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Kt(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=this.dot(t);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let l=1-e;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+a*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+a*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},Ho=class Ho{constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(w1.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(w1.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*s-o*n),h=2*(o*e-r*s),u=2*(r*n-a*e);return this.x=e+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=s+l*u+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Kt(this.x,t.x,e.x),this.y=Kt(this.y,t.y,e.y),this.z=Kt(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=Kt(this.x,t,e),this.y=Kt(this.y,t,e),this.z=Kt(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Kt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Ca.copy(this).projectOnVector(t),this.sub(Ca)}reflect(t){return this.sub(Ca.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Kt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Ho.prototype.isVector3=!0;var U=Ho,Ca=new U,w1=new y0,Vo=class Vo{constructor(t,e,n,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c)}set(t,e,n,s,r,a,o,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],f=n[5],_=n[8],v=s[0],p=s[3],m=s[6],y=s[1],b=s[4],x=s[7],w=s[2],T=s[5],g=s[8];return r[0]=a*v+o*y+l*w,r[3]=a*p+o*b+l*T,r[6]=a*m+o*x+l*g,r[1]=c*v+h*y+u*w,r[4]=c*p+h*b+u*T,r[7]=c*m+h*x+u*g,r[2]=d*v+f*y+_*w,r[5]=d*p+f*b+_*T,r[8]=d*m+f*x+_*g,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*r,f=c*r-a*l,_=e*u+n*d+s*f;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);let v=1/_;return t[0]=u*v,t[1]=(s*c-h*n)*v,t[2]=(o*n-s*a)*v,t[3]=d*v,t[4]=(h*e-s*l)*v,t[5]=(s*r-o*e)*v,t[6]=f*v,t[7]=(n*l-c*e)*v,t[8]=(a*e-n*r)*v,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-s*c,s*l,-s*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return xi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Ia.makeScale(t,e)),this}rotate(t){return xi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Ia.makeRotation(-t)),this}translate(t,e){return xi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Ia.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}};Vo.prototype.isMatrix3=!0;var Ht=Vo,Ia=new Ht,A1=new Ht().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),R1=new Ht().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Y3(){let i={enabled:!0,workingColorSpace:Si,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===ue&&(s.r=N0(s.r),s.g=N0(s.g),s.b=N0(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ue&&(s.r=Bn(s.r),s.g=Bn(s.g),s.b=Bn(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===G0?bi:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[a].fromXYZ).multiply(this.spaces[r].toXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Si]:{primaries:t,whitePoint:n,transfer:bi,toXYZ:A1,fromXYZ:R1,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:We},outputColorSpaceConfig:{drawingBufferColorSpace:We}},[We]:{primaries:t,whitePoint:n,transfer:ue,toXYZ:A1,fromXYZ:R1,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:We}}}),i}var ee=Y3();function N0(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Bn(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var En,er=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{En===void 0&&(En=Ei("canvas")),En.width=t.width,En.height=t.height;let s=En.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=En}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=Ei("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=N0(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(N0(e[n]/255)*255):e[n]=N0(e[n]);return{data:e,width:t.width,height:t.height}}else return Ot("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Z3=0,Vn=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Z3++}),this.uuid=si(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width||0,e.height||0,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Pa(s[a].image)):r.push(Pa(s[a]))}else r=Pa(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function Pa(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?er.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Ot("Texture: Unable to serialize Texture."),{})}var J3=0,La=new U,Ze=class i extends x0{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=_0,s=_0,r=qe,a=B0,o=s0,l=$e,c=i.DEFAULT_ANISOTROPY,h=G0){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:J3++}),this.uuid=si(),this.name="",this.source=new Vn(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new nt(0,0),this.repeat=new nt(1,1),this.center=new nt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ht,this.generateMipmaps=!0,this.mipmapsAutoUpdate=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.isPMREMTexture=!1,this.normalized=!1}get width(){return this.source.getSize(La).x}get height(){return this.source.getSize(La).y}get depth(){return this.source.getSize(La).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.mipmapsAutoUpdate=t.mipmapsAutoUpdate,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isPMREMTexture=t.isPMREMTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){Ot(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Ot(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,mipmapsAutoUpdate:this.mipmapsAutoUpdate,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==bo)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Gn:t.x=t.x-Math.floor(t.x);break;case _0:t.x=t.x<0?0:1;break;case Qs:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Gn:t.y=t.y-Math.floor(t.y);break;case _0:t.y=t.y<0?0:1;break;case Qs:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};Ze.DEFAULT_IMAGE=null;Ze.DEFAULT_MAPPING=bo;Ze.DEFAULT_ANISOTROPY=1;var Wo=class Wo{constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],f=l[5],_=l[9],v=l[2],p=l[6],m=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-v)<.01&&Math.abs(_-p)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+v)<.1&&Math.abs(_+p)<.1&&Math.abs(c+f+m-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let b=(c+1)/2,x=(f+1)/2,w=(m+1)/2,T=(h+d)/4,g=(u+v)/4,S=(_+p)/4;return b>x&&b>w?b<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(b),s=T/n,r=g/n):x>w?x<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(x),n=T/s,r=S/s):w<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(w),n=g/r,s=S/r),this.set(n,s,r,e),this}let y=Math.sqrt((p-_)*(p-_)+(u-v)*(u-v)+(d-h)*(d-h));return Math.abs(y)<.001&&(y=1),this.x=(p-_)/y,this.y=(u-v)/y,this.z=(d-h)/y,this.w=Math.acos((c+f+m-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Kt(this.x,t.x,e.x),this.y=Kt(this.y,t.y,e.y),this.z=Kt(this.z,t.z,e.z),this.w=Kt(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=Kt(this.x,t,e),this.y=Kt(this.y,t,e),this.z=Kt(this.z,t,e),this.w=Kt(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Kt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};Wo.prototype.isVector4=!0;var xe=Wo,nr=class extends x0{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:qe,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new xe(0,0,t,e),this.scissorTest=!1,this.viewport=new xe(0,0,t,e),this.textures=[];let s=n.count;for(let r=0;r<s;r++)this.textures[r]=new Ze({width:t,height:e,depth:n.depth}),this.textures[r].isRenderTargetTexture=!0,this.textures[r].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:qe,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.mipmapsAutoUpdate!==void 0&&(e.mipmapsAutoUpdate=t.mipmapsAutoUpdate),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),t!==null&&t.renderTarget===null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new Vn(s)}if(this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveColorBuffer=t.resolveColorBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,this.storeMultisampledColorBuffer=t.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=t.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=t.storeMultisampledStencilBuffer,t.depthTexture!==null)if(t.depthTexture.renderTarget===t){let e=t.depthTexture.clone();e.renderTarget=null,this.depthTexture=e}else this.depthTexture=t.depthTexture;else this.depthTexture=null;return this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},e0=class extends nr{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},Ti=class extends Ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Pe,this.minFilter=Pe,this.wrapR=_0,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var ir=class extends Ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Pe,this.minFilter=Pe,this.wrapR=_0,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}};var wr=class wr{constructor(t,e,n,s,r,a,o,l,c,h,u,d,f,_,v,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c,h,u,d,f,_,v,p)}set(t,e,n,s,r,a,o,l,c,h,u,d,f,_,v,p){let m=this.elements;return m[0]=t,m[4]=e,m[8]=n,m[12]=s,m[1]=r,m[5]=a,m[9]=o,m[13]=l,m[2]=c,m[6]=h,m[10]=u,m[14]=d,m[3]=f,m[7]=_,m[11]=v,m[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new wr().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/Tn.setFromMatrixColumn(t,0).length(),r=1/Tn.setFromMatrixColumn(t,1).length(),a=1/Tn.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){let d=a*h,f=a*u,_=o*h,v=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=f+_*c,e[5]=d-v*c,e[9]=-o*l,e[2]=v-d*c,e[6]=_+f*c,e[10]=a*l}else if(t.order==="YXZ"){let d=l*h,f=l*u,_=c*h,v=c*u;e[0]=d+v*o,e[4]=_*o-f,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=f*o-_,e[6]=v+d*o,e[10]=a*l}else if(t.order==="ZXY"){let d=l*h,f=l*u,_=c*h,v=c*u;e[0]=d-v*o,e[4]=-a*u,e[8]=_+f*o,e[1]=f+_*o,e[5]=a*h,e[9]=v-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){let d=a*h,f=a*u,_=o*h,v=o*u;e[0]=l*h,e[4]=_*c-f,e[8]=d*c+v,e[1]=l*u,e[5]=v*c+d,e[9]=f*c-_,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){let d=a*l,f=a*c,_=o*l,v=o*c;e[0]=l*h,e[4]=v-d*u,e[8]=_*u+f,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=f*u+_,e[10]=d-v*u}else if(t.order==="XZY"){let d=a*l,f=a*c,_=o*l,v=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+v,e[5]=a*h,e[9]=f*u-_,e[2]=_*u-f,e[6]=o*h,e[10]=v*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose($3,t,K3)}lookAt(t,e,n){let s=this.elements;return je.subVectors(t,e),je.lengthSq()===0&&(je.z=1),je.normalize(),q0.crossVectors(n,je),q0.lengthSq()===0&&(Math.abs(n.z)===1?je.x+=1e-4:je.z+=1e-4,je.normalize(),q0.crossVectors(n,je)),q0.normalize(),vs.crossVectors(je,q0),s[0]=q0.x,s[4]=vs.x,s[8]=je.x,s[1]=q0.y,s[5]=vs.y,s[9]=je.y,s[2]=q0.z,s[6]=vs.z,s[10]=je.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],f=n[13],_=n[2],v=n[6],p=n[10],m=n[14],y=n[3],b=n[7],x=n[11],w=n[15],T=s[0],g=s[4],S=s[8],C=s[12],R=s[1],L=s[5],F=s[9],H=s[13],P=s[2],G=s[6],X=s[10],k=s[14],et=s[3],W=s[7],Q=s[11],tt=s[15];return r[0]=a*T+o*R+l*P+c*et,r[4]=a*g+o*L+l*G+c*W,r[8]=a*S+o*F+l*X+c*Q,r[12]=a*C+o*H+l*k+c*tt,r[1]=h*T+u*R+d*P+f*et,r[5]=h*g+u*L+d*G+f*W,r[9]=h*S+u*F+d*X+f*Q,r[13]=h*C+u*H+d*k+f*tt,r[2]=_*T+v*R+p*P+m*et,r[6]=_*g+v*L+p*G+m*W,r[10]=_*S+v*F+p*X+m*Q,r[14]=_*C+v*H+p*k+m*tt,r[3]=y*T+b*R+x*P+w*et,r[7]=y*g+b*L+x*G+w*W,r[11]=y*S+b*F+x*X+w*Q,r[15]=y*C+b*H+x*k+w*tt,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],f=t[14],_=t[3],v=t[7],p=t[11],m=t[15],y=l*f-c*d,b=o*f-c*u,x=o*d-l*u,w=a*f-c*h,T=a*d-l*h,g=a*u-o*h;return e*(v*y-p*b+m*x)-n*(_*y-p*w+m*T)+s*(_*b-v*w+m*g)-r*(_*x-v*T+p*g)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],a=t[5],o=t[9],l=t[2],c=t[6],h=t[10];return e*(a*h-o*c)-n*(r*h-o*l)+s*(r*c-a*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],f=t[11],_=t[12],v=t[13],p=t[14],m=t[15],y=e*o-n*a,b=e*l-s*a,x=e*c-r*a,w=n*l-s*o,T=n*c-r*o,g=s*c-r*l,S=h*v-u*_,C=h*p-d*_,R=h*m-f*_,L=u*p-d*v,F=u*m-f*v,H=d*m-f*p,P=y*H-b*F+x*L+w*R-T*C+g*S;if(P===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let G=1/P;return t[0]=(o*H-l*F+c*L)*G,t[1]=(s*F-n*H-r*L)*G,t[2]=(v*g-p*T+m*w)*G,t[3]=(d*T-u*g-f*w)*G,t[4]=(l*R-a*H-c*C)*G,t[5]=(e*H-s*R+r*C)*G,t[6]=(p*x-_*g-m*b)*G,t[7]=(h*g-d*x+f*b)*G,t[8]=(a*F-o*R+c*S)*G,t[9]=(n*R-e*F-r*S)*G,t[10]=(_*T-v*x+m*y)*G,t[11]=(u*x-h*T-f*y)*G,t[12]=(o*C-a*L-l*S)*G,t[13]=(e*L-n*C+s*S)*G,t[14]=(v*b-_*w-p*y)*G,t[15]=(h*w-u*b+d*y)*G,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,u=o+o,d=r*c,f=r*h,_=r*u,v=a*h,p=a*u,m=o*u,y=l*c,b=l*h,x=l*u,w=n.x,T=n.y,g=n.z;return s[0]=(1-(v+m))*w,s[1]=(f+x)*w,s[2]=(_-b)*w,s[3]=0,s[4]=(f-x)*T,s[5]=(1-(d+m))*T,s[6]=(p+y)*T,s[7]=0,s[8]=(_+b)*g,s[9]=(p-y)*g,s[10]=(1-(d+v))*g,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let a=Tn.set(s[0],s[1],s[2]).length(),o=Tn.set(s[4],s[5],s[6]).length(),l=Tn.set(s[8],s[9],s[10]).length();r<0&&(a=-a),c0.copy(this);let c=1/a,h=1/o,u=1/l;return c0.elements[0]*=c,c0.elements[1]*=c,c0.elements[2]*=c,c0.elements[4]*=h,c0.elements[5]*=h,c0.elements[6]*=h,c0.elements[8]*=u,c0.elements[9]*=u,c0.elements[10]*=u,e.setFromRotationMatrix(c0),n.x=a,n.y=o,n.z=l,this}makePerspective(t,e,n,s,r,a,o=a0,l=!1){let c=this.elements,h=2*r/(e-t),u=2*r/(n-s),d=(e+t)/(e-t),f=(n+s)/(n-s),_,v;if(l)_=r/(a-r),v=a*r/(a-r);else if(o===a0)_=-(a+r)/(a-r),v=-2*a*r/(a-r);else if(o===kn)_=-a/(a-r),v=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=_,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=a0,l=!1){let c=this.elements,h=2/(e-t),u=2/(n-s),d=-(e+t)/(e-t),f=-(n+s)/(n-s),_,v;if(l)_=1/(a-r),v=a/(a-r);else if(o===a0)_=-2/(a-r),v=-(a+r)/(a-r);else if(o===kn)_=-1/(a-r),v=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=_,c[14]=v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}};wr.prototype.isMatrix4=!0;var oe=wr,Tn=new U,c0=new oe,$3=new U(0,0,0),K3=new U(1,1,1),q0=new U,vs=new U,je=new U,C1=new oe,I1=new y0,F0=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(Kt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Kt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Kt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Kt(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Kt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-Kt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:Ot("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return C1.makeRotationFromQuaternion(t),this.setFromRotationMatrix(C1,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return I1.setFromEuler(this),this.setFromQuaternion(I1,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};F0.DEFAULT_ORDER="XYZ";var Wn=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Q3=0,P1=new U,wn=new y0,C0=new oe,Ms=new U,ui=new U,j3=new U,tl=new y0,L1=new U(1,0,0),D1=new U(0,1,0),N1=new U(0,0,1),U1={type:"added"},el={type:"removed"},An={type:"childadded",child:null},Da={type:"childremoved",child:null},Ge=class i extends x0{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Q3++}),this.uuid=si(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new U,e=new F0,n=new y0,s=new U(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new oe},normalMatrix:{value:new Ht}}),this.matrix=new oe,this.matrixWorld=new oe,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Wn,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale),this.pivot!==null&&this.position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return wn.setFromAxisAngle(t,e),this.quaternion.multiply(wn),this}rotateOnWorldAxis(t,e){return wn.setFromAxisAngle(t,e),this.quaternion.premultiply(wn),this}rotateX(t){return this.rotateOnAxis(L1,t)}rotateY(t){return this.rotateOnAxis(D1,t)}rotateZ(t){return this.rotateOnAxis(N1,t)}translateOnAxis(t,e){return P1.copy(t).applyQuaternion(this.quaternion),this.position.add(P1.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(L1,t)}translateY(t){return this.translateOnAxis(D1,t)}translateZ(t){return this.translateOnAxis(N1,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(C0.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Ms.copy(t):Ms.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),ui.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?C0.lookAt(ui,Ms,this.up):C0.lookAt(Ms,ui,this.up),this.quaternion.setFromRotationMatrix(C0),s&&(C0.extractRotation(s.matrixWorld),wn.setFromRotationMatrix(C0),this.quaternion.premultiply(wn.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(zt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(U1),An.child=t,this.dispatchEvent(An),An.child=null):zt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(el),Da.child=t,this.dispatchEvent(Da),Da.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),C0.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),C0.multiply(t.parent.matrixWorld)),t.applyMatrix4(C0),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(U1),An.child=t,this.dispatchEvent(An),An.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ui,t,j3),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ui,tl,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){return!0}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(t.animations,l))}}if(e){let o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),f=a(t.animations),_=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),_.length>0&&(n.nodes=_)}return n.object=s,n;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Ge.DEFAULT_UP=new U(0,1,0);Ge.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ge.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var ge=class extends Ge{constructor(){super(),this.isGroup=!0,this.type="Group"}},nl={type:"move"},Xn=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ge,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ge,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new U,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new U),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ge,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new U,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new U,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(let v of t.hand.values()){let p=e.getJointPose(v,n),m=this._getHandJoint(c,v);p!==null&&(m.matrix.fromArray(p.transform.matrix),m.matrix.decompose(m.position,m.quaternion,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=p.radius),m.visible=p!==null}let h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,_=.005;c.inputState.pinching&&d>f+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=f-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.quaternion,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(nl)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new ge;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},k2={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Y0={h:0,s:0,l:0},Ss={h:0,s:0,l:0};function Na(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Qt=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=We){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ee.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=ee.workingColorSpace){return this.r=t,this.g=e,this.b=n,ee.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=ee.workingColorSpace){if(t=W3(t,1),e=Kt(e,0,1),n=Kt(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=Na(a,r,t+1/3),this.g=Na(a,r,t),this.b=Na(a,r,t-1/3)}return ee.colorSpaceToWorking(this,s),this}setStyle(t,e=We){function n(r){r!==void 0&&parseFloat(r)<1&&Ot("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseFloat(r[1]))/100,Math.min(100,parseFloat(r[2]))/100,Math.min(100,parseFloat(r[3]))/100,e);break;case"hsl":case"hsla":if(r=/^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Ot("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);Ot("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=We){let n=k2[t.toLowerCase()];return n!==void 0?this.setHex(n,e):Ot("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=N0(t.r),this.g=N0(t.g),this.b=N0(t.b),this}copyLinearToSRGB(t){return this.r=Bn(t.r),this.g=Bn(t.g),this.b=Bn(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=We){return ee.workingToColorSpace(ze.copy(this),t),Math.round(Kt(ze.r*255,0,255))*65536+Math.round(Kt(ze.g*255,0,255))*256+Math.round(Kt(ze.b*255,0,255))}getHexString(t=We){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ee.workingColorSpace){ee.workingToColorSpace(ze.copy(this),e);let n=ze.r,s=ze.g,r=ze.b,a=Math.max(n,s,r),o=Math.min(n,s,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=ee.workingColorSpace){return ee.workingToColorSpace(ze.copy(this),e),t.r=ze.r,t.g=ze.g,t.b=ze.b,t}getStyle(t=We){ee.workingToColorSpace(ze.copy(this),t);let e=ze.r,n=ze.g,s=ze.b;return t!==We?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Y0),this.setHSL(Y0.h+t,Y0.s+e,Y0.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Y0),t.getHSL(Ss);let n=Ra(Y0.h,Ss.h,e),s=Ra(Y0.s,Ss.s,e),r=Ra(Y0.l,Ss.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},ze=new Qt;Qt.NAMES=k2;var wi=class i{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new Qt(t),this.near=e,this.far=n}clone(){return new i(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},Ai=class extends Ge{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new F0,this.environmentIntensity=1,this.environmentRotation=new F0,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),this.background=t.background!==null?t.background.clone():null,this.environment=t.environment!==null?t.environment.clone():null,this.fog=t.fog!==null?t.fog.clone():null,this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),this.overrideMaterial=t.overrideMaterial!==null?t.overrideMaterial.clone():null,this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),e.object.backgroundBlurriness=this.backgroundBlurriness,e.object.backgroundIntensity=this.backgroundIntensity,e.object.backgroundRotation=this.backgroundRotation.toArray(),e.object.environmentIntensity=this.environmentIntensity,e.object.environmentRotation=this.environmentRotation.toArray(),e}},h0=new U,I0=new U,Ua=new U,P0=new U,Rn=new U,Cn=new U,F1=new U,Fa=new U,Oa=new U,Ba=new U,za=new xe,Ga=new xe,ka=new xe,K0=class i{constructor(t=new U,e=new U,n=new U){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),h0.subVectors(t,e),s.cross(h0);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){h0.subVectors(s,e),I0.subVectors(n,e),Ua.subVectors(t,e);let a=h0.dot(h0),o=h0.dot(I0),l=h0.dot(Ua),c=I0.dot(I0),h=I0.dot(Ua),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;let d=1/u,f=(c*l-o*h)*d,_=(a*h-o*l)*d;return r.set(1-f-_,_,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,P0)===null?!1:P0.x>=0&&P0.y>=0&&P0.x+P0.y<=1}static getInterpolation(t,e,n,s,r,a,o,l){return this.getBarycoord(t,e,n,s,P0)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,P0.x),l.addScaledVector(a,P0.y),l.addScaledVector(o,P0.z),l)}static getInterpolatedAttribute(t,e,n,s,r,a){return za.setScalar(0),Ga.setScalar(0),ka.setScalar(0),za.fromBufferAttribute(t,e),Ga.fromBufferAttribute(t,n),ka.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(za,r.x),a.addScaledVector(Ga,r.y),a.addScaledVector(ka,r.z),a}static isFrontFacing(t,e,n,s){return h0.subVectors(n,e),I0.subVectors(t,e),h0.cross(I0).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return h0.subVectors(this.c,this.b),I0.subVectors(this.a,this.b),h0.cross(I0).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,a,o;Rn.subVectors(s,n),Cn.subVectors(r,n),Fa.subVectors(t,n);let l=Rn.dot(Fa),c=Cn.dot(Fa);if(l<=0&&c<=0)return e.copy(n);Oa.subVectors(t,s);let h=Rn.dot(Oa),u=Cn.dot(Oa);if(h>=0&&u<=h)return e.copy(s);let d=l*u-h*c;if(d<=0&&l>=0&&h<=0&&l-h>0)return a=l/(l-h),e.copy(n).addScaledVector(Rn,a);Ba.subVectors(t,r);let f=Rn.dot(Ba),_=Cn.dot(Ba);if(_>=0&&f<=_)return e.copy(r);let v=f*c-l*_;if(v<=0&&c>=0&&_<=0)return o=c/(c-_),e.copy(n).addScaledVector(Cn,o);let p=h*_-f*u;if(p<=0&&u-h>=0&&f-_>=0)return F1.subVectors(r,s),o=(u-h)/(u-h+(f-_)),e.copy(s).addScaledVector(F1,o);let m=1/(p+v+d);return a=v*m,o=d*m,e.copy(n).addScaledVector(Rn,a).addScaledVector(Cn,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},v0=class{constructor(t=new U(1/0,1/0,1/0),e=new U(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(u0.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(u0.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=u0.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0&&t.isBatchedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,u0):u0.fromBufferAttribute(r,a),u0.applyMatrix4(t.matrixWorld),this.expandByPoint(u0);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),bs.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),bs.copy(n.boundingBox)),bs.applyMatrix4(t.matrixWorld),this.union(bs)}let s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,u0),u0.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(di),Es.subVectors(this.max,di),In.subVectors(t.a,di),Pn.subVectors(t.b,di),Ln.subVectors(t.c,di),Z0.subVectors(Pn,In),J0.subVectors(Ln,Pn),hn.subVectors(In,Ln);let e=[0,-Z0.z,Z0.y,0,-J0.z,J0.y,0,-hn.z,hn.y,Z0.z,0,-Z0.x,J0.z,0,-J0.x,hn.z,0,-hn.x,-Z0.y,Z0.x,0,-J0.y,J0.x,0,-hn.y,hn.x,0];return!Ha(e,In,Pn,Ln,Es)||(e=[1,0,0,0,1,0,0,0,1],!Ha(e,In,Pn,Ln,Es))?!1:(Ts.crossVectors(Z0,J0),e=[Ts.x,Ts.y,Ts.z],Ha(e,In,Pn,Ln,Es))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,u0).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(u0).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(L0[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),L0[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),L0[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),L0[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),L0[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),L0[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),L0[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),L0[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(L0),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},L0=[new U,new U,new U,new U,new U,new U,new U,new U],u0=new U,bs=new v0,In=new U,Pn=new U,Ln=new U,Z0=new U,J0=new U,hn=new U,di=new U,Es=new U,Ts=new U,un=new U;function Ha(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){un.fromArray(i,r);let o=s.x*Math.abs(un.x)+s.y*Math.abs(un.y)+s.z*Math.abs(un.z),l=t.dot(un),c=e.dot(un),h=n.dot(un);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var Ee=new U,ws=new nt,il=0,Ne=class extends x0{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:il++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=U2,this.updateRanges=[],this.gpuType=o0,this.version=0,this._normalizationScale=t!==void 0?Uo(t):void 0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this._normalizationScale=t._normalizationScale,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)ws.fromBufferAttribute(this,e),ws.applyMatrix3(t),this.setXY(e,ws.x,ws.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Ee.fromBufferAttribute(this,e),Ee.applyMatrix3(t),this.setXYZ(e,Ee.x,Ee.y,Ee.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Ee.fromBufferAttribute(this,e),Ee.applyMatrix4(t),this.setXYZ(e,Ee.x,Ee.y,Ee.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Ee.fromBufferAttribute(this,e),Ee.applyNormalMatrix(t),this.setXYZ(e,Ee.x,Ee.y,Ee.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Ee.fromBufferAttribute(this,e),Ee.transformDirection(t),this.setXYZ(e,Ee.x,Ee.y,Ee.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=this._denormalize(n)),n}setComponent(t,e,n){return this.normalized&&(n=this._normalize(n)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=this._denormalize(e)),e}setX(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=this._denormalize(e)),e}setY(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=this._denormalize(e)),e}setZ(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=this._denormalize(e)),e}setW(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n),s=this._normalize(s)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n),s=this._normalize(s),r=this._normalize(r)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}_denormalize(t){let e=this._normalizationScale;return e!==void 0?Math.max(t/e,-1):X3(t,this.array)}_normalize(t){let e=this._normalizationScale;return e!==void 0?Math.round(t*e):q3(t,this.array)}};var Ri=class extends Ne{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var Ci=class extends Ne{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var ae=class extends Ne{constructor(t,e,n){super(new Float32Array(t),e,n)}},sl=new v0,fi=new U,Va=new U,Q0=class{constructor(t=new U,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):sl.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;fi.subVectors(t,this.center);let e=fi.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(fi,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Va.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(fi.copy(t.center).add(Va)),this.expandByPoint(fi.copy(t.center).sub(Va))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},rl=0,r0=new oe,Wa=new Ge,Dn=new U,t0=new v0,pi=new v0,Ie=new U,Te=class i extends x0{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:rl++}),this.uuid=si(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(H3(t)?Ci:Ri)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Ht().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return r0.makeRotationFromQuaternion(t),this.applyMatrix4(r0),this}rotateX(t){return r0.makeRotationX(t),this.applyMatrix4(r0),this}rotateY(t){return r0.makeRotationY(t),this.applyMatrix4(r0),this}rotateZ(t){return r0.makeRotationZ(t),this.applyMatrix4(r0),this}translate(t,e,n){return r0.makeTranslation(t,e,n),this.applyMatrix4(r0),this}scale(t,e,n){return r0.makeScale(t,e,n),this.applyMatrix4(r0),this}lookAt(t){return Wa.lookAt(t),Wa.updateMatrix(),this.applyMatrix4(Wa.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Dn).negate(),this.translate(Dn.x,Dn.y,Dn.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new ae(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&Ot("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new v0);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){zt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new U(-1/0,-1/0,-1/0),new U(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];t0.setFromBufferAttribute(r),this.morphTargetsRelative?(Ie.addVectors(this.boundingBox.min,t0.min),this.boundingBox.expandByPoint(Ie),Ie.addVectors(this.boundingBox.max,t0.max),this.boundingBox.expandByPoint(Ie)):(this.boundingBox.expandByPoint(t0.min),this.boundingBox.expandByPoint(t0.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&zt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Q0);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){zt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new U,1/0);return}if(t){let n=this.boundingSphere.center;if(t0.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){let o=e[r];pi.setFromBufferAttribute(o),this.morphTargetsRelative?(Ie.addVectors(t0.min,pi.min),t0.expandByPoint(Ie),Ie.addVectors(t0.max,pi.max),t0.expandByPoint(Ie)):(t0.expandByPoint(pi.min),t0.expandByPoint(pi.max))}t0.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)Ie.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Ie));if(e)for(let r=0,a=e.length;r<a;r++){let o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Ie.fromBufferAttribute(o,c),l&&(Dn.fromBufferAttribute(t,c),Ie.add(Dn)),s=Math.max(s,n.distanceToSquared(Ie))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&zt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){zt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new Ne(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));let o=[],l=[],c=new Uint8Array(n.count);for(let C=0;C<n.count;C++)o[C]=new U,l[C]=new U;let h=new U,u=new U,d=new U,f=new nt,_=new nt,v=new nt,p=new U,m=new U;function y(C,R,L){c[C]=c[R]=c[L]=1,h.fromBufferAttribute(n,C),u.fromBufferAttribute(n,R),d.fromBufferAttribute(n,L),f.fromBufferAttribute(r,C),_.fromBufferAttribute(r,R),v.fromBufferAttribute(r,L),u.sub(h),d.sub(h),_.sub(f),v.sub(f);let F=1/(_.x*v.y-v.x*_.y);isFinite(F)&&(p.copy(u).multiplyScalar(v.y).addScaledVector(d,-_.y).multiplyScalar(F),m.copy(d).multiplyScalar(_.x).addScaledVector(u,-v.x).multiplyScalar(F),o[C].add(p),o[R].add(p),o[L].add(p),l[C].add(m),l[R].add(m),l[L].add(m))}let b=this.groups;b.length===0&&(b=[{start:0,count:t.count}]);for(let C=0,R=b.length;C<R;++C){let L=b[C],F=L.start,H=L.count;for(let P=F,G=F+H;P<G;P+=3)y(t.getX(P+0),t.getX(P+1),t.getX(P+2))}let x=new U,w=new U,T=new U,g=new U;function S(C){T.fromBufferAttribute(s,C),g.copy(T);let R=o[C];x.copy(R),x.sub(T.multiplyScalar(T.dot(R))).normalize(),w.crossVectors(g,R);let F=w.dot(l[C])<0?-1:1;a.setXYZW(C,x.x,x.y,x.z,F)}for(let C=0,R=n.count;C<R;++C)c[C]&&S(C);this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new Ne(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);let s=new U,r=new U,a=new U,o=new U,l=new U,c=new U,h=new U,u=new U;if(t)for(let d=0,f=t.count;d<f;d+=3){let _=t.getX(d+0),v=t.getX(d+1),p=t.getX(d+2);s.fromBufferAttribute(e,_),r.fromBufferAttribute(e,v),a.fromBufferAttribute(e,p),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(n,_),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,p),o.add(h),l.add(h),c.add(h),n.setXYZ(_,o.x,o.y,o.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let d=0,f=e.count;d<f;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Ie.fromBufferAttribute(t,e),Ie.normalize(),t.setXYZ(e,Ie.x,Ie.y,Ie.z)}toNonIndexed(){function t(o,l){let c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h),f=0,_=0;for(let v=0,p=l.length;v<p;v++){o.isInterleavedBufferAttribute?f=l[v]*o.data.stride+o.offset:f=l[v]*h;for(let m=0;m<h;m++)d[_++]=c[f++]}return new Ne(d,h,u)}if(this.index===null)return Ot("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=t(l,n);e.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){let d=c[h],f=t(d,n);l.push(f)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){let f=c[u];h.push(f.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],u=r[c];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let a=t.groups;for(let c=0,h=a.length;c<h;c++){let u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Xa=new U,al=new U,ol=new Ht,d0=class{constructor(t=new U(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=Xa.subVectors(n,e).cross(al.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(Xa),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let a=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:e.copy(t.start).addScaledVector(s,a)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||ol.getNormalMatrix(t),s=this.coplanarPoint(Xa).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},ll=0,j0=class extends x0{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:ll++}),this.uuid=si(),this.name="",this.type="Material",this.blending=ei,this.side=rn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=po,this.blendDst=mo,this.blendEquation=yn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Qt(0,0,0),this.blendAlpha=0,this.depthFunc=zn,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=C2,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ws,this.stencilZFail=Ws,this.stencilZPass=Ws,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){Ot(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Ot(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.diffuseRoughness!==void 0&&(n.diffuseRoughness=this.diffuseRoughness),this.diffuseRoughnessMap&&this.diffuseRoughnessMap.isTexture&&(n.diffuseRoughnessMap=this.diffuseRoughnessMap.toJSON(t).uuid),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessMinimum!==void 0&&(n.iridescenceThicknessMinimum=this.iridescenceThicknessMinimum),this.iridescenceThicknessMaximum!==void 0&&(n.iridescenceThicknessMaximum=this.iridescenceThicknessMaximum),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(e){let r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Qt().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.diffuseRoughness!==void 0&&(this.diffuseRoughness=t.diffuseRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessMinimum!==void 0&&(this.iridescenceThicknessMinimum=t.iridescenceThicknessMinimum),t.iridescenceThicknessMaximum!==void 0&&(this.iridescenceThicknessMaximum=t.iridescenceThicknessMaximum),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessMinimum=t.iridescenceThicknessRange[0],this.iridescenceThicknessMaximum=t.iridescenceThicknessRange[1]),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(n=>new d0().fromJSON(n))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new nt().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new nt().fromArray(t.clearcoatNormalScale)),t.diffuseRoughnessMap!==void 0&&(this.diffuseRoughnessMap=e[t.diffuseRoughnessMap]||null),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var D0=new U,qa=new U,As=new U,Rs=new U,Ii=class{constructor(t=new U,e=new U(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,D0)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=D0.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(D0.copy(this.origin).addScaledVector(this.direction,e),D0.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){qa.copy(t).add(e).multiplyScalar(.5),As.copy(e).sub(t).normalize(),Rs.copy(this.origin).sub(qa);let r=t.distanceTo(e)*.5,a=-this.direction.dot(As),o=Rs.dot(this.direction),l=-Rs.dot(As),c=Rs.lengthSq(),h=Math.abs(1-a*a),u,d,f,_;if(h>0)if(u=a*l-o,d=a*o-l,_=r*h,u>=0)if(d>=-_)if(d<=_){let v=1/h;u*=v,d*=v,f=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d<=-_?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c):d<=_?(u=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(qa).addScaledVector(As,d),f}intersectSphere(t,e){if(t.radius<0)return null;D0.subVectors(t.center,this.origin);let n=D0.dot(this.direction),s=D0.dot(D0)-n*n,r=t.radius*t.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,s=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,s=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,D0)!==null}intersectTriangle(t,e,n,s,r){let a=this.origin,o=this.direction,l=o.x,c=o.y,h=o.z,u=t.x-a.x,d=t.y-a.y,f=t.z-a.z,_=e.x-a.x,v=e.y-a.y,p=e.z-a.z,m=n.x-a.x,y=n.y-a.y,b=n.z-a.z,x=Math.abs(l),w=Math.abs(c),T=Math.abs(h),g,S,C,R,L,F,H,P,G,X,k,et;if(x>=w&&x>=T?(C=l,F=u,G=_,et=m,l>=0?(g=c,S=h,R=d,L=f,H=v,P=p,X=y,k=b):(g=h,S=c,R=f,L=d,H=p,P=v,X=b,k=y)):w>=T?(C=c,F=d,G=v,et=y,c>=0?(g=h,S=l,R=f,L=u,H=p,P=_,X=b,k=m):(g=l,S=h,R=u,L=f,H=_,P=p,X=m,k=b)):(C=h,F=f,G=p,et=b,h>=0?(g=l,S=c,R=u,L=d,H=_,P=v,X=m,k=y):(g=c,S=l,R=d,L=u,H=v,P=_,X=y,k=m)),C===0)return null;let W=g/C,Q=S/C,tt=1/C,Tt=R-W*F,rt=L-Q*F,Y=H-W*G,ot=P-Q*G,Et=X-W*et,Lt=k-Q*et,yt=Et*ot-Lt*Y,Pt=Tt*Lt-rt*Et,se=Y*rt-ot*Tt;if(s){if(yt<0||Pt<0||se<0)return null}else if((yt<0||Pt<0||se<0)&&(yt>0||Pt>0||se>0))return null;let Ut=yt+Pt+se;if(Ut===0)return null;let Wt=tt*(yt*F+Pt*G+se*et);return(Ut>0?Wt<0:Wt>0)?null:this.at(Wt/Ut,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},sr=class extends j0{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Qt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new F0,this.combine=go,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},O1=new oe,dn=new Ii,Cs=new Q0,B1=new U,Is=new U,Ps=new U,Ls=new U,Ya=new U,Ds=new U,z1=new U,Ns=new U,Je=class extends Ge{constructor(t=new Te,e=new sr){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0?this.morphTargetInfluences=t.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,t.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(r&&o){Ds.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],u=r[l];h!==0&&(Ya.fromBufferAttribute(u,t),a?Ds.addScaledVector(Ya,h):Ds.addScaledVector(Ya.sub(e),h))}e.add(Ds)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Cs.copy(n.boundingSphere),Cs.applyMatrix4(r),dn.copy(t.ray).recast(t.near),!(Cs.containsPoint(dn.origin)===!1&&(dn.intersectSphere(Cs,B1)===null||dn.origin.distanceToSquared(B1)>(t.far-t.near)**2))&&(O1.copy(r).invert(),dn.copy(t.ray).applyMatrix4(O1),!(n.boundingBox!==null&&dn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,dn)))}_computeIntersections(t,e,n){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let _=0,v=d.length;_<v;_++){let p=d[_],m=a[p.materialIndex],y=Math.max(p.start,f.start),b=Math.min(o.count,Math.min(p.start+p.count,f.start+f.count));for(let x=y,w=b;x<w;x+=3){let T=o.getX(x),g=o.getX(x+1),S=o.getX(x+2);s=Us(this,m,t,n,c,h,u,T,g,S),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let _=Math.max(0,f.start),v=Math.min(o.count,f.start+f.count);for(let p=_,m=v;p<m;p+=3){let y=o.getX(p),b=o.getX(p+1),x=o.getX(p+2);s=Us(this,a,t,n,c,h,u,y,b,x),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let _=0,v=d.length;_<v;_++){let p=d[_],m=a[p.materialIndex],y=Math.max(p.start,f.start),b=Math.min(l.count,Math.min(p.start+p.count,f.start+f.count));for(let x=y,w=b;x<w;x+=3){let T=x,g=x+1,S=x+2;s=Us(this,m,t,n,c,h,u,T,g,S),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let _=Math.max(0,f.start),v=Math.min(l.count,f.start+f.count);for(let p=_,m=v;p<m;p+=3){let y=p,b=p+1,x=p+2;s=Us(this,a,t,n,c,h,u,y,b,x),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}}};function cl(i,t,e,n,s,r,a,o){let l;if(t.side===Ye?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,t.side===rn,o),l===null)return null;Ns.copy(o),Ns.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(Ns);return c<e.near||c>e.far?null:{distance:c,point:Ns.clone(),object:i}}function Us(i,t,e,n,s,r,a,o,l,c){i.getVertexPosition(o,Is),i.getVertexPosition(l,Ps),i.getVertexPosition(c,Ls);let h=cl(i,t,e,n,Is,Ps,Ls,z1);if(h){let u=new U;K0.getBarycoord(z1,Is,Ps,Ls,u),s&&(h.uv=K0.getInterpolatedAttribute(s,o,l,c,u,new nt)),r&&(h.uv1=K0.getInterpolatedAttribute(r,o,l,c,u,new nt)),a&&(h.normal=K0.getInterpolatedAttribute(a,o,l,c,u,new U),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:l,c,normal:new U,materialIndex:0};K0.getNormal(Is,Ps,Ls,d.normal),h.face=d,h.barycoord=u}return h}var mn=class extends Ze{constructor(t=null,e=1,n=1,s,r,a,o,l,c=Pe,h=Pe,u,d){super(null,a,o,l,c,h,s,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var qn=class extends Ne{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){let t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}},Nn=new oe,G1=new oe,Fs=[],k1=new v0,hl=new oe,mi=new Je,gi=new Q0,Pi=class extends Je{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new qn(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,hl)}computeBoundingBox(){let t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new v0),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Nn),k1.copy(t.boundingBox).applyMatrix4(Nn),this.boundingBox.union(k1)}computeBoundingSphere(){let t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Q0),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Nn),gi.copy(t.boundingSphere).applyMatrix4(Nn),this.boundingSphere.union(gi)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),this.morphTexture=t.morphTexture!==null?t.morphTexture.clone():null,this.instanceColor=t.instanceColor!==null?t.instanceColor.clone():null,this.count=t.count,this.boundingBox=t.boundingBox!==null?t.boundingBox.clone():null,this.boundingSphere=t.boundingSphere!==null?t.boundingSphere.clone():null,this}getColorAt(t,e){return this.instanceColor===null?e.setRGB(1,1,1):e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){return e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){let n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=t*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(t,e){let n=this.matrixWorld,s=this.count;if(mi.geometry=this.geometry,mi.material=this.material,mi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),gi.copy(this.boundingSphere),gi.applyMatrix4(n),t.ray.intersectsSphere(gi)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Nn),G1.multiplyMatrices(n,Nn),mi.matrixWorld=G1,mi.raycast(t,Fs);for(let a=0,o=Fs.length;a<o;a++){let l=Fs[a];l.instanceId=r,l.object=this,e.push(l)}Fs.length=0}}setColorAt(t,e){return this.instanceColor===null&&(this.instanceColor=new qn(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3),this}setMatrixAt(t,e){return e.toArray(this.instanceMatrix.array,t*16),this}setMorphAt(t,e){let n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new mn(new Float32Array(s*this.count),s,this.count,Nr,o0));let r=this.morphTexture.source.data.data,a=0;for(let c=0;c<n.length;c++)a+=n[c];let o=this.geometry.morphTargetsRelative?1:1-a,l=s*t;return r[l]=o,r.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.instanceMatrix.dispose(),this.instanceColor!==null&&this.instanceColor.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},fn=new Q0,ul=new nt(.5,.5),Os=new U,tn=class{constructor(t=new d0,e=new d0,n=new d0,s=new d0,r=new d0,a=new d0){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){let o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=a0,n=!1){let s=this.planes,r=t.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],u=r[5],d=r[6],f=r[7],_=r[8],v=r[9],p=r[10],m=r[11],y=r[12],b=r[13],x=r[14],w=r[15];if(s[0].setComponents(c-a,f-h,m-_,w-y).normalize(),s[1].setComponents(c+a,f+h,m+_,w+y).normalize(),s[2].setComponents(c+o,f+u,m+v,w+b).normalize(),s[3].setComponents(c-o,f-u,m-v,w-b).normalize(),n)s[4].setComponents(l,d,p,x).normalize(),s[5].setComponents(c-l,f-d,m-p,w-x).normalize();else if(s[4].setComponents(c-l,f-d,m-p,w-x).normalize(),e===a0)s[5].setComponents(c+l,f+d,m+p,w+x).normalize();else if(e===kn)s[5].setComponents(l,d,p,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),fn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),fn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(fn)}intersectsSprite(t){fn.center.set(0,0,0);let e=ul.distanceTo(t.center);return fn.radius=.7071067811865476+e,fn.applyMatrix4(t.matrixWorld),this.intersectsSphere(fn)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(Os.x=s.normal.x>0?t.max.x:t.min.x,Os.y=s.normal.y>0?t.max.y:t.min.y,Os.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(Os)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},H1=new oe,rr=class i{constructor(){this.coordinateSystem=a0,this._frustums=[],this._count=0}setFromArrayCamera(t){let e=t.cameras,n=this._frustums;for(let s=0;s<e.length;s++){let r=e[s];H1.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),n[s]===void 0&&(n[s]=new tn),n[s].setFromProjectionMatrix(H1,r.coordinateSystem,r.reversedDepth)}return this._count=e.length,this}getFrustum(t){return this._frustums[t]}intersectsObject(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsObject(t))return!0;return!1}intersectsSprite(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsSprite(t))return!0;return!1}intersectsSphere(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsSphere(t))return!0;return!1}intersectsBox(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsBox(t))return!0;return!1}containsPoint(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].containsPoint(t))return!0;return!1}copy(t){this.coordinateSystem=t.coordinateSystem;let e=this._frustums,n=t._frustums;for(let s=0;s<t._count;s++)e[s]===void 0&&(e[s]=new tn),e[s].copy(n[s]);return this._count=t._count,this}clone(){return new i().copy(this)}};var Li=class extends Ze{constructor(t=[],e=vn,n,s,r,a,o,l,c,h){super(t,e,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}};var O0=class extends Ze{constructor(t,e,n=f0,s,r,a,o=Pe,l=Pe,c,h=U0,u=1){if(h!==U0&&h!==z0)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let d={width:t,height:e,depth:u};super(d,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new Vn(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return e.compareFunction=this.compareFunction,e}},Di=class extends O0{constructor(t,e=f0,n=vn,s,r,a=Pe,o=Pe,l,c=U0){let h={width:t,height:t,depth:1},u=[h,h,h,h,h,h];super(t,t,e,n,s,r,a,o,l,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},Ni=class extends Ze{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},ie=class i extends Te{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],u=[],d=0,f=0;_("z","y","x",-1,-1,n,e,t,a,r,0),_("z","y","x",1,-1,n,e,-t,a,r,1),_("x","z","y",1,1,t,n,e,s,a,2),_("x","z","y",1,-1,t,n,-e,s,a,3),_("x","y","z",1,-1,t,e,n,s,r,4),_("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new ae(c,3)),this.setAttribute("normal",new ae(h,3)),this.setAttribute("uv",new ae(u,2));function _(v,p,m,y,b,x,w,T,g,S,C){let R=x/g,L=w/S,F=x/2,H=w/2,P=T/2,G=g+1,X=S+1,k=0,et=0,W=new U;for(let Q=0;Q<X;Q++){let tt=Q*L-H;for(let Tt=0;Tt<G;Tt++){let rt=Tt*R-F;W[v]=rt*y,W[p]=tt*b,W[m]=P,c.push(W.x,W.y,W.z),W[v]=0,W[p]=0,W[m]=T>0?1:-1,h.push(W.x,W.y,W.z),u.push(Tt/g),u.push(1-Q/S),k+=1}}for(let Q=0;Q<S;Q++)for(let tt=0;tt<g;tt++){let Tt=d+tt+G*Q,rt=d+tt+G*(Q+1),Y=d+(tt+1)+G*(Q+1),ot=d+(tt+1)+G*Q;l.push(Tt,rt,ot),l.push(rt,Y,ot),et+=6}o.addGroup(f,et,C),f+=et,d+=k}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var fe=class i extends Te{constructor(t=1,e=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],u=[],d=[],f=[],_=0,v=[],p=n/2,m=0;y(),a===!1&&(t>0&&b(!0),e>0&&b(!1)),this.setIndex(h),this.setAttribute("position",new ae(u,3)),this.setAttribute("normal",new ae(d,3)),this.setAttribute("uv",new ae(f,2));function y(){let x=new U,w=new U,T=0,g=(e-t)/n;for(let S=0;S<=r;S++){let C=[],R=S/r,L=R*(e-t)+t;for(let F=0;F<=s;F++){let H=F/s,P=H*l+o,G=Math.sin(P),X=Math.cos(P);w.x=L*G,w.y=-R*n+p,w.z=L*X,u.push(w.x,w.y,w.z),x.set(G,g,X).normalize(),d.push(x.x,x.y,x.z),f.push(H,1-R),C.push(_++)}v.push(C)}for(let S=0;S<s;S++)for(let C=0;C<r;C++){let R=v[C][S],L=v[C+1][S],F=v[C+1][S+1],H=v[C][S+1];(t>0||C!==0)&&(h.push(R,L,H),T+=3),(e>0||C!==r-1)&&(h.push(L,F,H),T+=3)}c.addGroup(m,T,0),m+=T}function b(x){let w=_,T=new nt,g=new U,S=0,C=x===!0?t:e,R=x===!0?1:-1;for(let F=1;F<=s;F++)u.push(0,p*R,0),d.push(0,R,0),f.push(.5,.5),_++;let L=_;for(let F=0;F<=s;F++){let P=F/s*l+o,G=Math.cos(P),X=Math.sin(P);g.x=C*X,g.y=p*R,g.z=C*G,u.push(g.x,g.y,g.z),d.push(0,R,0),T.x=G*.5+.5,T.y=X*.5*R+.5,f.push(T.x,T.y),_++}for(let F=0;F<s;F++){let H=w+F,P=L+F;x===!0?h.push(P,P+1,H):h.push(P+1,P,H),S+=3}c.addGroup(m,S,x===!0?1:2),m+=S}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},M0=class i extends fe{constructor(t=1,e=1,n=32,s=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,s,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new i(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Ui=class i extends Te{constructor(t=[],e=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:s};let r=[],a=[];o(s),c(n),h(),this.setAttribute("position",new ae(r,3)),this.setAttribute("normal",new ae(r.slice(),3)),this.setAttribute("uv",new ae(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(y){let b=new U,x=new U,w=new U;for(let T=0;T<e.length;T+=3)f(e[T+0],b),f(e[T+1],x),f(e[T+2],w),l(b,x,w,y)}function l(y,b,x,w){let T=w+1,g=[];for(let S=0;S<=T;S++){g[S]=[];let C=y.clone().lerp(x,S/T),R=b.clone().lerp(x,S/T),L=T-S;for(let F=0;F<=L;F++)F===0&&S===T?g[S][F]=C:g[S][F]=C.clone().lerp(R,F/L)}for(let S=0;S<T;S++)for(let C=0;C<2*(T-S)-1;C++){let R=Math.floor(C/2);C%2===0?(d(g[S][R+1]),d(g[S+1][R]),d(g[S][R])):(d(g[S][R+1]),d(g[S+1][R+1]),d(g[S+1][R]))}}function c(y){let b=new U;for(let x=0;x<r.length;x+=3)b.x=r[x+0],b.y=r[x+1],b.z=r[x+2],b.normalize().multiplyScalar(y),r[x+0]=b.x,r[x+1]=b.y,r[x+2]=b.z}function h(){let y=new U;for(let b=0;b<r.length;b+=3){y.x=r[b+0],y.y=r[b+1],y.z=r[b+2];let x=p(y)/2/Math.PI+.5,w=m(y)/Math.PI+.5;a.push(x,1-w)}_(),u()}function u(){for(let y=0;y<a.length;y+=6){let b=a[y+0],x=a[y+2],w=a[y+4],T=Math.max(b,x,w),g=Math.min(b,x,w);T>.9&&g<.1&&(b<.2&&(a[y+0]+=1),x<.2&&(a[y+2]+=1),w<.2&&(a[y+4]+=1))}}function d(y){r.push(y.x,y.y,y.z)}function f(y,b){let x=y*3;b.x=t[x+0],b.y=t[x+1],b.z=t[x+2]}function _(){let y=new U,b=new U,x=new U,w=new U,T=new nt,g=new nt,S=new nt;for(let C=0,R=0;C<r.length;C+=9,R+=6){y.set(r[C+0],r[C+1],r[C+2]),b.set(r[C+3],r[C+4],r[C+5]),x.set(r[C+6],r[C+7],r[C+8]),T.set(a[R+0],a[R+1]),g.set(a[R+2],a[R+3]),S.set(a[R+4],a[R+5]),w.copy(y).add(b).add(x).divideScalar(3);let L=p(w);v(T,R+0,y,L),v(g,R+2,b,L),v(S,R+4,x,L)}}function v(y,b,x,w){w<0&&y.x===1&&(a[b]=y.x-1),x.x===0&&x.z===0&&(a[b]=w/2/Math.PI+.5)}function p(y){return Math.atan2(y.z,-y.x)}function m(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.vertices,t.indices,t.radius,t.detail)}};var n0=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ot("Curve: .getPoint() not implemented.")}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let n=this.getLengths(),s=0,r=n.length,a;e?a=e:a=t*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);let h=n[s],d=n[s+1]-h,f=(a-h)/d;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let a=this.getPoint(s),o=this.getPoint(r),l=e||(a.isVector2?new nt:new U);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e=!1){let n=new U,s=[],r=[],a=[],o=new U,l=new oe;for(let f=0;f<=t;f++){let _=f/t;s[f]=this.getTangentAt(_,new U)}r[0]=new U,a[0]=new U;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(s[f-1],s[f]),o.length()>Number.EPSILON){o.normalize();let _=Math.acos(Kt(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(o,_))}a[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(Kt(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(o.crossVectors(r[0],r[t]))>0&&(f=-f);for(let _=1;_<=t;_++)r[_].applyMatrix4(l.makeRotationAxis(s[_],f*_)),a[_].crossVectors(s[_],r[_])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this.cacheArcLengths=null,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this.cacheArcLengths=null,this}},Yn=class extends n0{constructor(t=0,e=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e=new nt){let n=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);let o=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*h-f*u+this.aX,c=d*u+f*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},ar=class extends Yn{constructor(t,e,n,s,r,a){super(t,e,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}};function Fo(){let i=0,t=0,e=0,n=0;function s(r,a,o,l){i=r,t=o,e=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,f=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,f*=h,s(a,o,d,f)},calc:function(r){let a=r*r,o=a*r;return i+t*r+e*a+n*o}}}var V1=new U,W1=new U,Za=new Fo,Ja=new Fo,$a=new Fo,gn=class extends n0{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new U){let n=e,s=this.points,r=s.length,a=(r-(this.closed?0:1))*t,o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(W1.subVectors(s[0],s[1]).add(s[0]),c=W1);let u=s[o%r],d=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(V1.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=V1),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,_=Math.pow(c.distanceToSquared(u),f),v=Math.pow(u.distanceToSquared(d),f),p=Math.pow(d.distanceToSquared(h),f);v<1e-4&&(v=1),_<1e-4&&(_=v),p<1e-4&&(p=v),Za.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,_,v,p),Ja.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,_,v,p),$a.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,_,v,p)}else this.curveType==="catmullrom"&&(Za.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),Ja.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),$a.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(Za.calc(l),Ja.calc(l),$a.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new U().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function X1(i,t,e,n,s){let r=(n-t)*.5,a=(s-e)*.5,o=i*i,l=i*o;return(2*e-2*n+r+a)*l+(-3*e+3*n-2*r-a)*o+r*i+e}function dl(i,t){let e=1-i;return e*e*t}function fl(i,t){return 2*(1-i)*i*t}function pl(i,t){return i*i*t}function yi(i,t,e,n){return dl(i,t)+fl(i,e)+pl(i,n)}function ml(i,t){let e=1-i;return e*e*e*t}function gl(i,t){let e=1-i;return 3*e*e*i*t}function _l(i,t){return 3*(1-i)*i*i*t}function xl(i,t){return i*i*i*t}function vi(i,t,e,n,s){return ml(i,t)+gl(i,e)+_l(i,n)+xl(i,s)}var Fi=class extends n0{constructor(t=new nt,e=new nt,n=new nt,s=new nt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new nt){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(vi(t,s.x,r.x,a.x,o.x),vi(t,s.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},or=class extends n0{constructor(t=new U,e=new U,n=new U,s=new U){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new U){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(vi(t,s.x,r.x,a.x,o.x),vi(t,s.y,r.y,a.y,o.y),vi(t,s.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Oi=class extends n0{constructor(t=new nt,e=new nt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new nt){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new nt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},lr=class extends n0{constructor(t=new U,e=new U){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new U){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new U){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Bi=class extends n0{constructor(t=new nt,e=new nt,n=new nt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new nt){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(yi(t,s.x,r.x,a.x),yi(t,s.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},zi=class extends n0{constructor(t=new U,e=new U,n=new U){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new U){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(yi(t,s.x,r.x,a.x),yi(t,s.y,r.y,a.y),yi(t,s.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Gi=class extends n0{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new nt){let n=e,s=this.points,r=(s.length-1)*t,a=Math.floor(r),o=r-a,l=s[a===0?a:a-1],c=s[a],h=s[a>s.length-2?s.length-1:a+1],u=s[a>s.length-3?s.length-1:a+2];return n.set(X1(o,l.x,c.x,h.x,u.x),X1(o,l.y,c.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new nt().fromArray(s))}return this}},cr=Object.freeze({__proto__:null,ArcCurve:ar,CatmullRomCurve3:gn,CubicBezierCurve:Fi,CubicBezierCurve3:or,EllipseCurve:Yn,LineCurve:Oi,LineCurve3:lr,QuadraticBezierCurve:Bi,QuadraticBezierCurve3:zi,SplineCurve:Gi}),hr=class extends n0{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1,this.cacheLengths=null}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new cr[n](e,t))}return this}getPoint(t,e){let n=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let a=s[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],n;for(let s=0,r=this.curves;s<r.length;s++){let a=r[s],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this.cacheLengths=null,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(new cr[s.type]().fromJSON(s))}return this.cacheLengths=null,this}},ki=class extends hr{constructor(t){super(),this.type="Path",this.currentPoint=new nt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let n=new Oi(this.currentPoint.clone(),new nt(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){let r=new Bi(this.currentPoint.clone(),new nt(t,e),new nt(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,a){let o=new Fi(this.currentPoint.clone(),new nt(t,e),new nt(n,s),new nt(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),n=new Gi(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,a){let o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,n,s,r,a),this}absarc(t,e,n,s,r,a){return this.absellipse(t,e,n,n,s,r,a),this}ellipse(t,e,n,s,r,a,o,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,a,o,l),this}absellipse(t,e,n,s,r,a,o,l){let c=new Yn(t,e,n,s,r,a,o,l);if(this.curves.length>0){let u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},Zn=class extends ki{constructor(t){super(t),this.uuid=si(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(new ki().fromJSON(s))}return this}};function yl(i,t,e=2){let n=t&&t.length,s=n?t[0]*e:i.length,r=H2(i,0,s,e,!0),a=[];if(!r||r.next===r.prev)return a;let o,l,c;if(n&&(r=El(i,t,r,e)),i.length>80*e){o=i[0],l=i[1];let h=o,u=l;for(let d=e;d<s;d+=e){let f=i[d],_=i[d+1];f<o&&(o=f),_<l&&(l=_),f>h&&(h=f),_>u&&(u=_)}c=Math.max(h-o,u-l),c=c!==0?32767/c:0}return Hi(r,a,e,o,l,c,0),a}function H2(i,t,e,n,s){let r;if(s===Ul(i,t,e,n)>0)for(let a=t;a<e;a+=n)r=q1(a/n|0,i[a],i[a+1],r);else for(let a=e-n;a>=t;a-=n)r=q1(a/n|0,i[a],i[a+1],r);return r&&Jn(r,r.next)&&(Wi(r),r=r.next),r}function _n(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(Jn(e,e.next)||ve(e.prev,e,e.next)===0)){if(Wi(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Hi(i,t,e,n,s,r,a){if(!i)return;!a&&r&&Cl(i,n,s,r);let o=i;for(;i.prev!==i.next;){let l=i.prev,c=i.next;if(r?Ml(i,n,s,r):vl(i)){t.push(l.i,i.i,c.i),Wi(i),i=c.next,o=c.next;continue}if(i=c,i===o){a?a===1?(i=Sl(_n(i),t),Hi(i,t,e,n,s,r,2)):a===2&&bl(i,t,e,n,s,r):Hi(_n(i),t,e,n,s,r,1);break}}}function vl(i){let t=i.prev,e=i,n=i.next;if(ve(t,e,n)>=0)return!1;let s=t.x,r=e.x,a=n.x,o=t.y,l=e.y,c=n.y,h=Math.min(s,r,a),u=Math.min(o,l,c),d=Math.max(s,r,a),f=Math.max(o,l,c),_=n.next;for(;_!==t;){if(_.x>=h&&_.x<=d&&_.y>=u&&_.y<=f&&_i(s,o,r,l,a,c,_.x,_.y)&&ve(_.prev,_,_.next)>=0)return!1;_=_.next}return!0}function Ml(i,t,e,n){let s=i.prev,r=i,a=i.next;if(ve(s,r,a)>=0)return!1;let o=s.x,l=r.x,c=a.x,h=s.y,u=r.y,d=a.y,f=Math.min(o,l,c),_=Math.min(h,u,d),v=Math.max(o,l,c),p=Math.max(h,u,d),m=no(f,_,t,e,n),y=no(v,p,t,e,n),b=i.prevZ,x=i.nextZ;for(;b&&b.z>=m&&x&&x.z<=y;){if(b.x>=f&&b.x<=v&&b.y>=_&&b.y<=p&&b!==s&&b!==a&&_i(o,h,l,u,c,d,b.x,b.y)&&ve(b.prev,b,b.next)>=0||(b=b.prevZ,x.x>=f&&x.x<=v&&x.y>=_&&x.y<=p&&x!==s&&x!==a&&_i(o,h,l,u,c,d,x.x,x.y)&&ve(x.prev,x,x.next)>=0))return!1;x=x.nextZ}for(;b&&b.z>=m;){if(b.x>=f&&b.x<=v&&b.y>=_&&b.y<=p&&b!==s&&b!==a&&_i(o,h,l,u,c,d,b.x,b.y)&&ve(b.prev,b,b.next)>=0)return!1;b=b.prevZ}for(;x&&x.z<=y;){if(x.x>=f&&x.x<=v&&x.y>=_&&x.y<=p&&x!==s&&x!==a&&_i(o,h,l,u,c,d,x.x,x.y)&&ve(x.prev,x,x.next)>=0)return!1;x=x.nextZ}return!0}function Sl(i,t){let e=i;do{let n=e.prev,s=e.next.next;!Jn(n,s)&&W2(n,e,e.next,s)&&Vi(n,s)&&Vi(s,n)&&(t.push(n.i,e.i,s.i),Wi(e),Wi(e.next),e=i=s),e=e.next}while(e!==i);return _n(e)}function bl(i,t,e,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&Ll(a,o)){let l=X2(a,o);a=_n(a,a.next),l=_n(l,l.next),Hi(a,t,e,n,s,r,0),Hi(l,t,e,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function El(i,t,e,n){let s=[];for(let r=0,a=t.length;r<a;r++){let o=t[r]*n,l=r<a-1?t[r+1]*n:i.length,c=H2(i,o,l,n,!1);c===c.next&&(c.steiner=!0),s.push(Pl(c))}s.sort(Tl);for(let r=0;r<s.length;r++)e=wl(s[r],e);return e}function Tl(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(t.next.y-t.y)/(t.next.x-t.x);e=n-s}return e}function wl(i,t){let e=Al(i,t);if(!e)return t;let n=X2(e,i);return _n(n,n.next),_n(e,e.next)}function Al(i,t){let e=t,n=i.x,s=i.y,r=-1/0,a;if(Jn(i,e))return e;do{if(Jn(i,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){let u=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(u<=n&&u>r&&(r=u,a=e.x<e.next.x?e:e.next,u===n))return a}e=e.next}while(e!==t);if(!a)return null;let o=a,l=a.x,c=a.y,h=1/0;e=a;do{if(n>=e.x&&e.x>=l&&n!==e.x&&V2(s<c?n:r,s,l,c,s<c?r:n,s,e.x,e.y)){let u=Math.abs(s-e.y)/(n-e.x);Vi(e,i)&&(u<h||u===h&&(e.x>a.x||e.x===a.x&&Rl(a,e)))&&(a=e,h=u)}e=e.next}while(e!==o);return a}function Rl(i,t){return ve(i.prev,i,t.prev)<0&&ve(t.next,i,i.next)<0}function Cl(i,t,e,n){let s=i;do s.z===0&&(s.z=no(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,Il(s)}function Il(i){let t,e=1;do{let n=i,s;i=null;let r=null;for(t=0;n;){t++;let a=n,o=0;for(let c=0;c<e&&(o++,a=a.nextZ,!!a);c++);let l=e;for(;o>0||l>0&&a;)o!==0&&(l===0||!a||n.z<=a.z)?(s=n,n=n.nextZ,o--):(s=a,a=a.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=a}r.nextZ=null,e*=2}while(t>1);return i}function no(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function Pl(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function V2(i,t,e,n,s,r,a,o){return(s-a)*(t-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(s-a)*(n-o)}function _i(i,t,e,n,s,r,a,o){return!(i===a&&t===o)&&V2(i,t,e,n,s,r,a,o)}function Ll(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!Dl(i,t)&&(Vi(i,t)&&Vi(t,i)&&Nl(i,t)&&(ve(i.prev,i,t.prev)||ve(i,t.prev,t))||Jn(i,t)&&ve(i.prev,i,i.next)>0&&ve(t.prev,t,t.next)>0)}function ve(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Jn(i,t){return i.x===t.x&&i.y===t.y}function W2(i,t,e,n){let s=zs(ve(i,t,e)),r=zs(ve(i,t,n)),a=zs(ve(e,n,i)),o=zs(ve(e,n,t));return!!(s!==r&&a!==o||s===0&&Bs(i,e,t)||r===0&&Bs(i,n,t)||a===0&&Bs(e,i,n)||o===0&&Bs(e,t,n))}function Bs(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function zs(i){return i>0?1:i<0?-1:0}function Dl(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&W2(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function Vi(i,t){return ve(i.prev,i,i.next)<0?ve(i,t,i.next)>=0&&ve(i,i.prev,t)>=0:ve(i,t,i.prev)<0||ve(i,i.next,t)<0}function Nl(i,t){let e=i,n=!1,s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function X2(i,t){let e=io(i.i,i.x,i.y),n=io(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function q1(i,t,e,n){let s=io(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Wi(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function io(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Ul(i,t,e,n){let s=0;for(let r=t,a=e-n;r<e;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}var so=class{static triangulate(t,e,n=2){return yl(t,e,n)}},pn=class i{static area(t){let e=t.length,n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let n=[],s=[],r=[];Y1(t),Z1(n,t);let a=t.length;e.forEach(Y1);for(let l=0;l<e.length;l++)s.push(a),a+=e[l].length,Z1(n,e[l]);let o=so.triangulate(n,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}};function Y1(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function Z1(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var Xi=class i extends Te{constructor(t=new Zn([new nt(.5,.5),new nt(-.5,.5),new nt(-.5,-.5),new nt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let n=this,s=[],r=[];for(let o=0,l=t.length;o<l;o++){let c=t[o];a(c)}this.setAttribute("position",new ae(s,3)),this.setAttribute("uv",new ae(r,2)),this.computeVertexNormals();function a(o){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1,d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:.2,_=e.bevelSize!==void 0?e.bevelSize:f-.1,v=e.bevelOffset!==void 0?e.bevelOffset:0,p=e.bevelSegments!==void 0?e.bevelSegments:3,m=e.extrudePath,y=e.UVGenerator!==void 0?e.UVGenerator:Fl,b,x=!1,w,T,g,S;if(m){b=m.getSpacedPoints(h),x=!0,d=!1;let j=m.isCatmullRomCurve3?m.closed:!1;w=m.computeFrenetFrames(h,j),T=new U,g=new U,S=new U}d||(p=0,f=0,_=0,v=0);let C=o.extractPoints(c),R=C.shape,L=C.holes;if(!pn.isClockWise(R)){R=R.reverse();for(let j=0,ct=L.length;j<ct;j++){let lt=L[j];pn.isClockWise(lt)&&(L[j]=lt.reverse())}}function H(j){let lt=10000000000000001e-36,bt=j[0];for(let mt=1;mt<=j.length;mt++){let Gt=mt%j.length,wt=j[Gt],Xt=wt.x-bt.x,$t=wt.y-bt.y,ne=Xt*Xt+$t*$t,D=Math.max(Math.abs(wt.x),Math.abs(wt.y),Math.abs(bt.x),Math.abs(bt.y)),ce=lt*D*D;if(ne<=ce){j.splice(Gt,1),mt--;continue}bt=wt}}H(R),L.forEach(H);let P=L.length,G=R;for(let j=0;j<P;j++){let ct=L[j];R=R.concat(ct)}function X(j,ct,lt){return ct||zt("ExtrudeGeometry: vec does not exist"),j.clone().addScaledVector(ct,lt)}let k=R.length;function et(j,ct,lt){let bt,mt,Gt,wt=j.x-ct.x,Xt=j.y-ct.y,$t=lt.x-j.x,ne=lt.y-j.y,D=wt*wt+Xt*Xt,ce=wt*ne-Xt*$t;if(Math.abs(ce)>Number.EPSILON){let Bt=Math.sqrt(D),he=Math.sqrt($t*$t+ne*ne),gt=ct.x-Xt/Bt,Me=ct.y+wt/Bt,Ft=lt.x-ne/he,kt=lt.y+$t/he,A=((Ft-gt)*ne-(kt-Me)*$t)/(wt*ne-Xt*$t);bt=gt+wt*A-j.x,mt=Me+Xt*A-j.y;let M=bt*bt+mt*mt;if(M<=2)return new nt(bt,mt);Gt=Math.sqrt(M/2)}else{let Bt=!1;wt>Number.EPSILON?$t>Number.EPSILON&&(Bt=!0):wt<-Number.EPSILON?$t<-Number.EPSILON&&(Bt=!0):Math.sign(Xt)===Math.sign(ne)&&(Bt=!0),Bt?(bt=-Xt,mt=wt,Gt=Math.sqrt(D)):(bt=wt,mt=Xt,Gt=Math.sqrt(D/2))}return new nt(bt/Gt,mt/Gt)}let W=[];for(let j=0,ct=G.length,lt=ct-1,bt=j+1;j<ct;j++,lt++,bt++)lt===ct&&(lt=0),bt===ct&&(bt=0),W[j]=et(G[j],G[lt],G[bt]);let Q=[],tt,Tt=W.concat();for(let j=0,ct=P;j<ct;j++){let lt=L[j];tt=[];for(let bt=0,mt=lt.length,Gt=mt-1,wt=bt+1;bt<mt;bt++,Gt++,wt++)Gt===mt&&(Gt=0),wt===mt&&(wt=0),tt[bt]=et(lt[bt],lt[Gt],lt[wt]);Q.push(tt),Tt=Tt.concat(tt)}let rt;if(p===0)rt=pn.triangulateShape(G,L);else{let j=[],ct=[];for(let lt=0;lt<p;lt++){let bt=lt/p,mt=f*Math.cos(bt*Math.PI/2),Gt=_*Math.sin(bt*Math.PI/2)+v;for(let wt=0,Xt=G.length;wt<Xt;wt++){let $t=X(G[wt],W[wt],Gt);Pt($t.x,$t.y,-mt),bt===0&&j.push($t)}for(let wt=0,Xt=P;wt<Xt;wt++){let $t=L[wt];tt=Q[wt];let ne=[];for(let D=0,ce=$t.length;D<ce;D++){let Bt=X($t[D],tt[D],Gt);Pt(Bt.x,Bt.y,-mt),bt===0&&ne.push(Bt)}bt===0&&ct.push(ne)}}rt=pn.triangulateShape(j,ct)}let Y=rt.length,ot=_+v;for(let j=0;j<k;j++){let ct=d?X(R[j],Tt[j],ot):R[j];x?(g.copy(w.normals[0]).multiplyScalar(ct.x),T.copy(w.binormals[0]).multiplyScalar(ct.y),S.copy(b[0]).add(g).add(T),Pt(S.x,S.y,S.z)):Pt(ct.x,ct.y,0)}for(let j=1;j<=h;j++)for(let ct=0;ct<k;ct++){let lt=d?X(R[ct],Tt[ct],ot):R[ct];x?(g.copy(w.normals[j]).multiplyScalar(lt.x),T.copy(w.binormals[j]).multiplyScalar(lt.y),S.copy(b[j]).add(g).add(T),Pt(S.x,S.y,S.z)):Pt(lt.x,lt.y,u/h*j)}for(let j=p-1;j>=0;j--){let ct=j/p,lt=f*Math.cos(ct*Math.PI/2),bt=_*Math.sin(ct*Math.PI/2)+v;for(let mt=0,Gt=G.length;mt<Gt;mt++){let wt=X(G[mt],W[mt],bt);Pt(wt.x,wt.y,u+lt)}for(let mt=0,Gt=L.length;mt<Gt;mt++){let wt=L[mt];tt=Q[mt];for(let Xt=0,$t=wt.length;Xt<$t;Xt++){let ne=X(wt[Xt],tt[Xt],bt);x?Pt(ne.x,ne.y+b[h-1].y,b[h-1].x+lt):Pt(ne.x,ne.y,u+lt)}}}Et(),Lt();function Et(){let j=s.length/3;if(d){let ct=0,lt=k*ct;for(let bt=0;bt<Y;bt++){let mt=rt[bt];se(mt[2]+lt,mt[1]+lt,mt[0]+lt)}ct=h+p*2,lt=k*ct;for(let bt=0;bt<Y;bt++){let mt=rt[bt];se(mt[0]+lt,mt[1]+lt,mt[2]+lt)}}else{for(let ct=0;ct<Y;ct++){let lt=rt[ct];se(lt[2],lt[1],lt[0])}for(let ct=0;ct<Y;ct++){let lt=rt[ct];se(lt[0]+k*h,lt[1]+k*h,lt[2]+k*h)}}n.addGroup(j,s.length/3-j,0)}function Lt(){let j=s.length/3,ct=0;yt(G,ct),ct+=G.length;for(let lt=0,bt=L.length;lt<bt;lt++){let mt=L[lt];yt(mt,ct),ct+=mt.length}n.addGroup(j,s.length/3-j,1)}function yt(j,ct){let lt=j.length;for(;--lt>=0;){let bt=lt,mt=lt-1;mt<0&&(mt=j.length-1);for(let Gt=0,wt=h+p*2;Gt<wt;Gt++){let Xt=k*Gt,$t=k*(Gt+1),ne=ct+bt+Xt,D=ct+mt+Xt,ce=ct+mt+$t,Bt=ct+bt+$t;Ut(ne,D,ce,Bt)}}}function Pt(j,ct,lt){l.push(j),l.push(ct),l.push(lt)}function se(j,ct,lt){Wt(j),Wt(ct),Wt(lt);let bt=s.length/3,mt=y.generateTopUV(n,s,bt-3,bt-2,bt-1);Yt(mt[0]),Yt(mt[1]),Yt(mt[2])}function Ut(j,ct,lt,bt){Wt(j),Wt(ct),Wt(bt),Wt(ct),Wt(lt),Wt(bt);let mt=s.length/3,Gt=y.generateSideWallUV(n,s,mt-6,mt-3,mt-2,mt-1);Yt(Gt[0]),Yt(Gt[1]),Yt(Gt[3]),Yt(Gt[1]),Yt(Gt[2]),Yt(Gt[3])}function Wt(j){s.push(l[j*3+0]),s.push(l[j*3+1]),s.push(l[j*3+2])}function Yt(j){r.push(j.x),r.push(j.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return Ol(e,n,t)}static fromJSON(t,e){let n=[];for(let r=0,a=t.shapes.length;r<a;r++){let o=e[t.shapes[r]];n.push(o)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new cr[s.type]().fromJSON(s)),new i(n,t.options)}},Fl={generateTopUV:function(i,t,e,n,s){let r=t[e*3],a=t[e*3+1],o=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new nt(r,a),new nt(o,l),new nt(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){let a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[s*3],f=t[s*3+1],_=t[s*3+2],v=t[r*3],p=t[r*3+1],m=t[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new nt(a,1-l),new nt(c,1-u),new nt(d,1-_),new nt(v,1-m)]:[new nt(o,1-l),new nt(h,1-u),new nt(f,1-_),new nt(p,1-m)]}};function Ol(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var qi=class i extends Ui{constructor(t=1,e=0){let n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new i(t.radius,t.detail)}},$n=class i extends Te{constructor(t=[new nt(0,-.5),new nt(.5,0),new nt(0,.5)],e=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:s},e=Math.floor(e),s=Kt(s,0,Math.PI*2);let r=[],a=[],o=[],l=[],c=[],h=1/e,u=new U,d=new nt,f=new U,_=new U,v=new U,p=0,m=0;for(let y=0;y<=t.length-1;y++)switch(y){case 0:p=t[y+1].x-t[y].x,m=t[y+1].y-t[y].y,f.x=m*1,f.y=-p,f.z=m*0,v.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case t.length-1:v.normalize(),l.push(v.x,v.y,v.z);break;default:p=t[y+1].x-t[y].x,m=t[y+1].y-t[y].y,f.x=m*1,f.y=-p,f.z=m*0,_.copy(f),f.x+=v.x,f.y+=v.y,f.z+=v.z,f.normalize(),l.push(f.x,f.y,f.z),v.copy(_)}for(let y=0;y<=e;y++){let b=n+y*h*s,x=Math.sin(b),w=Math.cos(b);for(let T=0;T<=t.length-1;T++){u.x=t[T].x*x,u.y=t[T].y,u.z=t[T].x*w,a.push(u.x,u.y,u.z),d.x=y/e,d.y=T/(t.length-1),o.push(d.x,d.y);let g=l[3*T+0]*x,S=l[3*T+1],C=l[3*T+0]*w;c.push(g,S,C)}}for(let y=0;y<e;y++)for(let b=0;b<t.length-1;b++){let x=b+y*t.length,w=x,T=x+t.length,g=x+t.length+1,S=x+1;r.push(w,T,S),r.push(g,S,T)}this.setIndex(r),this.setAttribute("position",new ae(a,3)),this.setAttribute("uv",new ae(o,2)),this.setAttribute("normal",new ae(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.points,t.segments,t.phiStart,t.phiLength)}};var Yi=class i extends Te{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,u=t/o,d=e/l,f=[],_=[],v=[],p=[];for(let m=0;m<h;m++){let y=m*d-a;for(let b=0;b<c;b++){let x=b*u-r;_.push(x,-y,0),v.push(0,0,1),p.push(b/o),p.push(1-m/l)}}for(let m=0;m<l;m++)for(let y=0;y<o;y++){let b=y+c*m,x=y+c*(m+1),w=y+1+c*(m+1),T=y+1+c*m;f.push(b,x,T),f.push(x,w,T)}this.setIndex(f),this.setAttribute("position",new ae(_,3)),this.setAttribute("normal",new ae(v,3)),this.setAttribute("uv",new ae(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}};var Le=class i extends Te{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(a+o,Math.PI),c=0,h=[],u=new U,d=new U,f=[],_=[],v=[],p=[];for(let m=0;m<=n;m++){let y=[],b=m/n,x=a+b*o,w=t*Math.cos(x),T=Math.sqrt(t*t-w*w),g=0;m===0&&a===0?g=.5/e:m===n&&l===Math.PI&&(g=-.5/e);for(let S=0;S<=e;S++){let C=S/e,R=s+C*r;u.x=-T*Math.cos(R),u.y=w,u.z=T*Math.sin(R),_.push(u.x,u.y,u.z),d.copy(u).normalize(),v.push(d.x,d.y,d.z),p.push(C+g,1-b),y.push(c++)}h.push(y)}for(let m=0;m<n;m++)for(let y=0;y<e;y++){let b=h[m][y+1],x=h[m][y],w=h[m+1][y],T=h[m+1][y+1];(m!==0||a>0)&&f.push(b,x,T),(m!==n-1||l<Math.PI)&&f.push(x,w,T)}this.setIndex(f),this.setAttribute("position",new ae(_,3)),this.setAttribute("normal",new ae(v,3)),this.setAttribute("uv",new ae(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}},Zi=class i extends Ui{constructor(t=1,e=0){let n=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],s=[2,1,0,0,3,2,1,3,0,2,3,1];super(n,s,t,e),this.type="TetrahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new i(t.radius,t.detail)}},S0=class i extends Te{constructor(t=1,e=.4,n=12,s=48,r=Math.PI*2,a=0,o=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:s,arc:r,thetaStart:a,thetaLength:o},n=Math.floor(n),s=Math.floor(s);let l=[],c=[],h=[],u=[],d=new U,f=new U,_=new U;for(let v=0;v<=n;v++){let p=a+v/n*o;for(let m=0;m<=s;m++){let y=m/s*r;f.x=(t+e*Math.cos(p))*Math.cos(y),f.y=(t+e*Math.cos(p))*Math.sin(y),f.z=e*Math.sin(p),c.push(f.x,f.y,f.z),d.x=t*Math.cos(y),d.y=t*Math.sin(y),_.subVectors(f,d).normalize(),h.push(_.x,_.y,_.z),u.push(m/s),u.push(v/n)}}for(let v=1;v<=n;v++)for(let p=1;p<=s;p++){let m=(s+1)*v+p-1,y=(s+1)*(v-1)+p-1,b=(s+1)*(v-1)+p,x=(s+1)*v+p;l.push(m,y,x),l.push(y,b,x)}this.setIndex(l),this.setAttribute("position",new ae(c,3)),this.setAttribute("normal",new ae(h,3)),this.setAttribute("uv",new ae(u,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc,t.thetaStart,t.thetaLength)}};var Kn=class i extends Te{constructor(t=new zi(new U(-1,-1,0),new U(-1,1,0),new U(1,1,0)),e=64,n=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:s,closed:r};let a=t.computeFrenetFrames(e,r);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;let o=new U,l=new U,c=new nt,h=new U,u=[],d=[],f=[],_=[];v(),this.setIndex(_),this.setAttribute("position",new ae(u,3)),this.setAttribute("normal",new ae(d,3)),this.setAttribute("uv",new ae(f,2));function v(){for(let b=0;b<e;b++)p(b);p(r===!1?e:0),y(),m()}function p(b){h=t.getPointAt(b/e,h);let x=a.normals[b],w=a.binormals[b];for(let T=0;T<=s;T++){let g=T/s*Math.PI*2,S=Math.sin(g),C=-Math.cos(g);l.x=C*x.x+S*w.x,l.y=C*x.y+S*w.y,l.z=C*x.z+S*w.z,l.normalize(),d.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,u.push(o.x,o.y,o.z)}}function m(){for(let b=1;b<=e;b++)for(let x=1;x<=s;x++){let w=(s+1)*(b-1)+(x-1),T=(s+1)*b+(x-1),g=(s+1)*b+x,S=(s+1)*(b-1)+x;_.push(w,T,S),_.push(T,g,S)}}function y(){for(let b=0;b<=e;b++)for(let x=0;x<=s;x++)c.x=b/e,c.y=x/s,f.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new i(new cr[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};function Sn(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(J1(s))s.isRenderTargetTexture?(Ot("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(J1(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function ke(i){let t={};for(let e=0;e<i.length;e++){let n=Sn(i[e]);for(let s in n)t[s]=n[s]}return t}function J1(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function Bl(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Oo(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ee.workingColorSpace}var q2={clone:Sn,merge:ke},zl=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Gl=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,b0=class extends j0{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=zl,this.fragmentShader=Gl,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Sn(t.uniforms),this.uniformsGroups=Bl(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new Qt().setHex(s.value);break;case"v2":this.uniforms[n].value=new nt().fromArray(s.value);break;case"v3":this.uniforms[n].value=new U().fromArray(s.value);break;case"v4":this.uniforms[n].value=new xe().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Ht().fromArray(s.value);break;case"m4":this.uniforms[n].value=new oe().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},ur=class extends b0{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Ji=class extends j0{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Qt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Qt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=pa,this.normalScale=new nt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new F0,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}};var dr=class extends j0{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=A2,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},fr=class extends j0{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function Un(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function Gs(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var en=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let a;e:{i:if(!(t<s)){for(let o=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=e[++n],t<s)break t}a=e.length;break e}if(!(t>=r)){let o=e[1];t<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}a=n,n=0;break e}break n}for(;n<a;){let o=n+a>>>1;t<e[o]?a=o:n=o+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let a=0;a!==s;++a)e[a]=n[r+a];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},pr=class extends en{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:ja,endingEnd:ja}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,a=t+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case to:r=t,o=2*e-n;break;case eo:r=s.length-2,o=e+s[r]-s[r+1];break;default:r=t,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case to:a=t,l=2*n-e;break;case eo:a=1,l=n+s[1]-s[0];break;default:a=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,_=(n-e)/(s-e),v=_*_,p=v*_,m=-d*p+2*d*v-d*_,y=(1+d)*p+(-1.5-2*d)*v+(-.5+d)*_+1,b=(-1-f)*p+(1.5+f)*v+.5*_,x=f*p-f*v;for(let w=0;w!==o;++w)r[w]=m*a[h+w]+y*a[c+w]+b*a[l+w]+x*a[u+w];return r}},mr=class extends en{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(n-e)/(s-e),u=1-h;for(let d=0;d!==o;++d)r[d]=a[c+d]*u+a[l+d]*h;return r}},gr=class extends en{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},_r=class extends en{interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this.inTangents,u=this.outTangents;if(!h||!u){let _=(n-e)/(s-e),v=1-_;for(let p=0;p!==o;++p)r[p]=a[c+p]*v+a[l+p]*_;return r}let d=o*2,f=t-1;for(let _=0;_!==o;++_){let v=a[c+_],p=a[l+_],m=f*d+_*2,y=u[m],b=u[m+1],x=t*d+_*2,w=h[x],T=h[x+1],g=Hl(n,e,y,w,s);r[_]=Y2(g,v,b,T,p)}return r}};function Y2(i,t,e,n,s){let r=1-i;return r*r*r*t+3*r*r*i*e+3*r*i*i*n+i*i*i*s}function kl(i,t,e,n,s){let r=1-i;return 3*r*r*(e-t)+6*r*i*(n-e)+3*i*i*(s-n)}function Hl(i,t,e,n,s){let r=(i-t)/(s-t);for(let a=0;a<8;a++){let o=Y2(r,t,e,n,s)-i;if(Math.abs(o)<1e-10)break;let l=kl(r,t,e,n,s);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-o/l))}return r}var i0=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Un(e,this.TimeBufferType),this.values=Un(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:Un(t.times,Array),values:Un(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s),Gs(t.settings)&&(n.settings={inTangents:Un(t.settings.inTangents,Array),outTangents:Un(t.settings.outTangents,Array)})}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new gr(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new mr(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new pr(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new _r(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case Mi:e=this.InterpolantFactoryMethodDiscrete;break;case js:e=this.InterpolantFactoryMethodLinear;break;case Vs:e=this.InterpolantFactoryMethodSmooth;break;case Qa:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Ot("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Mi;case this.InterpolantFactoryMethodLinear:return js;case this.InterpolantFactoryMethodSmooth:return Vs;case this.InterpolantFactoryMethodBezier:return Qa}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t;Gs(this.settings)&&($1(this.settings.inTangents,t),$1(this.settings.outTangents,t))}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t;Gs(this.settings)&&(K1(this.settings.inTangents,t),K1(this.settings.outTangents,t))}return this}trim(t,e){let n=this.times,s=n.length,r=0,a=s-1;for(;r!==s&&n[r]<t;)++r;for(;a!==-1&&n[a]>e;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(zt("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(zt("KeyframeTrack: Track is empty.",this),t=!1);let a=null;for(let o=0;o!==r;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){zt("KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(a!==null&&a>l){zt("KeyframeTrack: Out of order keys.",this,o,l,a),t=!1;break}a=l}if(s!==void 0&&V3(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){zt("KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Vs,r=t.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(s)l=!0;else{let u=o*n,d=u-n,f=u+n;for(let _=0;_!==n;++_){let v=e[u+_];if(v!==e[d+_]||v!==e[f+_]){l=!0;break}}}if(l){if(o!==a){t[a]=t[o];let u=o*n,d=a*n;for(let f=0;f!==n;++f)e[d+f]=e[u+f]}++a}}if(r>0){t[a]=t[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)e[l+c]=e[o+c];++a}return a!==t.length?(this.times=t.slice(0,a),this.values=e.slice(0,a*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,Gs(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function $1(i,t){for(let e=0,n=i.length;e!==n;e+=2)i[e]+=t}function K1(i,t){for(let e=0,n=i.length;e!==n;e+=2)i[e]*=t}i0.prototype.ValueTypeName="";i0.prototype.TimeBufferType=Float32Array;i0.prototype.ValueBufferType=Float32Array;i0.prototype.DefaultInterpolation=js;var nn=class extends i0{constructor(t,e,n){super(t,e,n)}};nn.prototype.ValueTypeName="bool";nn.prototype.ValueBufferType=Array;nn.prototype.DefaultInterpolation=Mi;nn.prototype.InterpolantFactoryMethodLinear=void 0;nn.prototype.InterpolantFactoryMethodSmooth=void 0;var xr=class extends i0{constructor(t,e,n,s){super(t,e,n,s)}};xr.prototype.ValueTypeName="color";var yr=class extends i0{constructor(t,e,n,s){super(t,e,n,s)}};yr.prototype.ValueTypeName="number";var vr=class extends en{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-e)/(s-e),c=t*o;for(let h=c+o;c!==h;c+=4)y0.slerpFlat(r,0,a,c-o,a,c,l);return r}},$i=class extends i0{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new vr(this.times,this.values,this.getValueSize(),t)}};$i.prototype.ValueTypeName="quaternion";$i.prototype.InterpolantFactoryMethodSmooth=void 0;var sn=class extends i0{constructor(t,e,n){super(t,e,n)}};sn.prototype.ValueTypeName="string";sn.prototype.ValueBufferType=Array;sn.prototype.DefaultInterpolation=Mi;sn.prototype.InterpolantFactoryMethodLinear=void 0;sn.prototype.InterpolantFactoryMethodSmooth=void 0;var Mr=class extends i0{constructor(t,e,n,s){super(t,e,n,s)}};Mr.prototype.ValueTypeName="vector";var Sr=class{constructor(t,e,n){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){let u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){let f=c[u],_=c[u+1];if(f.global&&(f.lastIndex=0),f.test(h))return _}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Z2=new Sr,br=class{constructor(t){this.manager=t!==void 0?t:Z2,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},this.priority="auto",this.cache="default",typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}setPriority(t){return this.priority=t,this}setCache(t){return this.cache=t,this}abort(){return this}};br.DEFAULT_MATERIAL_NAME="__DEFAULT";var Ki=class extends Ge{static registerNode(t){this.prototype._lightNode=t}constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Qt(t),this.intensity=e}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},Qi=class extends Ki{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ge.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Qt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},Ka=new oe,Q1=new U,j1=new U,Er=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new nt(512,512),this.mapType=$e,this.map=null,this.mapPass=null,this.matrix=new oe,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new tn,this._frameExtents=new nt(1,1),this._viewportCount=1,this._viewports=[new xe(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera;Q1.setFromMatrixPosition(t.matrixWorld),e.position.copy(Q1),j1.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(j1),e.updateMatrixWorld(),this._updateMatrix(e,this.matrix,this._frustum)}_updateMatrix(t,e,n,s){Ka.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),n.setFromProjectionMatrix(Ka,t.coordinateSystem,t.reversedDepth);let r=this._frameExtents,a=s?s.z/r.x:1,o=s?s.w/r.y:1,l=s?s.x/r.x:0,c=s?s.y/r.y:0;t.coordinateSystem===kn||t.reversedDepth?e.set(.5*a,0,0,.5*a+l,0,.5*o,0,.5*o+c,0,0,1,0,0,0,0,1):e.set(.5*a,0,0,.5*a+l,0,.5*o,0,.5*o+c,0,0,.5,.5,0,0,0,1),e.multiply(Ka)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.mapType=t.mapType,this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return t.intensity=this.intensity,t.bias=this.bias,t.normalBias=this.normalBias,t.radius=this.radius,t.blurSamples=this.blurSamples,t.mapSize=this.mapSize.toArray(),t.mapType=this.mapType,t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},ks=new U,Hs=new y0,g0=new U,ji=class extends Ge{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new oe,this.projectionMatrix=new oe,this.projectionMatrixInverse=new oe,this.coordinateSystem=a0,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(ks,Hs,g0),g0.x===1&&g0.y===1&&g0.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ks,Hs,g0.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(ks,Hs,g0),g0.x===1&&g0.y===1&&g0.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ks,Hs,g0.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},$0=new U,t2=new nt,e2=new nt,Xe=class extends ji{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=tr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(Aa*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return tr*2*Math.atan(Math.tan(Aa*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){$0.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set($0.x,$0.y).multiplyScalar(-t/$0.z),$0.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set($0.x,$0.y).multiplyScalar(-t/$0.z)}getViewSize(t,e){return this.getViewBounds(t,t2,e2),e.subVectors(e2,t2)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(Aa*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,e-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var ts=class extends ji{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,a=n+t,o=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},ro=class extends Er{constructor(){super(new ts(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Qn=class extends Ki{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ge.DEFAULT_UP),this.updateMatrix(),this.target=new Ge,this.shadow=new ro}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}};var Fn=-90,On=1,jn=class extends Ge{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Xe(Fn,On,t,e);s.layers=this.layers,this.add(s);let r=new Xe(Fn,On,t,e);r.layers=this.layers,this.add(r);let a=new Xe(Fn,On,t,e);a.layers=this.layers,this.add(a);let o=new Xe(Fn,On,t,e);o.layers=this.layers,this.add(o);let l=new Xe(Fn,On,t,e);l.layers=this.layers,this.add(l);let c=new Xe(Fn,On,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,l]=e;for(let c of e)this.remove(c);if(t===a0)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===kn)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),_=t.xr.enabled;t.xr.enabled=!1;let v=n.texture.mipmapsAutoUpdate;n.texture.mipmapsAutoUpdate=!1;let p=!1;t.isWebGLRenderer===!0?p=t.state.buffers.depth.getReversed():p=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,2,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,3,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(n,4,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),n.texture.mipmapsAutoUpdate=v,t.setRenderTarget(n,5,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(u,d,f),t.xr.enabled=_,n.texture.needsPMREMUpdate=!0}},Tr=class extends Xe{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t,this.perCameraFrustumCulled=!1}};var Bo="\\[\\]\\.:\\/",Vl=new RegExp("["+Bo+"]","g"),zo="[^"+Bo+"]",Wl="[^"+Bo.replace("\\.","")+"]",Xl=/((?:WC+[\/:])*)/.source.replace("WC",zo),ql=/(WCOD+)?/.source.replace("WCOD",Wl),Yl=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",zo),Zl=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",zo),Jl=new RegExp("^"+Xl+ql+Yl+Zl+"$"),$l=["material","materials","bones","map"],ao=class{constructor(t,e,n){let s=n||_e.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},_e=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(Vl,"")}static parseTrackName(t){let e=Jl.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);$l.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===e||o.uuid===e)return o;let l=n(o.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Ot("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){zt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){zt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){zt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){zt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){zt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){zt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){zt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let a=t[s];if(a===void 0){let c=e.nodeName;zt("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){zt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){zt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};_e.Composite=ao;_e.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};_e.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};_e.prototype.GetterByBindingType=[_e.prototype._getValue_direct,_e.prototype._getValue_array,_e.prototype._getValue_arrayElement,_e.prototype._getValue_toArray];_e.prototype.SetterByBindingTypeAndVersioning=[[_e.prototype._setValue_direct,_e.prototype._setValue_direct_setNeedsUpdate,_e.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[_e.prototype._setValue_array,_e.prototype._setValue_array_setNeedsUpdate,_e.prototype._setValue_array_setMatrixWorldNeedsUpdate],[_e.prototype._setValue_arrayElement,_e.prototype._setValue_arrayElement_setNeedsUpdate,_e.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[_e.prototype._setValue_fromArray,_e.prototype._setValue_fromArray_setNeedsUpdate,_e.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Jd=new Float32Array(1);var n2=new oe,es=class{constructor(t,e,n=0,s=1/0){this.ray=new Ii(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new Wn,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):zt("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return n2.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(n2),this}intersectObject(t,e=!0,n=[]){return oo(t,this,n,e),n.sort(i2),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)oo(t[s],this,n,e);return n.sort(i2),n}};function i2(i,t){return i.distance-t.distance}function oo(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let a=0,o=r.length;a<o;a++)oo(r[a],t,e,!0)}}var Xo=class Xo{constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};Xo.prototype.isMatrix2=!0;var lo=Xo;function Go(i,t,e,n){let s=Kl(n);switch(e){case Ro:return i*t;case Nr:return i*t/s.components*s.byteLength;case Ur:return i*t/s.components*s.byteLength;case an:return i*t*2/s.components*s.byteLength;case Fr:return i*t*2/s.components*s.byteLength;case Co:return i*t*3/s.components*s.byteLength;case s0:return i*t*4/s.components*s.byteLength;case Or:return i*t*4/s.components*s.byteLength;case rs:case as:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case os:case ls:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case zr:case kr:return Math.max(i,16)*Math.max(t,8)/4;case Br:case Gr:return Math.max(i,8)*Math.max(t,8)/2;case Hr:case Vr:case Xr:case qr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Wr:case cs:case Yr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Zr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Jr:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case $r:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Kr:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Qr:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case jr:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case ta:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case ea:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case na:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case ia:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case sa:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case ra:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case aa:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case oa:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case la:case ca:case ha:return Math.ceil(i/4)*Math.ceil(t/4)*16;case ua:case da:return Math.ceil(i/4)*Math.ceil(t/4)*8;case hs:case fa:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Kl(i){switch(i){case $e:case Eo:return{byteLength:1,components:1};case ii:case To:case p0:return{byteLength:2,components:1};case Lr:case Dr:return{byteLength:2,components:4};case f0:case Pr:case o0:return{byteLength:4,components:1};case wo:case Ao:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"187"}}));typeof window<"u"&&(window.__THREE__?Ot("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="187");/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function g3(){let i=null,t=!1,e=null,n=null;function s(r,a){n=i.requestAnimationFrame(s),e(r,a)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function rc(i){let t=new WeakMap;function e(o,l){let c=o.array,h=o.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){let h=l.array,u=l.updateRanges;if(i.bindBuffer(c,o),u.length===0)i.bufferSubData(c,0,h);else{u.sort((f,_)=>f.start-_.start);let d=0;for(let f=1;f<u.length;f++){let _=u[d],v=u[f];v.start<=_.start+_.count+1?_.count=Math.max(_.count,v.start+v.count-_.start):(++d,u[d]=v)}u.length=d+1;for(let f=0,_=u.length;f<_;f++){let v=u[f];i.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=t.get(o);l&&(i.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var ac=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,oc=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,lc=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,cc=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,hc=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,uc=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,dc=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT )
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN )
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,fc=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,pc=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,mc=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,gc=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,_c=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,xc=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,yc=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,vc=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Mc=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Sc=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,bc=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Ec=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Tc=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,wc=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Ac=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Rc=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Cc=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ic=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Pc=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Lc=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Dc=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Nc=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Uc="gl_FragColor = linearToOutputTexel( gl_FragColor );",Fc=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Oc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Bc=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif`,zc=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Gc=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS

		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,kc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Hc=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Vc=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Wc=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Xc=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,qc=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Yc=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Zc=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Jc=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,$c=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Kc=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * worldNormal, ENVMAP_MAX_LOD );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * reflectVec, roughnessToMip( roughness ) );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureLod( envMap, envMapRotation * retroVec, roughnessToMip( roughness ) );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_PMREM
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,Qc=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,jc=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,th=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,eh=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,nh=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.045 );
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef USE_DIFFUSE_ROUGHNESS
	float diffuseRoughnessFactor = diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		diffuseRoughnessFactor *= texture2D( diffuseRoughnessMap, vDiffuseRoughnessMapUv ).r;
	#endif
	material.diffuseRoughness = saturate( diffuseRoughnessFactor );
#endif
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.045 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,ih=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float diffuseRoughness;
	#endif
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
#ifdef USE_DIFFUSE_ROUGHNESS
	const float EON_EPSILON = 1e-7;
	float FON_DirectionalAlbedo( const in float mu, const in float roughness, const in float A ) {
		float muComp = 1.0 - mu;
		float gOverPi = muComp * ( 0.0571085289 + muComp * ( 0.491881867 + muComp * ( - 0.332181442 + muComp * 0.0714429953 ) ) );
		return A * ( 1.0 + roughness * gOverPi );
	}
	vec3 BRDF_EON( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 diffuseColor, const in float roughness ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return BRDF_Lambert( rho );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float s = dot( lightDir, viewDir ) - dotNL * dotNV;
		float sOverT = ( s > 0.0 ) ? s / max( max( dotNL, dotNV ), EON_EPSILON ) : s;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		vec3 singleScatter = rho * RECIPROCAL_PI * A * ( 1.0 + roughness * sOverT );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		float albedoV = FON_DirectionalAlbedo( dotNV, roughness, A );
		float albedoL = FON_DirectionalAlbedo( dotNL, roughness, A );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		vec3 multiScatter = rhoMultiScatter * RECIPROCAL_PI
			* max( EON_EPSILON, 1.0 - albedoV )
			* max( EON_EPSILON, 1.0 - albedoL )
			/ max( EON_EPSILON, 1.0 - averageAlbedo );
		return singleScatter + multiScatter;
	}
	vec3 EON_DirectionalAlbedo( const in vec3 diffuseColor, const in float roughness, const in float dotNV ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return rho;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		float directionalAlbedo = FON_DirectionalAlbedo( dotNV, roughness, A );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		return rho * directionalAlbedo + rhoMultiScatter * ( 1.0 - directionalAlbedo );
	}
#endif
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = max( material.clearcoatRoughness, 0.045 );
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = max( material.roughness, 0.045 );
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float alphaT = max( material.alphaT, alpha );
		float V = V_GGX_SmithCorrelated_Anisotropic( alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN

		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );

		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );

		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );

		irradiance *= sheenEnergyComp;

	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		vec3 diffuseBRDF = BRDF_EON( directLight.direction, geometryViewDir, geometryNormal, material.diffuseColor, material.diffuseRoughness ) * ( 1.0 - material.metalness );
	#else
		vec3 diffuseBRDF = BRDF_Lambert( material.diffuseContribution );
	#endif
	reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuseAlbedo = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness );
		vec3 diffuse = irradiance * RECIPROCAL_PI * diffuseAlbedo * ( 1.0 - singleScattering - multiScattering );
	#else
		vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#endif
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuse = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness ) * ( 1.0 - totalScatteringDielectric );
	#else
		vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	#endif
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,sh=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_LIGHT_PROBE_GRIDS > 0
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		int probeGrid = - 1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( isInsideLightProbeGrid( probeWorldPos, probeWorldNormal, probesMin[ i ], probesMax[ i ], probesResolution[ i ] ) ) probeGrid = UNROLLED_LOOP_INDEX;
		}
		#pragma unroll_loop_end
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( probeGrid == UNROLLED_LOOP_INDEX ) irradiance += getLightProbeGridIrradiance( probesSH[ i ], probesMin[ i ], probesMax[ i ], probesResolution[ i ], probeWorldPos, probeWorldNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,rh=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_PMREM )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ah=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,oh=`#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMax[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
bool isInsideLightProbeGrid( vec3 worldPos, vec3 worldNormal, vec3 probesMin, vec3 probesMax, vec3 probesResolution ) {
	vec3 spacing = ( probesMax - probesMin ) / probesResolution;
	vec3 samplePos = worldPos + worldNormal * spacing * 0.5;
	vec3 margin = spacing * 0.01;
	return all( greaterThanEqual( samplePos, probesMin - margin ) ) && all( lessThanEqual( samplePos, probesMax + margin ) );
}
vec3 getLightProbeGridIrradiance( highp sampler3D probesSH, vec3 probesMin, vec3 probesMax, vec3 probesResolution, vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 probeSpacing = gridRange / res;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.5 / res, 1.0 - 0.5 / res );
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,lh=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,ch=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,hh=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,uh=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,dh=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,fh=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,ph=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,mh=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,gh=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,_h=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,xh=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,yh=`#if defined( USE_MORPHCOLORS )
	#if defined( USE_COLOR_ALPHA )
		vColor *= morphTargetBaseInfluence;
	#elif defined( USE_COLOR )
		vColor.rgb *= morphTargetBaseInfluence;
	#endif
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,vh=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Mh=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Sh=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,bh=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Eh=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Th=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,wh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ah=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Rh=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Ch=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ih=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ph=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Lh=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Dh=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Nh=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER

		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {

	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Uh=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Fh=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Oh=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Bh=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,zh=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Gh=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,kh=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				vec2 radius = shadowRadius * texelSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif

				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float lightDistance = length( lightToPosition );
			float depthRange = shadowCameraFar - shadowCameraNear;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float depthA = - shadowCameraNear / depthRange - shadowBias;
				float depthB = shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#else
				float depthA = shadowCameraFar / depthRange + shadowBias;
				float depthB = - shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			shadow = 0.0;
			for ( int i = 0; i < 5; i ++ ) {
				vec2 offset = vogelDiskSample( i, 5, phi );
				vec3 direction = bd3D + ( tangent * offset.x + bitangent * offset.y ) * texelSize;
				vec3 absDirection = abs( direction );
				float dp = depthA + depthB / max( max( absDirection.x, absDirection.y ), absDirection.z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow *= 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Hh=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Vh=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Wh=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Xh=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,qh=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Yh=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Zh=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Jh=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,$h=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Kh=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Qh=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,jh=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,tu=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,eu=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,nu=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	uniform mat3 diffuseRoughnessMapTransform;
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,iu=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	vDiffuseRoughnessMapUv = ( diffuseRoughnessMapTransform * vec3( DIFFUSE_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,su=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,ru=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,au=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ou=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,lu=`uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <envmap_common_pars_fragment>
void main() {
	#ifdef ENVMAP_TYPE_PMREM
		vec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );
	#else
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cu=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,hu=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,uu=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,du=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,fu=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,pu=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,mu=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,gu=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_u=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,xu=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,yu=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,vu=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Mu=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Su=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bu=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Eu=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Tu=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,wu=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Au=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ru=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Cu=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Iu=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DIFFUSE_ROUGHNESS
	uniform float diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		uniform sampler2D diffuseRoughnessMap;
	#endif
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN

		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;

	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Pu=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Lu=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Du=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Nu=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Uu=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Fu=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ou=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Bu=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Jt={alphahash_fragment:ac,alphahash_pars_fragment:oc,alphamap_fragment:lc,alphamap_pars_fragment:cc,alphatest_fragment:hc,alphatest_pars_fragment:uc,aomap_fragment:dc,aomap_pars_fragment:fc,batching_pars_vertex:pc,batching_vertex:mc,begin_vertex:gc,beginnormal_vertex:_c,bsdfs:xc,iridescence_fragment:yc,bumpmap_pars_fragment:vc,clipping_planes_fragment:Mc,clipping_planes_pars_fragment:Sc,clipping_planes_pars_vertex:bc,clipping_planes_vertex:Ec,color_fragment:Tc,color_pars_fragment:wc,color_pars_vertex:Ac,color_vertex:Rc,common:Cc,defaultnormal_vertex:Ic,displacementmap_pars_vertex:Pc,displacementmap_vertex:Lc,emissivemap_fragment:Dc,emissivemap_pars_fragment:Nc,colorspace_fragment:Uc,colorspace_pars_fragment:Fc,envmap_fragment:Oc,envmap_common_pars_fragment:Bc,envmap_pars_fragment:zc,envmap_pars_vertex:Gc,envmap_physical_pars_fragment:Kc,envmap_vertex:kc,fog_vertex:Hc,fog_pars_vertex:Vc,fog_fragment:Wc,fog_pars_fragment:Xc,gradientmap_pars_fragment:qc,lightmap_pars_fragment:Yc,lights_lambert_fragment:Zc,lights_lambert_pars_fragment:Jc,lights_pars_begin:$c,lights_toon_fragment:Qc,lights_toon_pars_fragment:jc,lights_phong_fragment:th,lights_phong_pars_fragment:eh,lights_physical_fragment:nh,lights_physical_pars_fragment:ih,lights_fragment_begin:sh,lights_fragment_maps:rh,lights_fragment_end:ah,lightprobes_pars_fragment:oh,logdepthbuf_fragment:lh,logdepthbuf_pars_fragment:ch,logdepthbuf_pars_vertex:hh,logdepthbuf_vertex:uh,map_fragment:dh,map_pars_fragment:fh,map_particle_fragment:ph,map_particle_pars_fragment:mh,metalnessmap_fragment:gh,metalnessmap_pars_fragment:_h,morphinstance_vertex:xh,morphcolor_vertex:yh,morphnormal_vertex:vh,morphtarget_pars_vertex:Mh,morphtarget_vertex:Sh,normal_fragment_begin:bh,normal_fragment_maps:Eh,normal_pars_fragment:Th,normal_pars_vertex:wh,normal_vertex:Ah,normalmap_pars_fragment:Rh,clearcoat_normal_fragment_begin:Ch,clearcoat_normal_fragment_maps:Ih,clearcoat_pars_fragment:Ph,iridescence_pars_fragment:Lh,opaque_fragment:Dh,packing:Nh,premultiplied_alpha_fragment:Uh,project_vertex:Fh,dithering_fragment:Oh,dithering_pars_fragment:Bh,roughnessmap_fragment:zh,roughnessmap_pars_fragment:Gh,shadowmap_pars_fragment:kh,shadowmap_pars_vertex:Hh,shadowmap_vertex:Vh,shadowmask_pars_fragment:Wh,skinbase_vertex:Xh,skinning_pars_vertex:qh,skinning_vertex:Yh,skinnormal_vertex:Zh,specularmap_fragment:Jh,specularmap_pars_fragment:$h,tonemapping_fragment:Kh,tonemapping_pars_fragment:Qh,transmission_fragment:jh,transmission_pars_fragment:tu,uv_pars_fragment:eu,uv_pars_vertex:nu,uv_vertex:iu,worldpos_vertex:su,background_vert:ru,background_frag:au,backgroundCube_vert:ou,backgroundCube_frag:lu,cube_vert:cu,cube_frag:hu,depth_vert:uu,depth_frag:du,distance_vert:fu,distance_frag:pu,equirect_vert:mu,equirect_frag:gu,linedashed_vert:_u,linedashed_frag:xu,meshbasic_vert:yu,meshbasic_frag:vu,meshlambert_vert:Mu,meshlambert_frag:Su,meshmatcap_vert:bu,meshmatcap_frag:Eu,meshnormal_vert:Tu,meshnormal_frag:wu,meshphong_vert:Au,meshphong_frag:Ru,meshphysical_vert:Cu,meshphysical_frag:Iu,meshtoon_vert:Pu,meshtoon_frag:Lu,points_vert:Du,points_frag:Nu,shadow_vert:Uu,shadow_frag:Fu,sprite_vert:Ou,sprite_frag:Bu},Mt={common:{diffuse:{value:new Qt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ht}},envmap:{envMap:{value:null},envMapRotation:{value:new Ht},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ht}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ht}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ht},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ht},normalScale:{value:new nt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ht},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ht}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ht}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ht}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Qt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new Qt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0},uvTransform:{value:new Ht}},sprite:{diffuse:{value:new Qt(16777215)},opacity:{value:1},center:{value:new nt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}}},A0={basic:{uniforms:ke([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.fog]),vertexShader:Jt.meshbasic_vert,fragmentShader:Jt.meshbasic_frag},lambert:{uniforms:ke([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Qt(0)},envMapIntensity:{value:1}}]),vertexShader:Jt.meshlambert_vert,fragmentShader:Jt.meshlambert_frag},phong:{uniforms:ke([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Qt(0)},specular:{value:new Qt(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Jt.meshphong_vert,fragmentShader:Jt.meshphong_frag},standard:{uniforms:ke([Mt.common,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.roughnessmap,Mt.metalnessmap,Mt.fog,Mt.lights,{emissive:{value:new Qt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Jt.meshphysical_vert,fragmentShader:Jt.meshphysical_frag},toon:{uniforms:ke([Mt.common,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.gradientmap,Mt.fog,Mt.lights,{emissive:{value:new Qt(0)}}]),vertexShader:Jt.meshtoon_vert,fragmentShader:Jt.meshtoon_frag},matcap:{uniforms:ke([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,{matcap:{value:null}}]),vertexShader:Jt.meshmatcap_vert,fragmentShader:Jt.meshmatcap_frag},points:{uniforms:ke([Mt.points,Mt.fog]),vertexShader:Jt.points_vert,fragmentShader:Jt.points_frag},dashed:{uniforms:ke([Mt.common,Mt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Jt.linedashed_vert,fragmentShader:Jt.linedashed_frag},depth:{uniforms:ke([Mt.common,Mt.displacementmap]),vertexShader:Jt.depth_vert,fragmentShader:Jt.depth_frag},normal:{uniforms:ke([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,{opacity:{value:1}}]),vertexShader:Jt.meshnormal_vert,fragmentShader:Jt.meshnormal_frag},sprite:{uniforms:ke([Mt.sprite,Mt.fog]),vertexShader:Jt.sprite_vert,fragmentShader:Jt.sprite_frag},background:{uniforms:{uvTransform:{value:new Ht},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Jt.background_vert,fragmentShader:Jt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ht}},vertexShader:Jt.backgroundCube_vert,fragmentShader:Jt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Jt.cube_vert,fragmentShader:Jt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Jt.equirect_vert,fragmentShader:Jt.equirect_frag},distance:{uniforms:ke([Mt.common,Mt.displacementmap,{referencePosition:{value:new U},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Jt.distance_vert,fragmentShader:Jt.distance_frag},shadow:{uniforms:ke([Mt.lights,Mt.fog,{color:{value:new Qt(0)},opacity:{value:1}}]),vertexShader:Jt.shadow_vert,fragmentShader:Jt.shadow_frag}};A0.physical={uniforms:ke([A0.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ht},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ht},clearcoatNormalScale:{value:new nt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ht},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new Ht},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ht},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ht},sheen:{value:0},sheenColor:{value:new Qt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ht},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ht},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ht},transmissionSamplerSize:{value:new nt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ht},attenuationDistance:{value:0},attenuationColor:{value:new Qt(0)},specularColor:{value:new Qt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ht},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ht},anisotropyVector:{value:new nt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ht}}]),vertexShader:Jt.meshphysical_vert,fragmentShader:Jt.meshphysical_frag};var ma={r:0,b:0,g:0},zu=new oe,_3=new Ht;_3.set(-1,0,0,0,1,0,0,0,1);function Gu(i,t,e,n,s,r){let a=new Qt(0),o=s===!0?0:1,l,c,h=null,u=0,d=null;function f(y){let b=y.isScene===!0?y.background:null;if(b&&b.isTexture){let x=y.backgroundBlurriness>0;b=t.get(b,x)}return b}function _(y){let b=!1,x=f(y);x===null?p(a,o):x&&x.isColor&&(p(x,1),b=!0);let w=i.xr.getEnvironmentBlendMode();w==="additive"?e.buffers.color.setClear(0,0,0,1,r):w==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||b)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function v(y,b){let x=f(b);x&&x.isCubeTexture?(c===void 0&&(c=new Je(new ie(1,1,1),new b0({name:"BackgroundCubeMaterial",uniforms:Sn(A0.backgroundCube.uniforms),vertexShader:A0.backgroundCube.vertexShader,fragmentShader:A0.backgroundCube.fragmentShader,side:Ye,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(w,T,g){this.matrixWorld.copyPosition(g.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=x,c.material.uniforms.backgroundBlurriness.value=b.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(zu.makeRotationFromEuler(b.backgroundRotation)).transpose(),x.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(_3),c.material.toneMapped=ee.getTransfer(x.colorSpace)!==ue,(h!==x||u!==x.version||d!==i.toneMapping)&&(c.material.needsUpdate=!0,h=x,u=x.version,d=i.toneMapping),c.layers.enableAll(),y.unshift(c,c.geometry,c.material,0,0,null)):x&&x.isTexture&&(l===void 0&&(l=new Je(new Yi(2,2),new b0({name:"BackgroundMaterial",uniforms:Sn(A0.background.uniforms),vertexShader:A0.background.vertexShader,fragmentShader:A0.background.fragmentShader,side:rn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=x,l.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,l.material.toneMapped=ee.getTransfer(x.colorSpace)!==ue,x.matrixAutoUpdate===!0&&x.updateMatrix(),l.material.uniforms.uvTransform.value.copy(x.matrix),(h!==x||u!==x.version||d!==i.toneMapping)&&(l.material.needsUpdate=!0,h=x,u=x.version,d=i.toneMapping),l.layers.enableAll(),y.unshift(l,l.geometry,l.material,0,0,null))}function p(y,b){y.getRGB(ma,Oo(i)),e.buffers.color.setClear(ma.r,ma.g,ma.b,b,r)}function m(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(y,b=1){a.set(y),o=b,p(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(y){o=y,p(a,o)},render:_,addToRenderList:v,dispose:m}}function ku(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null),r=s,a=!1;function o(L,F,H,P,G){let X=!1,k=u(L,P,H,F);r!==k&&(r=k,c(r.object)),X=f(L,P,H,G),X&&_(L,P,H,G),G!==null&&t.update(G,i.ELEMENT_ARRAY_BUFFER),(X||a)&&(a=!1,x(L,F,H,P),G!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(G).buffer))}function l(){return i.createVertexArray()}function c(L){return i.bindVertexArray(L)}function h(L){return i.deleteVertexArray(L)}function u(L,F,H,P){let G=P.wireframe===!0,X=n[F.id];X===void 0&&(X={},n[F.id]=X);let k=L.isInstancedMesh===!0?L.id:0,et=X[k];et===void 0&&(et={},X[k]=et);let W=et[H.id];W===void 0&&(W={},et[H.id]=W);let Q=W[G];return Q===void 0&&(Q=d(l()),W[G]=Q),Q}function d(L){let F=[],H=[],P=[];for(let G=0;G<e;G++)F[G]=0,H[G]=0,P[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:F,enabledAttributes:H,attributeDivisors:P,object:L,attributes:{},index:null}}function f(L,F,H,P){let G=r.attributes,X=F.attributes,k=0,et=H.getAttributes();for(let W in et)if(et[W].location>=0){let tt=G[W],Tt=X[W];if(Tt===void 0&&(W==="instanceMatrix"&&L.instanceMatrix&&(Tt=L.instanceMatrix),W==="instanceColor"&&L.instanceColor&&(Tt=L.instanceColor)),tt===void 0||tt.attribute!==Tt||Tt&&tt.data!==Tt.data)return!0;k++}return r.attributesNum!==k||r.index!==P}function _(L,F,H,P){let G={},X=F.attributes,k=0,et=H.getAttributes();for(let W in et)if(et[W].location>=0){let tt=X[W];tt===void 0&&(W==="instanceMatrix"&&L.instanceMatrix&&(tt=L.instanceMatrix),W==="instanceColor"&&L.instanceColor&&(tt=L.instanceColor));let Tt={};Tt.attribute=tt,tt&&tt.data&&(Tt.data=tt.data),G[W]=Tt,k++}r.attributes=G,r.attributesNum=k,r.index=P}function v(){let L=r.newAttributes;for(let F=0,H=L.length;F<H;F++)L[F]=0}function p(L){m(L,0)}function m(L,F){let H=r.newAttributes,P=r.enabledAttributes,G=r.attributeDivisors;H[L]=1,P[L]===0&&(i.enableVertexAttribArray(L),P[L]=1),G[L]!==F&&(i.vertexAttribDivisor(L,F),G[L]=F)}function y(){let L=r.newAttributes,F=r.enabledAttributes;for(let H=0,P=F.length;H<P;H++)F[H]!==L[H]&&(i.disableVertexAttribArray(H),F[H]=0)}function b(L,F,H,P,G,X,k){k===!0?i.vertexAttribIPointer(L,F,H,G,X):i.vertexAttribPointer(L,F,H,P,G,X)}function x(L,F,H,P){v();let G=P.attributes,X=H.getAttributes(),k=F.defaultAttributeValues;for(let et in X){let W=X[et];if(W.location>=0){let Q=G[et];if(Q===void 0&&(et==="instanceMatrix"&&L.instanceMatrix&&(Q=L.instanceMatrix),et==="instanceColor"&&L.instanceColor&&(Q=L.instanceColor)),Q!==void 0){let tt=Q.normalized,Tt=Q.itemSize,rt=t.get(Q);if(rt===void 0)continue;let Y=rt.buffer,ot=rt.type,Et=rt.bytesPerElement,Lt=ot===i.INT||ot===i.UNSIGNED_INT||Q.gpuType===Pr;if(Q.isInterleavedBufferAttribute){let yt=Q.data,Pt=yt.isInterleavedBuffer===!0?yt.stride:yt.itemSize,se=Q.offset;if(yt.isInstancedInterleavedBuffer||yt.isInstancedBufferAttribute){for(let Ut=0;Ut<W.locationSize;Ut++)m(W.location+Ut,yt.meshPerAttribute);L.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=yt.meshPerAttribute*yt.count)}else for(let Ut=0;Ut<W.locationSize;Ut++)p(W.location+Ut);i.bindBuffer(i.ARRAY_BUFFER,Y);for(let Ut=0;Ut<W.locationSize;Ut++)b(W.location+Ut,Tt/W.locationSize,ot,tt,Pt*Et,(se+Tt/W.locationSize*Ut)*Et,Lt)}else{if(Q.isInstancedBufferAttribute){for(let yt=0;yt<W.locationSize;yt++)m(W.location+yt,Q.meshPerAttribute);L.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let yt=0;yt<W.locationSize;yt++)p(W.location+yt);i.bindBuffer(i.ARRAY_BUFFER,Y);for(let yt=0;yt<W.locationSize;yt++)b(W.location+yt,Tt/W.locationSize,ot,tt,Tt*Et,Tt/W.locationSize*yt*Et,Lt)}}else if(k!==void 0){let tt=k[et];if(tt!==void 0)switch(tt.length){case 2:i.vertexAttrib2fv(W.location,tt);break;case 3:i.vertexAttrib3fv(W.location,tt);break;case 4:i.vertexAttrib4fv(W.location,tt);break;default:i.vertexAttrib1fv(W.location,tt)}}}}y()}function w(){C();for(let L in n){let F=n[L];for(let H in F){let P=F[H];for(let G in P){let X=P[G];for(let k in X)h(X[k].object),delete X[k];delete P[G]}}delete n[L]}}function T(L){if(n[L.id]===void 0)return;let F=n[L.id];for(let H in F){let P=F[H];for(let G in P){let X=P[G];for(let k in X)h(X[k].object),delete X[k];delete P[G]}}delete n[L.id]}function g(L){for(let F in n){let H=n[F];for(let P in H){let G=H[P];if(G[L.id]===void 0)continue;let X=G[L.id];for(let k in X)h(X[k].object),delete X[k];delete G[L.id]}}}function S(L){for(let F in n){let H=n[F],P=L.isInstancedMesh===!0?L.id:0,G=H[P];if(G!==void 0){for(let X in G){let k=G[X];for(let et in k)h(k[et].object),delete k[et];delete G[X]}delete H[P],Object.keys(H).length===0&&delete n[F]}}}function C(){R(),a=!0,r!==s&&(r=s,c(r.object))}function R(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:C,resetDefaultState:R,dispose:w,releaseStatesOfGeometry:T,releaseStatesOfObject:S,releaseStatesOfProgram:g,initAttributes:v,enableAttribute:p,disableUnusedAttributes:y}}function Hu(i,t,e){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),e.update(c,n,1)}function a(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),e.update(c,n,h))}function o(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let d=0;for(let f=0;f<h;f++)d+=c[f];e.update(d,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function Vu(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let g=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(g.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(g){return!(g!==s0&&n.convert(g)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(g){let S=g===p0&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(g!==$e&&g!==o0&&!S&&n.convert(g)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(g){if(g==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";g="mediump"}return g==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(Ot("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let u=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control"),d=e.logarithmicDepthBuffer===!0&&u===!1;e.reversedDepthBuffer===!0&&u===!1&&Ot("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer."),e.logarithmicDepthBuffer===!0&&u===!0&&Ot("WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.");let f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_TEXTURE_SIZE),p=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),m=i.getParameter(i.MAX_VERTEX_ATTRIBS),y=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),b=i.getParameter(i.MAX_VARYING_VECTORS),x=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),w=i.getParameter(i.MAX_SAMPLES),T=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:_,maxTextureSize:v,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:y,maxVaryings:b,maxFragmentUniforms:x,maxSamples:w,samples:T}}function Wu(i){let t=this,e=null,n=0,s=!1,r=!1,a=new d0,o=new Ht,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){let f=u.length!==0||d||n!==0||s;return s=d,n=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,f){let _=u.clippingPlanes,v=u.clipIntersection,p=u.clipShadows,m=i.get(u);if(!s||_===null||_.length===0||r&&!p)r?h(null):c();else{let y=r?0:n,b=y*4,x=m.clippingState||null;l.value=x,x=h(_,d,b,f);for(let w=0;w!==b;++w)x[w]=e[w];m.clippingState=x,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=y}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,f,_){let v=u!==null?u.length:0,p=null;if(v!==0){if(p=l.value,_!==!0||p===null){let m=f+v*4,y=d.matrixWorldInverse;o.getNormalMatrix(y),(p===null||p.length<m)&&(p=new Float32Array(m));for(let b=0,x=f;b!==v;++b,x+=4)a.copy(u[b]).applyMatrix4(y,o),a.normal.toArray(p,x),p[x+3]=a.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=v,t.numIntersection=0,p}}var fs=class extends e0{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new Li(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new ie(5,5,5),r=new b0({name:"CubemapFromEquirect",uniforms:Sn(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ye,blending:xn});r.uniforms.tEquirect.value=e;let a=new Je(s,r),o=e.minFilter;return e.minFilter===B0&&(e.minFilter=qe),new jn(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}},J2=256,Xu=3,qu=20,x3=256,y3=16,Yu=3,Zu=new U,Ju=new Qt,_a=class i{constructor(t){this._renderer=t,this._cubeSize=0,this._sourceTarget=null,this._cubeCamera=new jn(1,10,null),this._boxMesh=new Je(new ie(5,5,5),null),this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null,this._integrationMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:a=256,position:o=Zu}=r,l=this._renderer;this._setSize(a);let c=this._allocateTarget(),h=this._getSourceTarget(!0);e>0&&(h.texture.mipmapsAutoUpdate=!1);let u=l.autoClear,d=l.autoClearColor,f=l.autoClearDepth,_=l.autoClearStencil,v=t.background;l.autoClear=!0,l.autoClearColor=!0,l.autoClearDepth=!0,l.autoClearStencil=!0,v===null&&(t.background=l.getClearColor(Ju));let p=new jn(n,s,h);return p.position.copy(o),p.update(l,t),l.autoClear=u,l.autoClearColor=d,l.autoClearDepth=f,l.autoClearStencil=_,t.background=v,e>0&&(h.texture.mipmapsAutoUpdate=!0,this._blur(c,e)),this._applyPMREM(c),c}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Q2(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=K2(),this._compileMaterial(this._equirectMaterial))}dispose(){this._sourceTarget!==null&&this._sourceTarget.dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._integrationMaterial!==null&&this._integrationMaterial.dispose(),this._boxMesh.geometry.dispose()}static lodToRoughness(t,e){return e>0?1-Math.sqrt(1-t/e):0}_setSize(t){this._cubeSize=Math.max(J2,G2(t))}_fromTexture(t,e){t.mapping===vn||t.mapping===ni?this._setSize(t.image.length===0?J2:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4);let n=e||this._allocateTarget();return this._textureToCubemap(t),this._applyPMREM(n),n}_allocateTarget(){let t=this._cubeSize,e=$2(t,!1,!1),n=Math.log2(t)-Xu;for(let s=0;s<=n;s++)e.texture.mipmaps.push({width:t>>s,height:t>>s});return e.texture.name="PMREM",e.texture.isPMREMTexture=!0,e}_getSourceTarget(t=!1){let e=this._cubeSize,n=this._sourceTarget;return(n===null||n.width!==e||t&&n.depthBuffer===!1)&&(n!==null&&n.dispose(),this._sourceTarget=$2(e,!0,t)),this._sourceTarget}_compileMaterial(t){this._boxMesh.material=t,this._renderer.compile(this._boxMesh,this._cubeCamera.children[0])}_renderCube(t,e,n){let s=this._boxMesh,r=this._cubeCamera;s.material=n,r.renderTarget=t,r.activeMipmapLevel=e;let a=t.width>>e;t.viewport.set(0,0,a,a),r.update(this._renderer,s),t.viewport.set(0,0,t.width,t.height)}_textureToCubemap(t){let e;t.mapping===vn||t.mapping===ni?(this._cubemapMaterial===null&&(this._cubemapMaterial=Q2()),e=this._cubemapMaterial,e.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):(this._equirectMaterial===null&&(this._equirectMaterial=K2()),e=this._equirectMaterial),e.uniforms.envMap.value=t,this._renderCube(this._getSourceTarget(),0,e)}_applyPMREM(t){this._ggxMaterial===null&&(this._ggxMaterial=$u(),this._integrationMaterial=Ku());let e=this._cubeSize,n=t.texture.mipmaps.length-1,s=this._ggxMaterial.uniforms;s.envMap.value=this._sourceTarget.texture;let r=this._integrationMaterial.uniforms;r.envMap.value=this._sourceTarget.texture,r.sourceLod.value=Math.log2(e/y3);for(let a=0;a<=n;a++){let o=i.lodToRoughness(a,n);if(a>n-Yu)r.roughness.value=o,this._renderCube(t,a,this._integrationMaterial);else{let l=o>0?Math.log2(e)+.5*Math.log2(6/(x3*Math.pow(o,4)))+.5:0;s.roughness.value=o,s.lodBias.value=l,this._renderCube(t,a,this._ggxMaterial)}}}_blur(t,e){this._blurMaterial===null&&(this._blurMaterial=Qu());let n=this._blurMaterial,s=n.uniforms,r=this._sourceTarget;s.sigma.value=Math.min(e,Math.PI)/Math.SQRT2,s.envMap.value=r.texture,this._renderCube(t,0,n),s.envMap.value=t.texture,this._renderCube(r,0,n)}};function $2(i,t,e){return new fs(i,{minFilter:B0,generateMipmaps:t,type:p0,colorSpace:Si,depthBuffer:e})}function ps(i,t,e){return new b0({name:i,uniforms:t,vertexShader:Jt.cube_vert,fragmentShader:e,side:Ye,blending:xn,depthTest:!1,depthWrite:!1})}function $u(){return ps("PMREMGGXConvolution",{envMap:{value:null},roughness:{value:0},lodBias:{value:0}},`

		#define GGX_SAMPLES ${x3}u

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float lodBias;

		#include <common>

		// Van der Corput radical inverse
		float radicalInverse_VdC( uint bits ) {

			bits = ( bits << 16u ) | ( bits >> 16u );
			bits = ( ( bits & 0x55555555u ) << 1u ) | ( ( bits & 0xAAAAAAAAu ) >> 1u );
			bits = ( ( bits & 0x33333333u ) << 2u ) | ( ( bits & 0xCCCCCCCCu ) >> 2u );
			bits = ( ( bits & 0x0F0F0F0Fu ) << 4u ) | ( ( bits & 0xF0F0F0F0u ) >> 4u );
			bits = ( ( bits & 0x00FF00FFu ) << 8u ) | ( ( bits & 0xFF00FF00u ) >> 8u );
			return float( bits ) * 2.3283064365386963e-10; // / 0x100000000

		}

		// Hammersley sequence
		vec2 hammersley( uint i, uint N ) {

			return vec2( float( i ) / float( N ), radicalInverse_VdC( i ) );

		}

		void main() {

			vec3 N = normalize( vWorldDirection );

			// For very low roughness, just sample the environment directly
			if ( roughness < 0.001 ) {

				gl_FragColor = vec4( textureLod( envMap, N, 0.0 ).rgb, 1.0 );
				return;

			}

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			// Tangent space basis for VNDF sampling
			vec3 up = abs( N.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, N ) );
			vec3 bitangent = cross( N, tangent );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			for ( uint i = 0u; i < GGX_SAMPLES; i ++ ) {

				vec2 Xi = hammersley( i, GGX_SAMPLES );

				// With V = N, sample the reflected direction directly.
				float invQ = 1.0 / ( 1.0 - Xi.x + alpha2 * Xi.x );
				float NdotL = ( 1.0 - Xi.x - alpha2 * Xi.x ) * invQ;

				if ( NdotL > 0.0 ) {

					float phi = 2.0 * PI * Xi.y;
					float sinTheta = 2.0 * alpha * sqrt( Xi.x * ( 1.0 - Xi.x ) ) * invQ;
					vec3 L = N * NdotL + ( tangent * cos( phi ) + bitangent * sin( phi ) ) * sinTheta;

					// Match the source mip to the sample's solid angle. The terms
					// independent of the sample are precomputed in lodBias.
					float d = alpha2 * invQ;
					float lod = max( log2( d ) + lodBias, 0.0 );

					// Weight by NdotL for the split-sum approximation
					prefilteredColor += textureLod( envMap, L, lod ).rgb * NdotL;
					totalWeight += NdotL;

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function Ku(){return ps("PMREMGGXIntegration",{envMap:{value:null},roughness:{value:0},sourceLod:{value:0},sourceSize:{value:y3}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float sourceLod;
		uniform int sourceSize;

		void main() {

			vec3 N = normalize( vWorldDirection );

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			float texelSize = 2.0 / float( sourceSize );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			// Pair opposite texels: only the one in N's hemisphere contributes.
			for ( int face = 0; face < 3; face ++ ) {

				for ( int y = 0; y < sourceSize; y ++ ) {

					for ( int x = 0; x < sourceSize; x ++ ) {

						vec2 uv = ( vec2( x, y ) + 0.5 ) * texelSize - 1.0;
						vec3 texelDirection = face == 0 ? vec3( 1.0, uv ) : ( face == 1 ? vec3( uv.x, 1.0, uv.y ) : vec3( uv, 1.0 ) );

						float invDistance = inversesqrt( 1.0 + dot( uv, uv ) );
						float NdotL = dot( N, texelDirection );
						texelDirection *= NdotL < 0.0 ? - 1.0 : 1.0;
						NdotL = abs( NdotL ) * invDistance;

						// With V = N, NdotH squared is ( 1 + NdotL ) / 2. Common factors
						// in the GGX distribution and texel solid angle cancel when normalized.
						float d = 1.0 + alpha2 + ( alpha2 - 1.0 ) * NdotL;
						float weight = NdotL * invDistance * invDistance * invDistance / ( d * d );

						prefilteredColor += textureLod( envMap, texelDirection, sourceLod ).rgb * weight;
						totalWeight += weight;

					}

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function Qu(){return ps("PMREMSphericalGaussianBlur",{envMap:{value:null},sigma:{value:0}},`

		#define SAMPLES ${qu}
		#define GOLDEN_ANGLE 2.39996322973

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float sigma;

		#include <common>

		void main() {

			vec3 outputDirection = normalize( vWorldDirection );

			vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, outputDirection ) );
			vec3 bitangent = cross( outputDirection, tangent );

			// Truncate the kernel at three standard deviations or at the antipode.
			float thetaMax = min( 3.0 * sigma, PI );
			float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

			vec3 accumColor = vec3( 0.0 );
			float accumWeight = 0.0;

			for ( int i = 0; i < SAMPLES; i ++ ) {

				// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
				float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
				float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
				float phi = float( i ) * GOLDEN_ANGLE;

				vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
				vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

				// Correct the planar sample density to solid angle.
				float weight = sin( theta ) / theta;

				accumColor += weight * textureLod( envMap, sampleDirection, 0.0 ).rgb;
				accumWeight += weight;

			}

			gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

		}
	`)}function K2(){return ps("PMREMEquirectangularToCubemap",{envMap:{value:null}},`

		varying vec3 vWorldDirection;

		uniform sampler2D envMap;

		#include <common>

		void main() {

			// Average four subpixel samples to preserve small, bright features.
			vec3 direction = normalize( vWorldDirection );
			vec3 dx = dFdx( direction ) * 0.25;
			vec3 dy = dFdy( direction ) * 0.25;

			vec3 color = textureLod( envMap, equirectUv( normalize( direction - dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction - dx + dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx + dy ) ), 0.0 ).rgb;
			gl_FragColor = vec4( color * 0.25, 1.0 );

		}
	`)}function Q2(){return ps("PMREMCubemapToCubemap",{envMap:{value:null},flipEnvMap:{value:-1}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`)}function ju(i){let t=new WeakMap,e=new WeakMap,n=null;function s(d,f=!1){return d==null?null:f?a(d):r(d)}function r(d){if(d&&d.isTexture){let f=d.mapping;if(f===Rr||f===Cr)if(t.has(d)){let _=t.get(d).texture;return o(_,d.mapping)}else{let _=d.image;if(_&&_.height>0){let v=new fs(_.height);return v.fromEquirectangularTexture(i,d),t.set(d,v),d.addEventListener("dispose",c),o(v.texture,d.mapping)}else return null}}return d}function a(d){if(d&&d.isTexture&&d.isPMREMTexture!==!0){let f=d.mapping,_=f===Rr||f===Cr,v=f===vn||f===ni;if(_||v){let p=e.get(d),m=p!==void 0?p.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==m)return n===null&&(n=new _a(i)),p=_?n.fromEquirectangular(d,p):n.fromCubemap(d,p),p.texture.pmremVersion=d.pmremVersion,e.set(d,p),p.texture;if(p!==void 0)return p.texture;{let y=d.image;return _&&y&&y.height>0||v&&y&&l(y)?(n===null&&(n=new _a(i)),p=_?n.fromEquirectangular(d):n.fromCubemap(d),p.texture.pmremVersion=d.pmremVersion,e.set(d,p),d.addEventListener("dispose",h),p.texture):null}}}return d}function o(d,f){return f===Rr?d.mapping=vn:f===Cr&&(d.mapping=ni),d}function l(d){let f=0,_=6;for(let v=0;v<_;v++)d[v]!==void 0&&f++;return f===_}function c(d){let f=d.target;f.removeEventListener("dispose",c);let _=t.get(f);_!==void 0&&(t.delete(f),_.dispose())}function h(d){let f=d.target;f.removeEventListener("dispose",h);let _=e.get(f);_!==void 0&&(e.delete(f),_.dispose())}function u(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:u}}function t4(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&xi("WebGLRenderer: "+n+" extension not supported."),s}}}function e4(i,t,e,n){let s={},r=new WeakMap,a=new FinalizationRegistry(_=>delete s[_]);function o(_){l(_.target)}function l(_){_.index!==null&&t.remove(_.index);for(let p in _.attributes)t.remove(_.attributes[p]);_.removeEventListener("dispose",o),delete s[_.id],a.unregister(_);let v=r.get(_);v&&(t.remove(v),r.delete(_)),n.releaseStatesOfGeometry(_),_.isInstancedBufferGeometry===!0&&delete _._maxInstanceCount,e.memory.geometries--}function c(_,v){return s[v.id]!==void 0||(v.addEventListener("dispose",o),s[v.id]=new WeakRef(v),a.register(v,v.id,v),e.memory.geometries++),v}function h(_){let v=_.attributes;for(let p in v)t.update(v[p],i.ARRAY_BUFFER)}function u(_){let v=_.index,p=_.attributes.position,m=0;if(p===void 0)return;let y=v!==null?v.array.length:p.array.length/3-1,b=p.count>=65535?Ci:Ri,x=new b(Math.ceil(y/3)*6,1),w=x.array;if(v!==null){let g=v.array;m=v.version;for(let S=0,C=0;S<y;S+=3){let R=g[S+0],L=g[S+1],F=g[S+2];w[C++]=R,w[C++]=L,w[C++]=L,w[C++]=F,w[C++]=F,w[C++]=R}}else{m=p.version;for(let g=0,S=0;g<y;g+=3){let C=g+0,R=g+1,L=g+2;w[S++]=C,w[S++]=R,w[S++]=R,w[S++]=L,w[S++]=L,w[S++]=C}}x.version=m;let T=r.get(_);T&&t.remove(T),r.set(_,x)}function d(_){let v=r.get(_);if(v){let p=_.index;p!==null&&v.version<p.version&&u(_)}else u(_);return r.get(_)}function f(){for(let _ in s){let v=s[_].deref();v!==void 0&&l(v)}}return{get:c,update:h,getWireframeAttribute:d,dispose:f}}function n4(i,t,e){let n;function s(u){n=u}let r,a;function o(u){r=u.type,a=u.bytesPerElement}function l(u,d){i.drawElements(n,d,r,u*a),e.update(d,n,1)}function c(u,d,f){f!==0&&(i.drawElementsInstanced(n,d,r,u*a,f),e.update(d,n,f))}function h(u,d,f){if(f===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,r,u,0,f);let v=0;for(let p=0;p<f;p++)v+=d[p];e.update(v,n,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function i4(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:zt("WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function s4(i,t,e){let n=new WeakMap,s=new xe;function r(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0,d=n.get(o);if(d===void 0||d.count!==u){let C=function(){g.dispose(),n.delete(o),o.removeEventListener("dispose",C)};d!==void 0&&d.texture.dispose();let f=o.morphAttributes.position!==void 0,_=o.morphAttributes.normal!==void 0,v=o.morphAttributes.color!==void 0,p=o.morphAttributes.position||[],m=o.morphAttributes.normal||[],y=o.morphAttributes.color||[],b=0;f===!0&&(b=1),_===!0&&(b=2),v===!0&&(b=3);let x=o.attributes.position.count*b,w=1;x>t.maxTextureSize&&(w=Math.ceil(x/t.maxTextureSize),x=t.maxTextureSize);let T=new Float32Array(x*w*4*u),g=new Ti(T,x,w,u);g.type=o0,g.needsUpdate=!0;let S=b*4;for(let R=0;R<u;R++){let L=p[R],F=m[R],H=y[R],P=x*w*4*R;for(let G=0;G<L.count;G++){let X=G*S;f===!0&&(s.fromBufferAttribute(L,G),T[P+X+0]=s.x,T[P+X+1]=s.y,T[P+X+2]=s.z,T[P+X+3]=0),_===!0&&(s.fromBufferAttribute(F,G),T[P+X+4]=s.x,T[P+X+5]=s.y,T[P+X+6]=s.z,T[P+X+7]=0),v===!0&&(s.fromBufferAttribute(H,G),T[P+X+8]=s.x,T[P+X+9]=s.y,T[P+X+10]=s.z,T[P+X+11]=H.itemSize===4?s.w:1)}}d={count:u,texture:g,size:new nt(x,w)},n.set(o,d),o.addEventListener("dispose",C)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let f=0;for(let v=0;v<c.length;v++)f+=c[v];let _=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",_),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function r4(i,t,e,n,s){let r=new WeakMap;function a(c){let h=s.render.frame,u=c.geometry,d=t.get(c,u);if(r.get(d)!==h&&(t.update(d),r.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return d}function o(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:a,dispose:o}}var a4={[_o]:"LINEAR_TONE_MAPPING",[xo]:"REINHARD_TONE_MAPPING",[yo]:"CINEON_TONE_MAPPING",[is]:"ACES_FILMIC_TONE_MAPPING",[Mo]:"AGX_TONE_MAPPING",[So]:"NEUTRAL_TONE_MAPPING",[vo]:"CUSTOM_TONE_MAPPING"};function o4(i,t,e,n,s,r){let a=new e0(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),o=null,l=null,c=null,h=new Te;h.setAttribute("position",new ae([-1,3,0,-1,-1,0,3,-1,0],3)),h.setAttribute("uv",new ae([0,2,0,0,2,0],2));let u=new ur({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new Je(h,u),f=new ts(-1,1,1,-1,0,1),_=null,v=null,p=!1,m,y=null,b=[],x=!1;this.setSize=function(w,T){a.setSize(w,T),o!==null&&o.setSize(w,T),l!==null&&l.setSize(w,T);for(let g=0;g<b.length;g++){let S=b[g];S.setSize&&S.setSize(w,T)}},this.setEffects=function(w){b=w,x=b.length>0&&b[0].isRenderPass===!0;let T=a.width,g=a.height;b.length>0&&o===null&&(o=new e0(T,g,{type:p0,depthBuffer:!1,stencilBuffer:!1}),l=new e0(T,g,{type:p0,depthBuffer:!1,stencilBuffer:!1}));let S=s===!0&&b.some(C=>C.needsDepthTexture===!0);S!==(a.depthTexture!==null)&&(S===!0&&c===null&&(c=new O0(T,g),r===!0&&(c.format=z0,c.type=Mn)),a.dispose(),a.depthTexture=S?c:null,a.resolveDepthBuffer=S,a.storeMultisampledDepthBuffer=S);for(let C=0;C<b.length;C++){let R=b[C];R.setSize&&R.setSize(T,g),S&&R.needsDepthTexture===!0&&R.setDepthTexture&&R.setDepthTexture(c)}},this.begin=function(w,T){if(p||w.toneMapping===T0&&b.length===0)return!1;if(y=T,T!==null){let g=T.width,S=T.height;(a.width!==g||a.height!==S)&&this.setSize(g,S)}return x===!1&&w.setRenderTarget(a),m=w.toneMapping,w.toneMapping=T0,!0},this.hasRenderPass=function(){return x},this.end=function(w,T){w.toneMapping=m,p=!0;let g=a,S=o;for(let C=0;C<b.length;C++){let R=b[C];R.enabled!==!1&&(R.render(w,S,g,T),R.needsSwap!==!1&&(g=S,S=S===o?l:o))}if(_!==w.outputColorSpace||v!==w.toneMapping){_=w.outputColorSpace,v=w.toneMapping,u.defines={},ee.getTransfer(_)===ue&&(u.defines.SRGB_TRANSFER="");let C=a4[v];C&&(u.defines[C]=""),u.needsUpdate=!0}u.uniforms.tDiffuse.value=g.texture,w.setRenderTarget(y),w.render(d,f),y=null,p=!1},this.isCompositing=function(){return p},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),l!==null&&l.dispose(),h.dispose(),u.dispose()}}var v3=new Ze,M3=new O0(1,1),S3=new Di(1),b3=new Ti,E3=new ir,T3=new Li,j2=[],t3=[],e3=new Float32Array(16),n3=new Float32Array(9),i3=new Float32Array(4);function ai(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=j2[s];if(r===void 0&&(r=new Float32Array(s),j2[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function we(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Ae(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function ya(i,t){let e=t3[t];e===void 0&&(e=new Int32Array(t),t3[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function l4(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function c4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(we(e,t))return;i.uniform2fv(this.addr,t),Ae(e,t)}}function h4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(we(e,t))return;i.uniform3fv(this.addr,t),Ae(e,t)}}function u4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(we(e,t))return;i.uniform4fv(this.addr,t),Ae(e,t)}}function d4(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(we(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Ae(e,t)}else{if(we(e,n))return;i3.set(n),i.uniformMatrix2fv(this.addr,!1,i3),Ae(e,n)}}function f4(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(we(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Ae(e,t)}else{if(we(e,n))return;n3.set(n),i.uniformMatrix3fv(this.addr,!1,n3),Ae(e,n)}}function p4(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(we(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Ae(e,t)}else{if(we(e,n))return;e3.set(n),i.uniformMatrix4fv(this.addr,!1,e3),Ae(e,n)}}function m4(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function g4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(we(e,t))return;i.uniform2iv(this.addr,t),Ae(e,t)}}function _4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(we(e,t))return;i.uniform3iv(this.addr,t),Ae(e,t)}}function x4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(we(e,t))return;i.uniform4iv(this.addr,t),Ae(e,t)}}function y4(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function v4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(we(e,t))return;i.uniform2uiv(this.addr,t),Ae(e,t)}}function M4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(we(e,t))return;i.uniform3uiv(this.addr,t),Ae(e,t)}}function S4(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(we(e,t))return;i.uniform4uiv(this.addr,t),Ae(e,t)}}function va(i){return i.version===0&&(i.compareFunction=Lo,i.needsUpdate=!0),i}function b4(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?r=va(M3):r=v3,e.setTexture2D(t||r,s)}function E4(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||E3,s)}function T4(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_CUBE_SHADOW?r=va(S3):r=T3,e.setTextureCube(t||r,s)}function w4(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||b3,s)}function A4(i){switch(i){case 5126:return l4;case 35664:return c4;case 35665:return h4;case 35666:return u4;case 35674:return d4;case 35675:return f4;case 35676:return p4;case 5124:case 35670:return m4;case 35667:case 35671:return g4;case 35668:case 35672:return _4;case 35669:case 35673:return x4;case 5125:return y4;case 36294:return v4;case 36295:return M4;case 36296:return S4;case 35678:case 36198:case 36298:case 36306:case 35682:return b4;case 35679:case 36299:case 36307:return E4;case 35680:case 36300:case 36308:case 36293:return T4;case 36289:case 36303:case 36311:case 36292:return w4}}function R4(i,t){i.uniform1fv(this.addr,t)}function C4(i,t){let e=ai(t,this.size,2);i.uniform2fv(this.addr,e)}function I4(i,t){let e=ai(t,this.size,3);i.uniform3fv(this.addr,e)}function P4(i,t){let e=ai(t,this.size,4);i.uniform4fv(this.addr,e)}function L4(i,t){let e=ai(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function D4(i,t){let e=ai(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function N4(i,t){let e=ai(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function U4(i,t){i.uniform1iv(this.addr,t)}function F4(i,t){i.uniform2iv(this.addr,t)}function O4(i,t){i.uniform3iv(this.addr,t)}function B4(i,t){i.uniform4iv(this.addr,t)}function z4(i,t){i.uniform1uiv(this.addr,t)}function G4(i,t){i.uniform2uiv(this.addr,t)}function k4(i,t){i.uniform3uiv(this.addr,t)}function H4(i,t){i.uniform4uiv(this.addr,t)}function V4(i,t,e){let n=this.cache,s=t.length,r=ya(e,s);we(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=va(M3):a=v3;for(let o=0;o!==s;++o)e.setTexture2D(t[o]||a,r[o])}function W4(i,t,e){let n=this.cache,s=t.length,r=ya(e,s);we(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||E3,r[a])}function X4(i,t,e){let n=this.cache,s=t.length,r=ya(e,s);we(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));let a;this.type===i.SAMPLER_CUBE_SHADOW?a=va(S3):a=T3;for(let o=0;o!==s;++o)e.setTextureCube(t[o]||a,r[o])}function q4(i,t,e){let n=this.cache,s=t.length,r=ya(e,s);we(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||b3,r[a])}function Y4(i){switch(i){case 5126:return R4;case 35664:return C4;case 35665:return I4;case 35666:return P4;case 35674:return L4;case 35675:return D4;case 35676:return N4;case 5124:case 35670:return U4;case 35667:case 35671:return F4;case 35668:case 35672:return O4;case 35669:case 35673:return B4;case 5125:return z4;case 36294:return G4;case 36295:return k4;case 36296:return H4;case 35678:case 36198:case 36298:case 36306:case 35682:return V4;case 35679:case 36299:case 36307:return W4;case 35680:case 36300:case 36308:case 36293:return X4;case 36289:case 36303:case 36311:case 36292:return q4}}var Zo=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=A4(e.type)}},Jo=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Y4(e.type)}},$o=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(t,e[o.id],n)}}},qo=/(\w+)(\])?(\[|\.)?/g;function s3(i,t){i.seq.push(t),i.map[t.id]=t}function Z4(i,t,e){let n=i.name,s=n.length;for(qo.lastIndex=0;;){let r=qo.exec(n),a=qo.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){s3(e,c===void 0?new Zo(o,i,t):new Jo(o,i,t));break}else{let u=e.map[o];u===void 0&&(u=new $o(o),s3(e,u)),e=u}}}var ri=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){let o=t.getActiveUniform(e,a),l=t.getUniformLocation(e,o.name);Z4(o,l,this)}let s=[],r=[];for(let a of this.seq)a.type===t.SAMPLER_2D_SHADOW||a.type===t.SAMPLER_CUBE_SHADOW||a.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){let o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let a=t[s];a.id in e&&n.push(a)}return n}};function r3(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var J4=37297,$4=0;function K4(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){let o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}var a3=new Ht;function Q4(i){ee._getMatrix(a3,ee.workingColorSpace,i);let t=`mat3( ${a3.elements.map(e=>e.toFixed(4))} )`;switch(ee.getTransfer(i)){case bi:return[t,"LinearTransferOETF"];case ue:return[t,"sRGBTransferOETF"];default:return Ot("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function o3(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return e.toUpperCase()+`

`+r+`

`+K4(i.getShaderSource(t),o)}else return r}function j4(i,t){let e=Q4(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( ${e[0]} * value.rgb, value.a ) );`,"}"].join(`
`)}var td={[_o]:"Linear",[xo]:"Reinhard",[yo]:"Cineon",[is]:"ACESFilmic",[Mo]:"AgX",[So]:"Neutral",[vo]:"Custom"};function ed(i,t){let e=td[t];return e===void 0?(Ot("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var ga=new U;function nd(){ee.getLuminanceCoefficients(ga);let i=ga.x.toFixed(4),t=ga.y.toFixed(4),e=ga.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function id(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ds).join(`
`)}function sd(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function rd(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),a=r.name,o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function ds(i){return i!==""}function l3(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows).replace(/NUM_LIGHT_PROBE_GRIDS/g,t.numLightProbeGrids)}function c3(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var ad=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ko(i){return i.replace(ad,od)}function od(i,t){let e=Jt[t];if(e===void 0)throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">");return Ko(e)}var ld=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function h3(i){return i.replace(ld,cd)}function cd(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function u3(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var hd={[ns]:"SHADOWMAP_TYPE_PCF",[ti]:"SHADOWMAP_TYPE_VSM"};function ud(i){return hd[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var dd={[ni]:"ENVMAP_MODE_REFRACTION"};function fd(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":dd[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var pd={[go]:"ENVMAP_BLENDING_MULTIPLY",[E2]:"ENVMAP_BLENDING_MIX",[T2]:"ENVMAP_BLENDING_ADD"};function md(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":pd[i.combine]||"ENVMAP_BLENDING_NONE"}function gd(i,t,e,n){let s=i.getContext(),r=e.defines,a=e.vertexShader,o=e.fragmentShader,l=ud(e),c=e.envMapPMREM===!0?"ENVMAP_TYPE_PMREM":"ENVMAP_TYPE_CUBE",h=fd(e),u=md(e),d=id(e),f=sd(r),_=s.createProgram(),v,p,m=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(v=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,f].filter(ds).join(`
`),v.length>0&&(v+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,f].filter(ds).join(`
`),p.length>0&&(p+=`
`)):(v=[u3(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,f,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.diffuseRoughnessMapUv?"#define DIFFUSE_ROUGHNESSMAP_UV "+e.diffuseRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ds).join(`
`),p=[u3(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,f,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",e.envMapPMREM?"#define ENVMAP_MAX_LOD "+e.envMapMaxLod+".0":"",e.envMapPMREM?"#define ENVMAP_SIZE "+e.envMapSize+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.diffuseRoughness?"#define USE_DIFFUSE_ROUGHNESS":"",e.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.retroreflection?"#define USE_RETROREFLECTION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==T0?"#define TONE_MAPPING":"",e.toneMapping!==T0?Jt.tonemapping_pars_fragment:"",e.toneMapping!==T0?ed("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Jt.colorspace_pars_fragment,j4("linearToOutputTexel",e.outputColorSpace),nd(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ds).join(`
`)),a=Ko(a),a=l3(a,e),a=c3(a,e),o=Ko(o),o=l3(o,e),o=c3(o,e),a=h3(a),o=h3(o),e.isRawShaderMaterial!==!0&&(m=`#version 300 es
`,v=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+v,p=["#define varying in",e.glslVersion===Do?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Do?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let y=m+v+a,b=m+p+o,x=r3(s,s.VERTEX_SHADER,y),w=r3(s,s.FRAGMENT_SHADER,b);s.attachShader(_,x),s.attachShader(_,w),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function T(R){if(i.debug.checkShaderErrors){let L=s.getProgramInfoLog(_)||"",F=s.getShaderInfoLog(x)||"",H=s.getShaderInfoLog(w)||"",P=L.trim(),G=F.trim(),X=H.trim(),k=!0,et=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(k=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,x,w);else{let W=o3(s,x,"vertex"),Q=o3(s,w,"fragment");zt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+P+`
`+W+`
`+Q)}else P!==""?Ot("WebGLProgram: Program Info Log:",P):(G===""||X==="")&&(et=!1);et&&(R.diagnostics={runnable:k,programLog:P,vertexShader:{log:G,prefix:v},fragmentShader:{log:X,prefix:p}})}s.deleteShader(x),s.deleteShader(w),g=new ri(s,_),S=rd(s,_)}let g;this.getUniforms=function(){return g===void 0&&T(this),g};let S;this.getAttributes=function(){return S===void 0&&T(this),S};let C=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=s.getProgramParameter(_,J4)),C},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=$4++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=x,this.fragmentShader=w,this}var _d=0,Qo=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new jo(t),e.set(t,n)),n}},jo=class{constructor(t){this.id=_d++,this.code=t,this.usedTimes=0}};function xd(i){return i===an||i===cs||i===hs}function yd(i,t,e,n,s,r){let a=new Wn,o=new Qo,l=new Set,c=[],h=new Map,u=n.logarithmicDepthBuffer,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function f(g){return l.add(g),g===0?"uv":`uv${g}`}function _(g,S,C,R,L,F){let H=R.fog,P=L.geometry,G=g.isMeshStandardMaterial||g.isMeshLambertMaterial||g.isMeshPhongMaterial?R.environment:null,X=g.isMeshStandardMaterial||g.isMeshLambertMaterial&&!g.envMap||g.isMeshPhongMaterial&&!g.envMap,k=t.get(g.envMap||G,X),et=d[g.type],W=n.precision;g.precision!==null&&(W=n.getMaxPrecision(g.precision),W!==g.precision&&Ot("WebGLProgram.getParameters:",g.precision,"not supported, using",W,"instead."));let Q=P.morphAttributes.position||P.morphAttributes.normal||P.morphAttributes.color,tt=Q!==void 0?Q.length:0,Tt=0;P.morphAttributes.position!==void 0&&(Tt=1),P.morphAttributes.normal!==void 0&&(Tt=2),P.morphAttributes.color!==void 0&&(Tt=3);let rt,Y,ot,Et;if(et){let vt=A0[et];rt=vt.vertexShader,Y=vt.fragmentShader}else{rt=g.vertexShader,Y=g.fragmentShader;let vt=o.getVertexShaderStage(g),de=o.getFragmentShaderStage(g);o.update(g,vt,de),ot=vt.id,Et=de.id}let Lt=i.getRenderTarget(),yt=i.state.buffers.depth.getReversed(),Pt=L.isInstancedMesh===!0,se=L.isBatchedMesh===!0,Ut=!!g.map,Wt=!!g.matcap,Yt=!!k,j=Yt&&k.isPMREMTexture===!0,ct=!!g.aoMap,lt=!!g.lightMap,bt=!!g.bumpMap&&g.wireframe===!1,mt=!!g.normalMap,Gt=!!g.displacementMap,wt=!!g.emissiveMap,Xt=!!g.metalnessMap,$t=!!g.roughnessMap,ne=g.anisotropy>0,D=g.clearcoat>0,ce=g.diffuseRoughness>0,Bt=g.dispersion>0,he=g.retroreflectivity>0,gt=g.iridescence>0,Me=g.sheen>0,Ft=g.transmission>0,kt=ne&&!!g.anisotropyMap,A=D&&!!g.clearcoatMap,M=D&&!!g.clearcoatNormalMap,B=D&&!!g.clearcoatRoughnessMap,it=ce&&!!g.diffuseRoughnessMap,K=gt&&!!g.iridescenceMap,ht=gt&&!!g.iridescenceThicknessMap,_t=Me&&!!g.sheenColorMap,Z=Me&&!!g.sheenRoughnessMap,J=!!g.specularMap,dt=!!g.specularColorMap,I=!!g.specularIntensityMap,$=Ft&&!!g.transmissionMap,q=Ft&&!!g.thicknessMap,ft=!!g.gradientMap,at=!!g.alphaMap,ut=g.alphaTest>0,Dt=!!g.alphaHash,Zt=!!g.extensions,st=T0;g.toneMapped&&(Lt===null||Lt.isXRRenderTarget===!0)&&(st=i.toneMapping);let Nt=j?k.isCompressedCubeTexture?k.image[0].mipmaps:k.mipmaps:null,qt={shaderID:et,shaderType:g.type,shaderName:g.name,vertexShader:rt,fragmentShader:Y,defines:g.defines,customVertexShaderID:ot,customFragmentShaderID:Et,isRawShaderMaterial:g.isRawShaderMaterial===!0,glslVersion:g.glslVersion,precision:W,batching:se,batchingColor:se&&L._colorsTexture!==null,instancing:Pt,instancingColor:Pt&&L.instanceColor!==null,instancingMorph:Pt&&L.morphTexture!==null,outputColorSpace:Lt===null?i.outputColorSpace:Lt.isXRRenderTarget===!0?Lt.texture.colorSpace:ee.workingColorSpace,alphaToCoverage:!!g.alphaToCoverage,map:Ut,matcap:Wt,envMap:Yt,envMapMode:Yt&&k.mapping,envMapPMREM:j,envMapMaxLod:j?Nt.length-1:null,envMapSize:j?Nt[0].width:null,aoMap:ct,lightMap:lt,bumpMap:bt,normalMap:mt,displacementMap:Gt,emissiveMap:wt,normalMapObjectSpace:mt&&g.normalMapType===R2,normalMapTangentSpace:mt&&g.normalMapType===pa,packedNormalMap:mt&&g.normalMapType===pa&&xd(g.normalMap.format),metalnessMap:Xt,roughnessMap:$t,anisotropy:ne,anisotropyMap:kt,clearcoat:D,clearcoatMap:A,clearcoatNormalMap:M,clearcoatRoughnessMap:B,diffuseRoughness:ce,diffuseRoughnessMap:it,dispersion:Bt,retroreflection:he,iridescence:gt,iridescenceMap:K,iridescenceThicknessMap:ht,sheen:Me,sheenColorMap:_t,sheenRoughnessMap:Z,specularMap:J,specularColorMap:dt,specularIntensityMap:I,transmission:Ft,transmissionMap:$,thicknessMap:q,gradientMap:ft,opaque:g.transparent===!1&&g.blending===ei&&g.alphaToCoverage===!1,alphaMap:at,alphaTest:ut,alphaHash:Dt,combine:g.combine,mapUv:Ut&&f(g.map.channel),aoMapUv:ct&&f(g.aoMap.channel),lightMapUv:lt&&f(g.lightMap.channel),bumpMapUv:bt&&f(g.bumpMap.channel),normalMapUv:mt&&f(g.normalMap.channel),displacementMapUv:Gt&&f(g.displacementMap.channel),emissiveMapUv:wt&&f(g.emissiveMap.channel),metalnessMapUv:Xt&&f(g.metalnessMap.channel),roughnessMapUv:$t&&f(g.roughnessMap.channel),anisotropyMapUv:kt&&f(g.anisotropyMap.channel),clearcoatMapUv:A&&f(g.clearcoatMap.channel),clearcoatNormalMapUv:M&&f(g.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:B&&f(g.clearcoatRoughnessMap.channel),diffuseRoughnessMapUv:it&&f(g.diffuseRoughnessMap.channel),iridescenceMapUv:K&&f(g.iridescenceMap.channel),iridescenceThicknessMapUv:ht&&f(g.iridescenceThicknessMap.channel),sheenColorMapUv:_t&&f(g.sheenColorMap.channel),sheenRoughnessMapUv:Z&&f(g.sheenRoughnessMap.channel),specularMapUv:J&&f(g.specularMap.channel),specularColorMapUv:dt&&f(g.specularColorMap.channel),specularIntensityMapUv:I&&f(g.specularIntensityMap.channel),transmissionMapUv:$&&f(g.transmissionMap.channel),thicknessMapUv:q&&f(g.thicknessMap.channel),alphaMapUv:at&&f(g.alphaMap.channel),vertexTangents:!!P.attributes.tangent&&(mt||ne),vertexNormals:!!P.attributes.normal,vertexColors:g.vertexColors,vertexAlphas:g.vertexColors===!0&&!!P.attributes.color&&P.attributes.color.itemSize===4,pointsUvs:L.isPoints===!0&&!!P.attributes.uv&&(Ut||at),fog:!!H,useFog:g.fog===!0,fogExp2:!!H&&H.isFogExp2,flatShading:g.wireframe===!1&&(g.flatShading===!0||P.attributes.normal===void 0&&mt===!1&&(g.isMeshLambertMaterial||g.isMeshPhongMaterial||g.isMeshStandardMaterial||g.isMeshPhysicalMaterial)),sizeAttenuation:g.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:yt,skinning:L.isSkinnedMesh===!0,hasPositionAttribute:P.attributes.position!==void 0,morphTargets:P.morphAttributes.position!==void 0,morphNormals:P.morphAttributes.normal!==void 0,morphColors:P.morphAttributes.color!==void 0,morphTargetsCount:tt,morphTextureStride:Tt,numSunLights:S.sun.length,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numSunLightShadows:S.sunShadowMap.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numLightProbeGrids:F.filter(vt=>vt.texture!==null).length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:g.dithering,shadowMapEnabled:i.shadowMap.enabled&&C.length>0,shadowMapType:i.shadowMap.type,toneMapping:st,decodeVideoTexture:Ut&&g.map.isVideoTexture===!0&&ee.getTransfer(g.map.colorSpace)===ue,decodeVideoTextureEmissive:wt&&g.emissiveMap.isVideoTexture===!0&&ee.getTransfer(g.emissiveMap.colorSpace)===ue,premultipliedAlpha:g.premultipliedAlpha,doubleSided:g.side===E0,flipSided:g.side===Ye,useDepthPacking:g.depthPacking>=0,depthPacking:g.depthPacking||0,index0AttributeName:g.index0AttributeName,extensionClipCullDistance:Zt&&g.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Zt&&g.extensions.multiDraw===!0||se)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:g.customProgramCacheKey()};return qt.vertexUv1s=l.has(1),qt.vertexUv2s=l.has(2),qt.vertexUv3s=l.has(3),l.clear(),qt}function v(g){let S=[];if(g.shaderID?S.push(g.shaderID):(S.push(g.customVertexShaderID),S.push(g.customFragmentShaderID)),g.defines!==void 0)for(let C in g.defines)S.push(C),S.push(g.defines[C]);return g.isRawShaderMaterial===!1&&(p(S,g),m(S,g),S.push(i.outputColorSpace)),S.push(g.customProgramCacheKey),S.join()}function p(g,S){g.push(S.precision),g.push(S.outputColorSpace),g.push(S.envMapMode),g.push(S.envMapPMREM),g.push(S.envMapMaxLod),g.push(S.envMapSize),g.push(S.mapUv),g.push(S.alphaMapUv),g.push(S.lightMapUv),g.push(S.aoMapUv),g.push(S.bumpMapUv),g.push(S.normalMapUv),g.push(S.displacementMapUv),g.push(S.emissiveMapUv),g.push(S.metalnessMapUv),g.push(S.roughnessMapUv),g.push(S.anisotropyMapUv),g.push(S.clearcoatMapUv),g.push(S.clearcoatNormalMapUv),g.push(S.clearcoatRoughnessMapUv),g.push(S.diffuseRoughnessMapUv),g.push(S.iridescenceMapUv),g.push(S.iridescenceThicknessMapUv),g.push(S.sheenColorMapUv),g.push(S.sheenRoughnessMapUv),g.push(S.specularMapUv),g.push(S.specularColorMapUv),g.push(S.specularIntensityMapUv),g.push(S.transmissionMapUv),g.push(S.thicknessMapUv),g.push(S.combine),g.push(S.fogExp2),g.push(S.sizeAttenuation),g.push(S.morphTargetsCount),g.push(S.numSunLights),g.push(S.numDirLights),g.push(S.numPointLights),g.push(S.numSpotLights),g.push(S.numSpotLightMaps),g.push(S.numHemiLights),g.push(S.numRectAreaLights),g.push(S.numSunLightShadows),g.push(S.numDirLightShadows),g.push(S.numPointLightShadows),g.push(S.numSpotLightShadows),g.push(S.numSpotLightShadowsWithMaps),g.push(S.numLightProbes),g.push(S.numLightProbeGrids),g.push(S.shadowMapType),g.push(S.toneMapping),g.push(S.numClippingPlanes),g.push(S.numClipIntersection),g.push(S.depthPacking)}function m(g,S){a.disableAll(),S.instancing&&a.enable(0),S.instancingColor&&a.enable(1),S.instancingMorph&&a.enable(2),S.matcap&&a.enable(3),S.envMap&&a.enable(4),S.normalMapObjectSpace&&a.enable(5),S.normalMapTangentSpace&&a.enable(6),S.clearcoat&&a.enable(7),S.iridescence&&a.enable(8),S.alphaTest&&a.enable(9),S.vertexColors&&a.enable(10),S.vertexAlphas&&a.enable(11),S.vertexUv1s&&a.enable(12),S.vertexUv2s&&a.enable(13),S.vertexUv3s&&a.enable(14),S.vertexTangents&&a.enable(15),S.anisotropy&&a.enable(16),S.alphaHash&&a.enable(17),S.batching&&a.enable(18),S.dispersion&&a.enable(19),S.retroreflection&&a.enable(24),S.diffuseRoughness&&a.enable(25),S.batchingColor&&a.enable(20),S.gradientMap&&a.enable(21),S.packedNormalMap&&a.enable(22),S.vertexNormals&&a.enable(23),g.push(a.mask),a.disableAll(),S.fog&&a.enable(0),S.useFog&&a.enable(1),S.flatShading&&a.enable(2),S.logarithmicDepthBuffer&&a.enable(3),S.reversedDepthBuffer&&a.enable(4),S.skinning&&a.enable(5),S.morphTargets&&a.enable(6),S.morphNormals&&a.enable(7),S.morphColors&&a.enable(8),S.premultipliedAlpha&&a.enable(9),S.shadowMapEnabled&&a.enable(10),S.doubleSided&&a.enable(11),S.flipSided&&a.enable(12),S.useDepthPacking&&a.enable(13),S.dithering&&a.enable(14),S.transmission&&a.enable(15),S.sheen&&a.enable(16),S.opaque&&a.enable(17),S.pointsUvs&&a.enable(18),S.decodeVideoTexture&&a.enable(19),S.decodeVideoTextureEmissive&&a.enable(20),S.alphaToCoverage&&a.enable(21),S.numLightProbeGrids>0&&a.enable(22),S.hasPositionAttribute&&a.enable(23),g.push(a.mask)}function y(g){let S=d[g.type],C;if(S){let R=A0[S];C=q2.clone(R.uniforms)}else C=g.uniforms;return C}function b(g,S){let C=h.get(S);return C!==void 0?++C.usedTimes:(C=new gd(i,S,g,s),c.push(C),h.set(S,C)),C}function x(g){if(--g.usedTimes===0){let S=c.indexOf(g);c[S]=c[c.length-1],c.pop(),h.delete(g.cacheKey),g.destroy()}}function w(g){o.remove(g)}function T(){o.dispose()}return{getParameters:_,getProgramCacheKey:v,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:w,programs:c,dispose:T}}function vd(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Md(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function d3(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function f3(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(d){let f=0;return d.isInstancedMesh&&(f+=2),d.isSkinnedMesh&&(f+=1),f}function o(d,f,_,v,p,m){let y=i[t];return y===void 0?(y={id:d.id,object:d,geometry:f,material:_,materialVariant:a(d),groupOrder:v,renderOrder:d.renderOrder,z:p,group:m},i[t]=y):(y.id=d.id,y.object=d,y.geometry=f,y.material=_,y.materialVariant=a(d),y.groupOrder=v,y.renderOrder=d.renderOrder,y.z=p,y.group=m),t++,y}function l(d,f,_,v,p,m,y){y.reversedDepth===!0&&(p=-p);let b=o(d,f,_,v,p,m);_.transmission>0?n.push(b):_.transparent===!0?s.push(b):e.push(b)}function c(d,f,_,v,p,m){let y=o(d,f,_,v,p,m);_.transmission>0?n.unshift(y):_.transparent===!0?s.unshift(y):e.unshift(y)}function h(d,f){e.length>1&&e.sort(d||Md),n.length>1&&n.sort(f||d3),s.length>1&&s.sort(f||d3)}function u(){for(let d=t,f=i.length;d<f;d++){let _=i[d];if(_.id===null)break;_.id=null,_.object=null,_.geometry=null,_.material=null,_.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:u,sort:h}}function Sd(){let i=new WeakMap;function t(n,s){let r=i.get(n),a;return r===void 0?(a=new f3,i.set(n,[a])):s>=r.length?(a=new f3,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function bd(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={direction:new U,color:new Qt};break;case"SpotLight":e={position:new U,direction:new U,color:new Qt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new U,color:new Qt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new U,skyColor:new Qt,groundColor:new Qt};break;case"RectAreaLight":e={color:new Qt,position:new U,halfWidth:new U,halfHeight:new U};break}return i[t.id]=e,e}}}function Ed(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new nt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new nt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new nt,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var Td=0;function wd(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Ad(i){let t=new bd,e=Ed(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new U);let s=new U,r=new oe,a=new oe;function o(c){let h=0,u=0,d=0;for(let F=0;F<9;F++)n.probe[F].set(0,0,0);let f=0,_=0,v=0,p=0,m=0,y=0,b=0,x=0,w=0,T=0,g=0,S=0,C=0,R=0;c.sort(wd);for(let F=0,H=c.length;F<H;F++){let P=c[F],G=P.color,X=P.intensity,k=P.distance,et=null;if(P.shadow&&P.shadow.map&&(P.shadow.map.texture.format===an?et=P.shadow.map.texture:et=P.shadow.map.depthTexture||P.shadow.map.texture),P.isAmbientLight)h+=G.r*X,u+=G.g*X,d+=G.b*X;else if(P.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(P.sh.coefficients[W],X);R++}else if(P.isSunLight){let W=t.get(P);if(W.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let Q=P.shadow,tt=e.get(P);tt.shadowIntensity=Q.intensity,tt.shadowBias=Q.bias,tt.shadowNormalBias=Q.normalBias,tt.shadowRadius=Q.radius,tt.shadowMapSize.copy(Q.mapSize).multiply(Q.getFrameExtents()),n.sunShadow[_]=tt,n.sunShadowMap[_]=et;let Tt=Q.getViewportCount();for(let rt=0;rt<Tt;rt++)n.sunShadowMatrix[v+rt]=Q.getMatrix(rt),n.sunShadowCascade[v+rt]=Q._cascadeData[rt];v+=Tt,_++}n.sun[f]=W,f++}else if(P.isDirectionalLight){let W=t.get(P);if(W.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let Q=P.shadow,tt=e.get(P);tt.shadowIntensity=Q.intensity,tt.shadowBias=Q.bias,tt.shadowNormalBias=Q.normalBias,tt.shadowRadius=Q.radius,tt.shadowMapSize=Q.mapSize,n.directionalShadow[p]=tt,n.directionalShadowMap[p]=et,n.directionalShadowMatrix[p]=P.shadow.matrix,w++}n.directional[p]=W,p++}else if(P.isSpotLight){let W=t.get(P);W.position.setFromMatrixPosition(P.matrixWorld),W.color.copy(G).multiplyScalar(X),W.distance=k,W.coneCos=Math.cos(P.angle),W.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),W.decay=P.decay,n.spot[y]=W;let Q=P.shadow;if(P.map&&(n.spotLightMap[S]=P.map,S++,Q.updateMatrices(P),P.castShadow&&C++),n.spotLightMatrix[y]=Q.matrix,P.castShadow){let tt=e.get(P);tt.shadowIntensity=Q.intensity,tt.shadowBias=Q.bias,tt.shadowNormalBias=Q.normalBias,tt.shadowRadius=Q.radius,tt.shadowMapSize=Q.mapSize,n.spotShadow[y]=tt,n.spotShadowMap[y]=et,g++}y++}else if(P.isRectAreaLight){let W=t.get(P);W.color.copy(G).multiplyScalar(X),W.halfWidth.set(P.width*.5,0,0),W.halfHeight.set(0,P.height*.5,0),n.rectArea[b]=W,b++}else if(P.isPointLight){let W=t.get(P);if(W.color.copy(P.color).multiplyScalar(P.intensity),W.distance=P.distance,W.decay=P.decay,P.castShadow){let Q=P.shadow,tt=e.get(P);tt.shadowIntensity=Q.intensity,tt.shadowBias=Q.bias,tt.shadowNormalBias=Q.normalBias,tt.shadowRadius=Q.radius,tt.shadowMapSize=Q.mapSize,tt.shadowCameraNear=Q.camera.near,tt.shadowCameraFar=Q.camera.far,n.pointShadow[m]=tt,n.pointShadowMap[m]=et,n.pointShadowMatrix[m]=P.shadow.matrix,T++}n.point[m]=W,m++}else if(P.isHemisphereLight){let W=t.get(P);W.skyColor.copy(P.color).multiplyScalar(X),W.groundColor.copy(P.groundColor).multiplyScalar(X),n.hemi[x]=W,x++}}b>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Mt.LTC_FLOAT_1,n.rectAreaLTC2=Mt.LTC_FLOAT_2):(n.rectAreaLTC1=Mt.LTC_HALF_1,n.rectAreaLTC2=Mt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;let L=n.hash;(L.sunLength!==f||L.directionalLength!==p||L.pointLength!==m||L.spotLength!==y||L.rectAreaLength!==b||L.hemiLength!==x||L.numSunShadows!==_||L.numDirectionalShadows!==w||L.numPointShadows!==T||L.numSpotShadows!==g||L.numSpotMaps!==S||L.numLightProbes!==R)&&(n.sun.length=f,n.directional.length=p,n.spot.length=y,n.rectArea.length=b,n.point.length=m,n.hemi.length=x,n.sunShadow.length=_,n.sunShadowMap.length=_,n.sunShadowMatrix.length=v,n.sunShadowCascade.length=v,n.directionalShadow.length=w,n.directionalShadowMap.length=w,n.directionalShadowMatrix.length=w,n.pointShadow.length=T,n.pointShadowMap.length=T,n.pointShadowMatrix.length=T,n.spotShadow.length=g,n.spotShadowMap.length=g,n.spotLightMatrix.length=g+S-C,n.spotLightMap.length=S,n.numSpotLightShadowsWithMaps=C,n.numLightProbes=R,L.sunLength=f,L.directionalLength=p,L.pointLength=m,L.spotLength=y,L.rectAreaLength=b,L.hemiLength=x,L.numSunShadows=_,L.numDirectionalShadows=w,L.numPointShadows=T,L.numSpotShadows=g,L.numSpotMaps=S,L.numLightProbes=R,n.version=Td++)}function l(c,h){let u=0,d=0,f=0,_=0,v=0,p=0,m=h.matrixWorldInverse;for(let y=0,b=c.length;y<b;y++){let x=c[y];if(x.isSunLight){let w=n.sun[u];w.direction.setFromMatrixPosition(x.matrixWorld),w.direction.transformDirection(m),u++}else if(x.isDirectionalLight){let w=n.directional[d];w.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),w.direction.sub(s),w.direction.transformDirection(m),d++}else if(x.isSpotLight){let w=n.spot[_];w.position.setFromMatrixPosition(x.matrixWorld),w.position.applyMatrix4(m),w.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),w.direction.sub(s),w.direction.transformDirection(m),_++}else if(x.isRectAreaLight){let w=n.rectArea[v];w.position.setFromMatrixPosition(x.matrixWorld),w.position.applyMatrix4(m),a.identity(),r.copy(x.matrixWorld),r.premultiply(m),a.extractRotation(r),w.halfWidth.set(x.width*.5,0,0),w.halfHeight.set(0,x.height*.5,0),w.halfWidth.applyMatrix4(a),w.halfHeight.applyMatrix4(a),v++}else if(x.isPointLight){let w=n.point[f];w.position.setFromMatrixPosition(x.matrixWorld),w.position.applyMatrix4(m),f++}else if(x.isHemisphereLight){let w=n.hemi[p];w.direction.setFromMatrixPosition(x.matrixWorld),w.direction.transformDirection(m),p++}}}return{setup:o,setupView:l,state:n}}function p3(i){let t=new Ad(i),e=[],n=[],s=[];function r(u){h.camera=u,e.length=0,n.length=0,s.length=0}function a(u){u.isLightProbeGrid?s.push(u):e.push(u)}function o(u){n.push(u)}function l(){t.setup(e),s.sort((u,d)=>u.priority-d.priority||u.id-d.id)}function c(u){t.setupView(e,u)}let h={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:h,setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function Rd(i){let t=new WeakMap;function e(s,r=0){let a=t.get(s),o;return a===void 0?(o=new p3(i),t.set(s,[o])):r>=a.length?(o=new p3(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}var Cd=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Id=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Pd=[new U(1,0,0),new U(-1,0,0),new U(0,1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1)],Ld=[new U(0,-1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1),new U(0,-1,0),new U(0,-1,0)],m3=new oe,us=new U,Yo=new U;function Dd(i,t,e){let n=new tn,s=new nt,r=new nt,a=new xe,o=new dr,l=new fr,c={},h=e.maxTextureSize,u={[rn]:Ye,[Ye]:rn,[E0]:E0},d=new b0({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new nt},radius:{value:4}},vertexShader:Cd,fragmentShader:Id}),f=d.clone();f.defines.HORIZONTAL_PASS=1;let _=new Te;_.setAttribute("position",new Ne(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let v=new Je(_,d),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ns;let m=this.type;this.render=function(T,g,S){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||T.length===0)return;this.type===Ar&&(Ot("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=ns);let C=i.getRenderTarget(),R=i.getActiveCubeFace(),L=i.getActiveMipmapLevel(),F=i.state;F.setBlending(xn),F.buffers.depth.getReversed()===!0?F.buffers.color.setClear(0,0,0,0):F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);let H=m!==this.type;H&&g.traverse(function(P){P.material&&(Array.isArray(P.material)?P.material.forEach(G=>G.needsUpdate=!0):P.material.needsUpdate=!0)});for(let P=0,G=T.length;P<G;P++){let X=T[P],k=X.shadow;if(k===void 0){Ot("WebGLShadowMap:",X,"has no shadow.");continue}if(k.autoUpdate===!1&&k.needsUpdate===!1)continue;s.copy(k.mapSize);let et=k.getFrameExtents();s.multiply(et),r.copy(k.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/et.x),s.x=r.x*et.x,k.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/et.y),s.y=r.y*et.y,k.mapSize.y=r.y));let W=i.state.buffers.depth.getReversed();if(k.camera._reversedDepth=W,k.map===null||H===!0){if(k.map!==null&&(k.map.depthTexture!==null&&(k.map.depthTexture.dispose(),k.map.depthTexture=null),k.map.dispose()),this.type===ti){if(X.isPointLight){Ot("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}k.map=new e0(s.x,s.y,{format:an,type:p0,minFilter:qe,magFilter:qe,generateMipmaps:!1}),k.map.texture.name=X.name+".shadowMap",k.map.depthTexture=new O0(s.x,s.y,o0),k.map.depthTexture.name=X.name+".shadowMapDepth",k.map.depthTexture.format=U0,k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=Pe,k.map.depthTexture.magFilter=Pe}else X.isPointLight?(k.map=new fs(s.x),k.map.depthTexture=new Di(s.x,f0)):(k.map=new e0(s.x,s.y),k.map.depthTexture=new O0(s.x,s.y,f0)),k.map.depthTexture.name=X.name+".shadowMap",k.map.depthTexture.format=U0,this.type===ns?(k.map.depthTexture.compareFunction=W?Po:Io,k.map.depthTexture.minFilter=qe,k.map.depthTexture.magFilter=qe):(k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=Pe,k.map.depthTexture.magFilter=Pe);k.camera.updateProjectionMatrix()}k.map.isWebGLCubeRenderTarget!==!0&&(k.map.width!==s.x||k.map.height!==s.y)&&k.map.setSize(s.x,s.y);let Q=k.map.isWebGLCubeRenderTarget?6:k.getViewportCount();X.isPointLight!==!0&&k.updateMatrices(X,S);let tt=(k.camera.layers.mask&4294967294)!==0?k.camera.layers:S.layers;for(let Tt=0;Tt<Q;Tt++){let rt=k.getCamera(Tt);if(X.isPointLight){let Y=k.camera,ot=k.matrix,Et=X.distance||Y.far;Et!==Y.far&&(Y.far=Et,Y.updateProjectionMatrix()),us.setFromMatrixPosition(X.matrixWorld),Y.position.copy(us),Yo.copy(Y.position),Yo.add(Pd[Tt]),Y.up.copy(Ld[Tt]),Y.lookAt(Yo),Y.updateMatrixWorld(),ot.makeTranslation(-us.x,-us.y,-us.z),m3.multiplyMatrices(Y.projectionMatrix,Y.matrixWorldInverse),k._frustum.setFromProjectionMatrix(m3,Y.coordinateSystem,Y.reversedDepth)}if(k.map.isWebGLCubeRenderTarget)i.setRenderTarget(k.map,Tt),i.clear();else{Tt===0&&(i.setRenderTarget(k.map),i.clear());let Y=k.getViewport(Tt);a.set(r.x*Y.x,r.y*Y.y,r.x*Y.z,r.y*Y.w),F.viewport(a)}n=k.getFrustum(Tt),x(g,S,rt,X,tt,this.type)}k.isPointLightShadow!==!0&&this.type===ti&&y(k,S),k.needsUpdate=!1}m=this.type,p.needsUpdate=!1,i.setRenderTarget(C,R,L)};function y(T,g){let S=t.update(v);d.defines.VSM_SAMPLES!==T.blurSamples&&(d.defines.VSM_SAMPLES=T.blurSamples,f.defines.VSM_SAMPLES=T.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),T.mapPass===null?T.mapPass=new e0(s.x,s.y,{format:an,type:p0}):(T.mapPass.width!==T.map.width||T.mapPass.height!==T.map.height)&&T.mapPass.setSize(T.map.width,T.map.height),d.uniforms.shadow_pass.value=T.map.depthTexture,d.uniforms.resolution.value.set(T.map.width,T.map.height),d.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(g,null,S,d,v,null),f.uniforms.shadow_pass.value=T.mapPass.texture,f.uniforms.resolution.value.set(T.map.width,T.map.height),f.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(g,null,S,f,v,null)}function b(T,g,S,C){let R=null,L=S.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(L!==void 0)R=L;else if(R=S.isPointLight===!0?l:o,i.localClippingEnabled&&g.clipShadows===!0&&Array.isArray(g.clippingPlanes)&&g.clippingPlanes.length!==0||g.displacementMap&&g.displacementScale!==0||g.alphaMap&&g.alphaTest>0||g.map&&g.alphaTest>0||g.alphaToCoverage===!0){let F=R.uuid,H=g.uuid,P=c[F];P===void 0&&(P={},c[F]=P);let G=P[H];G===void 0&&(G=R.clone(),P[H]=G,g.addEventListener("dispose",w)),R=G}if(R.visible=g.visible,R.wireframe=g.wireframe,C===ti?R.side=g.shadowSide!==null?g.shadowSide:g.side:R.side=g.shadowSide!==null?g.shadowSide:u[g.side],R.alphaMap=g.alphaMap,R.alphaTest=g.alphaToCoverage===!0?.5:g.alphaTest,R.map=g.map,R.clipShadows=g.clipShadows,R.clippingPlanes=g.clippingPlanes,R.clipIntersection=g.clipIntersection,R.displacementMap=g.displacementMap,R.displacementScale=g.displacementScale,R.displacementBias=g.displacementBias,R.wireframeLinewidth=g.wireframeLinewidth,R.linewidth=g.linewidth,S.isPointLight===!0&&R.isMeshDistanceMaterial===!0){let F=i.properties.get(R);F.light=S}return R}function x(T,g,S,C,R,L){if(T.visible===!1)return;if(T.layers.test(R)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&L===ti)&&(!T.frustumCulled||T.intersectsFrustum(n))){T.modelViewMatrix.multiplyMatrices(S.matrixWorldInverse,T.matrixWorld);let P=t.update(T),G=T.material;if(Array.isArray(G)){let X=P.groups;for(let k=0,et=X.length;k<et;k++){let W=X[k],Q=G[W.materialIndex];if(Q&&Q.visible){let tt=b(T,Q,C,L);T.onBeforeShadow(i,T,g,S,P,tt,W),i.renderBufferDirect(S,null,P,tt,T,W),T.onAfterShadow(i,T,g,S,P,tt,W)}}}else if(G.visible){let X=b(T,G,C,L);T.onBeforeShadow(i,T,g,S,P,X,null),i.renderBufferDirect(S,null,P,X,T,null),T.onAfterShadow(i,T,g,S,P,X,null)}}let H=T.children;for(let P=0,G=H.length;P<G;P++)x(H[P],g,S,C,R,L)}function w(T){T.target.removeEventListener("dispose",w);for(let S in c){let C=c[S],R=T.target.uuid;R in C&&(C[R].dispose(),delete C[R])}}}function Nd(i,t){function e(){let I=!1,$=new xe,q=null,ft=new xe(0,0,0,0);return{setMask:function(at){q!==at&&!I&&(i.colorMask(at,at,at,at),q=at)},setLocked:function(at){I=at},setClear:function(at,ut,Dt,Zt,st){st===!0&&(at*=Zt,ut*=Zt,Dt*=Zt),$.set(at,ut,Dt,Zt),ft.equals($)===!1&&(i.clearColor(at,ut,Dt,Zt),ft.copy($))},reset:function(){I=!1,q=null,ft.set(-1,0,0,0)}}}function n(){let I=!1,$=!1,q=null,ft=null,at=null;return{setReversed:function(ut){if($!==ut){let Dt=t.get("EXT_clip_control");ut?Dt.clipControlEXT(Dt.LOWER_LEFT_EXT,Dt.ZERO_TO_ONE_EXT):Dt.clipControlEXT(Dt.LOWER_LEFT_EXT,Dt.NEGATIVE_ONE_TO_ONE_EXT),$=ut;let Zt=at;at=null,this.setClear(Zt)}},getReversed:function(){return $},setTest:function(ut){ut?yt(i.DEPTH_TEST):Pt(i.DEPTH_TEST)},setMask:function(ut){q!==ut&&!I&&(i.depthMask(ut),q=ut)},setFunc:function(ut){if($&&(ut=z2[ut]),ft!==ut){switch(ut){case Xs:i.depthFunc(i.NEVER);break;case qs:i.depthFunc(i.ALWAYS);break;case Ys:i.depthFunc(i.LESS);break;case zn:i.depthFunc(i.LEQUAL);break;case Zs:i.depthFunc(i.EQUAL);break;case Js:i.depthFunc(i.GEQUAL);break;case $s:i.depthFunc(i.GREATER);break;case Ks:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}ft=ut}},setLocked:function(ut){I=ut},setClear:function(ut){at!==ut&&(at=ut,$&&(ut=1-ut),i.clearDepth(ut))},reset:function(){I=!1,q=null,ft=null,at=null,$=!1}}}function s(){let I=!1,$=null,q=null,ft=null,at=null,ut=null,Dt=null,Zt=null,st=null;return{setTest:function(Nt){I||(Nt?yt(i.STENCIL_TEST):Pt(i.STENCIL_TEST))},setMask:function(Nt){$!==Nt&&!I&&(i.stencilMask(Nt),$=Nt)},setFunc:function(Nt,qt,vt){(q!==Nt||ft!==qt||at!==vt)&&(i.stencilFunc(Nt,qt,vt),q=Nt,ft=qt,at=vt)},setOp:function(Nt,qt,vt){(ut!==Nt||Dt!==qt||Zt!==vt)&&(i.stencilOp(Nt,qt,vt),ut=Nt,Dt=qt,Zt=vt)},setLocked:function(Nt){I=Nt},setClear:function(Nt){st!==Nt&&(i.clearStencil(Nt),st=Nt)},reset:function(){I=!1,$=null,q=null,ft=null,at=null,ut=null,Dt=null,Zt=null,st=null}}}let r=new e,a=new n,o=new s,l={},c=new WeakMap,h={},u={},d={},f=new WeakMap,_=[],v=null,p=!1,m=null,y=null,b=null,x=null,w=null,T=null,g=null,S=new Qt(0,0,0),C=0,R=!1,L=null,F=null,H=null,P=null,G=null,X=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),k=!1,et=0,W=i.getParameter(i.VERSION);W.indexOf("WebGL")!==-1?(et=parseFloat(/^WebGL (\d)/.exec(W)[1]),k=et>=1):W.indexOf("OpenGL ES")!==-1&&(et=parseFloat(/^OpenGL ES (\d)/.exec(W)[1]),k=et>=2);let Q=null,tt={},Tt=i.getParameter(i.SCISSOR_BOX),rt=i.getParameter(i.VIEWPORT),Y=new xe().fromArray(Tt),ot=new xe().fromArray(rt);function Et(I,$,q,ft){let at=new Uint8Array(4),ut=i.createTexture();i.bindTexture(I,ut),i.texParameteri(I,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(I,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Dt=0;Dt<q;Dt++)I===i.TEXTURE_3D||I===i.TEXTURE_2D_ARRAY?i.texImage3D($,0,i.RGBA,1,1,ft,0,i.RGBA,i.UNSIGNED_BYTE,at):i.texImage2D($+Dt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,at);return ut}let Lt={};Lt[i.TEXTURE_2D]=Et(i.TEXTURE_2D,i.TEXTURE_2D,1),Lt[i.TEXTURE_CUBE_MAP]=Et(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Lt[i.TEXTURE_2D_ARRAY]=Et(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Lt[i.TEXTURE_3D]=Et(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),yt(i.DEPTH_TEST),a.setFunc(zn),bt(!1),mt(co),yt(i.CULL_FACE),ct(xn);function yt(I){h[I]!==!0&&(i.enable(I),h[I]=!0)}function Pt(I){h[I]!==!1&&(i.disable(I),h[I]=!1)}function se(I,$){return d[I]!==$?(i.bindFramebuffer(I,$),d[I]=$,I===i.DRAW_FRAMEBUFFER&&(d[i.FRAMEBUFFER]=$),I===i.FRAMEBUFFER&&(d[i.DRAW_FRAMEBUFFER]=$),!0):!1}function Ut(I,$){let q=_,ft=!1;if(I){q=f.get($),q===void 0&&(q=[],f.set($,q));let at=I.textures;if(q.length!==at.length||q[0]!==i.COLOR_ATTACHMENT0){for(let ut=0,Dt=at.length;ut<Dt;ut++)q[ut]=i.COLOR_ATTACHMENT0+ut;q.length=at.length,ft=!0}}else q[0]!==i.BACK&&(q[0]=i.BACK,ft=!0);ft&&i.drawBuffers(q)}function Wt(I){return v!==I?(i.useProgram(I),v=I,!0):!1}let Yt={[yn]:i.FUNC_ADD,[o2]:i.FUNC_SUBTRACT,[l2]:i.FUNC_REVERSE_SUBTRACT};Yt[c2]=i.MIN,Yt[h2]=i.MAX;let j={[u2]:i.ZERO,[d2]:i.ONE,[f2]:i.SRC_COLOR,[po]:i.SRC_ALPHA,[y2]:i.SRC_ALPHA_SATURATE,[_2]:i.DST_COLOR,[m2]:i.DST_ALPHA,[p2]:i.ONE_MINUS_SRC_COLOR,[mo]:i.ONE_MINUS_SRC_ALPHA,[x2]:i.ONE_MINUS_DST_COLOR,[g2]:i.ONE_MINUS_DST_ALPHA,[v2]:i.CONSTANT_COLOR,[M2]:i.ONE_MINUS_CONSTANT_COLOR,[S2]:i.CONSTANT_ALPHA,[b2]:i.ONE_MINUS_CONSTANT_ALPHA};function ct(I,$,q,ft,at,ut,Dt,Zt,st,Nt){if(I===xn){p===!0&&(Pt(i.BLEND),p=!1);return}if(p===!1&&(yt(i.BLEND),p=!0),I!==a2){if(I!==m||Nt!==R){if((y!==yn||w!==yn)&&(i.blendEquation(i.FUNC_ADD),y=yn,w=yn),Nt)switch(I){case ei:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ho:i.blendFunc(i.ONE,i.ONE);break;case uo:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case fo:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:zt("WebGLState: Invalid blending: ",I);break}else switch(I){case ei:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ho:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case uo:zt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case fo:zt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:zt("WebGLState: Invalid blending: ",I);break}b=null,x=null,T=null,g=null,S.set(0,0,0),C=0,m=I,R=Nt}return}at=at||$,ut=ut||q,Dt=Dt||ft,($!==y||at!==w)&&(i.blendEquationSeparate(Yt[$],Yt[at]),y=$,w=at),(q!==b||ft!==x||ut!==T||Dt!==g)&&(i.blendFuncSeparate(j[q],j[ft],j[ut],j[Dt]),b=q,x=ft,T=ut,g=Dt),(Zt.equals(S)===!1||st!==C)&&(i.blendColor(Zt.r,Zt.g,Zt.b,st),S.copy(Zt),C=st),m=I,R=!1}function lt(I,$){I.side===E0?Pt(i.CULL_FACE):yt(i.CULL_FACE);let q=I.side===Ye;$&&(q=!q),bt(q),I.blending===ei&&I.transparent===!1?ct(xn):ct(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),a.setFunc(I.depthFunc),a.setTest(I.depthTest),a.setMask(I.depthWrite),r.setMask(I.colorWrite);let ft=I.stencilWrite;o.setTest(ft),ft&&(o.setMask(I.stencilWriteMask),o.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),o.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),wt(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?yt(i.SAMPLE_ALPHA_TO_COVERAGE):Pt(i.SAMPLE_ALPHA_TO_COVERAGE)}function bt(I){L!==I&&(I?i.frontFace(i.CW):i.frontFace(i.CCW),L=I)}function mt(I){I!==s2?(yt(i.CULL_FACE),I!==F&&(I===co?i.cullFace(i.BACK):I===r2?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Pt(i.CULL_FACE),F=I}function Gt(I){I!==H&&(k&&i.lineWidth(I),H=I)}function wt(I,$,q){I?(yt(i.POLYGON_OFFSET_FILL),(P!==$||G!==q)&&(P=$,G=q,a.getReversed()&&($=-$,q=-q),i.polygonOffset($,q))):Pt(i.POLYGON_OFFSET_FILL)}function Xt(I){I?yt(i.SCISSOR_TEST):Pt(i.SCISSOR_TEST)}function $t(I){I===void 0&&(I=i.TEXTURE0+X-1),Q!==I&&(i.activeTexture(I),Q=I)}function ne(I,$,q){q===void 0&&(Q===null?q=i.TEXTURE0+X-1:q=Q);let ft=tt[q];ft===void 0&&(ft={type:void 0,texture:void 0},tt[q]=ft),(ft.type!==I||ft.texture!==$)&&(Q!==q&&(i.activeTexture(q),Q=q),i.bindTexture(I,$||Lt[I]),ft.type=I,ft.texture=$)}function D(){let I=tt[Q];I!==void 0&&I.type!==void 0&&(i.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function ce(){try{i.compressedTexImage2D(...arguments)}catch(I){zt("WebGLState:",I)}}function Bt(){try{i.compressedTexImage3D(...arguments)}catch(I){zt("WebGLState:",I)}}function he(){try{i.texSubImage2D(...arguments)}catch(I){zt("WebGLState:",I)}}function gt(){try{i.texSubImage3D(...arguments)}catch(I){zt("WebGLState:",I)}}function Me(){try{i.compressedTexSubImage2D(...arguments)}catch(I){zt("WebGLState:",I)}}function Ft(){try{i.compressedTexSubImage3D(...arguments)}catch(I){zt("WebGLState:",I)}}function kt(){try{i.texStorage2D(...arguments)}catch(I){zt("WebGLState:",I)}}function A(){try{i.texStorage3D(...arguments)}catch(I){zt("WebGLState:",I)}}function M(){try{i.texImage2D(...arguments)}catch(I){zt("WebGLState:",I)}}function B(){try{i.texImage3D(...arguments)}catch(I){zt("WebGLState:",I)}}function it(I){return u[I]!==void 0?u[I]:i.getParameter(I)}function K(I,$){u[I]!==$&&(i.pixelStorei(I,$),u[I]=$)}function ht(I){Y.equals(I)===!1&&(i.scissor(I.x,I.y,I.z,I.w),Y.copy(I))}function _t(I){ot.equals(I)===!1&&(i.viewport(I.x,I.y,I.z,I.w),ot.copy(I))}function Z(I,$){let q=c.get($);q===void 0&&(q=new WeakMap,c.set($,q));let ft=q.get(I);ft===void 0&&(ft=i.getUniformBlockIndex($,I.name),i.uniformBlockBinding($,ft,ft),q.set(I,ft))}function J(I,$,q){let at=c.get($).get(I);l[at]!==q&&(i.bindBufferBase(i.UNIFORM_BUFFER,at,q),l[at]=q)}function dt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},u={},Q=null,tt={},d={},l={},f=new WeakMap,_=[],v=null,p=!1,m=null,y=null,b=null,x=null,w=null,T=null,g=null,S=new Qt(0,0,0),C=0,R=!1,L=null,F=null,H=null,P=null,G=null,Y.set(0,0,i.canvas.width,i.canvas.height),ot.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:yt,disable:Pt,bindFramebuffer:se,drawBuffers:Ut,useProgram:Wt,setBlending:ct,setMaterial:lt,setFlipSided:bt,setCullFace:mt,setLineWidth:Gt,setPolygonOffset:wt,setScissorTest:Xt,activeTexture:$t,bindTexture:ne,unbindTexture:D,compressedTexImage2D:ce,compressedTexImage3D:Bt,texImage2D:M,texImage3D:B,pixelStorei:K,getParameter:it,updateUBOMapping:Z,uniformBlockBinding:J,texStorage2D:kt,texStorage3D:A,texSubImage2D:he,texSubImage3D:gt,compressedTexSubImage2D:Me,compressedTexSubImage3D:Ft,scissor:ht,viewport:_t,reset:dt}}function Ud(i,t,e,n,s,r,a){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new nt,h=new WeakMap,u=new Set,d,f=new WeakMap,_=new Set,v=new FinalizationRegistry(A=>_.delete(A)),p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(A,M){return p?new OffscreenCanvas(A,M):Ei("canvas")}function y(A,M,B){let it=1,K=kt(A);if((K.width>B||K.height>B)&&(it=B/Math.max(K.width,K.height)),it<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){let ht=Math.floor(it*K.width),_t=Math.floor(it*K.height);d===void 0&&(d=m(ht,_t));let Z=M?m(ht,_t):d;return Z.width=ht,Z.height=_t,Z.getContext("2d").drawImage(A,0,0,ht,_t),Ot("WebGLRenderer: Texture has been resized from ("+K.width+"x"+K.height+") to ("+ht+"x"+_t+")."),Z}else return"data"in A&&Ot("WebGLRenderer: Image in DataTexture is too big ("+K.width+"x"+K.height+")."),A;return A}function b(A){return A.generateMipmaps}function x(A){i.generateMipmap(A)}function w(A){return A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?i.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function T(A,M,B,it,K,ht=!1){if(A!==null){if(i[A]!==void 0)return i[A];Ot("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let _t;it&&(_t=t.get("EXT_texture_norm16"),_t||Ot("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Z=M;if(M===i.RED&&(B===i.FLOAT&&(Z=i.R32F),B===i.HALF_FLOAT&&(Z=i.R16F),B===i.UNSIGNED_BYTE&&(Z=i.R8),B===i.UNSIGNED_SHORT&&_t&&(Z=_t.R16_EXT),B===i.SHORT&&_t&&(Z=_t.R16_SNORM_EXT)),M===i.RED_INTEGER&&(B===i.UNSIGNED_BYTE&&(Z=i.R8UI),B===i.UNSIGNED_SHORT&&(Z=i.R16UI),B===i.UNSIGNED_INT&&(Z=i.R32UI),B===i.BYTE&&(Z=i.R8I),B===i.SHORT&&(Z=i.R16I),B===i.INT&&(Z=i.R32I)),M===i.RG&&(B===i.FLOAT&&(Z=i.RG32F),B===i.HALF_FLOAT&&(Z=i.RG16F),B===i.UNSIGNED_BYTE&&(Z=i.RG8),B===i.UNSIGNED_SHORT&&_t&&(Z=_t.RG16_EXT),B===i.SHORT&&_t&&(Z=_t.RG16_SNORM_EXT)),M===i.RG_INTEGER&&(B===i.UNSIGNED_BYTE&&(Z=i.RG8UI),B===i.UNSIGNED_SHORT&&(Z=i.RG16UI),B===i.UNSIGNED_INT&&(Z=i.RG32UI),B===i.BYTE&&(Z=i.RG8I),B===i.SHORT&&(Z=i.RG16I),B===i.INT&&(Z=i.RG32I)),M===i.RGB_INTEGER&&(B===i.UNSIGNED_BYTE&&(Z=i.RGB8UI),B===i.UNSIGNED_SHORT&&(Z=i.RGB16UI),B===i.UNSIGNED_INT&&(Z=i.RGB32UI),B===i.BYTE&&(Z=i.RGB8I),B===i.SHORT&&(Z=i.RGB16I),B===i.INT&&(Z=i.RGB32I)),M===i.RGBA_INTEGER&&(B===i.UNSIGNED_BYTE&&(Z=i.RGBA8UI),B===i.UNSIGNED_SHORT&&(Z=i.RGBA16UI),B===i.UNSIGNED_INT&&(Z=i.RGBA32UI),B===i.BYTE&&(Z=i.RGBA8I),B===i.SHORT&&(Z=i.RGBA16I),B===i.INT&&(Z=i.RGBA32I)),M===i.RGB&&(B===i.UNSIGNED_SHORT&&_t&&(Z=_t.RGB16_EXT),B===i.SHORT&&_t&&(Z=_t.RGB16_SNORM_EXT),B===i.UNSIGNED_INT_5_9_9_9_REV&&(Z=i.RGB9_E5),B===i.UNSIGNED_INT_10F_11F_11F_REV&&(Z=i.R11F_G11F_B10F)),M===i.RGBA){let J=ht?bi:ee.getTransfer(K);B===i.FLOAT&&(Z=i.RGBA32F),B===i.HALF_FLOAT&&(Z=i.RGBA16F),B===i.UNSIGNED_BYTE&&(Z=J===ue?i.SRGB8_ALPHA8:i.RGBA8),B===i.UNSIGNED_SHORT&&_t&&(Z=_t.RGBA16_EXT),B===i.SHORT&&_t&&(Z=_t.RGBA16_SNORM_EXT),B===i.UNSIGNED_SHORT_4_4_4_4&&(Z=i.RGBA4),B===i.UNSIGNED_SHORT_5_5_5_1&&(Z=i.RGB5_A1)}return(Z===i.R16F||Z===i.R32F||Z===i.RG16F||Z===i.RG32F||Z===i.RGBA16F||Z===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Z}function g(A,M){let B;return A?M===null||M===f0||M===Mn?B=i.DEPTH24_STENCIL8:M===o0?B=i.DEPTH32F_STENCIL8:M===ii&&(B=i.DEPTH24_STENCIL8,Ot("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):M===null||M===f0||M===Mn?B=i.DEPTH_COMPONENT24:M===o0?B=i.DEPTH_COMPONENT32F:M===ii&&(B=i.DEPTH_COMPONENT16),B}function S(A,M){return b(A)===!0||A.isFramebufferTexture&&A.minFilter!==Pe&&A.minFilter!==qe?Math.log2(Math.max(M.width,M.height))+1:A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?M.mipmaps.length:1}function C(A){let M=new WeakRef(A);n.get(A).__ref=M,_.add(M),v.register(A,M,M)}function R(A){let M=n.get(A).__ref;M!==void 0&&(_.delete(M),v.unregister(M))}function L(A){H(A.target)}function F(A){P(A.target)}function H(A){A.removeEventListener("dispose",L),R(A),X(A),A.isVideoTexture&&h.delete(A),A.isHTMLTexture&&u.delete(A)}function P(A){A.removeEventListener("dispose",F),R(A),et(A)}function G(){for(let A of _){let M=A.deref();M!==void 0&&(M.isRenderTarget===!0?P(M):H(M))}_.clear(),u.clear()}function X(A){let M=n.get(A);if(M.__webglInit===void 0)return;let B=A.source,it=f.get(B);if(it){let K=it[M.__cacheKey];K.usedTimes--,K.usedTimes===0&&k(A),Object.keys(it).length===0&&f.delete(B)}n.remove(A)}function k(A){let M=n.get(A);i.deleteTexture(M.__webglTexture);let B=A.source,it=f.get(B);delete it[M.__cacheKey],a.memory.textures--}function et(A){let M=n.get(A);M.__depthDisposeCallback&&M.__depthDisposeCallback();let B=A.depthTexture;if(B&&B.renderTarget===A&&H(B),A.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(M.__webglFramebuffer[K]))for(let ht=0;ht<M.__webglFramebuffer[K].length;ht++)i.deleteFramebuffer(M.__webglFramebuffer[K][ht]);else i.deleteFramebuffer(M.__webglFramebuffer[K]);M.__webglDepthbuffer&&i.deleteRenderbuffer(M.__webglDepthbuffer[K])}else{if(Array.isArray(M.__webglFramebuffer))for(let K=0;K<M.__webglFramebuffer.length;K++)i.deleteFramebuffer(M.__webglFramebuffer[K]);else i.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer&&i.deleteRenderbuffer(M.__webglDepthbuffer),M.__webglMultisampledFramebuffer&&i.deleteFramebuffer(M.__webglMultisampledFramebuffer),M.__webglColorRenderbuffer)for(let K=0;K<M.__webglColorRenderbuffer.length;K++)M.__webglColorRenderbuffer[K]&&i.deleteRenderbuffer(M.__webglColorRenderbuffer[K]);M.__webglDepthRenderbuffer&&i.deleteRenderbuffer(M.__webglDepthRenderbuffer)}let it=A.textures;for(let K=0,ht=it.length;K<ht;K++){let _t=n.get(it[K]);_t.__webglTexture&&(i.deleteTexture(_t.__webglTexture),a.memory.textures--),n.remove(it[K])}n.remove(A)}let W=0;function Q(){W=0}function tt(){return W}function Tt(A){W=A}function rt(){let A=W;return A>=s.maxTextures&&Ot("WebGLTextures: Trying to use "+(A+1)+" texture units while this GPU supports only "+s.maxTextures),W+=1,A}function Y(A){let M=[];return M.push(A.wrapS),M.push(A.wrapT),M.push(A.wrapR||0),M.push(A.magFilter),M.push(A.minFilter),M.push(A.anisotropy),M.push(A.internalFormat),M.push(A.format),M.push(A.type),M.push(A.generateMipmaps),M.push(A.mipmapsAutoUpdate),M.push(A.premultiplyAlpha),M.push(A.flipY),M.push(A.unpackAlignment),M.push(A.colorSpace),M.join()}function ot(A,M){let B=n.get(A);if(A.isVideoTexture&&Me(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&B.__version!==A.version){let it=A.image;if(it===null)Ot("WebGLRenderer: Texture marked for update but no image data found.");else if(it.complete===!1)Ot("WebGLRenderer: Texture marked for update but image is incomplete");else{lt(B,A,M);return}}else A.isExternalTexture&&(B.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,B.__webglTexture,i.TEXTURE0+M)}function Et(A,M){let B=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&B.__version!==A.version){lt(B,A,M);return}else A.isExternalTexture&&(B.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,B.__webglTexture,i.TEXTURE0+M)}function Lt(A,M){let B=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&B.__version!==A.version){lt(B,A,M);return}e.bindTexture(i.TEXTURE_3D,B.__webglTexture,i.TEXTURE0+M)}function yt(A,M){let B=n.get(A);if(A.version>0&&B.__version!==A.version){bt(B,A,M);return}e.bindTexture(i.TEXTURE_CUBE_MAP,B.__webglTexture,i.TEXTURE0+M)}let Pt={[Gn]:i.REPEAT,[_0]:i.CLAMP_TO_EDGE,[Qs]:i.MIRRORED_REPEAT},se={[Pe]:i.NEAREST,[w2]:i.NEAREST_MIPMAP_NEAREST,[ss]:i.NEAREST_MIPMAP_LINEAR,[qe]:i.LINEAR,[Ir]:i.LINEAR_MIPMAP_NEAREST,[B0]:i.LINEAR_MIPMAP_LINEAR},Ut={[I2]:i.NEVER,[Lo]:i.ALWAYS,[P2]:i.LESS,[Io]:i.LEQUAL,[L2]:i.EQUAL,[Po]:i.GEQUAL,[D2]:i.GREATER,[N2]:i.NOTEQUAL};function Wt(A,M){if(M.type===o0&&t.has("OES_texture_float_linear")===!1&&(M.magFilter===qe||M.magFilter===Ir||M.magFilter===ss||M.magFilter===B0||M.minFilter===qe||M.minFilter===Ir||M.minFilter===ss||M.minFilter===B0)&&Ot("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(A,i.TEXTURE_WRAP_S,Pt[M.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,Pt[M.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,Pt[M.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,se[M.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,se[M.minFilter]),M.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,Ut[M.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===Pe||M.minFilter!==ss&&M.minFilter!==B0||M.type===o0&&t.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||n.get(M).__currentAnisotropy){let B=t.get("EXT_texture_filter_anisotropic");i.texParameterf(A,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,s.getMaxAnisotropy())),n.get(M).__currentAnisotropy=M.anisotropy}}}function Yt(A,M){let B=!1;A.__webglInit===void 0&&(A.__webglInit=!0,M.addEventListener("dispose",L),C(M));let it=M.source,K=f.get(it);K===void 0&&(K={},f.set(it,K));let ht=Y(M);if(ht!==A.__cacheKey){K[ht]===void 0&&(K[ht]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,B=!0),K[ht].usedTimes++;let _t=K[A.__cacheKey];_t!==void 0&&(K[A.__cacheKey].usedTimes--,_t.usedTimes===0&&k(M)),A.__cacheKey=ht,A.__webglTexture=K[ht].texture}return B}function j(A,M,B){return Math.floor(Math.floor(A/B)/M)}function ct(A,M,B,it){let ht=A.updateRanges;if(ht.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,M.width,M.height,B,it,M.data);else{ht.sort((I,$)=>I.start-$.start);let _t=0;for(let I=1;I<ht.length;I++){let $=ht[_t],q=ht[I],ft=$.start+$.count,at=j(q.start,M.width,4),ut=j($.start,M.width,4);q.start<=ft+1&&at===ut&&j(q.start+q.count-1,M.width,4)===at?$.count=Math.max($.count,q.start+q.count-$.start):(++_t,ht[_t]=q)}ht.length=_t+1;let Z=e.getParameter(i.UNPACK_ROW_LENGTH),J=e.getParameter(i.UNPACK_SKIP_PIXELS),dt=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,M.width);for(let I=0,$=ht.length;I<$;I++){let q=ht[I],ft=Math.floor(q.start/4),at=Math.ceil(q.count/4),ut=ft%M.width,Dt=Math.floor(ft/M.width),Zt=at,st=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,ut),e.pixelStorei(i.UNPACK_SKIP_ROWS,Dt),e.texSubImage2D(i.TEXTURE_2D,0,ut,Dt,Zt,st,B,it,M.data)}A.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,Z),e.pixelStorei(i.UNPACK_SKIP_PIXELS,J),e.pixelStorei(i.UNPACK_SKIP_ROWS,dt)}}function lt(A,M,B){let it=i.TEXTURE_2D;(M.isDataArrayTexture||M.isCompressedArrayTexture)&&(it=i.TEXTURE_2D_ARRAY),M.isData3DTexture&&(it=i.TEXTURE_3D);let K=Yt(A,M),ht=M.source;e.bindTexture(it,A.__webglTexture,i.TEXTURE0+B);let _t=n.get(ht);if(ht.version!==_t.__version||K===!0){if(e.activeTexture(i.TEXTURE0+B),(typeof ImageBitmap<"u"&&M.image instanceof ImageBitmap)===!1){let st=ee.getPrimaries(ee.workingColorSpace),Nt=M.colorSpace===G0?null:ee.getPrimaries(M.colorSpace),qt=M.colorSpace===G0||st===Nt?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,M.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,qt)}e.pixelStorei(i.UNPACK_ALIGNMENT,M.unpackAlignment);let J=y(M.image,!1,s.maxTextureSize);J=Ft(M,J);let dt=r.convert(M.format,M.colorSpace),I=r.convert(M.type),$=T(M.internalFormat,dt,I,M.normalized,M.colorSpace,M.isVideoTexture);Wt(it,M);let q,ft=M.mipmaps,at=M.isVideoTexture!==!0,ut=_t.__version===void 0||K===!0,Dt=ht.dataReady,Zt=S(M,J);if(M.isDepthTexture)$=g(M.format===z0,M.type),ut&&(at?e.texStorage2D(i.TEXTURE_2D,1,$,J.width,J.height):e.texImage2D(i.TEXTURE_2D,0,$,J.width,J.height,0,dt,I,null));else if(M.isDataTexture)if(ft.length>0){at&&ut&&e.texStorage2D(i.TEXTURE_2D,Zt,$,ft[0].width,ft[0].height);for(let st=0,Nt=ft.length;st<Nt;st++)q=ft[st],at?Dt&&e.texSubImage2D(i.TEXTURE_2D,st,0,0,q.width,q.height,dt,I,q.data):e.texImage2D(i.TEXTURE_2D,st,$,q.width,q.height,0,dt,I,q.data);M.generateMipmaps=!1}else at?(ut&&e.texStorage2D(i.TEXTURE_2D,Zt,$,J.width,J.height),Dt&&ct(M,J,dt,I)):e.texImage2D(i.TEXTURE_2D,0,$,J.width,J.height,0,dt,I,J.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){at&&ut&&e.texStorage3D(i.TEXTURE_2D_ARRAY,Zt,$,ft[0].width,ft[0].height,J.depth);for(let st=0,Nt=ft.length;st<Nt;st++)if(q=ft[st],M.format!==s0)if(dt!==null)if(at){if(Dt)if(M.layerUpdates.size>0){let qt=Go(q.width,q.height,M.format,M.type);for(let vt of M.layerUpdates){let de=q.data.subarray(vt*qt/q.data.BYTES_PER_ELEMENT,(vt+1)*qt/q.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,st,0,0,vt,q.width,q.height,1,dt,de)}}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,st,0,0,0,q.width,q.height,J.depth,dt,q.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,st,$,q.width,q.height,J.depth,0,q.data,0,0);else Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else at?Dt&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,st,0,0,0,q.width,q.height,J.depth,dt,I,q.data):e.texImage3D(i.TEXTURE_2D_ARRAY,st,$,q.width,q.height,J.depth,0,dt,I,q.data);M.layerUpdates.size>0&&M.clearLayerUpdates()}else{at&&ut&&e.texStorage2D(i.TEXTURE_2D,Zt,$,ft[0].width,ft[0].height);for(let st=0,Nt=ft.length;st<Nt;st++)q=ft[st],M.format!==s0?dt!==null?at?Dt&&e.compressedTexSubImage2D(i.TEXTURE_2D,st,0,0,q.width,q.height,dt,q.data):e.compressedTexImage2D(i.TEXTURE_2D,st,$,q.width,q.height,0,q.data):Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):at?Dt&&e.texSubImage2D(i.TEXTURE_2D,st,0,0,q.width,q.height,dt,I,q.data):e.texImage2D(i.TEXTURE_2D,st,$,q.width,q.height,0,dt,I,q.data)}else if(M.isDataArrayTexture)if(at){if(ut&&e.texStorage3D(i.TEXTURE_2D_ARRAY,Zt,$,J.width,J.height,J.depth),Dt)if(M.layerUpdates.size>0){let st=Go(J.width,J.height,M.format,M.type);for(let Nt of M.layerUpdates){let qt=J.data.subarray(Nt*st/J.data.BYTES_PER_ELEMENT,(Nt+1)*st/J.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,Nt,J.width,J.height,1,dt,I,qt)}M.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,dt,I,J.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,$,J.width,J.height,J.depth,0,dt,I,J.data);else if(M.isData3DTexture)at?(ut&&e.texStorage3D(i.TEXTURE_3D,Zt,$,J.width,J.height,J.depth),Dt&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,dt,I,J.data)):e.texImage3D(i.TEXTURE_3D,0,$,J.width,J.height,J.depth,0,dt,I,J.data);else if(M.isFramebufferTexture){if(ut)if(at)e.texStorage2D(i.TEXTURE_2D,Zt,$,J.width,J.height);else{let st=J.width,Nt=J.height;for(let qt=0;qt<Zt;qt++)e.texImage2D(i.TEXTURE_2D,qt,$,st,Nt,0,dt,I,null),st>>=1,Nt>>=1}}else if(M.isHTMLTexture){if("texElementImage2D"in i){let st=i.canvas;if(st.hasAttribute("layoutsubtree")||st.setAttribute("layoutsubtree","true"),J.parentNode!==st){st.appendChild(J),u.add(M),st.onpaint=Nt=>{let qt=Nt.changedElements;for(let vt of u)qt.includes(vt.image)&&(vt.needsUpdate=!0)},st.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,J);else{let qt=i.RGBA,vt=i.RGBA,de=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,qt,vt,de,J)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(ft.length>0){if(at&&ut){let st=kt(ft[0]);e.texStorage2D(i.TEXTURE_2D,Zt,$,st.width,st.height)}for(let st=0,Nt=ft.length;st<Nt;st++)q=ft[st],at?Dt&&e.texSubImage2D(i.TEXTURE_2D,st,0,0,dt,I,q):e.texImage2D(i.TEXTURE_2D,st,$,dt,I,q);M.generateMipmaps=!1}else if(at){if(ut){let st=kt(J);e.texStorage2D(i.TEXTURE_2D,Zt,$,st.width,st.height)}Dt&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,dt,I,J)}else e.texImage2D(i.TEXTURE_2D,0,$,dt,I,J);b(M)&&M.mipmapsAutoUpdate===!0&&x(it),_t.__version=ht.version,M.onUpdate&&M.onUpdate(M)}A.__version=M.version}function bt(A,M,B){if(M.image.length!==6)return;let it=Yt(A,M),K=M.source;e.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+B);let ht=n.get(K);if(K.version!==ht.__version||it===!0){e.activeTexture(i.TEXTURE0+B);let _t=ee.getPrimaries(ee.workingColorSpace),Z=M.colorSpace===G0?null:ee.getPrimaries(M.colorSpace),J=M.colorSpace===G0||_t===Z?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,M.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,M.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,J);let dt=M.isCompressedTexture||M.image[0].isCompressedTexture,I=M.image[0]&&M.image[0].isDataTexture,$=[];for(let vt=0;vt<6;vt++)!dt&&!I?$[vt]=y(M.image[vt],!0,s.maxCubemapSize):$[vt]=I?M.image[vt].image:M.image[vt],$[vt]=Ft(M,$[vt]);let q=$[0],ft=r.convert(M.format,M.colorSpace),at=r.convert(M.type),ut=T(M.internalFormat,ft,at,M.normalized,M.colorSpace),Dt=M.isVideoTexture!==!0,Zt=ht.__version===void 0||it===!0,st=K.dataReady,Nt=S(M,q);Wt(i.TEXTURE_CUBE_MAP,M);let qt;if(M.isDepthTexture){if(ut=g(M.format===z0,M.type),Zt)if(Dt)e.texStorage2D(i.TEXTURE_CUBE_MAP,1,ut,q.width,q.height);else for(let vt=0;vt<6;vt++)e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,0,ut,q.width,q.height,0,ft,at,null)}else if(dt){Dt&&Zt&&e.texStorage2D(i.TEXTURE_CUBE_MAP,Nt,ut,q.width,q.height);for(let vt=0;vt<6;vt++){qt=$[vt].mipmaps;for(let de=0;de<qt.length;de++){let Re=qt[de];M.format!==s0?ft!==null?Dt?st&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de,0,0,Re.width,Re.height,ft,Re.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de,ut,Re.width,Re.height,0,Re.data):Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Dt?st&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de,0,0,Re.width,Re.height,ft,at,Re.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de,ut,Re.width,Re.height,0,ft,at,Re.data)}}}else{if(qt=M.mipmaps,Dt&&Zt){qt.length>0&&Nt++;let vt=kt($[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,Nt,ut,vt.width,vt.height)}for(let vt=0;vt<6;vt++)if(I){Dt?st&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,0,0,0,$[vt].width,$[vt].height,ft,at,$[vt].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,0,ut,$[vt].width,$[vt].height,0,ft,at,$[vt].data);for(let de=0;de<qt.length;de++){let H0=qt[de].image[vt].image;Dt?st&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de+1,0,0,H0.width,H0.height,ft,at,H0.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de+1,ut,H0.width,H0.height,0,ft,at,H0.data)}}else{Dt?st&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,0,0,0,ft,at,$[vt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,0,ut,ft,at,$[vt]);for(let de=0;de<qt.length;de++){let Re=qt[de];Dt?st&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de+1,0,0,ft,at,Re.image[vt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,de+1,ut,ft,at,Re.image[vt])}}}b(M)&&M.mipmapsAutoUpdate===!0&&x(i.TEXTURE_CUBE_MAP),ht.__version=K.version,M.onUpdate&&M.onUpdate(M)}A.__version=M.version}function mt(A,M,B,it,K,ht){let _t=r.convert(B.format,B.colorSpace),Z=r.convert(B.type),J=T(B.internalFormat,_t,Z,B.normalized,B.colorSpace),dt=n.get(M),I=n.get(B);if(I.__renderTarget=M,!dt.__hasExternalTextures){let $=Math.max(1,M.width>>ht),q=Math.max(1,M.height>>ht);K===i.TEXTURE_3D||K===i.TEXTURE_2D_ARRAY?e.texImage3D(K,ht,J,$,q,M.depth,0,_t,Z,null):e.texImage2D(K,ht,J,$,q,0,_t,Z,null)}e.bindFramebuffer(i.FRAMEBUFFER,A),gt(M)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,it,K,I.__webglTexture,0,he(M)):(K===i.TEXTURE_2D||K>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&K<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,it,K,I.__webglTexture,ht),e.bindFramebuffer(i.FRAMEBUFFER,null)}function Gt(A,M,B){if(i.bindRenderbuffer(i.RENDERBUFFER,A),M.depthBuffer){let it=M.depthTexture,K=it&&it.isDepthTexture?it.type:null,ht=g(M.stencilBuffer,K),_t=M.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;gt(M)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,he(M),ht,M.width,M.height):B?i.renderbufferStorageMultisample(i.RENDERBUFFER,he(M),ht,M.width,M.height):i.renderbufferStorage(i.RENDERBUFFER,ht,M.width,M.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,_t,i.RENDERBUFFER,A)}else{let it=M.textures;for(let K=0;K<it.length;K++){let ht=it[K],_t=r.convert(ht.format,ht.colorSpace),Z=r.convert(ht.type),J=T(ht.internalFormat,_t,Z,ht.normalized,ht.colorSpace);gt(M)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,he(M),J,M.width,M.height):B?i.renderbufferStorageMultisample(i.RENDERBUFFER,he(M),J,M.width,M.height):i.renderbufferStorage(i.RENDERBUFFER,J,M.width,M.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function wt(A,M,B){let it=M.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,A),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let K=n.get(M.depthTexture);K.__renderTarget=M;let ht=it?M.depthTexture.image[0]:M.depthTexture.image;(!K.__webglTexture||ht.width!==M.width||ht.height!==M.height)&&(ht.width=M.width,ht.height=M.height,M.depthTexture.needsUpdate=!0),it?yt(M.depthTexture,0):ot(M.depthTexture,0);let _t=K.__webglTexture,Z=he(M),J=it?i.TEXTURE_CUBE_MAP_POSITIVE_X+B:i.TEXTURE_2D,dt=M.depthTexture.format===z0?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(M.depthTexture.format===U0)gt(M)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,dt,J,_t,0,Z):i.framebufferTexture2D(i.FRAMEBUFFER,dt,J,_t,0);else if(M.depthTexture.format===z0)gt(M)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,dt,J,_t,0,Z):i.framebufferTexture2D(i.FRAMEBUFFER,dt,J,_t,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Xt(A){let M=n.get(A),B=A.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==A.depthTexture){let it=A.depthTexture;if(M.__depthDisposeCallback&&M.__depthDisposeCallback(),it){let K=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,it.removeEventListener("dispose",K)};it.addEventListener("dispose",K),M.__depthDisposeCallback=K}M.__boundDepthTexture=it}if(A.depthTexture&&!M.__autoAllocateDepthBuffer)if(B)for(let it=0;it<6;it++)wt(M.__webglFramebuffer[it],A,it);else A.texture.mipmaps.length>0?wt(M.__webglFramebuffer[0],A,0):wt(M.__webglFramebuffer,A,0);else if(B){M.__webglDepthbuffer=[];for(let it=0;it<6;it++)if(e.bindFramebuffer(i.FRAMEBUFFER,M.__webglFramebuffer[it]),M.__webglDepthbuffer[it]===void 0)M.__webglDepthbuffer[it]=i.createRenderbuffer(),Gt(M.__webglDepthbuffer[it],A,!1);else{let K=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ht=M.__webglDepthbuffer[it];i.bindRenderbuffer(i.RENDERBUFFER,ht),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,ht)}}else if(A.texture.mipmaps.length>0?e.bindFramebuffer(i.FRAMEBUFFER,M.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,M.__webglFramebuffer),M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=i.createRenderbuffer(),Gt(M.__webglDepthbuffer,A,!1);else{let K=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ht=M.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ht),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,ht)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function $t(A,M,B){let it=n.get(A);M!==void 0&&mt(it.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),B!==void 0&&Xt(A)}function ne(A){let M=A.texture,B=n.get(A),it=n.get(M);A.addEventListener("dispose",F),C(A);let K=A.textures,ht=A.isWebGLCubeRenderTarget===!0,_t=K.length>1;if(_t||(it.__webglTexture===void 0&&(it.__webglTexture=i.createTexture()),it.__version=M.version,a.memory.textures++),ht){B.__webglFramebuffer=[];for(let Z=0;Z<6;Z++)if(M.mipmaps.length>0){B.__webglFramebuffer[Z]=[];for(let J=0;J<M.mipmaps.length;J++)B.__webglFramebuffer[Z][J]=i.createFramebuffer()}else B.__webglFramebuffer[Z]=i.createFramebuffer()}else{if(M.mipmaps.length>0){B.__webglFramebuffer=[];for(let Z=0;Z<M.mipmaps.length;Z++)B.__webglFramebuffer[Z]=i.createFramebuffer()}else B.__webglFramebuffer=i.createFramebuffer();if(_t)for(let Z=0,J=K.length;Z<J;Z++){let dt=n.get(K[Z]);dt.__webglTexture===void 0&&(dt.__webglTexture=i.createTexture(),a.memory.textures++)}if(A.samples>0&&gt(A)===!1){B.__webglMultisampledFramebuffer=i.createFramebuffer(),B.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let Z=0;Z<K.length;Z++){let J=K[Z];B.__webglColorRenderbuffer[Z]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,B.__webglColorRenderbuffer[Z]);let dt=r.convert(J.format,J.colorSpace),I=r.convert(J.type),$=T(J.internalFormat,dt,I,J.normalized,J.colorSpace,A.isXRRenderTarget===!0),q=he(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,q,$,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Z,i.RENDERBUFFER,B.__webglColorRenderbuffer[Z])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(B.__webglDepthRenderbuffer=i.createRenderbuffer(),Gt(B.__webglDepthRenderbuffer,A,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ht){e.bindTexture(i.TEXTURE_CUBE_MAP,it.__webglTexture),Wt(i.TEXTURE_CUBE_MAP,M);for(let Z=0;Z<6;Z++)if(M.mipmaps.length>0)for(let J=0;J<M.mipmaps.length;J++)mt(B.__webglFramebuffer[Z][J],A,M,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Z,J);else mt(B.__webglFramebuffer[Z],A,M,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0);b(M)?x(i.TEXTURE_CUBE_MAP):M.mipmaps.length>0&&i.texParameteri(i.TEXTURE_CUBE_MAP,i.TEXTURE_MAX_LEVEL,M.mipmaps.length-1),e.unbindTexture()}else if(_t){for(let Z=0,J=K.length;Z<J;Z++){let dt=K[Z],I=n.get(dt),$=i.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&($=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture($,I.__webglTexture),Wt($,dt),mt(B.__webglFramebuffer,A,dt,i.COLOR_ATTACHMENT0+Z,$,0),b(dt)&&x($)}e.unbindTexture()}else{let Z=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(Z=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(Z,it.__webglTexture),Wt(Z,M),M.mipmaps.length>0)for(let J=0;J<M.mipmaps.length;J++)mt(B.__webglFramebuffer[J],A,M,i.COLOR_ATTACHMENT0,Z,J);else mt(B.__webglFramebuffer,A,M,i.COLOR_ATTACHMENT0,Z,0);b(M)?x(Z):M.mipmaps.length>0&&i.texParameteri(Z,i.TEXTURE_MAX_LEVEL,M.mipmaps.length-1),e.unbindTexture()}A.depthBuffer&&Xt(A)}function D(A){let M=A.textures;for(let B=0,it=M.length;B<it;B++){let K=M[B];if(b(K)&&K.mipmapsAutoUpdate===!0){let ht=w(A),_t=n.get(K).__webglTexture;e.bindTexture(ht,_t),x(ht),e.unbindTexture()}}}let ce=[];function Bt(A){if(A.samples>0){if(gt(A)===!1){let M=A.textures,B=A.width,it=A.height,K=i.COLOR_BUFFER_BIT,ht=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,_t=n.get(A),Z=M.length>1;if(Z)for(let dt=0;dt<M.length;dt++)e.bindFramebuffer(i.FRAMEBUFFER,_t.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,_t.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,_t.__webglMultisampledFramebuffer),A.texture.mipmaps.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,_t.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,_t.__webglFramebuffer);for(let dt=0;dt<M.length;dt++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(K|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(K|=i.STENCIL_BUFFER_BIT)),Z){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,_t.__webglColorRenderbuffer[dt]);let I=n.get(M[dt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,I,0)}i.blitFramebuffer(0,0,B,it,0,0,B,it,K,i.NEAREST),l===!0&&(ce.length=0,ce.push(i.COLOR_ATTACHMENT0+dt),A.depthBuffer&&A.storeMultisampledDepthBuffer===!1&&ce.push(ht),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ce))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),Z)for(let dt=0;dt<M.length;dt++){e.bindFramebuffer(i.FRAMEBUFFER,_t.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.RENDERBUFFER,_t.__webglColorRenderbuffer[dt]);let I=n.get(M[dt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,_t.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.TEXTURE_2D,I,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,_t.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.storeMultisampledDepthBuffer===!1&&l){let M=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[M])}}}function he(A){return Math.min(s.maxSamples,A.samples)}function gt(A){let M=n.get(A);return A.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function Me(A){let M=a.render.frame;h.get(A)!==M&&(h.set(A,M),A.update())}function Ft(A,M){let B=A.colorSpace,it=A.format,K=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||B!==Si&&B!==G0&&(ee.getTransfer(B)===ue?(it!==s0||K!==$e)&&Ot("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):zt("WebGLTextures: Unsupported texture color space:",B)),M}function kt(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=rt,this.resetTextureUnits=Q,this.getTextureUnits=tt,this.setTextureUnits=Tt,this.setTexture2D=ot,this.setTexture2DArray=Et,this.setTexture3D=Lt,this.setTextureCube=yt,this.rebindTextures=$t,this.setupRenderTarget=ne,this.updateRenderTargetMipmap=D,this.updateMultisampleRenderTarget=Bt,this.setupDepthRenderbuffer=Xt,this.setupFrameBufferTexture=mt,this.useMultisampledRTT=gt,this.dispose=G}function Fd(i,t){function e(n,s=G0){let r,a=ee.getTransfer(s);if(n===$e)return i.UNSIGNED_BYTE;if(n===Lr)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Dr)return i.UNSIGNED_SHORT_5_5_5_1;if(n===wo)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Ao)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Eo)return i.BYTE;if(n===To)return i.SHORT;if(n===ii)return i.UNSIGNED_SHORT;if(n===Pr)return i.INT;if(n===f0)return i.UNSIGNED_INT;if(n===o0)return i.FLOAT;if(n===p0)return i.HALF_FLOAT;if(n===Ro)return i.ALPHA;if(n===Co)return i.RGB;if(n===s0)return i.RGBA;if(n===U0)return i.DEPTH_COMPONENT;if(n===z0)return i.DEPTH_STENCIL;if(n===Nr)return i.RED;if(n===Ur)return i.RED_INTEGER;if(n===an)return i.RG;if(n===Fr)return i.RG_INTEGER;if(n===Or)return i.RGBA_INTEGER;if(n===rs||n===as||n===os||n===ls)if(a===ue)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===rs)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===as)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===os)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===ls)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===rs)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===as)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===os)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===ls)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Br||n===zr||n===Gr||n===kr)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Br)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===zr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Gr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===kr)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Hr||n===Vr||n===Wr||n===Xr||n===qr||n===cs||n===Yr)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Hr||n===Vr)return a===ue?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Wr)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Xr)return r.COMPRESSED_R11_EAC;if(n===qr)return r.COMPRESSED_SIGNED_R11_EAC;if(n===cs)return r.COMPRESSED_RG11_EAC;if(n===Yr)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Zr||n===Jr||n===$r||n===Kr||n===Qr||n===jr||n===ta||n===ea||n===na||n===ia||n===sa||n===ra||n===aa||n===oa)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Zr)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Jr)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===$r)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Kr)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Qr)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===jr)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===ta)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===ea)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===na)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===ia)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===sa)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ra)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===aa)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===oa)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===la||n===ca||n===ha)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===la)return a===ue?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===ca)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===ha)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ua||n===da||n===hs||n===fa)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===ua)return r.COMPRESSED_RED_RGTC1_EXT;if(n===da)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===hs)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===fa)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Mn?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var Od=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Bd=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,t1=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new Ni(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new b0({vertexShader:Od,fragmentShader:Bd,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Je(new Yi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},e1=class extends x0{constructor(t,e){super();let n=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,f=null,_=null,v=typeof XRWebGLBinding<"u",p=new t1,m={},y=e.getContextAttributes(),b=null,x=null,w=[],T=[],g=new nt,S=null,C=null,R=new Xe;R.viewport=new xe;let L=new Xe;L.viewport=new xe;let F=[R,L],H=new Tr,P=null,G=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let ot=w[Y];return ot===void 0&&(ot=new Xn,w[Y]=ot),ot.getTargetRaySpace()},this.getControllerGrip=function(Y){let ot=w[Y];return ot===void 0&&(ot=new Xn,w[Y]=ot),ot.getGripSpace()},this.getHand=function(Y){let ot=w[Y];return ot===void 0&&(ot=new Xn,w[Y]=ot),ot.getHandSpace()};function X(Y){let ot=T.indexOf(Y.inputSource);if(ot===-1)return;let Et=w[ot];Et!==void 0&&(Et.update(Y.inputSource,Y.frame,c||a),Et.dispatchEvent({type:Y.type,data:Y.inputSource}))}function k(){s.removeEventListener("select",X),s.removeEventListener("selectstart",X),s.removeEventListener("selectend",X),s.removeEventListener("squeeze",X),s.removeEventListener("squeezestart",X),s.removeEventListener("squeezeend",X),s.removeEventListener("end",k),s.removeEventListener("inputsourceschange",et);for(let Y=0;Y<w.length;Y++){let ot=T[Y];ot!==null&&(T[Y]=null,w[Y].disconnect(ot))}P=null,G=null,p.reset();for(let Y in m)delete m[Y];if(t.setRenderTarget(b),f=null,d=null,u=null,s=null,x=null,rt.stop(),n.isPresenting=!1,t.setPixelRatio(S),t.setSize(g.width,g.height,!1),C!==null){let Y=C.camera;Y.fov=C.fov,Y.zoom=C.zoom,Y.updateProjectionMatrix(),C=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&Ot("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&Ot("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u===null&&v&&(u=new XRWebGLBinding(s,e)),u},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(b=t.getRenderTarget(),s.addEventListener("select",X),s.addEventListener("selectstart",X),s.addEventListener("selectend",X),s.addEventListener("squeeze",X),s.addEventListener("squeezestart",X),s.addEventListener("squeezeend",X),s.addEventListener("end",k),s.addEventListener("inputsourceschange",et),y.xrCompatible!==!0&&await e.makeXRCompatible(),S=t.getPixelRatio(),t.getSize(g),v&&"createProjectionLayer"in XRWebGLBinding.prototype){let Et=null,Lt=null,yt=null;y.depth&&(yt=y.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,Et=y.stencil?z0:U0,Lt=y.stencil?Mn:f0);let Pt={colorFormat:e.RGBA8,depthFormat:yt,scaleFactor:r};u=this.getBinding(),d=u.createProjectionLayer(Pt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),x=new e0(d.textureWidth,d.textureHeight,{format:s0,type:$e,depthTexture:new O0(d.textureWidth,d.textureHeight,Lt,void 0,void 0,void 0,void 0,void 0,void 0,Et),stencilBuffer:y.stencil,colorSpace:t.outputColorSpace,samples:y.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let Et={antialias:y.antialias,alpha:!0,depth:y.depth,stencil:y.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,Et),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),x=new e0(f.framebufferWidth,f.framebufferHeight,{format:s0,type:$e,colorSpace:t.outputColorSpace,stencilBuffer:y.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),rt.setContext(s),rt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function et(Y){for(let ot=0;ot<Y.removed.length;ot++){let Et=Y.removed[ot],Lt=T.indexOf(Et);Lt>=0&&(T[Lt]=null,w[Lt].disconnect(Et))}for(let ot=0;ot<Y.added.length;ot++){let Et=Y.added[ot],Lt=T.indexOf(Et);if(Lt===-1){for(let Pt=0;Pt<w.length;Pt++)if(Pt>=T.length){T.push(Et),Lt=Pt;break}else if(T[Pt]===null){T[Pt]=Et,Lt=Pt;break}if(Lt===-1)break}let yt=w[Lt];yt&&yt.connect(Et)}}function W(Y,ot){ot===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(ot.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let ot=Y.near,Et=Y.far;p.texture!==null&&(p.depthNear>0&&(ot=p.depthNear),p.depthFar>0&&(Et=p.depthFar)),H.near=L.near=R.near=ot,H.far=L.far=R.far=Et,(P!==H.near||G!==H.far)&&(s.updateRenderState({depthNear:H.near,depthFar:H.far}),P=H.near,G=H.far),H.layers.mask=Y.layers.mask|6,R.layers.mask=H.layers.mask&-5,L.layers.mask=H.layers.mask&-3;let Lt=Y.parent,yt=H.cameras;W(H,Lt);for(let Pt=0;Pt<yt.length;Pt++)W(yt[Pt],Lt);H.projectionMatrix.copy(R.projectionMatrix),H.projectionMatrixInverse.copy(R.projectionMatrixInverse),C===null&&Y.isPerspectiveCamera&&(C={camera:Y,fov:Y.fov,zoom:Y.zoom}),Q(Y,H,Lt)};function Q(Y,ot,Et){Et===null?Y.matrix.copy(ot.matrixWorld):(Y.matrix.copy(Et.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(ot.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(ot.projectionMatrix),Y.projectionMatrixInverse.copy(ot.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=tr*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return H},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Y)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(H)},this.getCameraTexture=function(Y){return m[Y]};let tt=null;function Tt(Y,ot){if(h=ot.getViewerPose(c||a),_=ot,h!==null){let Et=h.views;f!==null&&(t.setRenderTargetFramebuffer(x,f.framebuffer),t.setRenderTarget(x));let Lt=!1;Et.length!==H.cameras.length&&(H.cameras.length=0,Lt=!0);for(let Ut=0;Ut<Et.length;Ut++){let Wt=Et[Ut],Yt=null;if(f!==null)Yt=f.getViewport(Wt);else{let ct=u.getViewSubImage(d,Wt);Yt=ct.viewport,Ut===0&&(t.setRenderTargetTextures(x,ct.colorTexture,ct.depthStencilTexture),t.setRenderTarget(x))}let j=F[Ut];j===void 0&&(j=new Xe,j.layers.enable(Ut),j.viewport=new xe,F[Ut]=j),j.matrix.fromArray(Wt.transform.matrix),j.matrix.decompose(j.position,j.quaternion,j.scale),j.projectionMatrix.fromArray(Wt.projectionMatrix),j.projectionMatrixInverse.copy(j.projectionMatrix).invert(),j.viewport.set(Yt.x,Yt.y,Yt.width,Yt.height),Ut===0&&(H.matrix.copy(j.matrix),H.matrix.decompose(H.position,H.quaternion,H.scale)),Lt===!0&&H.cameras.push(j)}let yt=s.enabledFeatures;if(yt&&yt.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&v){u=n.getBinding();let Ut=u.getDepthInformation(Et[0]);Ut&&Ut.isValid&&Ut.texture&&p.init(Ut,s.renderState)}if(yt&&yt.includes("camera-access")&&v){t.state.unbindTexture(),u=n.getBinding();for(let Ut=0;Ut<Et.length;Ut++){let Wt=Et[Ut].camera;if(Wt){let Yt=m[Wt];Yt||(Yt=new Ni,m[Wt]=Yt);let j=u.getCameraImage(Wt);Yt.sourceTexture=j}}}}for(let Et=0;Et<w.length;Et++){let Lt=T[Et],yt=w[Et];Lt!==null&&yt!==void 0&&yt.update(Lt,ot,c||a)}tt&&tt(Y,ot),ot.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ot}),_=null}let rt=new g3;rt.setAnimationLoop(Tt),this.setAnimationLoop=function(Y){tt=Y},this.dispose=function(){}}},zd=new oe,w3=new Ht;w3.set(-1,0,0,0,1,0,0,0,1);function Gd(i,t){function e(p,m){p.matrixAutoUpdate===!0&&p.updateMatrix(),m.value.copy(p.matrix)}function n(p,m){m.color.getRGB(p.fogColor.value,Oo(i)),m.isFog?(p.fogNear.value=m.near,p.fogFar.value=m.far):m.isFogExp2&&(p.fogDensity.value=m.density)}function s(p,m,y,b,x){m.isNodeMaterial?m.uniformsNeedUpdate=!1:m.isMeshBasicMaterial?r(p,m):m.isMeshLambertMaterial?(r(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshToonMaterial?(r(p,m),u(p,m)):m.isMeshPhongMaterial?(r(p,m),h(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshStandardMaterial?(r(p,m),d(p,m),m.isMeshPhysicalMaterial&&f(p,m,x)):m.isMeshMatcapMaterial?(r(p,m),_(p,m)):m.isMeshDepthMaterial?r(p,m):m.isMeshDistanceMaterial?(r(p,m),v(p,m)):m.isMeshNormalMaterial?r(p,m):m.isLineBasicMaterial?(a(p,m),m.isLineDashedMaterial&&o(p,m)):m.isPointsMaterial?l(p,m,y,b):m.isSpriteMaterial?c(p,m):m.isShadowMaterial?(p.color.value.copy(m.color),p.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function r(p,m){p.opacity.value=m.opacity,m.color&&p.diffuse.value.copy(m.color),m.emissive&&p.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(p.map.value=m.map,e(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.bumpMap&&(p.bumpMap.value=m.bumpMap,e(m.bumpMap,p.bumpMapTransform),p.bumpScale.value=m.bumpScale,m.side===Ye&&(p.bumpScale.value*=-1)),m.normalMap&&(p.normalMap.value=m.normalMap,e(m.normalMap,p.normalMapTransform),p.normalScale.value.copy(m.normalScale),m.side===Ye&&p.normalScale.value.negate()),m.displacementMap&&(p.displacementMap.value=m.displacementMap,e(m.displacementMap,p.displacementMapTransform),p.displacementScale.value=m.displacementScale,p.displacementBias.value=m.displacementBias),m.emissiveMap&&(p.emissiveMap.value=m.emissiveMap,e(m.emissiveMap,p.emissiveMapTransform)),m.specularMap&&(p.specularMap.value=m.specularMap,e(m.specularMap,p.specularMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest);let y=t.get(m),b=y.envMap,x=y.envMapRotation;b&&(p.envMap.value=b,p.envMapRotation.value.setFromMatrix4(zd.makeRotationFromEuler(x)).transpose(),b.isCubeTexture&&b.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(w3),p.reflectivity.value=m.reflectivity,p.ior.value=m.ior,p.refractionRatio.value=m.refractionRatio),m.lightMap&&(p.lightMap.value=m.lightMap,p.lightMapIntensity.value=m.lightMapIntensity,e(m.lightMap,p.lightMapTransform)),m.aoMap&&(p.aoMap.value=m.aoMap,p.aoMapIntensity.value=m.aoMapIntensity,e(m.aoMap,p.aoMapTransform))}function a(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,m.map&&(p.map.value=m.map,e(m.map,p.mapTransform))}function o(p,m){p.dashSize.value=m.dashSize,p.totalSize.value=m.dashSize+m.gapSize,p.scale.value=m.scale}function l(p,m,y,b){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.size.value=m.size*y,p.scale.value=b*.5,m.map&&(p.map.value=m.map,e(m.map,p.uvTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function c(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.rotation.value=m.rotation,m.map&&(p.map.value=m.map,e(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function h(p,m){p.specular.value.copy(m.specular),p.shininess.value=Math.max(m.shininess,1e-4)}function u(p,m){m.gradientMap&&(p.gradientMap.value=m.gradientMap)}function d(p,m){p.metalness.value=m.metalness,m.metalnessMap&&(p.metalnessMap.value=m.metalnessMap,e(m.metalnessMap,p.metalnessMapTransform)),p.roughness.value=m.roughness,m.roughnessMap&&(p.roughnessMap.value=m.roughnessMap,e(m.roughnessMap,p.roughnessMapTransform)),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)}function f(p,m,y){p.ior.value=m.ior,m.diffuseRoughness>0&&(p.diffuseRoughness.value=m.diffuseRoughness,m.diffuseRoughnessMap&&(p.diffuseRoughnessMap.value=m.diffuseRoughnessMap,e(m.diffuseRoughnessMap,p.diffuseRoughnessMapTransform))),m.sheen>0&&(p.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),p.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(p.sheenColorMap.value=m.sheenColorMap,e(m.sheenColorMap,p.sheenColorMapTransform)),m.sheenRoughnessMap&&(p.sheenRoughnessMap.value=m.sheenRoughnessMap,e(m.sheenRoughnessMap,p.sheenRoughnessMapTransform))),m.clearcoat>0&&(p.clearcoat.value=m.clearcoat,p.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(p.clearcoatMap.value=m.clearcoatMap,e(m.clearcoatMap,p.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,e(m.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(p.clearcoatNormalMap.value=m.clearcoatNormalMap,e(m.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===Ye&&p.clearcoatNormalScale.value.negate())),m.dispersion>0&&(p.dispersion.value=m.dispersion),m.retroreflectivity>0&&(p.retroreflectivity.value=m.retroreflectivity),m.iridescence>0&&(p.iridescence.value=m.iridescence,p.iridescenceIOR.value=m.iridescenceIOR,p.iridescenceThicknessMinimum.value=m.iridescenceThicknessMinimum,p.iridescenceThicknessMaximum.value=m.iridescenceThicknessMaximum,m.iridescenceMap&&(p.iridescenceMap.value=m.iridescenceMap,e(m.iridescenceMap,p.iridescenceMapTransform)),m.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=m.iridescenceThicknessMap,e(m.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),m.transmission>0&&(p.transmission.value=m.transmission,p.transmissionSamplerMap.value=y.texture,p.transmissionSamplerSize.value.set(y.width,y.height),m.transmissionMap&&(p.transmissionMap.value=m.transmissionMap,e(m.transmissionMap,p.transmissionMapTransform)),p.thickness.value=m.thickness,m.thicknessMap&&(p.thicknessMap.value=m.thicknessMap,e(m.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=m.attenuationDistance,p.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(p.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(p.anisotropyMap.value=m.anisotropyMap,e(m.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=m.specularIntensity,p.specularColor.value.copy(m.specularColor),m.specularColorMap&&(p.specularColorMap.value=m.specularColorMap,e(m.specularColorMap,p.specularColorMapTransform)),m.specularIntensityMap&&(p.specularIntensityMap.value=m.specularIntensityMap,e(m.specularIntensityMap,p.specularIntensityMapTransform))}function _(p,m){m.matcap&&(p.matcap.value=m.matcap)}function v(p,m){let y=t.get(m).light;p.referencePosition.value.setFromMatrixPosition(y.matrixWorld),p.nearDistance.value=y.shadow.camera.near,p.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function kd(i,t,e,n){let s={},r={};function a(y,b){let x=b.program;n.uniformBlockBinding(y,x,s[y.id])}function o(y,b){let x=s[y.id];x===void 0&&(_(y),x=l(y),s[y.id]=x,y.addEventListener("dispose",p));let w=b.program;n.updateUBOMapping(y,w);let T=t.render.frame;r[y.id]!==T&&(c(y),r[y.id]=T)}function l(y){let b=i.createBuffer(),x=y.__size,w=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,b),i.bufferData(i.UNIFORM_BUFFER,x,w),i.bindBuffer(i.UNIFORM_BUFFER,null),b}function c(y){let b=s[y.id],x=y.uniforms,w=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let T=0,g=x.length;T<g;T++){let S=x[T];if(Array.isArray(S))for(let C=0,R=S.length;C<R;C++)h(S[C],T,C,w);else h(S,T,0,w)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function h(y,b,x,w){if(d(y,b,x,w)===!0){let T=y.__offset,g=y.value;if(Array.isArray(g)){let S=0;for(let C=0;C<g.length;C++){let R=g[C],L=v(R,!0);u(R,y.__data,S),S+=L.storage/Float32Array.BYTES_PER_ELEMENT}}else u(g,y.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,T,y.__data)}}function u(y,b,x){typeof y=="number"||typeof y=="boolean"?b[x]=y:y.isMatrix3?(b[x]=y.elements[0],b[x+1]=y.elements[1],b[x+2]=y.elements[2],b[x+3]=0,b[x+4]=y.elements[3],b[x+5]=y.elements[4],b[x+6]=y.elements[5],b[x+7]=0,b[x+8]=y.elements[6],b[x+9]=y.elements[7],b[x+10]=y.elements[8],b[x+11]=0):ArrayBuffer.isView(y)?b.set(y.subarray(0,b.length-x),x):y.toArray(b,x)}function d(y,b,x,w){let T=y.value,g=b+"_"+x;if(Array.isArray(T)){w[g]===void 0&&(w[g]=[]);let S=w[g],C=!1;for(let R=0;R<T.length;R++)f(T[R],S,R)===!0&&(C=!0);return C}return f(T,w,g)}function f(y,b,x){if(b[x]===void 0)return typeof y=="number"||typeof y=="boolean"?b[x]=y:ArrayBuffer.isView(y)?b[x]=y.slice():b[x]=y.clone(),!0;{let w=b[x];if(typeof y=="number"||typeof y=="boolean"){if(w!==y)return b[x]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(w.equals(y)===!1)return w.copy(y),!0}}return!1}function _(y){let b=y.uniforms,x=0,w=16;for(let g=0,S=b.length;g<S;g++){let C=Array.isArray(b[g])?b[g]:[b[g]];for(let R=0,L=C.length;R<L;R++){let F=C[R],H=Array.isArray(F.value)?F.value:[F.value],P=Array.isArray(b[g])||Array.isArray(F.value),G=x;for(let k=0,et=H.length;k<et;k++){let W=H[k],Q=v(W,P),tt=x%w,Tt=tt%Q.boundary,rt=tt+Tt;x+=Tt,rt!==0&&w-rt<Q.storage&&(x+=w-rt),k===0&&(G=x),x+=Q.storage}let X=F.type==="int"?Int32Array:F.type==="uint"?Uint32Array:Float32Array;F.__data=new X((x-G)/Float32Array.BYTES_PER_ELEMENT),F.__offset=G}}let T=x%w;return T>0&&(x+=w-T),y.__size=x,y.__cache={},this}function v(y,b){let x={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(x.boundary=4,x.storage=4):y.isVector2?(x.boundary=8,x.storage=8):y.isVector3||y.isColor?(x.boundary=16,x.storage=12):y.isVector4?(x.boundary=16,x.storage=16):y.isMatrix3?(x.boundary=16,x.storage=48):y.isMatrix4?(x.boundary=16,x.storage=64):y.isTexture?Ot("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(x.boundary=16,x.storage=y.byteLength):Ot("WebGLRenderer: Unsupported uniform value type.",y),b===!0&&(x.boundary=16,x.storage=Math.ceil(x.storage/16)*16),x}function p(y){let b=y.target;b.removeEventListener("dispose",p),i.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function m(){for(let y in s)i.deleteBuffer(s[y]);s={},r={}}return{bind:a,update:o,dispose:m}}var Hd=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),w0=null;function Vd(){return w0===null&&(w0=new mn(Hd,16,16,an,p0),w0.name="DFG_LUT",w0.minFilter=qe,w0.magFilter=qe,w0.wrapS=_0,w0.wrapT=_0,w0.generateMipmaps=!1,w0.needsUpdate=!0),w0}var xa=class{constructor(t={}){let{canvas:e=F2(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=$e}=t;this.isWebGLRenderer=!0;let _;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");_=n.getContextAttributes().alpha}else _=a;let v=f,p=new Set([Or,Fr,Ur]),m=new Set([$e,f0,ii,Mn,Lr,Dr]),y=new Uint32Array(4),b=new Int32Array(4),x={textures:[],min:[],max:[],resolution:[]},w=null,T=null,g=[],S=[],C=null;this.domElement=e,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=T0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let R=this,L=!1,F=null,H=null,P=null,G=null;this._outputColorSpace=We;let X=0,k=0,et=null,W=-1,Q=null,tt=new xe,Tt=new xe,rt=null,Y=new Qt(0),ot=0,Et=e.width,Lt=e.height,yt=1,Pt=null,se=null,Ut=new xe(0,0,Et,Lt),Wt=new xe(0,0,Et,Lt),Yt=!1,j=new tn,ct=new rr,lt=!1,bt=!1,mt=new oe,Gt=new U,wt=new xe,Xt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},$t=!1;function ne(){return et===null?yt:1}let D=n;function ce(E,N){return e.getContext(E,N)}let Bt,he,gt,Me,Ft,kt,A,M,B,it,K,ht,_t,Z,J,dt,I,$,q,ft,at,ut,Dt;try{let E={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"187"}`),e.addEventListener("webglcontextlost",Nt,!1),e.addEventListener("webglcontextrestored",qt,!1),e.addEventListener("webglcontextcreationerror",vt,!1),D===null){let N="webgl2";if(D=ce(N,E),D===null)throw ce(N)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Zt()}catch(E){throw e.removeEventListener("webglcontextlost",Nt,!1),e.removeEventListener("webglcontextrestored",qt,!1),e.removeEventListener("webglcontextcreationerror",vt,!1),zt("WebGLRenderer: "+E.message),E}function Zt(){Bt=new t4(D),Bt.init(),at=new Fd(D,Bt),he=new Vu(D,Bt,t,at),gt=new Nd(D,Bt),he.reversedDepthBuffer&&d&&gt.buffers.depth.setReversed(!0),H=D.createFramebuffer(),P=D.createFramebuffer(),G=D.createFramebuffer(),Me=new i4(D),Ft=new vd,kt=new Ud(D,Bt,gt,Ft,he,at,Me),A=new ju(R),M=new rc(D),ut=new ku(D,M),B=new e4(D,M,Me,ut),it=new r4(D,B,M,ut,Me),$=new s4(D,he,kt),J=new Wu(Ft),K=new yd(R,A,Bt,he,ut,J),ht=new Gd(R,Ft),_t=new Sd,Z=new Rd(Bt),I=new Gu(R,A,gt,it,_,l),dt=new Dd(R,it,he),Dt=new kd(D,Me,he,gt),q=new Hu(D,Bt,Me),ft=new n4(D,Bt,Me),Me.programs=K.programs,R.capabilities=he,R.extensions=Bt,R.properties=Ft,R.renderLists=_t,R.shadowMap=dt,R.state=gt,R.info=Me}v!==$e&&(C=new o4(v,e.width,e.height,o,s,r));let st=new e1(R,D);this.xr=st,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){let E=Bt.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){let E=Bt.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return yt},this.setPixelRatio=function(E){E!==void 0&&(yt=E,this.setSize(Et,Lt,!1))},this.getSize=function(E){return E.set(Et,Lt)},this.setSize=function(E,N,V=!0){if(st.isPresenting){Ot("WebGLRenderer: Can't change size while VR device is presenting.");return}Et=E,Lt=N,e.width=Math.floor(E*yt),e.height=Math.floor(N*yt),V===!0&&(e.style.width=E+"px",e.style.height=N+"px"),C!==null&&C.setSize(e.width,e.height),this.setViewport(0,0,E,N)},this.getDrawingBufferSize=function(E){return E.set(Et*yt,Lt*yt).floor()},this.setDrawingBufferSize=function(E,N,V){Et=E,Lt=N,yt=V,e.width=Math.floor(E*V),e.height=Math.floor(N*V),this.setViewport(0,0,E,N)},this.setEffects=function(E){if(v===$e){zt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(E){for(let N=0;N<E.length;N++)if(E[N].isOutputPass===!0){Ot("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}C.setEffects(E||[])},this.getCurrentViewport=function(E){return E.copy(tt)},this.getViewport=function(E){return E.copy(Ut)},this.setViewport=function(E,N,V,O){E.isVector4?Ut.set(E.x,E.y,E.z,E.w):Ut.set(E,N,V,O),gt.viewport(tt.copy(Ut).multiplyScalar(ne()).round())},this.getScissor=function(E){return E.copy(Wt)},this.setScissor=function(E,N,V,O){E.isVector4?Wt.set(E.x,E.y,E.z,E.w):Wt.set(E,N,V,O),gt.scissor(Tt.copy(Wt).multiplyScalar(ne()).round())},this.getScissorTest=function(){return Yt},this.setScissorTest=function(E){gt.setScissorTest(Yt=E)},this.setOpaqueSort=function(E){Pt=E},this.setTransparentSort=function(E){se=E},this.getClearColor=function(E){return E.copy(I.getClearColor())},this.setClearColor=function(){I.setClearColor(...arguments)},this.getClearAlpha=function(){return I.getClearAlpha()},this.setClearAlpha=function(){I.setClearAlpha(...arguments)},this.clear=function(E=!0,N=!0,V=!0){let O=0;if(E){let z=!1;if(et!==null){let xt=et.texture.format;z=p.has(xt)}if(z){let xt=et.texture.type,At=m.has(xt),pt=I.getClearColor(),St=I.getClearAlpha(),It=pt.r,Vt=pt.g,jt=pt.b;At?(y[0]=It,y[1]=Vt,y[2]=jt,y[3]=St,D.clearBufferuiv(D.COLOR,0,y)):(b[0]=It,b[1]=Vt,b[2]=jt,b[3]=St,D.clearBufferiv(D.COLOR,0,b))}else O|=D.COLOR_BUFFER_BIT}N&&(O|=D.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),V&&(O|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),O!==0&&D.clear(O)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(E){E.setRenderer(this),F=E},this.dispose=function(){e.removeEventListener("webglcontextlost",Nt,!1),e.removeEventListener("webglcontextrestored",qt,!1),e.removeEventListener("webglcontextcreationerror",vt,!1),I.dispose(),_t.dispose(),Z.dispose(),kt.dispose(),Ft.dispose(),A.dispose(),it.dispose(),B.dispose(),ut.dispose(),Dt.dispose(),K.dispose(),st.dispose(),st.removeEventListener("sessionstart",s1),st.removeEventListener("sessionend",r1),on.stop()};function Nt(E){E.preventDefault(),No("WebGLRenderer: Context Lost."),L=!0}function qt(){No("WebGLRenderer: Context Restored."),L=!1;let E=Me.autoReset,N=dt.enabled,V=dt.autoUpdate,O=dt.needsUpdate,z=dt.type;Zt(),Me.autoReset=E,dt.enabled=N,dt.autoUpdate=V,dt.needsUpdate=O,dt.type=z}function vt(E){zt("WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function de(E){let N=E.target;N.removeEventListener("dispose",de),Re(N)}function Re(E){H0(E),Ft.remove(E)}function H0(E){let N=Ft.get(E).programs;N!==void 0&&(N.forEach(function(V){K.releaseProgram(V)}),E.isShaderMaterial&&K.releaseShaderCache(E))}this.renderBufferDirect=function(E,N,V,O,z,xt){N===null&&(N=Xt);let At=z.isMesh&&z.matrixWorld.determinantAffine()<0,pt=L3(E,N,V,O,z);gt.setMaterial(O,At);let St=V.index,It=1;if(O.wireframe===!0){if(St=B.getWireframeAttribute(V),St===void 0)return;It=2}let Vt=V.drawRange,jt=V.attributes.position,Rt=Vt.start*It,te=(Vt.start+Vt.count)*It;xt!==null&&(Rt=Math.max(Rt,xt.start*It),te=Math.min(te,(xt.start+xt.count)*It)),St!==null?(Rt=Math.max(Rt,0),te=Math.min(te,St.count)):jt!=null&&(Rt=Math.max(Rt,0),te=Math.min(te,jt.count));let Se=te-Rt;if(Se<0||Se===1/0)return;ut.setup(z,O,pt,V,St);let me,pe=q;if(St!==null&&(me=M.get(St),pe=ft,pe.setIndex(me)),z.isMesh)O.wireframe===!0?(gt.setLineWidth(O.wireframeLinewidth*ne()),pe.setMode(D.LINES)):pe.setMode(D.TRIANGLES);else if(z.isLine){let Ue=O.linewidth;Ue===void 0&&(Ue=1),gt.setLineWidth(Ue*ne()),z.isLineSegments?pe.setMode(D.LINES):z.isLineLoop?pe.setMode(D.LINE_LOOP):pe.setMode(D.LINE_STRIP)}else z.isPoints?pe.setMode(D.POINTS):z.isSprite&&pe.setMode(D.TRIANGLES);if(z.isBatchedMesh)if(Bt.get("WEBGL_multi_draw"))pe.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{let Ue=z._multiDrawStarts,Ct=z._multiDrawCounts,He=z._multiDrawCount,le=St?M.get(St).bytesPerElement:1,ln=Ft.get(O).currentProgram.getUniforms();for(let Fe=0;Fe<He;Fe++)ln.setValue(D,"_gl_DrawID",Fe),pe.render(Ue[Fe]/le,Ct[Fe])}else if(z.isInstancedMesh)pe.renderInstances(Rt,Se,z.count);else if(V.isInstancedBufferGeometry){let Ue=V._maxInstanceCount!==void 0?V._maxInstanceCount:1/0,Ct=Math.min(V.instanceCount,Ue);pe.renderInstances(Rt,Se,Ct)}else pe.render(Rt,Se)};function i1(E,N,V,O){F!==null&&E.isNodeMaterial&&F.setObject(O,E),lt===!0&&J.setState(E,V,!1),E.transparent===!0&&E.side===E0&&E.forceSinglePass===!1?(E.side=Ye,E.needsUpdate=!0,oi(E,N,O),E.side=rn,E.needsUpdate=!0,oi(E,N,O),E.side=E0):oi(E,N,O)}this.compile=function(E,N,V=null){V===null&&(V=E),F!==null&&F.renderStart(E,N,V),T=Z.get(V),T.init(N),S.push(T),V.traverseVisible(function(z){z.isLight&&z.layers.test(N.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),E!==V&&E.traverseVisible(function(z){z.isLight&&z.layers.test(N.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),T.setupLights(),F!==null&&F.updateLights(T.state.lightsArray),bt=this.localClippingEnabled,lt=J.init(this.clippingPlanes,bt),lt===!0&&J.setGlobalState(this.clippingPlanes,N),F!==null&&dt.render(T.state.shadowsArray,V,N);let O=new Set;return E.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;let xt=z.material;if(xt)if(Array.isArray(xt))for(let At=0;At<xt.length;At++){let pt=xt[At];i1(pt,V,N,z),O.add(pt)}else i1(xt,V,N,z),O.add(xt)}),T=S.pop(),F!==null&&F.renderEnd(),O},this.compileAsync=function(E,N,V=null){let O=this.compile(E,N,V);return new Promise(z=>{function xt(){if(O.forEach(function(At){let St=Ft.get(At).currentProgram;(St===void 0||St.isReady())&&O.delete(At)}),O.size===0){z(E);return}setTimeout(xt,10)}Bt.get("KHR_parallel_shader_compile")!==null?xt():setTimeout(xt,10)})};let Ma=null;function I3(E){Ma&&Ma(E)}function s1(){on.stop()}function r1(){on.start()}let on=new g3;on.setAnimationLoop(I3),typeof self<"u"&&on.setContext(self),this.setAnimationLoop=function(E){Ma=E,st.setAnimationLoop(E),E===null?on.stop():on.start()},st.addEventListener("sessionstart",s1),st.addEventListener("sessionend",r1),this.render=function(E,N){if(N!==void 0&&N.isCamera!==!0){zt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(L===!0)return;F!==null&&F.renderStart(E,N);let V=st.enabled===!0&&st.isPresenting===!0,O=C!==null&&(et===null||V)&&C.begin(R,et);if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),N.parent===null&&N.matrixWorldAutoUpdate===!0&&N.updateMatrixWorld(),st.enabled===!0&&st.isPresenting===!0&&(C===null||C.isCompositing()===!1)&&(st.cameraAutoUpdate===!0&&st.updateCamera(N),N=st.getCamera()),E.isScene===!0&&E.onBeforeRender(R,E,N,et),T=Z.get(E,S.length),T.init(N),T.state.textureUnits=kt.getTextureUnits(),S.push(T),mt.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),N.isArrayCamera?ct.setFromArrayCamera(N):j.setFromProjectionMatrix(mt,a0,N.reversedDepth),bt=this.localClippingEnabled,lt=J.init(this.clippingPlanes,bt),w=_t.get(E,g.length),w.init(),g.push(w),this.info.render.frame++,st.enabled===!0&&st.isPresenting===!0){let At=R.xr.getDepthSensingMesh();At!==null&&Sa(At,N,-1/0,R.sortObjects)}Sa(E,N,0,R.sortObjects),w.finish(),F!==null&&F.updateLights(T.state.lightsArray),R.sortObjects===!0&&w.sort(Pt,se),$t=st.enabled===!1||st.isPresenting===!1||st.hasDepthSensing()===!1,$t&&I.addToRenderList(w,E),this.info.autoReset===!0&&this.info.reset(),lt===!0&&J.beginShadows();let z=T.state.shadowsArray;if(dt.render(z,E,N),lt===!0&&J.endShadows(),(O&&C.hasRenderPass())===!1){let At=w.opaque,pt=w.transmissive;if(T.setupLights(),N.isArrayCamera){let St=N.cameras;if(pt.length>0)for(let It=0,Vt=St.length;It<Vt;It++){let jt=St[It];o1(At,pt,E,jt)}$t&&I.render(E);for(let It=0,Vt=St.length;It<Vt;It++){let jt=St[It];a1(w,E,jt,jt.viewport)}}else pt.length>0&&o1(At,pt,E,N),$t&&I.render(E),a1(w,E,N)}et!==null&&k===0&&(kt.updateMultisampleRenderTarget(et),kt.updateRenderTargetMipmap(et)),O&&C.end(R),E.isScene===!0&&E.onAfterRender(R,E,N),ut.resetDefaultState(),W=-1,Q=null,S.pop(),S.length>0?(T=S[S.length-1],kt.setTextureUnits(T.state.textureUnits),lt===!0&&J.setGlobalState(R.clippingPlanes,T.state.camera)):T=null,g.pop(),g.length>0?w=g[g.length-1]:w=null,F!==null&&F.renderEnd()};function Sa(E,N,V,O){if(E.visible===!1)return;if(E.layers.test(N.layers)){if(E.isGroup)V=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(N);else if(E.isLight)T.pushLight(E),E.castShadow&&T.pushShadow(E);else if(E.isSprite){let At=N.isArrayCamera?ct:j;if(!E.frustumCulled||E.intersectsFrustum(At)){O&&wt.setFromMatrixPosition(E.matrixWorld).applyMatrix4(mt);let pt=it.update(E),St=E.material;St.visible&&w.push(E,pt,St,V,wt.z,null,N)}}else if(E.isMesh||E.isLine||E.isPoints){let At=N.isArrayCamera?ct:j;if(!E.frustumCulled||E.intersectsFrustum(At)){let pt=it.update(E),St=E.material;if(O&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),wt.copy(E.boundingSphere.center)):(pt.boundingSphere===null&&pt.computeBoundingSphere(),wt.copy(pt.boundingSphere.center)),wt.applyMatrix4(E.matrixWorld).applyMatrix4(mt)),Array.isArray(St)){let It=pt.groups;for(let Vt=0,jt=It.length;Vt<jt;Vt++){let Rt=It[Vt],te=St[Rt.materialIndex];te&&te.visible&&w.push(E,pt,te,V,wt.z,Rt,N)}}else St.visible&&w.push(E,pt,St,V,wt.z,null,N)}}}let xt=E.children;for(let At=0,pt=xt.length;At<pt;At++)Sa(xt[At],N,V,O)}function a1(E,N,V,O){let{opaque:z,transmissive:xt,transparent:At}=E;T.setupLightsView(V),lt===!0&&J.setGlobalState(R.clippingPlanes,V),O&&gt.viewport(tt.copy(O)),z.length>0&&gs(z,N,V),xt.length>0&&gs(xt,N,V),At.length>0&&gs(At,N,V),gt.buffers.depth.setTest(!0),gt.buffers.depth.setMask(!0),gt.buffers.color.setMask(!0),gt.setPolygonOffset(!1)}function o1(E,N,V,O){if((V.isScene===!0?V.overrideMaterial:null)!==null)return;if(T.state.transmissionRenderTarget[O.id]===void 0){let Rt=Bt.has("EXT_color_buffer_half_float")||Bt.has("EXT_color_buffer_float");T.state.transmissionRenderTarget[O.id]=new e0(1,1,{generateMipmaps:!0,type:Rt?p0:$e,minFilter:B0,samples:Math.max(4,he.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:ee.workingColorSpace})}let xt=T.state.transmissionRenderTarget[O.id],At=O.viewport||tt;xt.setSize(At.z*R.transmissionResolutionScale,At.w*R.transmissionResolutionScale);let pt=R.getRenderTarget(),St=R.getActiveCubeFace(),It=R.getActiveMipmapLevel();R.setRenderTarget(xt),R.getClearColor(Y),ot=R.getClearAlpha(),ot<1&&R.setClearColor(16777215,.5),R.clear(),$t&&I.render(V);let Vt=R.toneMapping;R.toneMapping=T0;let jt=O.viewport;if(O.viewport!==void 0&&(O.viewport=void 0),T.setupLightsView(O),lt===!0&&J.setGlobalState(R.clippingPlanes,O),gs(E,V,O),kt.updateMultisampleRenderTarget(xt),kt.updateRenderTargetMipmap(xt),Bt.has("WEBGL_multisampled_render_to_texture")===!1){let Rt=!1;for(let te=0,Se=N.length;te<Se;te++){let me=N[te],{object:pe,geometry:Ue,material:Ct,group:He}=me;if(Ct.side===E0&&pe.layers.test(O.layers)){let le=Ct.side;Ct.side=Ye,Ct.needsUpdate=!0,l1(pe,V,O,Ue,Ct,He),Ct.side=le,Ct.needsUpdate=!0,Rt=!0}}Rt===!0&&(kt.updateMultisampleRenderTarget(xt),kt.updateRenderTargetMipmap(xt))}R.setRenderTarget(pt,St,It),R.setClearColor(Y,ot),jt!==void 0&&(O.viewport=jt),R.toneMapping=Vt}function gs(E,N,V){let O=N.isScene===!0?N.overrideMaterial:null;for(let z=0,xt=E.length;z<xt;z++){let At=E[z],{object:pt,geometry:St,group:It}=At,Vt=At.material;Vt.allowOverride===!0&&O!==null&&(Vt=O),pt.layers.test(V.layers)&&l1(pt,N,V,St,Vt,It)}}function l1(E,N,V,O,z,xt){F!==null&&z.isNodeMaterial&&F.setObject(E,z),E.onBeforeRender(R,N,V,O,z,xt),E.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),z.onBeforeRender(R,N,V,O,E,xt),z.transparent===!0&&z.side===E0&&z.forceSinglePass===!1?(z.side=Ye,z.needsUpdate=!0,R.renderBufferDirect(V,N,O,z,E,xt),z.side=rn,z.needsUpdate=!0,R.renderBufferDirect(V,N,O,z,E,xt),z.side=E0):R.renderBufferDirect(V,N,O,z,E,xt),E.onAfterRender(R,N,V,O,z,xt)}function c1(E){let N=0;for(let V of E)V.texture!==null&&N++;return N}function oi(E,N,V){N.isScene!==!0&&(N=Xt);let O=Ft.get(E),z=T.state.lights,xt=T.state.shadowsArray,At=z.state.version,pt=K.getParameters(E,z.state,xt,N,V,T.state.lightProbeGridArray),St=K.getProgramCacheKey(pt),It=O.programs;O.environment=E.isMeshStandardMaterial||E.isMeshLambertMaterial||E.isMeshPhongMaterial?N.environment:null,O.fog=N.fog;let Vt=E.isMeshStandardMaterial||E.isMeshLambertMaterial&&!E.envMap||E.isMeshPhongMaterial&&!E.envMap;O.envMap=A.get(E.envMap||O.environment,Vt),O.envMapRotation=O.environment!==null&&E.envMap===null?N.environmentRotation:E.envMapRotation,It===void 0&&(E.addEventListener("dispose",de),It=new Map,O.programs=It,O.programVariants=new Map);let jt=It.get(St);if(jt!==void 0){if(O.currentProgram===jt&&O.lightsStateVersion===At)return u1(E,pt),jt}else pt.uniforms=K.getUniforms(E),F!==null&&E.isNodeMaterial&&F.build(E,V,pt),E.onBeforeCompile(pt,R),jt=K.acquireProgram(pt,St),It.set(St,jt),O.uniforms=pt.uniforms;let Rt=O.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Rt.clippingPlanes=J.uniform),u1(E,pt),O.needsLights=N3(E),O.lightsStateVersion=At,O.needsLights&&(Rt.ambientLightColor.value=z.state.ambient,Rt.lightProbe.value=z.state.probe,Rt.sunLights.value=z.state.sun,Rt.sunLightShadows.value=z.state.sunShadow,Rt.directionalLights.value=z.state.directional,Rt.directionalLightShadows.value=z.state.directionalShadow,Rt.spotLights.value=z.state.spot,Rt.spotLightShadows.value=z.state.spotShadow,Rt.rectAreaLights.value=z.state.rectArea,Rt.ltc_1.value=z.state.rectAreaLTC1,Rt.ltc_2.value=z.state.rectAreaLTC2,Rt.pointLights.value=z.state.point,Rt.pointLightShadows.value=z.state.pointShadow,Rt.hemisphereLights.value=z.state.hemi,Rt.sunShadowMatrix.value=z.state.sunShadowMatrix,Rt.sunShadowCascade.value=z.state.sunShadowCascade,Rt.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Rt.spotLightMatrix.value=z.state.spotLightMatrix,Rt.spotLightMap.value=z.state.spotLightMap,Rt.pointShadowMatrix.value=z.state.pointShadowMatrix),O.numLightProbeGrids=c1(T.state.lightProbeGridArray),O.currentProgram=jt,O.uniformsList=null,jt}function P3(E,N,V,O,z){let xt=Ft.get(E),At=xt.currentProgram.id+","+O+","+z,pt=xt.programVariants.get(At);return pt===void 0?(pt=oi(E,N,V),xt.programVariants.set(At,pt)):(xt.currentProgram=pt,xt.uniformsList=null,xt.outputColorSpace=O,xt.toneMapping=z),pt}function h1(E){if(E.uniformsList===null){let N=E.currentProgram.getUniforms();E.uniformsList=ri.seqWithValue(N.seq,E.uniforms)}return E.uniformsList}function u1(E,N){let V=Ft.get(E);V.outputColorSpace=N.outputColorSpace,V.batching=N.batching,V.batchingColor=N.batchingColor,V.instancing=N.instancing,V.instancingColor=N.instancingColor,V.instancingMorph=N.instancingMorph,V.skinning=N.skinning,V.morphTargets=N.morphTargets,V.morphNormals=N.morphNormals,V.morphColors=N.morphColors,V.morphTargetsCount=N.morphTargetsCount,V.numClippingPlanes=N.numClippingPlanes,V.numIntersection=N.numClipIntersection,V.vertexAlphas=N.vertexAlphas,V.vertexTangents=N.vertexTangents,V.toneMapping=N.toneMapping}function L3(E,N,V,O,z){N.isScene!==!0&&(N=Xt),kt.resetTextureUnits();let xt=N.fog,At=O.isMeshStandardMaterial||O.isMeshLambertMaterial||O.isMeshPhongMaterial?N.environment:null,pt=et===null?R.outputColorSpace:et.isXRRenderTarget===!0?et.texture.colorSpace:ee.workingColorSpace,St=O.isMeshStandardMaterial||O.isMeshLambertMaterial&&!O.envMap||O.isMeshPhongMaterial&&!O.envMap,It=A.get(O.envMap||At,St),Vt=O.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,jt=!!V.attributes.tangent&&(!!O.normalMap||O.anisotropy>0),Rt=!!V.morphAttributes.position,te=!!V.morphAttributes.normal,Se=!!V.morphAttributes.color,me=T0;O.toneMapped&&(et===null||et.isXRRenderTarget===!0)&&(me=R.toneMapping);let pe=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,Ue=pe!==void 0?pe.length:0,Ct=Ft.get(O),He=T.state.lights;if(lt===!0&&(bt===!0||E!==Q)){let ye=E===Q&&O.id===W;J.setState(O,E,ye)}let le=!1,ln=!1;O.version===Ct.__version?Ct.needsLights&&Ct.lightsStateVersion!==He.state.version||z.isBatchedMesh&&Ct.batching===!1||!z.isBatchedMesh&&Ct.batching===!0||z.isBatchedMesh&&Ct.batchingColor===!0&&z._colorsTexture===null||z.isBatchedMesh&&Ct.batchingColor===!1&&z._colorsTexture!==null||z.isInstancedMesh&&Ct.instancing===!1||!z.isInstancedMesh&&Ct.instancing===!0||z.isSkinnedMesh&&Ct.skinning===!1||!z.isSkinnedMesh&&Ct.skinning===!0||z.isInstancedMesh&&Ct.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Ct.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Ct.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Ct.instancingMorph===!1&&z.morphTexture!==null||Ct.envMap!==It||O.fog===!0&&Ct.fog!==xt||Ct.numClippingPlanes!==void 0&&(Ct.numClippingPlanes!==J.numPlanes||Ct.numIntersection!==J.numIntersection)||Ct.vertexAlphas!==Vt||Ct.vertexTangents!==jt||Ct.morphTargets!==Rt||Ct.morphNormals!==te||Ct.morphColors!==Se||Ct.morphTargetsCount!==Ue||Ct.numLightProbeGrids!==c1(T.state.lightProbeGridArray)?le=!0:(Ct.outputColorSpace!==pt||Ct.toneMapping!==me)&&(ln=!0):(le=!0,Ct.__version=O.version);let Fe=Ct.currentProgram;(le===!0||ln===!0)&&(Fe=ln===!0?P3(O,N,z,pt,me):oi(O,N,z),F&&O.isNodeMaterial&&F.onUpdateProgram(O,Fe,Ct));let _s=!1,V0=!1,cn=!1,re=Fe.getUniforms(),De=Ct.uniforms;if(gt.useProgram(Fe.program)&&(_s=!0,V0=!0,cn=!0),O.id!==W&&(W=O.id,V0=!0),_s||Q!==E){gt.buffers.depth.getReversed()&&E.reversedDepth!==!0&&(E._reversedDepth=!0,E.updateProjectionMatrix()),re.setValue(D,"projectionMatrix",E.projectionMatrix),re.setValue(D,"viewMatrix",E.matrixWorldInverse);let Ce=re.map.cameraPosition;Ce!==void 0&&Ce.setValue(D,Gt.setFromMatrixPosition(E.matrixWorld)),he.logarithmicDepthBuffer&&re.setValue(D,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(O.isMeshPhongMaterial||O.isMeshToonMaterial||O.isMeshLambertMaterial||O.isMeshBasicMaterial||O.isMeshStandardMaterial||O.isShaderMaterial)&&re.setValue(D,"isOrthographic",E.isOrthographicCamera===!0),Q!==E&&(Q=E,V0=!0,cn=!0)}if(Ct.needsLights&&(He.state.sunShadowMap.length>0&&re.setValue(D,"sunShadowMap",He.state.sunShadowMap,kt),He.state.directionalShadowMap.length>0&&re.setValue(D,"directionalShadowMap",He.state.directionalShadowMap,kt),He.state.spotShadowMap.length>0&&re.setValue(D,"spotShadowMap",He.state.spotShadowMap,kt),He.state.pointShadowMap.length>0&&re.setValue(D,"pointShadowMap",He.state.pointShadowMap,kt)),z.isSkinnedMesh){re.setOptional(D,z,"bindMatrix"),re.setOptional(D,z,"bindMatrixInverse");let ye=z.skeleton;ye&&(ye.boneTexture===null&&ye.computeBoneTexture(),re.setValue(D,"boneTexture",ye.boneTexture,kt))}z.isBatchedMesh&&(re.setOptional(D,z,"batchingTexture"),re.setValue(D,"batchingTexture",z._matricesTexture,kt),re.setOptional(D,z,"batchingIdTexture"),re.setValue(D,"batchingIdTexture",z._indirectTexture,kt),re.setOptional(D,z,"batchingColorTexture"),z._colorsTexture!==null&&re.setValue(D,"batchingColorTexture",z._colorsTexture,kt));let l0=V.morphAttributes;if((l0.position!==void 0||l0.normal!==void 0||l0.color!==void 0)&&$.update(z,V,Fe),(V0||Ct.receiveShadow!==z.receiveShadow)&&(Ct.receiveShadow=z.receiveShadow,re.setValue(D,"receiveShadow",z.receiveShadow)),(O.isMeshStandardMaterial||O.isMeshLambertMaterial||O.isMeshPhongMaterial)&&O.envMap===null&&N.environment!==null&&(De.envMapIntensity.value=N.environmentIntensity),De.dfgLUT!==void 0&&(De.dfgLUT.value=Vd()),V0){if(re.setValue(D,"toneMappingExposure",R.toneMappingExposure),Ct.needsLights&&D3(De,cn),xt&&O.fog===!0&&ht.refreshFogUniforms(De,xt),ht.refreshMaterialUniforms(De,O,yt,Lt,T.state.transmissionRenderTarget[E.id]),Ct.needsLights&&Ct.numLightProbeGrids>0){let ye=x,Ce=0;for(let R0 of T.state.lightProbeGridArray)R0.texture!==null&&(ye.textures[Ce]=R0.texture,ye.min[Ce]=R0.boundingBox.min,ye.max[Ce]=R0.boundingBox.max,ye.resolution[Ce]=R0.resolution,Ce++);for(let R0 in ye)ye[R0].length=Ce;De.probesSH.value=ye.textures,De.probesMin.value=ye.min,De.probesMax.value=ye.max,De.probesResolution.value=ye.resolution}ri.upload(D,h1(Ct),De,kt)}if(O.isShaderMaterial&&O.uniformsNeedUpdate===!0&&(ri.upload(D,h1(Ct),De,kt),O.uniformsNeedUpdate=!1),O.isSpriteMaterial&&re.setValue(D,"center",z.center),re.setValue(D,"modelViewMatrix",z.modelViewMatrix),re.setValue(D,"normalMatrix",z.normalMatrix),re.setValue(D,"modelMatrix",z.matrixWorld),O.uniformsGroups!==void 0){let ye=O.uniformsGroups;for(let Ce=0,R0=ye.length;Ce<R0;Ce++){let f1=ye[Ce];Dt.update(f1,Fe),Dt.bind(f1,Fe)}}return Fe}function D3(E,N){E.ambientLightColor.needsUpdate=N,E.lightProbe.needsUpdate=N,E.sunLights.needsUpdate=N,E.sunLightShadows.needsUpdate=N,E.directionalLights.needsUpdate=N,E.directionalLightShadows.needsUpdate=N,E.pointLights.needsUpdate=N,E.pointLightShadows.needsUpdate=N,E.spotLights.needsUpdate=N,E.spotLightShadows.needsUpdate=N,E.rectAreaLights.needsUpdate=N,E.hemisphereLights.needsUpdate=N}function N3(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return X},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return et},this.setRenderTargetTextures=function(E,N,V){let O=Ft.get(E);O.__autoAllocateDepthBuffer=E.resolveDepthBuffer===!1,O.__autoAllocateDepthBuffer===!1&&(O.__useRenderToTexture=!1),Ft.get(E.texture).__webglTexture=N,Ft.get(E.depthTexture).__webglTexture=O.__autoAllocateDepthBuffer?void 0:V,O.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(E,N){let V=Ft.get(E);V.__webglFramebuffer=N,V.__useDefaultFramebuffer=N===void 0},this.setRenderTarget=function(E,N=0,V=0){et=E,X=N,k=V;let O=null,z=!1,xt=!1;if(E){let pt=Ft.get(E);if(pt.__useDefaultFramebuffer!==void 0){gt.bindFramebuffer(D.FRAMEBUFFER,pt.__webglFramebuffer),tt.copy(E.viewport),Tt.copy(E.scissor),rt=E.scissorTest,gt.viewport(tt),gt.scissor(Tt),gt.setScissorTest(rt),W=-1;return}else if(pt.__webglFramebuffer===void 0)kt.setupRenderTarget(E);else if(pt.__hasExternalTextures)kt.rebindTextures(E,Ft.get(E.texture).__webglTexture,Ft.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){let Vt=E.depthTexture;if(pt.__boundDepthTexture!==Vt){if(Vt!==null&&Ft.has(Vt)&&(E.width!==Vt.image.width||E.height!==Vt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");kt.setupDepthRenderbuffer(E)}}let St=E.texture;(St.isData3DTexture||St.isDataArrayTexture||St.isCompressedArrayTexture)&&(xt=!0);let It=Ft.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(It[N])?O=It[N][V]:O=It[N],z=!0):E.samples>0&&kt.useMultisampledRTT(E)===!1?O=Ft.get(E).__webglMultisampledFramebuffer:Array.isArray(It)?O=It[V]:O=It,tt.copy(E.viewport),Tt.copy(E.scissor),rt=E.scissorTest}else tt.copy(Ut).multiplyScalar(yt).floor(),Tt.copy(Wt).multiplyScalar(yt).floor(),rt=Yt;if(V!==0&&(O=H),gt.bindFramebuffer(D.FRAMEBUFFER,O)&&gt.drawBuffers(E,O),gt.viewport(tt),gt.scissor(Tt),gt.setScissorTest(rt),z){let pt=Ft.get(E.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+N,pt.__webglTexture,V)}else if(xt){let pt=N;for(let St=0;St<E.textures.length;St++){let It=Ft.get(E.textures[St]);D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0+St,It.__webglTexture,V,pt)}}else if(E!==null&&V!==0){let pt=Ft.get(E.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,pt.__webglTexture,V)}W=-1};function d1(E){let N=Ft.get(E);return(N.__readFormat!==E.format||N.__readType!==E.type)&&(N.__readFormat=E.format,N.__readType=E.type,N.__formatReadable=he.textureFormatReadable(E.format),N.__typeReadable=he.textureTypeReadable(E.type)),N}this.readRenderTargetPixels=function(E,N,V,O,z,xt,At,pt=0){if(!(E&&E.isWebGLRenderTarget)){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let St=Ft.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&At!==void 0&&(St=St[At],Array.isArray(St)&&(St=St[0])),St){gt.bindFramebuffer(D.FRAMEBUFFER,St);try{let It=E.textures[pt],Vt=It.format,jt=It.type;E.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+pt);let Rt=d1(It);if(Rt.__formatReadable===!1){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Rt.__typeReadable===!1){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}N>=0&&N<=E.width-O&&V>=0&&V<=E.height-z&&D.readPixels(N,V,O,z,at.convert(Vt),at.convert(jt),xt)}finally{let It=et!==null?Ft.get(et).__webglFramebuffer:null;gt.bindFramebuffer(D.FRAMEBUFFER,It)}}},this.readRenderTargetPixelsAsync=async function(E,N,V,O,z,xt,At,pt=0){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let St=Ft.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&At!==void 0&&(St=St[At],Array.isArray(St)&&(St=St[0])),St)if(N>=0&&N<=E.width-O&&V>=0&&V<=E.height-z){gt.bindFramebuffer(D.FRAMEBUFFER,St);let It=E.textures[pt],Vt=It.format,jt=It.type;E.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+pt);let Rt=d1(It);if(Rt.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Rt.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let te=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,te),D.bufferData(D.PIXEL_PACK_BUFFER,xt.byteLength,D.STREAM_READ),D.readPixels(N,V,O,z,at.convert(Vt),at.convert(jt),0),D.bindBuffer(D.PIXEL_PACK_BUFFER,null);let Se=et!==null?Ft.get(et).__webglFramebuffer:null;gt.bindFramebuffer(D.FRAMEBUFFER,Se);let me=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await B2(D,me,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,te),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,xt),D.bindBuffer(D.PIXEL_PACK_BUFFER,null),D.deleteBuffer(te),D.deleteSync(me),xt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(E,N=null,V=0){let O=Math.pow(2,-V),z=Math.floor(E.image.width*O),xt=Math.floor(E.image.height*O),At=N!==null?N.x:0,pt=N!==null?N.y:0;kt.setTexture2D(E,0),D.copyTexSubImage2D(D.TEXTURE_2D,V,0,0,At,pt,z,xt),gt.unbindTexture()},this.copyTextureToTexture=function(E,N,V=null,O=null,z=0,xt=0){let At,pt,St,It,Vt,jt,Rt,te,Se,me=E.isCompressedTexture?E.mipmaps[xt]:E.image;if(V!==null)At=V.max.x-V.min.x,pt=V.max.y-V.min.y,St=V.isBox3?V.max.z-V.min.z:1,It=V.min.x,Vt=V.min.y,jt=V.isBox3?V.min.z:0;else{let re=Math.pow(2,-z);At=Math.floor(me.width*re),pt=Math.floor(me.height*re),E.isDataArrayTexture?St=me.depth:E.isData3DTexture?St=Math.floor(me.depth*re):St=1,It=0,Vt=0,jt=0}O!==null?(Rt=O.x,te=O.y,Se=O.z):(Rt=0,te=0,Se=0);let pe=at.convert(N.format),Ue=at.convert(N.type),Ct;N.isData3DTexture?(kt.setTexture3D(N,0),Ct=D.TEXTURE_3D):N.isDataArrayTexture||N.isCompressedArrayTexture?(kt.setTexture2DArray(N,0),Ct=D.TEXTURE_2D_ARRAY):(kt.setTexture2D(N,0),Ct=D.TEXTURE_2D),gt.activeTexture(D.TEXTURE0),gt.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,N.flipY),gt.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,N.premultiplyAlpha),gt.pixelStorei(D.UNPACK_ALIGNMENT,N.unpackAlignment);let He=gt.getParameter(D.UNPACK_ROW_LENGTH),le=gt.getParameter(D.UNPACK_IMAGE_HEIGHT),ln=gt.getParameter(D.UNPACK_SKIP_PIXELS),Fe=gt.getParameter(D.UNPACK_SKIP_ROWS),_s=gt.getParameter(D.UNPACK_SKIP_IMAGES);gt.pixelStorei(D.UNPACK_ROW_LENGTH,me.width),gt.pixelStorei(D.UNPACK_IMAGE_HEIGHT,me.height),gt.pixelStorei(D.UNPACK_SKIP_PIXELS,It),gt.pixelStorei(D.UNPACK_SKIP_ROWS,Vt),gt.pixelStorei(D.UNPACK_SKIP_IMAGES,jt);let V0=E.isDataArrayTexture||E.isData3DTexture,cn=N.isDataArrayTexture||N.isData3DTexture;if(E.isDepthTexture){let re=Ft.get(E),De=Ft.get(N),l0=Ft.get(re.__renderTarget),ye=Ft.get(De.__renderTarget);gt.bindFramebuffer(D.READ_FRAMEBUFFER,l0.__webglFramebuffer),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,ye.__webglFramebuffer);for(let Ce=0;Ce<St;Ce++)V0&&(D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Ft.get(E).__webglTexture,z,jt+Ce),D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Ft.get(N).__webglTexture,xt,Se+Ce)),D.blitFramebuffer(It,Vt,It+At,Vt+pt,Rt,te,Rt+At,te+pt,D.DEPTH_BUFFER_BIT,D.NEAREST);gt.bindFramebuffer(D.READ_FRAMEBUFFER,null),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else if(z!==0||E.isRenderTargetTexture||Ft.has(E)){let re=Ft.get(E),De=Ft.get(N);gt.bindFramebuffer(D.READ_FRAMEBUFFER,P),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,G);for(let l0=0;l0<St;l0++)V0?D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,re.__webglTexture,z,jt+l0):D.framebufferTexture2D(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,re.__webglTexture,z),cn?D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,De.__webglTexture,xt,Se+l0):D.framebufferTexture2D(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,De.__webglTexture,xt),z!==0?D.blitFramebuffer(It,Vt,It+At,Vt+pt,Rt,te,Rt+At,te+pt,D.COLOR_BUFFER_BIT,D.NEAREST):cn?D.copyTexSubImage3D(Ct,xt,Rt,te,Se+l0,It,Vt,At,pt):D.copyTexSubImage2D(Ct,xt,Rt,te,It,Vt,At,pt);gt.bindFramebuffer(D.READ_FRAMEBUFFER,null),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else cn?E.isDataTexture||E.isData3DTexture?D.texSubImage3D(Ct,xt,Rt,te,Se,At,pt,St,pe,Ue,me.data):N.isCompressedArrayTexture?D.compressedTexSubImage3D(Ct,xt,Rt,te,Se,At,pt,St,pe,me.data):D.texSubImage3D(Ct,xt,Rt,te,Se,At,pt,St,pe,Ue,me):E.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,xt,Rt,te,At,pt,pe,Ue,me.data):E.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,xt,Rt,te,me.width,me.height,pe,me.data):D.texSubImage2D(D.TEXTURE_2D,xt,Rt,te,At,pt,pe,Ue,me);gt.pixelStorei(D.UNPACK_ROW_LENGTH,He),gt.pixelStorei(D.UNPACK_IMAGE_HEIGHT,le),gt.pixelStorei(D.UNPACK_SKIP_PIXELS,ln),gt.pixelStorei(D.UNPACK_SKIP_ROWS,Fe),gt.pixelStorei(D.UNPACK_SKIP_IMAGES,_s),xt===0&&N.generateMipmaps===!0&&N.mipmapsAutoUpdate===!0&&D.generateMipmap(Ct),gt.unbindTexture()},this.initRenderTarget=function(E){Ft.get(E).__webglFramebuffer===void 0&&kt.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?kt.setTextureCube(E,0):E.isData3DTexture?kt.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?kt.setTexture2DArray(E,0):kt.setTexture2D(E,0),gt.unbindTexture()},this.resetState=function(){X=0,k=0,et=null,gt.reset(),ut.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return a0}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=ee._getDrawingBufferColorSpace(t),e.unpackColorSpace=ee._getUnpackColorSpace()}};function n1(i,t=!1){let e=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),s=new Set(Object.keys(i[0].morphAttributes)),r={},a={},o=i[0].morphTargetsRelative,l=new Te;l.morphTargetsRelative=o;let c=0;for(let h=0;h<i.length;++h){let u=i[h],d=0,f=0;if(e!==(u.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let _ in u.attributes){if(!n.has(_))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+_+'" attribute exists among all geometries, or in none of them.'),null;r[_]===void 0&&(r[_]=[]),r[_].push(u.attributes[_]),d++}if(d!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(o!==u.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let _ in u.morphAttributes){if(!s.has(_))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;if(u.morphAttributes[_].length!==i[0].morphAttributes[_].length)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have the same number of morph targets for the "'+_+'" morph attribute.'),null;a[_]===void 0&&(a[_]=[]),a[_].push(u.morphAttributes[_]),f++}if(f!==s.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of morph attributes."),null;if(t){let _;if(e)_=u.index.count;else if(u.attributes.position!==void 0)_=u.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,_,h),c+=_}}if(e){let h=0,u=[];for(let d=0;d<i.length;++d){let f=i[d].index;for(let _=0;_<f.count;++_)u.push(f.getX(_)+h);h+=i[d].attributes.position.count}l.setIndex(u)}for(let h in r){let u=A3(r[h]);if(!u)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,u)}for(let h in a){let u=a[h][0].length;if(u!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let d=0;d<u;++d){let f=[];for(let v=0;v<a[h].length;++v)f.push(a[h][v][d]);let _=A3(f);if(!_)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(_)}}}return l}function A3(i){let t,e,n,s=-1,r=0;for(let c=0;c<i.length;++c){let h=i[c];if(t===void 0&&(t=h.array.constructor),t!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=h.itemSize),e!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=h.gpuType),s!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*e}let a=new t(r),o=new Ne(a,e,n),l=0;for(let c=0;c<i.length;++c){let h=i[c];if(h.isInterleavedBufferAttribute){let u=l/e;for(let d=0,f=h.count;d<f;d++)for(let _=0;_<e;_++){let v=h.getComponent(d,_);o.setComponent(d+u,_,v)}}else a.set(h.array,l);l+=h.count*e}return s!==void 0&&(o.gpuType=s),o}var bn=new Float32Array([-.04168,.1786,-.10892,-.03732,.17778,-.10928,-.0419,.17759,-.10891,-.03715,.17849,-.10952,-.04184,.18089,-.10847,-.03714,.17947,-.1094,-.04177,.17958,-.10874,-.03696,.18079,-.10924,-.04589,.17798,-.10806,-.04619,.17896,-.10766,-.04663,.1801,-.10716,-.04985,.17772,-.1062,-.05076,.17868,-.10532,-.04924,.1769,-.10667,-.05236,.17626,-.10472,-.05354,.17695,-.1038,-.05154,.17572,-.10537,-.05368,.17502,-.10349,-.05498,.17537,-.10217,-.0527,.1746,-.10428,-.05425,.17389,-.10258,-.05566,.17401,-.10104,-.05326,.17374,-.10334,-.05437,.17276,-.10154,-.05574,.17279,-.1003,-.05338,.17279,-.1026,-.05416,.17172,-.10154,-.05557,.17141,-.10026,-.05314,.17191,-.10247,-.05356,.17057,-.10158,-.05501,.16998,-.10007,-.05266,.17104,-.10258,-.05287,.16955,-.10194,-.05422,.16861,-.10051,-.05197,.17022,-.103,-.04712,.16598,-.10586,-.05084,.16578,-.10356,-.0497,.16712,-.10436,-.04771,.16441,-.10529,-.04686,.16705,-.1063,-.04927,.16814,-.10489,-.03286,.1664,-.1078,-.03716,.16458,-.10777,-.03731,.16606,-.10834,-.03235,.16488,-.10774,-.03793,.16315,-.10811,-.0325,.1636,-.10794,-.02858,.16708,-.10704,-.02798,.16592,-.10718,-.02786,.16459,-.10721,-.02615,.1676,-.10636,-.02544,.16662,-.1065,-.0248,.16555,-.10655,-.03241,.17754,-.10891,-.0327,.17672,-.10866,-.03186,.17972,-.10896,-.03218,.17846,-.10898,-.02718,.17783,-.10853,-.02764,.17678,-.10814,-.028,.17597,-.10772,-.02824,.17516,-.10739,-.02357,.17562,-.10824,-.02419,.17473,-.1079,-.0248,.17405,-.1076,-.02512,.17334,-.10702,-.02146,.17384,-.10807,-.0222,.17329,-.10781,-.02279,.1728,-.10758,-.02342,.17218,-.10654,-.01934,.17114,-.10798,-.02088,.17208,-.10787,-.02014,.17231,-.10807,-.02011,.17113,-.1073,-.0206,.17111,-.10662,-.0218,.17159,-.10602,-.02147,.17191,-.1077,-.02102,.17083,-.10568,-.019,.16987,-.10778,-.01981,.17008,-.10702,-.02045,.17011,-.10586,-.02108,.17005,-.10537,-.01922,.16854,-.10723,-.0201,.16891,-.10664,-.02107,.16918,-.10579,-.02215,.16906,-.10513,-.04844,.16238,-.10388,-.05196,.16404,-.10225,-.02365,.16416,-.10645,-.02694,.1629,-.10721,-.03206,.16159,-.10776,-.03815,.15836,-.10696,-.03814,.16104,-.1076,-.0315,.15912,-.1078,-.05567,.1677,-.09894,-.05641,.16945,-.09868,-.05689,.17117,-.09901,-.05696,.1727,-.09917,-.0568,.17416,-.09979,-.05614,.17567,-.10097,-.05453,.17735,-.10252,-.05141,.17933,-.10454,-.04699,.18096,-.10631,-.04199,.18182,-.10824,-.03688,.18172,-.10901,-.03152,.18066,-.10892,-.0266,.17872,-.10886,-.02282,.17628,-.10854,-.05221,.18002,-.10375,-.05563,.1777,-.10082,-.01927,.17275,-.10848,-.0185,.17128,-.10854,-.01824,.16975,-.10826,-.01864,.16806,-.10739,-.02062,.17443,-.1084,-.01781,.17324,-.1094,-.01924,.17524,-.1093,-.02185,.17747,-.10952,-.01709,.17598,-.11107,-.01552,.1736,-.11096,-.01706,.17144,-.10937,-.01476,.17146,-.11075,-.01691,.16957,-.10909,-.0147,.16921,-.11042,-.01745,.16736,-.10795,-.01559,.16654,-.10992,-.0111,.17791,-.11641,-.01266,.17401,-.11339,-.01422,.17678,-.11356,-.00974,.17483,-.1164,-.00908,.17161,-.11623,-.01204,.1688,-.11294,-.01193,.17141,-.11314,-.00936,.16844,-.11612,-.01307,.1656,-.11238,-.01063,.1646,-.11527,-.00762,.17876,-.11902,-.0066,.17544,-.11892,-.00618,.17204,-.11886,-.00655,.16831,-.1189,-.00799,.16334,-.1186,-.0039,.17957,-.12055,-.00342,.17614,-.12038,-.00774,.15846,-.12092,-.00384,.16524,-.12174,-.00398,.16051,-.12334,-.00325,.17251,-.12053,-.00343,.16889,-.12113,0,.18014,-.12089,0,.17677,-.12068,0,.16596,-.12268,0,.16156,-.12437,0,.17299,-.1209,0,.16931,-.12167,-.03106,.15617,-.10931,-.03847,.15515,-.10812,-.0247,.15826,-.10915,-.02574,.16081,-.10721,-.02092,.16054,-.10884,-.02221,.1625,-.10667,-.05152,.15679,-.10214,-.0533,.1619,-.10014,-.04955,.15995,-.10247,-.05555,.15917,-.09893,-.06068,.17248,-.09594,-.05809,.17417,-.09834,-.05838,.17262,-.09785,-.06028,.17435,-.09654,-.06058,.16789,-.09539,-.0584,.1709,-.09757,-.05809,.16876,-.09719,-.06074,.17036,-.09545,-.05741,.17579,-.09928,-.0592,.17627,-.09752,-.05701,.1785,-.09959,-.05332,.18083,-.10265,-.0474,.18188,-.1059,-.0481,.18299,-.10584,-.03004,.18326,-.11044,-.02588,.17972,-.10944,-.03112,.18166,-.10927,-.02428,.18108,-.11098,-.04202,.18286,-.10799,-.04223,.18427,-.10826,-.03625,.18439,-.10956,-.03671,.18281,-.10888,-.01985,.17856,-.11114,-.01338,.18124,-.1164,-.01688,.17987,-.11352,-.00936,.18244,-.11918,-.00458,.1832,-.12059,0,.18384,-.1211,-.02458,.18866,-.11534,-.0214,.18314,-.11378,-.02789,.18578,-.11282,-.01782,.18522,-.11632,-.03329,.19,-.11255,-.03514,.18708,-.11086,-.04967,.18793,-.10535,-.04226,.18676,-.10866,-.04903,.18508,-.10561,-.042,.18961,-.10933,-.05626,.18499,-.10079,-.05494,.18232,-.10156,-.06695,.16868,-.08983,-.06347,.17225,-.09356,-.06361,.16964,-.09299,-.06652,.1721,-.09047,-.06289,.17453,-.09425,-.06582,.1751,-.09142,-.06646,.16504,-.08954,-.0634,.16664,-.09272,-.06168,.17687,-.09553,-.06419,.17834,-.09335,-.05906,.17954,-.098,-.06104,.18167,-.09665,-.05725,.18833,-.10004,-.04979,.19162,-.10546,-.06293,.18431,-.09508,-.0307,.19422,-.11464,-.01938,.19286,-.11869,-.01276,.1872,-.11921,-.06988,.16769,-.08604,-.0691,.17206,-.08675,-.06814,.17615,-.08836,-.06977,.1633,-.08612,-.06601,.18025,-.09097,-.0408,.19363,-.11036,-.06916,.15889,-.087,-.0656,.16121,-.09024,-.00592,.18833,-.12131,0,.18919,-.12206,-.058,.19218,-.09907,-.05026,.19583,-.10519,-.04048,.19819,-.11078,-.02993,.19949,-.11585,-.00818,.19376,-.12184,0,.19397,-.12289,-.01844,.19974,-.12032,-.00803,.19984,-.12258,-.04058,.20293,-.11089,-.02964,.2044,-.1163,-.05902,.19603,-.09784,-.05076,.20021,-.10471,0,.1999,-.12353,-.0177,.20496,-.12086,-.00763,.20494,-.1231,0,.20522,-.12402,-.07172,.22417,-.07606,-.05869,.22626,-.09389,-.06931,.21829,-.0824,-.06156,.23395,-.08803,-.04544,.232,-.1024,-.04775,.24042,-.09772,-.03232,.23612,-.10974,-.03353,.24514,-.1064,-.07249,.16153,-.08162,-.07243,.16693,-.08143,-.07199,.17221,-.08252,-.07031,.17718,-.08474,-.06774,.18252,-.08824,-.06408,.18745,-.09325,-.07208,.15629,-.08294,-.06919,.18458,-.08498,-.06493,.19057,-.09088,-.072,.17843,-.08029,-.07396,.17228,-.07721,-.07964,.20028,-.05516,-.07495,.20803,-.07106,-.0779,.19726,-.06089,-.07727,.21251,-.06505,-.08005,.2178,-.05759,-.07463,.23081,-.06906,-.06622,.21254,-.08735,-.07276,.20387,-.07648,-.08111,.187,-.0475,-.08162,.20359,-.04926,-.08218,.18845,-.04295,-.06533,.28751,.01884,-.04954,.30494,-.01973,-.064,.29195,-.01757,-.05234,.30092,.02234,0,.13426,-.14027,-.00449,.13813,-.13721,0,.13835,-.13826,-.00418,.13448,-.13914,-.01469,.13592,-.12986,-.01126,.13992,-.13034,-.01134,.13696,-.13244,-.0138,.1384,-.12683,-.01703,.13427,-.12626,-.01676,.13639,-.12424,-.01076,.14292,-.12716,-.01375,.14101,-.12431,-.01634,.13848,-.12102,-.00797,.14093,-.13294,-.00809,.1377,-.13536,-.00443,.1416,-.13465,0,.14208,-.13572,-.0044,.1453,-.13189,0,.14598,-.13296,-.00764,.1443,-.1298,-.00809,.13448,-.13726,-.01892,.13529,-.11825,-.02052,.12983,-.11857,-.02173,.13117,-.11683,-.0191,.13363,-.1214,-.01046,.12334,-.13436,-.00652,.12128,-.13502,-.00774,.12132,-.13392,-.00946,.12434,-.13638,-.01901,.12599,-.12509,-.01898,.12182,-.12097,-.02024,.12372,-.12086,-.01854,.1244,-.12566,-.00624,.12421,-.13864,-.00238,.12078,-.13613,-.00456,.1212,-.13553,-.0032,.12394,-.1396,-.00515,.11875,-.1323,-.00629,.11954,-.13146,0,.12048,-.13686,0,.12371,-.14014,-.00181,.11765,-.13246,-.00347,.11821,-.13217,-.00515,.11681,-.12924,-.00624,.11772,-.12904,0,.11722,-.1324,-.0015,.11532,-.12888,-.00319,.11591,-.12914,-.00641,.11477,-.12635,-.00692,.11647,-.12626,0,.11464,-.12878,-.01376,.11696,-.12142,-.00989,.114,-.12401,-.01429,.11496,-.12157,-.00967,.11556,-.1238,-.01673,.11864,-.12005,-.01364,.11832,-.12174,-.0156,.11962,-.12125,-.0118,.12266,-.13213,-.01054,.12246,-.13295,-.01214,.12396,-.13333,-.0166,.12172,-.12695,-.0155,.12414,-.12971,-.0146,.12254,-.12965,-.0175,.1227,-.12644,-.01674,.12106,-.12281,-.01814,.1207,-.12271,-.00841,.1213,-.13298,-.00668,.12034,-.13067,-.0069,.11873,-.12859,-.00755,.11794,-.12612,-.00979,.11737,-.124,-.01632,.1257,-.1297,0,.13062,-.14158,-.00354,.12766,-.14088,-.00401,.13109,-.14059,0,.12708,-.14168,-.01294,.12582,-.13345,-.01151,.13405,-.1343,-.01471,.13336,-.13126,-.01927,.1305,-.12416,-.01908,.13202,-.12313,-.01735,.13216,-.12758,-.02033,.12878,-.12167,-.02046,.12918,-.12022,-.01811,.11839,-.11857,-.02849,.12755,-.11461,-.03906,.12311,-.11062,-.03457,.12992,-.11375,-.03293,.12096,-.11317,-.00167,.11308,-.12812,-.00367,.11384,-.12752,0,.11273,-.12752,-.01516,.1216,-.1235,-.01472,.12032,-.12227,-.01314,.11929,-.12244,-.00798,.119,-.1258,-.0069,.12025,-.12761,-.00863,.12214,-.13062,-.01001,.12262,-.1307,-.01518,.12205,-.12622,-.00721,.12163,-.12952,-.01166,.1224,-.13042,-.00982,.1186,-.1242,-.01326,.12305,-.1278,0,.11059,-.12702,-.00222,.11099,-.1278,-.02945,.09988,-.11533,-.03194,.09424,-.11188,-.03277,.09582,-.11153,-.02912,.09716,-.11537,-.02736,.08596,-.11236,-.02267,.0809,-.1158,-.02752,.08466,-.1121,-.02238,.08315,-.11674,-.02981,.08771,-.11042,-.03018,.08676,-.11027,0,.10152,-.13168,-.00212,.10492,-.1289,0,.10459,-.12847,-.00269,.1018,-.1317,0,.10802,-.12762,-.00222,.10842,-.12827,-.01057,.12012,-.1244,-.00953,.12065,-.1254,-.01367,.12239,-.12583,-.01416,.12196,-.12432,-.01217,.12076,-.12382,-.01348,.12146,-.12382,-.00966,.12262,-.12902,-.01036,.12282,-.12949,-.00875,.12222,-.12833,-.01134,.12283,-.12887,-.01249,.12269,-.12769,-.00862,.12145,-.12685,-.0107,.12283,-.12799,-.01164,.12266,-.1268,-.0126,.12223,-.12529,-.00984,.12256,-.1275,-.01027,.12222,-.12644,-.01116,.12163,-.12505,-.02818,.08123,-.11135,-.03126,.08369,-.10945,-.023,.07848,-.11453,-.03119,.09337,-.11225,-.02869,.0955,-.11543,-.00491,.10906,-.12774,-.00449,.11153,-.12712,-.02483,.09659,-.11954,-.02812,.09426,-.1154,-.0253,.09804,-.1195,-.0243,.09536,-.11957,-.02755,.09347,-.11558,-.02692,.09257,-.11534,-.02287,.09294,-.11855,-.02651,.09186,-.11502,-.02352,.09389,-.11885,-.02215,.09176,-.11825,-.0254,.09179,-.11386,-.02074,.09198,-.11622,-.02488,.09205,-.11282,-.03034,.09104,-.11035,-.03078,.09026,-.10942,-.03107,.09115,-.11006,-.03034,.09058,-.10967,-.02993,.09107,-.1103,-.02988,.0908,-.11002,-.02914,.0913,-.10938,-.02957,.09094,-.1097,-.02956,.09113,-.11009,-.02927,.09114,-.10886,-.02891,.09172,-.10788,-.02929,.09144,-.10722,-.02636,.08855,-.11328,-.02911,.08869,-.11076,-.02855,.08941,-.11099,-.02688,.08744,-.11305,-.02609,.09098,-.10849,-.02753,.09082,-.1094,-.02776,.09092,-.10738,-.02528,.09074,-.11113,-.03046,.0925,-.11249,-.02959,.092,-.11248,-.02869,.09172,-.11225,-.02802,.09157,-.11222,-.02728,.09158,-.11177,-.02665,.092,-.11072,-.03294,.09107,-.1096,-.03168,.08968,-.10954,-.03257,.08921,-.10926,-.03202,.09107,-.10984,-.02578,.08948,-.11303,-.02807,.09002,-.11101,-.02774,.09049,-.11053,-.0254,.0902,-.11244,-.00551,.10594,-.1292,-.00959,.10423,-.13024,-.00863,.10681,-.12727,-.00618,.10312,-.13146,-.01744,.10073,-.12575,-.02106,.09774,-.1232,-.02138,.09899,-.12347,-.01709,.09943,-.12582,-.01657,.09697,-.12509,-.01951,.09368,-.12221,-.02016,.09564,-.12262,-.01608,.0946,-.1246,-.008,.10963,-.12636,-.01067,.11236,-.12421,-.00725,.11203,-.12569,-.0114,.10998,-.12456,-.0163,.10608,-.12336,-.02144,.10044,-.12282,-.02077,.10384,-.12113,-.01726,.10262,-.1253,-.00942,.09792,-.12931,-.01254,.09502,-.12679,-.01273,.09774,-.12769,-.00924,.09496,-.12788,-.00967,.10256,-.13056,-.01306,.10062,-.12875,-.01326,.10212,-.12844,-.00964,.10135,-.13086,-.00618,.09697,-.12994,-.006,.09422,-.12866,-.00638,.10148,-.13148,-.0064,.10008,-.13146,-.00257,.09611,-.13032,-.00238,.09354,-.1293,-.00276,.10007,-.1319,-.0028,.0989,-.13177,0,.09589,-.13064,0,.09356,-.12934,0,.09991,-.13223,0,.09854,-.13214,-.01546,.09178,-.12433,-.01217,.0916,-.12542,-.00913,.09152,-.12542,-.00559,.09137,-.12586,-.00258,.09114,-.12596,0,.09097,-.12636,-.01309,.10394,-.12785,-.02189,.08728,-.11742,-.02204,.0854,-.11718,-.01966,.09076,-.11503,-.02069,.08999,-.11747,-.02143,.08884,-.11783,-.01555,.07962,-.12139,-.01532,.08287,-.12202,-.01481,.08578,-.12304,-.01435,.08756,-.12298,-.01381,.08914,-.12208,-.01328,.09052,-.12204,-.0062,.08652,-.12635,-.00634,.08453,-.12642,-.00653,.08155,-.12587,-.00643,.07609,-.12157,-.01556,.075,-.11797,-.01573,.07763,-.11935,-.00641,.07338,-.12001,-.00685,.07744,-.125,-.0061,.09013,-.12414,-.00613,.08879,-.12503,-.01904,.09116,-.11316,-.01253,.09084,-.12092,-.0061,.09073,-.12374,-.00881,.09238,-.1214,-.01139,.09238,-.12088,-.00508,.0922,-.12096,-.01313,.09232,-.12004,-.0216,.0905,-.1094,-.01152,.09083,-.11904,0,.09179,-.12173,-.00228,.09218,-.12091,-.02903,.09241,-.10574,-.02995,.0918,-.10487,0,.09323,-.12131,-.00217,.09352,-.12082,-.02472,.0929,-.11155,-.02626,.0928,-.10924,-.00871,.09355,-.12052,-.01118,.09354,-.11986,-.02874,.09072,-.10457,-.02546,.09054,-.10656,-.02057,.08821,-.10688,-.01304,.08897,-.11596,-.00518,.09348,-.12078,-.00662,.09026,-.12126,-.01302,.09348,-.11893,-.02,.09322,-.11453,0,.09596,-.12084,-.00187,.09666,-.1205,-.00463,.09732,-.12016,-.00769,.09775,-.11957,-.00766,.08855,-.11857,-.01036,.09758,-.11816,-.01205,.0974,-.11717,-.02752,.0888,-.10314,-.0241,.08785,-.10454,-.02322,.09568,-.1097,-.02514,.0952,-.10742,-.01877,.09636,-.11274,-.0199,.0841,-.10699,-.0139,.08435,-.11449,-.02963,.09334,-.10361,-.03072,.09203,-.10291,-.02375,.08416,-.10409,-.0298,.09563,-.10276,-.0313,.09247,-.10148,0,.10195,-.12094,-.00184,.10237,-.12062,-.00444,.10261,-.12037,-.00736,.10295,-.11962,-.00742,.08345,-.11821,-.00991,.10306,-.1181,-.01156,.10286,-.1171,-.02744,.08573,-.10222,-.02239,.1005,-.10954,-.02477,.09956,-.10724,-.01844,.10166,-.11236,-.01926,.08052,-.10651,-.01417,.07966,-.11302,-.01918,.07507,-.103,-.01494,.0734,-.10699,-.0234,.08126,-.1034,-.03035,.09814,-.1016,-.03193,.0931,-.10008,0,.10726,-.11999,-.0018,.10764,-.11996,-.00426,.10813,-.11966,-.007,.10837,-.11898,-.00706,.07891,-.1174,-.00942,.10828,-.11762,-.01106,.10808,-.11662,-.0274,.08354,-.10124,-.0218,.1053,-.1091,-.02453,.10399,-.10674,-.01754,.10632,-.11206,-.00989,.04656,-.02203,0,.05454,-.01439,0,.04499,-.023,-.00779,.05599,-.01378,-.02184,.11101,-.107,-.02498,.10925,-.10476,-.01778,.1128,-.10954,-.00889,.06701,-.06252,0,.06494,-.06337,-.00691,.11504,-.11605,-.00944,.11506,-.11479,-.02048,.07003,-.09539,-.01487,.06887,-.09869,-.0236,.07686,-.10049,-.00755,.0654,-.08216,0,.06227,-.08387,-.0318,.10128,-.09928,-.03335,.09378,-.09752,0,.11315,-.11618,-.00167,.11384,-.11676,-.00731,.06607,-.10165,0,.06655,-.10055,-.0039,.11459,-.11666,-.00544,.07217,-.11173,-.01114,.11477,-.11383,-.02789,.08039,-.0984,0,.12173,-.10554,-.0014,.12274,-.10619,0,.07232,-.11084,-.00409,.12378,-.10607,-.00707,.12438,-.10559,-.01037,.12424,-.10468,-.0121,.12379,-.10403,-.03031,.07788,-.09208,-.02532,.07289,-.09354,-.0235,.11861,-.09964,-.02728,.11606,-.0981,-.01926,.12103,-.10086,0,.07894,-.1196,-.02297,.07088,-.08038,-.01661,.06769,-.08141,0,.08239,-.12072,-.03498,.10499,-.09356,-.03649,.09529,-.09198,-.02783,.07381,-.07946,0,.08723,-.11957,-.03802,.10846,-.08105,-.03918,.09708,-.07984,0,.12953,-.08862,-.00157,.13108,-.0888,0,.0903,-.12103,-.00479,.13248,-.08848,-.00804,.13322,-.08813,-.01146,.13298,-.08773,-.0133,.13237,-.08738,-.03266,.07669,-.07948,-.02528,.12587,-.08584,-.02944,.12287,-.08536,-.02191,.12798,-.08605,0,.09068,-.12325,-.01794,.0687,-.06191,-.02546,.07033,-.06108,-.02048,.05104,-.02537,-.02942,.05669,-.02963,-.03034,.0739,-.06074,0,.09017,-.12475,-.04295,.11189,-.06134,-.04363,.09895,-.06028,0,.13286,-.06569,-.00174,.13456,-.06456,0,.08862,-.12614,-.00601,.13624,-.06401,-.01033,.13724,-.0637,-.01468,.13726,-.06361,-.01867,.13562,-.06335,-.03551,.07668,-.0619,-.03043,.13001,-.06316,-.0347,.12677,-.06284,-.02684,.1323,-.06322,0,.08683,-.12712,0,.12918,-.0423,-.00192,.13081,-.04139,0,.08476,-.12788,-.00601,.132,-.04009,-.01001,.13271,-.03967,-.01415,.13266,-.03953,-.01776,.13092,-.03958,-.03576,.07684,-.03872,-.0333,.06498,-.03655,-.02977,.12587,-.03914,-.03439,.12229,-.03876,-.02584,.12833,-.03931,0,.08125,-.12739,-.01355,.05864,-.01298,-.01996,.0633,-.0132,0,.07662,-.12678,-.04322,.1083,-.03716,-.04208,.09774,-.0368,-.02594,.11416,-.01872,-.03068,.11162,-.01787,-.02174,.1159,-.01932,-.00824,.11891,-.02022,-.0112,.11887,-.02011,-.02491,.07039,-.01236,-.03868,.102,-.01596,-.03702,.09528,-.01336,0,.11692,-.02267,-.00203,.11755,-.02132,-.00454,.11836,-.02058,-.01439,.11767,-.02041,-.0258,.08072,-.01226,-.01998,.08606,-.00834,-.01796,.08389,-.00881,-.00989,.08158,-.00946,-.0148,.08191,-.00835,0,.08107,-.01048,-.00534,.08018,-.00893,-.01814,.0991,-.00854,-.02002,.0983,-.0083,-.01693,.1016,-.00823,-.01752,.11653,-.02071,-.01369,.10243,-.00809,-.0274,.09584,-.00722,-.02544,.09163,-.00767,0,.09965,-.01068,-.00209,.10008,-.0105,-.00378,.10212,-.00853,-.00625,.10244,-.0083,-.0088,.10057,-.00866,-.01085,.10056,-.00859,-.01948,.23848,-.11434,-.01883,.24731,-.11148,-.00644,.06973,-.11801,-.0155,.07166,-.1161,-.03678,.09053,-.10764,-.03463,.08803,-.10828,-.03631,.08713,-.10714,-.03456,.09104,-.10903,-.02849,.07816,-.11063,-.03232,.08111,-.10847,-.02308,.07469,-.11281,-.00766,.03816,-.10092,-.01652,.04028,-.09094,-.01732,.04043,-.09817,-.00708,.0381,-.0944,-.05694,.06985,-.05261,-.06454,.08114,-.04907,-.06006,.07433,-.05869,-.06148,.077,-.04396,-.05387,.07715,-.01096,-.06071,.09061,-.00437,-.05861,.08438,-.01502,-.05609,.08137,-78e-5,-.04883,.06406,-.00517,-.05293,.06925,.00385,-.04885,.04776,.00191,-.05195,.05382,.00995,-.0503,.02953,.01056,-.05192,.03266,.01937,-.05498,.00962,.02033,-.05794,.01403,.02932,-.04628,.06482,-.02554,-.05557,.07684,-.02476,-.05172,.06996,-.03314,-.0503,.07008,-.01902,-.04099,.05564,-.01648,-.0449,.06092,-.01032,-.04024,.03995,-.00884,-.0455,.04358,-.00496,-.04445,.02291,-.00422,-.04734,.02602,.00263,-.04898,.00528,.00406,-.05274,.00733,.0118,-.06955,.09152,-.03913,-.06632,.08749,-.03376,-.01572,.04039,-.08245,-.00674,.03893,-.07589,-.01486,.04163,-.07172,-.0066,.03792,-.08623,-.00624,.03949,-.06132,-.01324,.04124,-.05815,-.00454,.03774,-.04186,-.00978,.03871,-.04002,-.00343,.02675,-.02936,-.00784,.02717,-.02802,-.01907,.01321,-.01849,-.01318,.02744,-.02681,-.0137,.01144,-.02176,-.01835,.02839,-.02443,-.00407,.01,-.02501,-.0088,.01027,-.02388,-.02597,.04255,-.03101,-.02118,.0409,-.03397,-.02309,.03023,-.02113,-.04482,.00257,-.00294,-.03966,.01997,-.00869,-.03521,.03672,-.01187,0,.03738,-.0422,0,.03824,-.06362,-.05315,.06456,-.06014,-.05497,.06774,-.06599,-.06487,.24263,-.08132,-.0561,.07536,.01672,-.05857,.08687,.01313,-.05954,.01801,.03864,-.05378,.03755,.02968,-.0538,.06022,.02102,-.05602,.07903,.03192,-.05833,.09054,.02924,-.05334,.06449,.03445,-.05537,.04332,.04146,-.05982,.02216,.04891,-.05401,.08148,.04768,-.05534,.09239,.04591,-.06792,.00829,.06766,-.05876,.02693,.06014,-.07084,.00434,.05776,-.05396,.06756,.04992,-.05508,.04784,.0541,-.05062,.08362,.06161,-.05118,.0936,.06085,-.06133,.01109,.07787,-.05352,.03036,.07016,-.0501,.06998,.06302,-.0506,.05183,.0655,-.0417,.08539,.0702,-.04276,.09509,.07027,-.04904,.01229,.08484,-.04144,.03072,.07726,-.0412,.07176,.07066,-.04126,.05299,.07262,-.02872,.08734,.07369,-.02993,.09706,.07508,-.03629,.01271,.0887,-.02993,.03086,.08016,-.02807,.07429,.07319,-.02834,.05495,.07481,-.00648,.1002,.07625,0,.09034,.07316,0,.10076,.07602,-.00588,.09006,.07397,-.0082,.03144,.07979,0,.01099,.08809,0,.03076,.07674,-.0108,.01192,.08776,0,.07634,.0705,-.00553,.07638,.07141,0,.05639,.07187,-.0057,.05704,.07273,-.04858,.25932,.08414,-.03652,.29008,.06359,-.05332,.28374,.05959,-.03348,.26399,.08882,-.02035,.2937,.0654,-.01796,.26623,.09042,-.07184,.23964,.06236,-.0649,.27202,.05275,-.07664,.25799,.04279,-.06149,.25135,.07658,-.08777,.20291,.02762,-.08776,.22583,.02476,-.08959,.21056,.01709,-.08504,.21499,.03822,-.08266,.24089,.03335,-.07938,.22739,.04985,-.08333,.14696,-.03972,-.08413,.15901,-.03516,-.08356,.15952,-.04115,-.08378,.14586,-.03334,-.08357,.17334,-.0379,-.0825,.17269,-.0439,-.08488,.25534,-.01129,-.08932,.23392,.00686,-.0848,.25206,.01112,-.08888,.23578,-.00941,-.08189,.13476,-.0395,-.08245,.13307,-.03214,-.06635,.13862,.04352,-.06367,.15128,.05933,-.06869,.15047,.04662,-.06131,.13784,.05623,-.07662,.2707,.01482,-.07591,.27504,-.01462,-.05446,.13841,.06876,-.05642,.15252,.07212,-.06644,.0875,-.05626,-.07177,.09755,-.04741,-.06124,.09626,.00895,-.06125,.10176,.02581,-.0572,.10147,.04532,-.0514,.10178,.06029,-.042,.10318,.07103,-.03046,.1046,.07596,-.06334,.14075,-.09593,-.06422,.14963,-.0937,-.05945,.14542,-.09914,-.06756,.14563,-.09006,-.05741,.16673,-.0975,-.05994,.16525,-.09582,-.05832,.15607,-.09764,-.05394,.15312,-.1016,-.06268,.1634,-.0931,-.0584,.16225,-.09671,-.06112,.15991,-.09484,-.05647,.14936,-.10061,-.06096,.15316,-.09607,-.07637,.10463,-.03209,-.07286,.10206,-.0236,-.07607,.10925,-.04144,0,.02663,-.02947,0,.00968,-.02524,-.00779,.03896,-.10384,-.01766,.04111,-.10144,-.02677,.04574,-.09637,-.03535,.05026,-.08542,-.03488,.05195,-.08984,-.02669,.04469,-.09235,-.03504,.04892,-.07957,-.0259,.04382,-.08604,-.04264,.05593,-.07872,-.04225,.0581,-.08338,-.0427,.05398,-.0733,-.03762,.0524,-.05802,-.0273,.04829,-.05002,-.03248,.05119,-.04578,-.03143,.04894,-.06287,-.01588,.03959,-.03764,-.02458,.01436,-.01632,-.02064,.04453,-.05434,-.0236,.04513,-.06758,-.0337,.04847,-.0721,-.02465,.04399,-.07802,-.04068,.05297,-.06635,-.05474,.0718,-.07201,-.06109,.07928,-.06509,-.03956,.05738,-.03631,-.04801,.06487,-.04034,-.04499,.06073,-.04684,-.04265,.0603,-.03128,-.03523,.01763,-.01157,-.03164,.03476,-.01441,-.04163,19e-5,-.01001,-.05278,.06752,-.04685,-.05686,.07368,-.03866,-.06473,.09173,-.01901,-.06487,.09827,-.00845,-.04904,.06252,-.05402,-.06119,.0821,-.02911,-.06434,.10388,.00296,-.08748,.19206,.01895,-.08882,.19822,.01002,-.08734,.18287,.01208,-.08795,.18686,.00548,-.08309,.13232,-.0253,-.08424,.145,-.02744,0,.29651,.06518,0,.26761,.09125,-.07996,.11953,-.03155,-.08046,.11852,-.02192,-.0634,.20178,.07837,-.05755,.22732,.08713,-.06739,.21995,.0728,-.05362,.20576,.09101,-.06482,.10964,.01397,-.00695,.11435,.07993,0,.10918,.07818,0,.11455,.08021,-.00671,.10838,.0777,-.01952,.12656,.08404,-.00914,.13692,.09043,-.02153,.13727,.08947,-.00768,.12616,.08447,-.03247,.12649,.08165,-.03421,.13729,.08567,-.04249,.11016,.07182,-.0311,.11144,.0776,-.05236,.10936,.06162,-.05822,.10936,.04766,-.06228,.1105,.03127,-.01775,.09913,.07589,-.01823,.10681,.07723,-.05892,.16798,.07618,-.06655,.16585,.06354,-.01224,.15185,.09846,0,.16996,.10549,-.01391,.16931,.10456,0,.15197,.09955,-.07238,.1635,.05104,-.04742,.15346,.08286,-.03918,.17021,.09637,-.04978,.16976,.08767,-.03695,.15307,.09112,-.0731,.14957,.03636,-.07691,.16013,.03925,-.08046,.1761,.04042,-.07816,.19117,.05125,-.08304,.186,.03739,-.07546,.17852,.05327,-.06098,.18514,.07994,-.05141,.18755,.0917,-.06911,.182,.06671,-.07189,.19685,.06542,-.0137,.19025,.10658,0,.21428,.10692,-.01512,.21338,.10646,0,.19104,.10699,-.04253,.20896,.09954,-.04032,.18905,.09935,-.04548,.23246,.09592,-.08525,.19464,.03331,-.0817,.20327,.04712,-.07561,.21197,.05984,-.01667,.23705,.10294,0,.23999,.10326,-.01435,.30569,-.05638,0,.31696,-.02353,0,.30725,-.05658,-.01823,.31525,-.02311,-.06155,.28729,-.04559,-.04627,.29753,-.05088,-.0531,.2607,-.0834,-.0508,.25074,-.09161,-.06731,.25114,-.07295,-.0776,.23766,-.06124,-.08246,.22262,-.05053,-.0325,.3125,-.02255,-.03623,.30892,.02332,-.04535,.13868,.07884,-.00752,.24806,-.11299,0,.23994,-.11672,-.00737,.23974,-.1162,0,.24829,-.11345,-.03564,.25594,-.0998,-.03752,.26734,-.0918,-.07936,.24358,-.05333,-.06911,.25801,-.065,-.08461,.22782,-.04328,-.02508,.1523,.0966,-.08767,.23489,-.02327,-.08304,.25339,-.02962,-.07418,.27224,-.038,-.055,.26906,-.07558,-.06875,.10664,-.01282,-.06763,.11059,-.00196,-.06764,.11574,.00666,-.06559,.11537,.02003,-.07504,.1489,.02677,-.07804,.15787,.02825,-.08191,.17294,.02879,-.08431,.18023,.02566,-.0861,.18696,.02303,-.0717,.26528,-.05486,-.08123,.24884,-.04368,-.08666,.23219,-.03463,0,.13668,.09085,-.05821,.27814,-.06498,-.00955,.2828,-.08972,0,.27307,-.09846,-.00781,.27287,-.09775,0,.28343,-.0905,-.01646,.07524,.07318,-.01664,.05558,.07448,-.02096,.3129,.02312,0,.31532,.0221,-.06838,.13018,.02909,-.07249,.14038,.02398,-.0704,.13307,.02089,-.07024,.13889,.03244,-.02863,.30344,-.0553,-.04242,.28607,-.07224,-.02468,.28938,-.07764,0,.25972,-.10738,-.00739,.25921,-.10693,-.02718,.16952,.10249,-.01691,.0892,.07416,-.03145,.23556,.10123,-.01129,.29099,-.07945,0,.29274,-.08005,-.01904,.03185,.08312,-.02292,.01219,.08796,-.02734,.18958,.10458,-.02915,.21152,.10446,-.03961,.27643,-.08326,0,.073,-.12038,0,.07646,-.12193,0,.06964,-.1189,0,.03774,-.07686,0,.03666,-.08767,0,.03706,-.09539,0,.03737,-.10146,0,.0382,-.10534,-.01942,.15846,-.11053,-.01411,.1602,-.11298,-.01806,.15653,-.11191,-.01607,.16177,-.11113,-.04187,.06007,-.08742,-.03458,.05359,-.09312,-.02668,.04718,-.09931,-.01775,.04256,-.10457,-.00805,.04032,-.10717,-.03301,.04757,-.02366,-.0367,.05052,-.01954,-.07786,.1492,.0192,-.07992,.15653,.02016,-.083,.16831,.02018,-.08482,.1744,.01822,-.02044,.27107,-.09655,-.01914,.25775,-.10576,-.02218,.28039,-.08812,-.04188,.17771,-.1078,-.03737,.17779,-.10768,-.04184,.17782,-.10668,-.03734,.17778,-.10848,-.05212,.17413,-.10337,-.05262,.17324,-.10384,-.05204,.1741,-.10481,-.05262,.17316,-.10267,-.05144,.1749,-.10397,-.05135,.17479,-.10546,-.04925,.17615,-.10534,-.04919,.17603,-.10674,-.046,.177,-.1068,-.04602,.1769,-.10811,-.03268,.17682,-.10808,-.02364,.16918,-.10408,-.02221,.17003,-.10495,-.02422,.1725,-.10554,-.02504,.17174,-.10436,-.02567,.1726,-.10469,-.02321,.17162,-.10496,-.02216,.17088,-.10522,-.02693,.16835,-.10542,-.0252,.16859,-.10554,-.02662,.16824,-.1061,-.02548,.16872,-.10468,-.03312,.16721,-.10723,-.02892,.16774,-.10698,-.03312,.16721,-.10783,-.02909,.16784,-.1063,-.02539,.17342,-.10592,-.03737,.16678,-.10799,-.03731,.16674,-.10855,-.02824,.17516,-.10678,-.04885,.16883,-.10487,-.04638,.16777,-.10648,-.04903,.16884,-.10522,-.04618,.16774,-.10602,-.05155,.17053,-.10268,-.05099,.17012,-.10387,-.05154,.17054,-.10336,-.05098,.17011,-.10336,-.05252,.17189,-.1019,-.05203,.17106,-.10274,-.0524,.17188,-.1026,-.0521,.171,-.10211,-.05273,.1725,-.10211,-.05273,.17249,-.10296,-.03724,.1676,-.10333,-.03312,.1673,-.10655,-.03731,.16698,-.10714,-.03329,.16784,-.10288,-.0482,.16879,-.10034,-.04568,.16792,-.10502,-.04811,.16894,-.10376,-.04568,.16823,-.10154,-.05186,.17332,-.09785,-.0522,.1725,-.10067,-.05208,.17317,-.10091,-.05202,.17252,-.09731,-.0421,.17706,-.1034,-.04567,.17698,-.10512,-.04615,.17651,-.10226,-.02614,.17386,-.10176,-.02824,.17516,-.10618,-.02633,.17342,-.10501,-.02825,.17506,-.10289,-.02926,.16795,-.1056,-.02885,.16855,-.10165,-.0521,.17196,-.10063,-.05206,.17179,-.09697,-.0488,.17591,-.10322,-.04879,.17604,-.10079,-.02515,.17192,-.10154,-.02575,.17285,-.10153,-.02752,.16872,-.10122,-.02614,.16885,-.10411,-.02724,.16844,-.10472,-.02666,.1689,-.10105,-.05179,.171,-.10094,-.05216,.17122,-.09692,-.05086,.17506,-.10171,-.0506,.17501,-.09932,-.02458,.17105,-.10148,-.02436,.17101,-.10428,-.0516,.17058,-.09758,-.05042,.17011,-.10214,-.0512,.17054,-.10153,-.05105,.16994,-.09824,-.05156,.17407,-.10124,-.05136,.17423,-.09862,-.02443,.17058,-.10147,-.02436,.1702,-.1041,-.03247,.17621,-.10388,-.03264,.17692,-.10752,-.03769,.177,-.10416,-.02497,.1698,-.10134,-.0253,.1695,-.10392,-.02704,.17932,-.10344,-.03158,.18168,-.10445,-.03622,.16058,-.10426,-.03116,.16139,-.10372,-.0504,.16464,-.10044,-.04727,.1626,-.10207,-.05371,.17485,-.09775,-.05416,.17317,-.09726,-.04214,.18298,-.10369,-.04638,.18185,-.10234,-.02406,.17674,-.1021,-.02753,.16268,-.10265,-.05429,.17153,-.09707,-.04945,.18026,-.10084,-.02153,.17249,-.09991,-.0224,.17443,-.10093,-.02548,.16379,-.10174,-.0238,.16514,-.10086,-.05412,.16998,-.0972,-.05158,.1784,-.09948,-.02118,.17077,-.09925,-.05359,.16853,-.09779,-.0526,.16687,-.09875,-.05288,.17662,-.09851,-.02131,.16916,-.09928,-.03704,.18301,-.10452,-.02206,.16726,-.09976,-.01974,.16848,-.09643,-.0195,.17082,-.09667,-.03054,.18606,-.10002,-.03653,.18754,-.09995,-.05405,.17844,-.09462,-.05498,.17609,-.09386,-.04214,.18722,-.09919,-.0206,.16579,-.0964,-.02549,.183,-.09935,-.03608,.15598,-.09931,-.03029,.1572,-.09896,-.0519,.16216,-.09577,-.0485,.15916,-.0972,-.05548,.17381,-.09336,-.04674,.18562,-.09805,-.02219,.17939,-.0983,-.02651,.15906,-.09822,-.05561,.17152,-.09317,-.05016,.18336,-.09679,-.01968,.17324,-.09689,-.02044,.17606,-.09734,-.02425,.16076,-.09757,-.02237,.16283,-.09697,-.0554,.16933,-.0933,-.05252,.18088,-.09559,-.05491,.16738,-.09372,-.05394,.16513,-.0945,-.04181,.18959,-.09437,-.04655,.18781,-.09356,-.02122,.18124,-.09406,-.02472,.18533,-.09464,-.02994,.155,-.09392,-.02611,.15708,-.09361,-.05592,.17425,-.08969,-.05606,.17152,-.08947,-.05012,.1853,-.09262,-.01856,.17392,-.09308,-.01934,.1773,-.0935,-.02376,.15902,-.0933,-.02171,.16144,-.09304,-.05582,.1689,-.08951,-.05266,.18252,-.09167,-.01843,.17099,-.09282,-.0553,.16663,-.08976,-.05434,.16411,-.09024,-.05432,.17971,-.09084,-.01877,.16818,-.0927,-.02995,.18858,-.09499,-.03605,.19003,-.0949,-.05537,.17698,-.09016,-.01976,.16494,-.09278,-.03589,.15361,-.09392,-.05232,.1608,-.09108,-.04883,.15736,-.09214,-.0357,.19085,-.0909,-.04133,.19044,-.09056,-.01952,.1646,-.0899,-.01843,.16813,-.08994,-.02466,.18629,-.09085,-.02978,.18943,-.091,-.03571,.153,-.08974,-.02987,.15437,-.09002,-.05208,.16039,-.08752,-.0486,.15686,-.08822,-.05518,.17748,-.08734,-.05578,.17453,-.08692,-.04604,.1887,-.09,-.0211,.18221,-.09061,-.02611,.15642,-.09004,-.05592,.17154,-.08668,-.04967,.18619,-.08932,-.01822,.17444,-.09018,-.01909,.1781,-.09037,-.02376,.15838,-.08999,-.02161,.16087,-.08993,-.05564,.16873,-.08663,-.05228,.18335,-.08858,-.01806,.17123,-.09004,-.05508,.16634,-.08675,-.0541,.16376,-.08701,-.05406,.18041,-.08791,-.05174,.18371,-.0862,-.05358,.18076,-.08568,-.05476,.17777,-.08521,-.05539,.17473,-.08482,-.05524,.16878,-.08447,-.05554,.17165,-.08456,-.01955,.16463,-.0876,-.01843,.16828,-.08773,-.05366,.16384,-.08458,-.05466,.16638,-.08448,-.0482,.15702,-.08524,-.05166,.16052,-.08482,-.02981,.15448,-.08707,-.03551,.15316,-.08654,-.04084,.19055,-.0876,-.04546,.18893,-.08723,-.02616,.15644,-.08732,-.02488,.18654,-.08794,-.02977,.1895,-.08792,-.01806,.17153,-.0878,-.01829,.17489,-.08785,-.01926,.17862,-.08789,-.02384,.15835,-.08743,-.02168,.16084,-.08749,-.02135,.18265,-.08791,-.03541,.19087,-.08783,-.04908,.18652,-.08674,-.04836,.18653,-.08435,-.05105,.1838,-.08398,-.01862,.17526,-.08563,-.0197,.17896,-.08554,-.02183,.1828,-.08544,-.02623,.15689,-.0848,-.02399,.15871,-.08504,-.03528,.1538,-.08363,-.02976,.15503,-.08434,-.02522,.1864,-.08532,-.02986,.18914,-.08516,-.05495,.17185,-.08257,-.05465,.169,-.08244,-.04034,.19025,-.08492,-.0448,.18878,-.08468,-.05406,.16666,-.08237,-.05293,.18092,-.0836,-.03517,.19048,-.08504,-.01864,.16858,-.08561,-.01832,.17186,-.08568,-.05107,.16099,-.08232,-.04765,.15757,-.0825,-.05413,.17798,-.08322,-.01974,.16493,-.0854,-.05479,.17495,-.08286,-.05306,.16421,-.08232,-.05366,.16937,-.08015,-.0531,.16716,-.08003,-.05008,.18361,-.0815,-.05196,.18088,-.08129,-.02578,.18586,-.08256,-.03007,.18833,-.08231,-.02026,.16549,-.08286,-.01919,.16903,-.08315,-.01894,.17221,-.08322,-.05014,.16183,-.07964,-.04679,.15858,-.07964,-.05316,.17809,-.08099,-.03503,.18959,-.08218,-.03984,.18948,-.08215,-.01933,.17551,-.08309,-.02986,.1561,-.08138,-.02648,.15778,-.08202,-.0538,.17518,-.0806,-.0205,.17908,-.08292,-.0226,.18264,-.08278,-.05212,.16486,-.07985,-.05394,.17214,-.08029,-.04399,.18822,-.08201,-.0474,.18617,-.08176,-.02434,.15946,-.08237,-.03512,.15503,-.08057,-.02058,.16966,-.07979,-.02039,.17256,-.07986,-.04849,.16324,-.07658,-.04541,.16037,-.07648,-.0503,.1804,-.0783,-.05141,.17791,-.07806,-.0351,.1879,-.07883,-.03934,.18788,-.07888,-.02088,.1756,-.07969,-.03044,.15802,-.07789,-.02732,.1594,-.07858,-.05195,.17525,-.07768,-.02208,.17885,-.07951,-.02405,.18198,-.07942,-.05039,.16589,-.0769,-.05207,.17244,-.07738,-.04296,.18686,-.07879,-.04601,.18509,-.07858,-.02689,.1847,-.07921,-.02534,.16085,-.07896,-.03517,.15722,-.07714,-.05184,.1699,-.07726,-.0485,.18281,-.07841,-.0307,.18678,-.07892,-.05134,.16792,-.07715,-.02159,.1664,-.07944,-.04121,.16829,-.07084,-.04548,.16537,-.0733,-.04702,.16736,-.0735,-.04054,.16705,-.07098,-.0478,.16894,-.07363,-.04142,.17082,-.07056,-.04146,.16943,-.0707,-.04817,.17056,-.07366,-.02945,.18245,-.0751,-.03308,.17861,-.07165,-.03402,.1799,-.07201,-.02723,.18043,-.07511,-.04022,.17879,-.07156,-.047,.17906,-.07446,-.04555,.18096,-.07459,-.04084,.17741,-.0712,-.03565,.1608,-.07369,-.03884,.16451,-.07162,-.03644,.16414,-.0717,-.03995,.16146,-.07343,-.03947,.18,-.07196,-.04361,.18271,-.07477,-.03215,.16133,-.07404,-.03536,.16496,-.07142,-.04314,.16321,-.07327,-.03967,.16573,-.07126,-.03521,.1809,-.07234,-.03558,.18482,-.07508,-.03233,.18394,-.07502,-.0363,.18176,-.07274,-.04787,.17708,-.07424,-.04117,.17587,-.07087,-.03809,.18181,-.07279,-.04136,.18408,-.07501,-.03878,.18487,-.07517,-.03874,.18097,-.07236,-.0331,.16789,-.07087,-.02509,.16786,-.07481,-.02665,.1651,-.07465,-.03221,.16974,-.07076,-.0297,.16228,-.0744,-.03443,.16582,-.07122,-.02419,.17051,-.07508,-.03166,.17162,-.07079,-.04824,.17492,-.07394,-.04129,.17422,-.07062,-.03379,.16669,-.07104,-.02813,.16337,-.07459,-.04831,.17263,-.07372,-.04135,.17248,-.07051,-.02406,.1729,-.07517,-.03156,.17341,-.07087,-.02564,.178,-.07505,-.03185,.17521,-.07102,-.03239,.177,-.07129,-.02456,.17538,-.07508,-.04094,.15806,-.07664,-.06719,.15421,-.08944,-.07037,.15088,-.08564,-.07987,.12284,-.03972,-.0783,.11677,-.01142,-.064,.15718,-.09256,-.05602,.16442,-.09818,-.05306,.16722,-.10163,-.05435,.16591,-.10013,-.05176,.16853,-.10286,-.051,.16942,-.10376,-.03002,.01612,-.0137,-.02747,.03238,-.01736,-.02998,.04495,-.02683,-.03643,.05408,-.04099,-.04186,.05654,-.05237,-.04524,.05806,-.06028,-.0483,.05932,-.06674,-.04931,.06167,-.0724,-.04859,.06463,-.0774,-.0479,.06726,-.08249,-.00778,.13128,-.13903,-.03354,.08576,-.1084,-.03473,.08431,-.10753,-.03137,.08798,-.10976,-.02995,.08947,-.11009,-.03074,.08869,-.10998,-.02945,.09,-.11033,-.02898,.09041,-.11052,-.02866,.09072,-.11011,-.0284,.09097,-.10914,-.02852,.09119,-.1073,-.02934,.09126,-.10471,-.02912,.09042,-.10302,-.02938,.0891,-.10184,-.02966,.08832,-.10067,-.03062,.08708,-.09797,-.03341,.08659,-.09203,-.03593,.08688,-.07966,-.03956,.08782,-.06109,-.0379,.08802,-.03772,-.0314,.08815,-.01194,-.0227,.08885,-.008,-.0237,.09708,-.00776,-.03468,.10681,-.01692,-.03881,.1153,-.03797,-.03882,.11933,-.06209,-.03372,.11567,-.08321,-.03113,.11052,-.09583,-.02839,.10526,-.10201,-.02743,.10106,-.10417,-.02729,.0976,-.105,-.02738,.09427,-.10552,-.02765,.0926,-.10748,-.02778,.09186,-.10931,-.02821,.09144,-.11057,-.02879,.09134,-.11116,-.02932,.09139,-.11128,-.02988,.09143,-.11114,-.0309,.09163,-.11102,-.03182,.09178,-.11064,-.03258,.09238,-.11044,-.03436,.09328,-.1097,-.03596,.09403,-.1089,-.01139,.13122,-.13585,-.01459,.13084,-.13262,-.01061,.12814,-.13642,-.01374,.12824,-.13325,-.01759,.12995,-.12802,-.01943,.12828,-.12418,-.03378,.09773,-.11116,-.02056,.1264,-.12108,-.07576,.17208,-.07247,-.07562,.18049,-.07082,-.07372,.17954,-.07584,-.07766,.17184,-.06692,-.07265,.18888,-.0773,-.07087,.18683,-.08147,-.06857,.1965,-.0856,-.06674,.19355,-.08873,-.06019,.1997,-.09631,-.05261,.20879,-.10259,-.05141,.20441,-.10387,-.06178,.20354,-.09416,-.04154,.21257,-.10986,-.04098,.20766,-.11054,-.03006,.21526,-.11573,-.02969,.20965,-.11636,-.01855,.21664,-.12035,-.01835,.2106,-.12076,-.00732,.21694,-.12257,-.0075,.21068,-.12317,0,.21733,-.12316,0,.21097,-.12373,-.02075,.12533,-.11868,-.02108,.12479,-.11633,-.04008,.14274,-.11176,-.02563,.14456,-.11374,-.03396,.13961,-.11389,-.0291,.14753,-.113,-.01684,.15437,-.1136,-.01169,.15487,-.11834,-.01556,.1513,-.11616,-.0126,.15829,-.11546,-.00409,.14974,-.12854,-.00772,.15322,-.12385,-.00416,.15492,-.12584,-.00756,.14843,-.12672,-.02183,.15095,-.1126,-.02014,.14796,-.11461,0,.15055,-.12996,0,.15582,-.1274,-.01974,.12137,-.11815,-.03006,.15031,-.11202,-.02363,.15558,-.11069,-.02306,.15338,-.11178,-.03055,.15301,-.11086,0,.22429,-.12167,-.00721,.22411,-.12124,-.01897,.22324,-.11942,-.03101,.2214,-.11495,-.04249,.21816,-.10834,-.01466,.1129,-.12205,-.02228,.11818,-.1165,-.01968,.11401,-.11908,-.00707,.128,-.13937,-.02999,.10258,-.11478,-.02414,.16808,-.10585,-.02324,.16726,-.10604,-.02227,.16669,-.10619,-.02117,.1657,-.10624,-.01792,.16322,-.10873,-.01958,.16457,-.10669,-.05416,.21368,-.10067,-.02414,.12578,-.11548,-.03924,.14778,-.1104,-.02188,.16114,-.0852,-.02231,.1618,-.08258,-.0235,.163,-.07914,-.06376,.20773,-.09144,-.00701,.06534,-.11839,0,.06452,-.1198,-.03883,.15145,-.10939,-.01702,.12785,-.12882,-.07854,.16336,-.0654,-.0766,.16462,-.07127,-.01571,.06738,-.11567,-.02738,.11934,-.11504,-.02329,.07024,-.11153,-.0298,.07356,-.10841,-.03494,.07714,-.10595,-.02054,.13769,-.11663,-.02441,.13324,-.11554,-.03833,.08064,-.10441,-.03961,.08518,-.10459,-.03994,.08988,-.10538,-.03865,.09473,-.10717,-.03606,.09942,-.10997,-.03188,.10508,-.11346,-.03708,.1146,-.11078,-.03538,.10702,-.11138,-.0407,.10852,-.10834,-.03126,.11293,-.11333,-.07033,.19996,-.08142,-.07465,.1915,-.07193,-.07741,.18186,-.06503,-.0794,.17186,-.06042,-.07486,.12671,-.06863,-.07169,.11245,-.06661,-.07567,.12134,-.06082,-.07086,.1191,-.07481,-.08021,.16219,-.05885,-.07997,.15281,-.0587,-.07847,.155,-.06536,-.07927,.14376,-.06034,-.07783,.14698,-.06704,-.07774,.13501,-.0637,-.07643,.13927,-.07046,-.07388,.13192,-.07546,-.06983,.12508,-.08161,-.05341,.07584,-.0789,-.00865,.05128,-.11623,0,.05722,-.11988,0,.05053,-.11794,-.00811,.05797,-.11873,-.04592,.09587,-.10213,-.04328,.08923,-.10253,-.04652,.08861,-.09892,-.042,.09532,-.10489,-.0113,.15066,-.12158,-.0176,.0532,-.11384,-.00911,.04592,-.11309,-.01814,.04804,-.11053,-.04249,.08327,-.10117,-.04535,.08131,-.09676,-.03821,.0685,-.09914,-.03367,.05864,-.09992,-.03977,.06502,-.09527,-.03244,.06238,-.103,-.0252,.05735,-.10838,-.02638,.05252,-.10535,-.04255,.07463,-.09688,-.04814,.07952,-.09181,-.0446,.07187,-.09228,-.0086,.04298,-.11075,0,.0452,-.11458,0,.04207,-.11213,-.01807,.04544,-.10789,-.02636,.0498,-.10282,-.06808,.13069,-.08713,-.07256,.13666,-.08134,-.07903,.13074,-.05638,-.07506,.14321,-.07652,-.07621,.15017,-.07292,-.01472,.14767,-.11893,-.01837,.14442,-.1164,-.07664,.15731,-.07147,-.08146,.1506,-.05168,-.08286,.16044,-.046,-.08189,.16118,-.05231,-.08255,.14868,-.04494,-.08195,.17246,-.04836,-.08108,.17203,-.05422,-.07478,.16586,-.07634,-.07498,.15959,-.07646,-.07465,.15332,-.078,-.07313,.14706,-.08118,-.07024,.14107,-.08591,-.06596,.13585,-.09164,-.08062,.14051,-.05305,-.08155,.13753,-.04568,0,.23046,-.11971,-.00726,.2301,-.11929,-.0192,.23006,-.11716,-.0313,.22808,-.11267,-.04409,.22464,-.10644,-.05626,.21952,-.09798,-.07914,.18352,-.05939,-.0801,.18512,-.05358,-.07645,.19436,-.06643,-.07936,.12653,-.04826,-.07584,.11575,-.05201,-.07208,.10514,-.05755,-.0667,.10489,-.07459,-.06604,.11284,-.08204,-.05044,.09622,-.09761,-.0502,.08797,-.09394,-.01634,.06002,-.11543,-.03689,.07266,-.10231,-.03096,.06794,-.1059,-.02388,.06358,-.11044,-.04045,.07764,-.10099,-.03386,.05592,-.09706,-.0229,.14076,-.11494,-.02861,.13606,-.1146,-.04187,.13223,-.11105,-.04621,.12551,-.10775,-.03904,.10091,-.10768,-.0437,.10224,-.10525,-.04104,.06218,-.09127,-.04656,.06943,-.08754,-.05096,.0778,-.08599,0,.03923,-.10836,-.05466,.08723,-.08624,-.05981,.08738,-.07566,-.06662,.09612,-.06592,-.06475,.11963,-.0885,-.01699,.14117,-.11857,-.01405,.14413,-.12168,-.01103,.14658,-.12461,-.02756,.11111,-.11572,0,.1196,.08212,0,.12577,.08449,-.00721,.11969,.08197,-.01879,.11348,.07924,-.01915,.11948,.08144,-.03196,.11825,.07955,-.04375,.12689,.07564,-.04302,.11777,.07327,-.05318,.12653,.0661,-.05249,.11711,.06439,-.05984,.12697,.05321,-.05892,.11723,.05053,-.0647,.12761,.03912,-.06376,.11844,.03599,-.06678,.12222,.02497,-.06884,.12634,.01684,-.06858,.12037,.0129,-.04926,.10336,-.10147,-.05275,.11233,-.10068,-.04685,.11016,-.10495,-.05473,.10512,-.09601,-.04355,.11671,-.1081,-.05552,.09682,-.09097,-.06046,.10793,-.08957,-.05915,.11526,-.09523,-.05298,.12824,-.10343,-.05627,.13722,-.10166,-.04801,.13489,-.10697,-.05968,.13139,-.09804,-.06086,.09923,-.08285,-.05164,.14287,-.10526,-.04932,.14732,-.10644,-.0473,.1513,-.10579,-.0456,.15527,-.10548,-.04438,.15866,-.10535,-.0437,.16124,-.1061,-.04316,.16336,-.10698,-.04243,.16492,-.10763,-.04226,.1662,-.10801,-.04172,.15594,-.07991,-.04231,.15474,-.08291,-.04276,.1541,-.08582,-.0431,.15392,-.08903,-.04333,.1545,-.09322,-.04324,.15672,-.0986,-.04266,.16102,-.10355,-.04234,.16762,-.10265,-.04196,.16714,-.10652,-.04223,.1669,-.1076,-.04223,.16687,-.10819,-.06209,.12566,-.09296,-.0499,.11893,-.10457,-.05629,.12184,-.09965,-.02545,.10824,-.11725,-.025,.10458,-.11796,-.02504,.10076,-.1185,-.01222,.10709,-.12575,-.02014,.10855,-.12028,-.01872,.09175,-.12196,-.01724,.0922,-.11801,-.01549,.10967,-.12256,-.01703,.09348,-.11684,-.01552,.0973,-.11522,-.01504,.10256,-.1151,-.01481,.10783,-.11441,-.01464,.11405,-.11111,-.0158,.1226,-.10207,-.01798,.13006,-.08663,-.02267,.13403,-.06301,-.02177,.1297,-.03894,-.08633,.17892,.01559,-.08341,.20725,-.04254,-.08557,.21134,-.03582,-.08729,.21514,-.02837,-.08879,.21762,-.01932,-.08988,.21856,-.00883,-.08812,.20287,-.01684,-.0888,.20375,-.00895,-.08381,.19112,-.03684,-.08514,.19591,-.0309,-.08656,.19997,-.02473,-.08737,.19061,-.01523,-.08786,.19177,-.00924,-.08458,.17378,-.03089,-.0853,.18217,-.02632,-.0863,.18734,-.02142,-.0733,.13054,.0113,-.0725,.12568,.00732,-.07594,.14232,.01708,-.07459,.13631,.01456,-.0727,.12221,.00323,-.07471,.11846,-.00314,-.08915,.20273,-62e-5,-.0881,.19104,-.00296,-.09025,.2166,.00229,-.08444,.15803,-.02936,-.0879,.17975,.00398,-.08849,.1755,.00678,-.08465,.15832,.01362,-.08184,.15007,.01264,-.08364,.13313,-.02068,-.08443,.144,-.02298,-.09557,.16817,.0121,-.10278,.1721,.01376,-.10279,.16842,.01604,-.09655,.17188,.01084,-.08342,.11702,-.01025,-.08285,.1234,-.01699,-.07813,.12956,.00319,-.07846,.12528,13e-5,-.08538,.16096,-.02171,-.08548,.15112,-.01848,-.08569,.15806,-.01891,-.08518,.15254,-.02116,-.08392,.13109,.00216,-.0914,.13399,.0107,-.08994,.1281,.00678,-.08525,.13607,.0052,-.08622,.17785,-.01903,-.08716,.18108,-.01423,-.08494,.1548,-.02473,-.08888,.17665,-.00528,-.09017,.17665,-.00929,-.09422,.17926,-.00577,-.08802,.17711,-.01007,-.08734,.11675,-.00949,-.0899,.12086,-.00238,-.0893,.1203,-.00869,-.08564,.11875,-.0024,-.0873,.17258,-.01292,-.08735,.17561,-.0136,-.08062,.14424,.01112,-.08918,.12358,.00168,-.0847,.12238,.00136,-.08578,.16733,-.02018,-.08603,.16381,-.01799,-.09416,.16349,.01318,-.10237,.16392,.01752,-.08856,.1724,.00959,-.0841,.13388,-.0179,-.08645,.12654,-.01354,-.08501,.13494,-.016,-.08546,.12514,-.01523,-.0861,.14126,.00763,-.09392,.14345,.01552,-.09266,.13872,.01312,-.08753,.1446,.00948,-.08876,.16598,-.01387,-.08672,.16844,-.01602,-.09074,.16969,-.01224,-.08857,.12586,-.00804,-.08712,.12968,-.01183,-.08755,.1439,-.01427,-.0851,.14335,-.01715,-.08639,.15032,-.0153,-.09469,.13661,.01028,-.09205,.13015,.00517,-.0934,.17473,-.00947,-.08779,.1369,-.01404,-.10552,.16686,.01495,-.1047,.16264,.01625,-.09014,.1256,-.00348,-.08656,.15623,-.01566,-.08737,.16145,-.01526,-.10463,.17507,.00948,-.10207,.17561,.01129,-.10547,.17039,.01292,-.10242,.15684,.01747,-.09731,.15024,.0173,-.10026,.15722,.0187,-.10001,.15058,.0168,-.09768,.145,.01525,-.09078,.12709,.00116,-.0966,.17678,-.00607,-.09618,.1408,.01277,-.10104,.17752,.00204,-.09869,.1797,.00199,-.09382,.17146,-.00906,-.09707,.17442,-.00625,-.0985,.14634,.01364,-.09674,.14189,.01108,-.10038,.17594,.00202,-.10399,.17351,.00828,-.08736,.14968,-.01308,-.08748,.15492,-.01355,-.09278,.1326,.00449,-.09109,.12952,61e-5,-.08981,.16406,-.01272,-.09127,.16766,-.01126,-.08862,.12924,-.0072,-.08741,.13235,-.01045,-.08962,.14371,-.01229,-.09527,.13842,.00898,-.08892,.13874,-.01183,-.10429,.1656,.01338,-.10364,.16124,.01458,-.08972,.12845,-.00331,-.08842,.15972,-.01351,-.10493,.16936,.01177,-.10292,.15643,.01501,-.10081,.14992,.01518,-.08896,.15847,-.01226,-.08832,.15347,-.01129,-.08904,.15757,-.01126,-.08814,.15402,-.01219,-.08968,.13158,-.00305,-.09104,.13421,11e-5,-.08966,.13314,-.00306,-.09106,.13261,3e-4,-.10331,.16464,.0121,-.10316,.1682,.00937,-.10084,.1642,.0112,-.10382,.16862,.01028,-.08593,.13984,-.01046,-.08249,.13735,-.00856,-.08387,.14116,-.00949,-.0856,.1358,-.0091,-.0929,.17326,-.00498,-.09068,.17,-.0063,-.09254,.1722,-.00414,-.09115,.17112,-.00709,-.09605,.14363,.00922,-.0965,.14725,.01082,-.09534,.14398,.00895,-.09742,.14696,.01096,-.08708,.14936,-.01076,-.08767,.14945,-.01156,-.0926,.1351,.00361,-.09421,.14134,.00714,-.09251,.13598,.00317,-.09474,.14078,.00754,-.08959,.16507,-.00904,-.09023,.16614,-.01018,-.1012,.16074,.0128,-.10098,.16014,.01189,-.08868,.13182,-.00668,-.08863,.13391,-.00605,-.08382,.14618,-.00942,-.08614,.14531,-.00984,-.08632,.14951,-.01012,-.08186,.1428,-.00854,-.09818,.17033,.0058,-.09881,.17148,.00672,-.10044,.16758,.00815,-.09964,.15413,.01116,-.09814,.14957,.01129,-.09942,.15492,.01205,-.09809,.14968,.01052,-.09724,.14747,.01006,-.09792,.17116,.00146,-.09751,.1727,.002,-.09257,.13706,.00305,-.09136,.13538,2e-5,-.0886,.16046,-.00938,-.0891,.16147,-.01038,-.08928,.16409,-.00821,-.08837,.13618,-.00556,-.08183,.1398,-.00739,-.08464,.14449,-.00107,-.08791,.14548,91e-5,-.08664,.14633,-25e-5,-.0857,.14374,91e-5,-.08879,.15409,-.00757,-.088,.15121,-.00654,-.08927,.15316,-.00641,-.08777,.15191,-.00775,-.09396,.15966,.00113,-.09794,.16092,.00282,-.097,.1618,.00125,-.09527,.15904,.00214,-.08352,.14564,-.00271,-.08567,.14729,-.0015,-.0936,.14933,.00463,-.09308,.14584,.00436,-.09491,.148,.00523,-.09254,.14742,.0039,-.09876,.15767,.00523,-.09617,.1582,.00307,-.09661,.15716,.00392,-.09858,.15968,.00409,-.09475,.15301,.00536,-.09594,.15023,.006,-.09704,.15229,.00616,-.09383,.15128,.0054,-.08912,.14516,.00211,-.0888,.14328,.00172,-.08471,.14822,-.00244,-.08311,.14872,-.00545,-.08306,.14717,-.00421,-.08422,.14909,-.0031,-.09587,.15456,.00499,-.09782,.15432,.00612,-.09368,.16276,-.00305,-.08873,.15834,-.0029,-.09049,.15949,-.00236,-.09076,.1617,-.00454,-.09715,.14935,.00713,-.09785,.15184,.00779,-.09905,.15433,.00767,-.09961,.16343,.00402,-.09836,.16463,.00228,-.08878,.15514,-.0086,-.08789,.15239,-.00886,-.08813,.15797,-.00751,-.08801,.15623,-.00636,-.08416,.1423,-.00214,-.08707,.14112,-79e-5,-.1003,.15842,.00684,-.10025,.16154,.00565,-.08238,.14804,-.00758,-.08173,.14602,-.00601,-.08897,.16483,-.00518,-.08798,.15881,-.00517,-.08887,.16158,-.00665,-.09353,.14161,.00206,-.09181,.14396,.00259,-.09479,.1441,.00414,-.08531,.15001,-.00826,-.08512,.15017,-.0067,-.08246,.14424,-.00388,-.09211,.14064,43e-5,-.09583,.16231,-54e-5,-.0952,.16567,26e-5,-.09601,.14675,.00589,-.09106,.16592,-.0027,-.08969,.1626,-.01157,-.08912,.14478,-.01032,-.08644,.17198,-.01746,-.09484,.14257,.00505,-.09293,.1383,.00251,-.09468,.14212,.0067,-.09067,.16884,-.00576,-.089,.16296,-.00744,-.09053,.16774,-.00533,-.10091,.1598,.01073,-.10075,.16324,.00809,-.10121,.15943,.00952,-.10054,.16408,.01003,-.08989,.13739,-.00296,-.08604,.1388,-.00433,-.08977,.13495,-.0031,-.08894,.1568,-.01038,-.08801,.15275,-.00979,-.08881,.15605,-.00954,-.0882,.15307,-.01054,-.09193,.13714,-14e-5,-.09979,.16651,.00626,-.08179,.14164,-.00592,-.081,.14443,-.00757,-.09196,.17094,-.0035,-.09234,.1694,-.00334,-.0958,.14418,.00824,-.09737,.14851,.00924,-.09619,.14557,.00706,-.08564,.14975,-.00943,-.08827,.15942,-.00851,-.09859,.14947,.01164,-.08714,.15613,-.00364,-.08506,.15022,-.00488,-.09275,.16004,-8e-5,-.10027,.15487,.01262,-.10272,.17179,.00728,-.09725,.17411,.002,-.09112,.14586,.00293,-.0879,.1545,-.00512,-.08719,.1545,-.00253,-.08994,.15337,-.00396,-.09016,.15242,-.00515,-.08849,.15084,-.00492,-.08699,.14965,-.0036,-.08732,.14912,-.00295,-.08812,.14858,-.00218,-.08882,.14807,-.00114,-.08965,.14748,-8e-5,-.09024,.14684,.00101,-.09058,.14636,.00181,-.09138,.1473,.00257,-.09198,.14884,.00342,-.09208,.15062,.00416,-.09181,.15238,.00479,-.09238,.15388,.00473,-.09341,.1551,.0044,-.0936,.15658,.00373,-.09299,.15718,.00286,-.09224,.15764,.00186,-.0915,.15799,74e-5,-.09064,.15833,-22e-5,-.08912,.15779,-.00139,-.08809,.15649,-.00181,-.09073,.15104,.00364,-.09028,.15247,.00391,-.08796,.1555,-58e-5,-.08756,.15362,-.00134,-.0975,.16937,.00118,-.09187,.14974,.00236,-.09132,.1482,.00175,-.09025,.1528,-.00272,-.08777,.15305,16e-5,-.09024,.1521,-89e-5,-.08906,.15496,.00173,-.08826,.1527,.00155,-.08833,.15509,64e-5,-.09028,.15137,-.00338,-.09086,.15067,-.0016,-.08948,.14968,-.00311,-.09014,.14929,-.00193,-.09059,.14904,-61e-5,-.09011,.15163,5e-4,-.09119,.15029,-14e-5,-.09005,.1513,.00236,-.09162,.15016,.00112,-.08918,.15256,.00301,-.08981,.15486,.00283,-.09086,.15454,.00382,-.09097,.14874,67e-5,-.08221,.1471,-.00898,-.09911,.16794,.00392,-.09892,.15428,.01012,-.09806,.15114,.00978,-.09559,.17486,.00724,-.09287,.17678,.00158,-.08959,.1499,.01194,-.09124,.1578,.01316,-.08478,.14344,-.01957,-.08833,.16855,.01153,-.08497,.16544,-.02512,-.07894,.13429,.00624,-.08771,.18194,-.00373,-.08772,.18233,-.0098,-.08029,.12102,-.0053,-.08554,.17293,-.02262,-.08687,.16441,.01285,-.08002,.13949,.00904,.04168,.1786,-.10892,.03732,.17778,-.10928,.03715,.17849,-.10952,.0419,.17759,-.10891,.04184,.18089,-.10847,.03714,.17947,-.1094,.03696,.18079,-.10924,.04177,.17958,-.10874,.04589,.17798,-.10806,.04619,.17896,-.10766,.04663,.1801,-.10716,.04985,.17772,-.1062,.05076,.17868,-.10532,.04924,.1769,-.10667,.05236,.17626,-.10472,.05354,.17695,-.1038,.05154,.17572,-.10537,.05368,.17502,-.10349,.05498,.17537,-.10217,.0527,.1746,-.10428,.05425,.17389,-.10258,.05566,.17401,-.10104,.05326,.17374,-.10334,.05437,.17276,-.10154,.05574,.17279,-.1003,.05338,.17279,-.1026,.05416,.17172,-.10154,.05557,.17141,-.10026,.05314,.17191,-.10247,.05356,.17057,-.10158,.05501,.16998,-.10007,.05266,.17104,-.10258,.05287,.16955,-.10194,.05422,.16861,-.10051,.05197,.17022,-.103,.04712,.16598,-.10586,.05084,.16578,-.10356,.04771,.16441,-.10529,.0497,.16712,-.10436,.04686,.16705,-.1063,.04927,.16814,-.10489,.03286,.1664,-.1078,.03716,.16458,-.10777,.03235,.16488,-.10774,.03731,.16606,-.10834,.03793,.16315,-.10811,.0325,.1636,-.10794,.02858,.16708,-.10704,.02798,.16592,-.10718,.02786,.16459,-.10721,.02615,.1676,-.10636,.02544,.16662,-.1065,.0248,.16555,-.10655,.03241,.17754,-.10891,.0327,.17672,-.10866,.03186,.17972,-.10896,.03218,.17846,-.10898,.02718,.17783,-.10853,.02764,.17678,-.10814,.028,.17597,-.10772,.02824,.17516,-.10739,.02357,.17562,-.10824,.02419,.17473,-.1079,.0248,.17405,-.1076,.02512,.17334,-.10702,.02146,.17384,-.10807,.0222,.17329,-.10781,.02279,.1728,-.10758,.02342,.17218,-.10654,.01934,.17114,-.10798,.02088,.17208,-.10787,.02011,.17113,-.1073,.02014,.17231,-.10807,.0206,.17111,-.10662,.0218,.17159,-.10602,.02102,.17083,-.10568,.02147,.17191,-.1077,.019,.16987,-.10778,.01981,.17008,-.10702,.02045,.17011,-.10586,.02108,.17005,-.10537,.01922,.16854,-.10723,.0201,.16891,-.10664,.02107,.16918,-.10579,.02215,.16906,-.10513,.04844,.16238,-.10388,.05196,.16404,-.10225,.02365,.16416,-.10645,.02694,.1629,-.10721,.03206,.16159,-.10776,.03815,.15836,-.10696,.0315,.15912,-.1078,.03814,.16104,-.1076,.05567,.1677,-.09894,.05641,.16945,-.09868,.05689,.17117,-.09901,.05696,.1727,-.09917,.0568,.17416,-.09979,.05614,.17567,-.10097,.05453,.17735,-.10252,.05141,.17933,-.10454,.04699,.18096,-.10631,.04199,.18182,-.10824,.03688,.18172,-.10901,.03152,.18066,-.10892,.0266,.17872,-.10886,.02282,.17628,-.10854,.05221,.18002,-.10375,.05563,.1777,-.10082,.01927,.17275,-.10848,.0185,.17128,-.10854,.01824,.16975,-.10826,.01864,.16806,-.10739,.02062,.17443,-.1084,.01781,.17324,-.1094,.01924,.17524,-.1093,.02185,.17747,-.10952,.01709,.17598,-.11107,.01552,.1736,-.11096,.01706,.17144,-.10937,.01476,.17146,-.11075,.01691,.16957,-.10909,.0147,.16921,-.11042,.01745,.16736,-.10795,.01559,.16654,-.10992,.0111,.17791,-.11641,.01266,.17401,-.11339,.00974,.17483,-.1164,.01422,.17678,-.11356,.00908,.17161,-.11623,.01204,.1688,-.11294,.00936,.16844,-.11612,.01193,.17141,-.11314,.01307,.1656,-.11238,.01063,.1646,-.11527,.00762,.17876,-.11902,.0066,.17544,-.11892,.00618,.17204,-.11886,.00655,.16831,-.1189,.00799,.16334,-.1186,.0039,.17957,-.12055,.00342,.17614,-.12038,.00774,.15846,-.12092,.00384,.16524,-.12174,.00398,.16051,-.12334,.00325,.17251,-.12053,.00343,.16889,-.12113,.03106,.15617,-.10931,.03847,.15515,-.10812,.0247,.15826,-.10915,.02574,.16081,-.10721,.02092,.16054,-.10884,.02221,.1625,-.10667,.05152,.15679,-.10214,.0533,.1619,-.10014,.05555,.15917,-.09893,.04955,.15995,-.10247,.06068,.17248,-.09594,.05809,.17417,-.09834,.06028,.17435,-.09654,.05838,.17262,-.09785,.06058,.16789,-.09539,.0584,.1709,-.09757,.06074,.17036,-.09545,.05809,.16876,-.09719,.05741,.17579,-.09928,.0592,.17627,-.09752,.05701,.1785,-.09959,.05332,.18083,-.10265,.0474,.18188,-.1059,.0481,.18299,-.10584,.03004,.18326,-.11044,.02588,.17972,-.10944,.02428,.18108,-.11098,.03112,.18166,-.10927,.04202,.18286,-.10799,.04223,.18427,-.10826,.03625,.18439,-.10956,.03671,.18281,-.10888,.01985,.17856,-.11114,.01338,.18124,-.1164,.01688,.17987,-.11352,.00936,.18244,-.11918,.00458,.1832,-.12059,.02458,.18866,-.11534,.0214,.18314,-.11378,.01782,.18522,-.11632,.02789,.18578,-.11282,.03329,.19,-.11255,.03514,.18708,-.11086,.04967,.18793,-.10535,.04226,.18676,-.10866,.042,.18961,-.10933,.04903,.18508,-.10561,.05626,.18499,-.10079,.05494,.18232,-.10156,.06695,.16868,-.08983,.06347,.17225,-.09356,.06652,.1721,-.09047,.06361,.16964,-.09299,.06289,.17453,-.09425,.06582,.1751,-.09142,.06646,.16504,-.08954,.0634,.16664,-.09272,.06168,.17687,-.09553,.06419,.17834,-.09335,.05906,.17954,-.098,.06104,.18167,-.09665,.05725,.18833,-.10004,.04979,.19162,-.10546,.06293,.18431,-.09508,.0307,.19422,-.11464,.01938,.19286,-.11869,.01276,.1872,-.11921,.06988,.16769,-.08604,.0691,.17206,-.08675,.06814,.17615,-.08836,.06977,.1633,-.08612,.06601,.18025,-.09097,.0408,.19363,-.11036,.06916,.15889,-.087,.0656,.16121,-.09024,.00592,.18833,-.12131,.058,.19218,-.09907,.05026,.19583,-.10519,.04048,.19819,-.11078,.02993,.19949,-.11585,.01844,.19974,-.12032,.00818,.19376,-.12184,.00803,.19984,-.12258,.04058,.20293,-.11089,.02964,.2044,-.1163,.05902,.19603,-.09784,.05076,.20021,-.10471,.0177,.20496,-.12086,.00763,.20494,-.1231,.07172,.22417,-.07606,.05869,.22626,-.09389,.06156,.23395,-.08803,.06931,.21829,-.0824,.04544,.232,-.1024,.04775,.24042,-.09772,.03232,.23612,-.10974,.03353,.24514,-.1064,.07249,.16153,-.08162,.07243,.16693,-.08143,.07199,.17221,-.08252,.07031,.17718,-.08474,.06774,.18252,-.08824,.06408,.18745,-.09325,.07208,.15629,-.08294,.06919,.18458,-.08498,.06493,.19057,-.09088,.072,.17843,-.08029,.07396,.17228,-.07721,.07964,.20028,-.05516,.07495,.20803,-.07106,.07727,.21251,-.06505,.0779,.19726,-.06089,.08005,.2178,-.05759,.07463,.23081,-.06906,.06622,.21254,-.08735,.07276,.20387,-.07648,.08111,.187,-.0475,.08162,.20359,-.04926,.08218,.18845,-.04295,.06533,.28751,.01884,.04954,.30494,-.01973,.05234,.30092,.02234,.064,.29195,-.01757,.00449,.13813,-.13721,.00418,.13448,-.13914,.01469,.13592,-.12986,.01126,.13992,-.13034,.0138,.1384,-.12683,.01134,.13696,-.13244,.01703,.13427,-.12626,.01676,.13639,-.12424,.01076,.14292,-.12716,.01375,.14101,-.12431,.01634,.13848,-.12102,.00797,.14093,-.13294,.00443,.1416,-.13465,.00809,.1377,-.13536,.0044,.1453,-.13189,.00764,.1443,-.1298,.00809,.13448,-.13726,.01892,.13529,-.11825,.02052,.12983,-.11857,.0191,.13363,-.1214,.02173,.13117,-.11683,.01046,.12334,-.13436,.00652,.12128,-.13502,.00946,.12434,-.13638,.00774,.12132,-.13392,.01901,.12599,-.12509,.01898,.12182,-.12097,.01854,.1244,-.12566,.02024,.12372,-.12086,.00624,.12421,-.13864,.00238,.12078,-.13613,.0032,.12394,-.1396,.00456,.1212,-.13553,.00515,.11875,-.1323,.00629,.11954,-.13146,.00181,.11765,-.13246,.00347,.11821,-.13217,.00515,.11681,-.12924,.00624,.11772,-.12904,.0015,.11532,-.12888,.00319,.11591,-.12914,.00641,.11477,-.12635,.00692,.11647,-.12626,.01376,.11696,-.12142,.00989,.114,-.12401,.00967,.11556,-.1238,.01429,.11496,-.12157,.01673,.11864,-.12005,.01364,.11832,-.12174,.0156,.11962,-.12125,.0118,.12266,-.13213,.01214,.12396,-.13333,.01054,.12246,-.13295,.0166,.12172,-.12695,.0155,.12414,-.12971,.0175,.1227,-.12644,.0146,.12254,-.12965,.01674,.12106,-.12281,.01814,.1207,-.12271,.00841,.1213,-.13298,.00668,.12034,-.13067,.0069,.11873,-.12859,.00755,.11794,-.12612,.00979,.11737,-.124,.01632,.1257,-.1297,.00354,.12766,-.14088,.00401,.13109,-.14059,.01294,.12582,-.13345,.01151,.13405,-.1343,.01471,.13336,-.13126,.01927,.1305,-.12416,.01735,.13216,-.12758,.01908,.13202,-.12313,.02033,.12878,-.12167,.02046,.12918,-.12022,.01811,.11839,-.11857,.02849,.12755,-.11461,.03906,.12311,-.11062,.03293,.12096,-.11317,.03457,.12992,-.11375,.00167,.11308,-.12812,.00367,.11384,-.12752,.01516,.1216,-.1235,.01472,.12032,-.12227,.01314,.11929,-.12244,.00798,.119,-.1258,.0069,.12025,-.12761,.00863,.12214,-.13062,.01001,.12262,-.1307,.01518,.12205,-.12622,.00721,.12163,-.12952,.01166,.1224,-.13042,.00982,.1186,-.1242,.01326,.12305,-.1278,.00222,.11099,-.1278,.02945,.09988,-.11533,.03194,.09424,-.11188,.02912,.09716,-.11537,.03277,.09582,-.11153,.02736,.08596,-.11236,.02267,.0809,-.1158,.02238,.08315,-.11674,.02752,.08466,-.1121,.02981,.08771,-.11042,.03018,.08676,-.11027,.00212,.10492,-.1289,.00269,.1018,-.1317,.00222,.10842,-.12827,.01057,.12012,-.1244,.00953,.12065,-.1254,.01367,.12239,-.12583,.01416,.12196,-.12432,.01217,.12076,-.12382,.01348,.12146,-.12382,.00966,.12262,-.12902,.01036,.12282,-.12949,.00875,.12222,-.12833,.01134,.12283,-.12887,.01249,.12269,-.12769,.00862,.12145,-.12685,.0107,.12283,-.12799,.01164,.12266,-.1268,.0126,.12223,-.12529,.00984,.12256,-.1275,.01027,.12222,-.12644,.01116,.12163,-.12505,.02818,.08123,-.11135,.03126,.08369,-.10945,.023,.07848,-.11453,.03119,.09337,-.11225,.02869,.0955,-.11543,.00491,.10906,-.12774,.00449,.11153,-.12712,.02483,.09659,-.11954,.0253,.09804,-.1195,.02812,.09426,-.1154,.0243,.09536,-.11957,.02755,.09347,-.11558,.02692,.09257,-.11534,.02287,.09294,-.11855,.02352,.09389,-.11885,.02651,.09186,-.11502,.02215,.09176,-.11825,.0254,.09179,-.11386,.02074,.09198,-.11622,.02488,.09205,-.11282,.03034,.09104,-.11035,.03078,.09026,-.10942,.03034,.09058,-.10967,.03107,.09115,-.11006,.02993,.09107,-.1103,.02988,.0908,-.11002,.02914,.0913,-.10938,.02957,.09094,-.1097,.02927,.09114,-.10886,.02956,.09113,-.11009,.02891,.09172,-.10788,.02929,.09144,-.10722,.02636,.08855,-.11328,.02911,.08869,-.11076,.02688,.08744,-.11305,.02855,.08941,-.11099,.02609,.09098,-.10849,.02753,.09082,-.1094,.02528,.09074,-.11113,.02776,.09092,-.10738,.03046,.0925,-.11249,.02959,.092,-.11248,.02869,.09172,-.11225,.02802,.09157,-.11222,.02728,.09158,-.11177,.02665,.092,-.11072,.03294,.09107,-.1096,.03168,.08968,-.10954,.03202,.09107,-.10984,.03257,.08921,-.10926,.02578,.08948,-.11303,.02807,.09002,-.11101,.02774,.09049,-.11053,.0254,.0902,-.11244,.00551,.10594,-.1292,.00959,.10423,-.13024,.00618,.10312,-.13146,.00863,.10681,-.12727,.01744,.10073,-.12575,.02106,.09774,-.1232,.01709,.09943,-.12582,.02138,.09899,-.12347,.01657,.09697,-.12509,.01951,.09368,-.12221,.01608,.0946,-.1246,.02016,.09564,-.12262,.008,.10963,-.12636,.01067,.11236,-.12421,.0114,.10998,-.12456,.00725,.11203,-.12569,.0163,.10608,-.12336,.02144,.10044,-.12282,.01726,.10262,-.1253,.02077,.10384,-.12113,.00942,.09792,-.12931,.01254,.09502,-.12679,.00924,.09496,-.12788,.01273,.09774,-.12769,.00967,.10256,-.13056,.01306,.10062,-.12875,.00964,.10135,-.13086,.01326,.10212,-.12844,.00618,.09697,-.12994,.006,.09422,-.12866,.00638,.10148,-.13148,.0064,.10008,-.13146,.00257,.09611,-.13032,.00238,.09354,-.1293,.00276,.10007,-.1319,.0028,.0989,-.13177,.01546,.09178,-.12433,.01217,.0916,-.12542,.00913,.09152,-.12542,.00559,.09137,-.12586,.00258,.09114,-.12596,.01309,.10394,-.12785,.02189,.08728,-.11742,.02204,.0854,-.11718,.01966,.09076,-.11503,.02069,.08999,-.11747,.02143,.08884,-.11783,.01555,.07962,-.12139,.01532,.08287,-.12202,.01481,.08578,-.12304,.01435,.08756,-.12298,.01381,.08914,-.12208,.01328,.09052,-.12204,.0062,.08652,-.12635,.00634,.08453,-.12642,.00653,.08155,-.12587,.00643,.07609,-.12157,.01556,.075,-.11797,.00641,.07338,-.12001,.01573,.07763,-.11935,.00685,.07744,-.125,.0061,.09013,-.12414,.00613,.08879,-.12503,.01904,.09116,-.11316,.01253,.09084,-.12092,.0061,.09073,-.12374,.00881,.09238,-.1214,.01139,.09238,-.12088,.00508,.0922,-.12096,.01313,.09232,-.12004,.0216,.0905,-.1094,.01152,.09083,-.11904,.00228,.09218,-.12091,.02903,.09241,-.10574,.02995,.0918,-.10487,.02472,.0929,-.11155,.02626,.0928,-.10924,.00871,.09355,-.12052,.01118,.09354,-.11986,.02874,.09072,-.10457,.02546,.09054,-.10656,.02057,.08821,-.10688,.01304,.08897,-.11596,.00217,.09352,-.12082,.00518,.09348,-.12078,.00662,.09026,-.12126,.01302,.09348,-.11893,.02,.09322,-.11453,.00463,.09732,-.12016,.00769,.09775,-.11957,.00187,.09666,-.1205,.00766,.08855,-.11857,.01036,.09758,-.11816,.01205,.0974,-.11717,.02752,.0888,-.10314,.0241,.08785,-.10454,.02322,.09568,-.1097,.02514,.0952,-.10742,.01877,.09636,-.11274,.0199,.0841,-.10699,.0139,.08435,-.11449,.02963,.09334,-.10361,.03072,.09203,-.10291,.02375,.08416,-.10409,.0298,.09563,-.10276,.0313,.09247,-.10148,.00184,.10237,-.12062,.00444,.10261,-.12037,.00736,.10295,-.11962,.00742,.08345,-.11821,.00991,.10306,-.1181,.01156,.10286,-.1171,.02744,.08573,-.10222,.02239,.1005,-.10954,.02477,.09956,-.10724,.01844,.10166,-.11236,.01926,.08052,-.10651,.01417,.07966,-.11302,.01918,.07507,-.103,.01494,.0734,-.10699,.0234,.08126,-.1034,.03035,.09814,-.1016,.03193,.0931,-.10008,.0018,.10764,-.11996,.00426,.10813,-.11966,.007,.10837,-.11898,.00706,.07891,-.1174,.00942,.10828,-.11762,.01106,.10808,-.11662,.0274,.08354,-.10124,.0218,.1053,-.1091,.02453,.10399,-.10674,.01754,.10632,-.11206,.00989,.04656,-.02203,.00779,.05599,-.01378,.02184,.11101,-.107,.02498,.10925,-.10476,.01778,.1128,-.10954,.00889,.06701,-.06252,.00691,.11504,-.11605,.00944,.11506,-.11479,.02048,.07003,-.09539,.01487,.06887,-.09869,.0236,.07686,-.10049,.00755,.0654,-.08216,.0318,.10128,-.09928,.03335,.09378,-.09752,.00167,.11384,-.11676,.00731,.06607,-.10165,.0039,.11459,-.11666,.00544,.07217,-.11173,.01114,.11477,-.11383,.02789,.08039,-.0984,.0014,.12274,-.10619,.00409,.12378,-.10607,.00707,.12438,-.10559,.01037,.12424,-.10468,.0121,.12379,-.10403,.03031,.07788,-.09208,.02532,.07289,-.09354,.0235,.11861,-.09964,.02728,.11606,-.0981,.01926,.12103,-.10086,.02297,.07088,-.08038,.01661,.06769,-.08141,.03498,.10499,-.09356,.03649,.09529,-.09198,.02783,.07381,-.07946,.03802,.10846,-.08105,.03918,.09708,-.07984,.00157,.13108,-.0888,.00479,.13248,-.08848,.00804,.13322,-.08813,.01146,.13298,-.08773,.0133,.13237,-.08738,.03266,.07669,-.07948,.02528,.12587,-.08584,.02944,.12287,-.08536,.02191,.12798,-.08605,.01794,.0687,-.06191,.02546,.07033,-.06108,.02048,.05104,-.02537,.02942,.05669,-.02963,.03034,.0739,-.06074,.04295,.11189,-.06134,.04363,.09895,-.06028,.00174,.13456,-.06456,.00601,.13624,-.06401,.01033,.13724,-.0637,.01468,.13726,-.06361,.01867,.13562,-.06335,.03551,.07668,-.0619,.03043,.13001,-.06316,.0347,.12677,-.06284,.02684,.1323,-.06322,.00192,.13081,-.04139,.00601,.132,-.04009,.01001,.13271,-.03967,.01415,.13266,-.03953,.01776,.13092,-.03958,.03576,.07684,-.03872,.0333,.06498,-.03655,.02977,.12587,-.03914,.03439,.12229,-.03876,.02584,.12833,-.03931,.01355,.05864,-.01298,.01996,.0633,-.0132,.04322,.1083,-.03716,.04208,.09774,-.0368,.02594,.11416,-.01872,.03068,.11162,-.01787,.02174,.1159,-.01932,.00824,.11891,-.02022,.0112,.11887,-.02011,.02491,.07039,-.01236,.03868,.102,-.01596,.03702,.09528,-.01336,.00203,.11755,-.02132,.00454,.11836,-.02058,.01439,.11767,-.02041,.0258,.08072,-.01226,.01998,.08606,-.00834,.01796,.08389,-.00881,.00989,.08158,-.00946,.0148,.08191,-.00835,.00534,.08018,-.00893,.01814,.0991,-.00854,.02002,.0983,-.0083,.01693,.1016,-.00823,.01752,.11653,-.02071,.01369,.10243,-.00809,.0274,.09584,-.00722,.02544,.09163,-.00767,.00209,.10008,-.0105,.00378,.10212,-.00853,.00625,.10244,-.0083,.0088,.10057,-.00866,.01085,.10056,-.00859,.01948,.23848,-.11434,.01883,.24731,-.11148,.00644,.06973,-.11801,.0155,.07166,-.1161,.03678,.09053,-.10764,.03463,.08803,-.10828,.03456,.09104,-.10903,.03631,.08713,-.10714,.02849,.07816,-.11063,.03232,.08111,-.10847,.02308,.07469,-.11281,.00766,.03816,-.10092,.01652,.04028,-.09094,.00708,.0381,-.0944,.01732,.04043,-.09817,.05694,.06985,-.05261,.06454,.08114,-.04907,.06148,.077,-.04396,.06006,.07433,-.05869,.05387,.07715,-.01096,.06071,.09061,-.00437,.05609,.08137,-78e-5,.05861,.08438,-.01502,.04883,.06406,-.00517,.05293,.06925,.00385,.04885,.04776,.00191,.05195,.05382,.00995,.0503,.02953,.01056,.05192,.03266,.01937,.05498,.00962,.02033,.05794,.01403,.02932,.04628,.06482,-.02554,.05557,.07684,-.02476,.0503,.07008,-.01902,.05172,.06996,-.03314,.04099,.05564,-.01648,.0449,.06092,-.01032,.04024,.03995,-.00884,.0455,.04358,-.00496,.04445,.02291,-.00422,.04734,.02602,.00263,.04898,.00528,.00406,.05274,.00733,.0118,.06955,.09152,-.03913,.06632,.08749,-.03376,.01572,.04039,-.08245,.00674,.03893,-.07589,.0066,.03792,-.08623,.01486,.04163,-.07172,.00624,.03949,-.06132,.01324,.04124,-.05815,.00454,.03774,-.04186,.00978,.03871,-.04002,.00343,.02675,-.02936,.00784,.02717,-.02802,.01907,.01321,-.01849,.01318,.02744,-.02681,.01835,.02839,-.02443,.0137,.01144,-.02176,.00407,.01,-.02501,.0088,.01027,-.02388,.02597,.04255,-.03101,.02309,.03023,-.02113,.02118,.0409,-.03397,.04482,.00257,-.00294,.03966,.01997,-.00869,.03521,.03672,-.01187,.05315,.06456,-.06014,.05497,.06774,-.06599,.06487,.24263,-.08132,.0561,.07536,.01672,.05857,.08687,.01313,.05954,.01801,.03864,.05378,.03755,.02968,.0538,.06022,.02102,.05602,.07903,.03192,.05833,.09054,.02924,.05334,.06449,.03445,.05537,.04332,.04146,.05982,.02216,.04891,.05401,.08148,.04768,.05534,.09239,.04591,.06792,.00829,.06766,.07084,.00434,.05776,.05876,.02693,.06014,.05396,.06756,.04992,.05508,.04784,.0541,.05062,.08362,.06161,.05118,.0936,.06085,.06133,.01109,.07787,.05352,.03036,.07016,.0501,.06998,.06302,.0506,.05183,.0655,.0417,.08539,.0702,.04276,.09509,.07027,.04904,.01229,.08484,.04144,.03072,.07726,.0412,.07176,.07066,.04126,.05299,.07262,.02872,.08734,.07369,.02993,.09706,.07508,.03629,.01271,.0887,.02993,.03086,.08016,.02807,.07429,.07319,.02834,.05495,.07481,.00648,.1002,.07625,.00588,.09006,.07397,.0082,.03144,.07979,.0108,.01192,.08776,.00553,.07638,.07141,.0057,.05704,.07273,.04858,.25932,.08414,.03652,.29008,.06359,.03348,.26399,.08882,.05332,.28374,.05959,.02035,.2937,.0654,.01796,.26623,.09042,.07184,.23964,.06236,.0649,.27202,.05275,.06149,.25135,.07658,.07664,.25799,.04279,.08777,.20291,.02762,.08776,.22583,.02476,.08504,.21499,.03822,.08959,.21056,.01709,.08266,.24089,.03335,.07938,.22739,.04985,.08333,.14696,-.03972,.08413,.15901,-.03516,.08378,.14586,-.03334,.08356,.15952,-.04115,.08357,.17334,-.0379,.0825,.17269,-.0439,.08488,.25534,-.01129,.08932,.23392,.00686,.08888,.23578,-.00941,.0848,.25206,.01112,.08189,.13476,-.0395,.08245,.13307,-.03214,.06635,.13862,.04352,.06367,.15128,.05933,.06131,.13784,.05623,.06869,.15047,.04662,.07662,.2707,.01482,.07591,.27504,-.01462,.05446,.13841,.06876,.05642,.15252,.07212,.06644,.0875,-.05626,.07177,.09755,-.04741,.06124,.09626,.00895,.06125,.10176,.02581,.0572,.10147,.04532,.0514,.10178,.06029,.042,.10318,.07103,.03046,.1046,.07596,.06334,.14075,-.09593,.06422,.14963,-.0937,.06756,.14563,-.09006,.05945,.14542,-.09914,.05741,.16673,-.0975,.05994,.16525,-.09582,.05832,.15607,-.09764,.05394,.15312,-.1016,.06268,.1634,-.0931,.0584,.16225,-.09671,.06112,.15991,-.09484,.05647,.14936,-.10061,.06096,.15316,-.09607,.07637,.10463,-.03209,.07286,.10206,-.0236,.07607,.10925,-.04144,.00779,.03896,-.10384,.01766,.04111,-.10144,.02677,.04574,-.09637,.03535,.05026,-.08542,.02669,.04469,-.09235,.03488,.05195,-.08984,.03504,.04892,-.07957,.0259,.04382,-.08604,.04264,.05593,-.07872,.04225,.0581,-.08338,.0427,.05398,-.0733,.03762,.0524,-.05802,.0273,.04829,-.05002,.03143,.04894,-.06287,.03248,.05119,-.04578,.01588,.03959,-.03764,.02458,.01436,-.01632,.02064,.04453,-.05434,.0236,.04513,-.06758,.0337,.04847,-.0721,.02465,.04399,-.07802,.04068,.05297,-.06635,.05474,.0718,-.07201,.06109,.07928,-.06509,.03956,.05738,-.03631,.04801,.06487,-.04034,.04265,.0603,-.03128,.04499,.06073,-.04684,.03523,.01763,-.01157,.03164,.03476,-.01441,.04163,19e-5,-.01001,.05278,.06752,-.04685,.05686,.07368,-.03866,.06473,.09173,-.01901,.06487,.09827,-.00845,.04904,.06252,-.05402,.06119,.0821,-.02911,.06434,.10388,.00296,.08748,.19206,.01895,.08882,.19822,.01002,.08734,.18287,.01208,.08795,.18686,.00548,.08309,.13232,-.0253,.08424,.145,-.02744,.07996,.11953,-.03155,.08046,.11852,-.02192,.0634,.20178,.07837,.05755,.22732,.08713,.05362,.20576,.09101,.06739,.21995,.0728,.06482,.10964,.01397,.00695,.11435,.07993,.00671,.10838,.0777,.01952,.12656,.08404,.00914,.13692,.09043,.00768,.12616,.08447,.02153,.13727,.08947,.03247,.12649,.08165,.03421,.13729,.08567,.04249,.11016,.07182,.0311,.11144,.0776,.05236,.10936,.06162,.05822,.10936,.04766,.06228,.1105,.03127,.01775,.09913,.07589,.01823,.10681,.07723,.05892,.16798,.07618,.06655,.16585,.06354,.01224,.15185,.09846,.01391,.16931,.10456,.07238,.1635,.05104,.04742,.15346,.08286,.03918,.17021,.09637,.03695,.15307,.09112,.04978,.16976,.08767,.0731,.14957,.03636,.07691,.16013,.03925,.08046,.1761,.04042,.07816,.19117,.05125,.07546,.17852,.05327,.08304,.186,.03739,.06098,.18514,.07994,.05141,.18755,.0917,.06911,.182,.06671,.07189,.19685,.06542,.0137,.19025,.10658,.01512,.21338,.10646,.04253,.20896,.09954,.04032,.18905,.09935,.04548,.23246,.09592,.08525,.19464,.03331,.0817,.20327,.04712,.07561,.21197,.05984,.01667,.23705,.10294,.01435,.30569,-.05638,.01823,.31525,-.02311,.06155,.28729,-.04559,.04627,.29753,-.05088,.0531,.2607,-.0834,.06731,.25114,-.07295,.0508,.25074,-.09161,.0776,.23766,-.06124,.08246,.22262,-.05053,.0325,.3125,-.02255,.03623,.30892,.02332,.04535,.13868,.07884,.00752,.24806,-.11299,.00737,.23974,-.1162,.03564,.25594,-.0998,.03752,.26734,-.0918,.07936,.24358,-.05333,.06911,.25801,-.065,.08461,.22782,-.04328,.02508,.1523,.0966,.08767,.23489,-.02327,.08304,.25339,-.02962,.07418,.27224,-.038,.055,.26906,-.07558,.06875,.10664,-.01282,.06763,.11059,-.00196,.06764,.11574,.00666,.06559,.11537,.02003,.07504,.1489,.02677,.07804,.15787,.02825,.08191,.17294,.02879,.08431,.18023,.02566,.0861,.18696,.02303,.0717,.26528,-.05486,.08123,.24884,-.04368,.08666,.23219,-.03463,.05821,.27814,-.06498,.00955,.2828,-.08972,.00781,.27287,-.09775,.01646,.07524,.07318,.01664,.05558,.07448,.02096,.3129,.02312,.06838,.13018,.02909,.07249,.14038,.02398,.07024,.13889,.03244,.0704,.13307,.02089,.02863,.30344,-.0553,.04242,.28607,-.07224,.02468,.28938,-.07764,.00739,.25921,-.10693,.02718,.16952,.10249,.01691,.0892,.07416,.03145,.23556,.10123,.01129,.29099,-.07945,.01904,.03185,.08312,.02292,.01219,.08796,.02734,.18958,.10458,.02915,.21152,.10446,.03961,.27643,-.08326,.00701,.06534,-.11839,.01942,.15846,-.11053,.01411,.1602,-.11298,.01607,.16177,-.11113,.01806,.15653,-.11191,.04187,.06007,-.08742,.03458,.05359,-.09312,.02668,.04718,-.09931,.01775,.04256,-.10457,.00805,.04032,-.10717,.03301,.04757,-.02366,.0367,.05052,-.01954,.07786,.1492,.0192,.07992,.15653,.02016,.083,.16831,.02018,.08482,.1744,.01822,.02044,.27107,-.09655,.01914,.25775,-.10576,.02218,.28039,-.08812,.04188,.17771,-.1078,.03737,.17779,-.10768,.03734,.17778,-.10848,.04184,.17782,-.10668,.05212,.17413,-.10337,.05262,.17324,-.10384,.05262,.17316,-.10267,.05204,.1741,-.10481,.05144,.1749,-.10397,.05135,.17479,-.10546,.04925,.17615,-.10534,.04919,.17603,-.10674,.046,.177,-.1068,.04602,.1769,-.10811,.03268,.17682,-.10808,.02364,.16918,-.10408,.02221,.17003,-.10495,.02422,.1725,-.10554,.02504,.17174,-.10436,.02321,.17162,-.10496,.02567,.1726,-.10469,.02216,.17088,-.10522,.02693,.16835,-.10542,.0252,.16859,-.10554,.02548,.16872,-.10468,.02662,.16824,-.1061,.03312,.16721,-.10723,.02892,.16774,-.10698,.02909,.16784,-.1063,.03312,.16721,-.10783,.02539,.17342,-.10592,.03737,.16678,-.10799,.03731,.16674,-.10855,.02824,.17516,-.10678,.04885,.16883,-.10487,.04638,.16777,-.10648,.04618,.16774,-.10602,.04903,.16884,-.10522,.05155,.17053,-.10268,.05099,.17012,-.10387,.05098,.17011,-.10336,.05154,.17054,-.10336,.05252,.17189,-.1019,.05203,.17106,-.10274,.0521,.171,-.10211,.0524,.17188,-.1026,.05273,.1725,-.10211,.05273,.17249,-.10296,.03724,.1676,-.10333,.03312,.1673,-.10655,.03329,.16784,-.10288,.03731,.16698,-.10714,.0482,.16879,-.10034,.04568,.16792,-.10502,.04568,.16823,-.10154,.04811,.16894,-.10376,.05186,.17332,-.09785,.0522,.1725,-.10067,.05202,.17252,-.09731,.05208,.17317,-.10091,.0421,.17706,-.1034,.04567,.17698,-.10512,.04615,.17651,-.10226,.02614,.17386,-.10176,.02824,.17516,-.10618,.02825,.17506,-.10289,.02633,.17342,-.10501,.02926,.16795,-.1056,.02885,.16855,-.10165,.0521,.17196,-.10063,.05206,.17179,-.09697,.0488,.17591,-.10322,.04879,.17604,-.10079,.02515,.17192,-.10154,.02575,.17285,-.10153,.02752,.16872,-.10122,.02614,.16885,-.10411,.02666,.1689,-.10105,.02724,.16844,-.10472,.05179,.171,-.10094,.05216,.17122,-.09692,.05086,.17506,-.10171,.0506,.17501,-.09932,.02458,.17105,-.10148,.02436,.17101,-.10428,.0516,.17058,-.09758,.05042,.17011,-.10214,.05105,.16994,-.09824,.0512,.17054,-.10153,.05156,.17407,-.10124,.05136,.17423,-.09862,.02443,.17058,-.10147,.02436,.1702,-.1041,.03247,.17621,-.10388,.03769,.177,-.10416,.03264,.17692,-.10752,.02497,.1698,-.10134,.0253,.1695,-.10392,.02704,.17932,-.10344,.03158,.18168,-.10445,.03622,.16058,-.10426,.03116,.16139,-.10372,.0504,.16464,-.10044,.04727,.1626,-.10207,.05371,.17485,-.09775,.05416,.17317,-.09726,.04214,.18298,-.10369,.04638,.18185,-.10234,.02406,.17674,-.1021,.02753,.16268,-.10265,.05429,.17153,-.09707,.04945,.18026,-.10084,.02153,.17249,-.09991,.0224,.17443,-.10093,.02548,.16379,-.10174,.0238,.16514,-.10086,.05412,.16998,-.0972,.05158,.1784,-.09948,.02118,.17077,-.09925,.05359,.16853,-.09779,.0526,.16687,-.09875,.05288,.17662,-.09851,.02131,.16916,-.09928,.03704,.18301,-.10452,.02206,.16726,-.09976,.01974,.16848,-.09643,.0195,.17082,-.09667,.03054,.18606,-.10002,.03653,.18754,-.09995,.05405,.17844,-.09462,.05498,.17609,-.09386,.04214,.18722,-.09919,.0206,.16579,-.0964,.02549,.183,-.09935,.03608,.15598,-.09931,.03029,.1572,-.09896,.0519,.16216,-.09577,.0485,.15916,-.0972,.05548,.17381,-.09336,.04674,.18562,-.09805,.02219,.17939,-.0983,.02651,.15906,-.09822,.05561,.17152,-.09317,.05016,.18336,-.09679,.01968,.17324,-.09689,.02044,.17606,-.09734,.02425,.16076,-.09757,.02237,.16283,-.09697,.0554,.16933,-.0933,.05252,.18088,-.09559,.05491,.16738,-.09372,.05394,.16513,-.0945,.04181,.18959,-.09437,.04655,.18781,-.09356,.02122,.18124,-.09406,.02472,.18533,-.09464,.02994,.155,-.09392,.02611,.15708,-.09361,.05592,.17425,-.08969,.05606,.17152,-.08947,.05012,.1853,-.09262,.01856,.17392,-.09308,.01934,.1773,-.0935,.02376,.15902,-.0933,.02171,.16144,-.09304,.05582,.1689,-.08951,.05266,.18252,-.09167,.01843,.17099,-.09282,.0553,.16663,-.08976,.05434,.16411,-.09024,.05432,.17971,-.09084,.01877,.16818,-.0927,.02995,.18858,-.09499,.03605,.19003,-.0949,.05537,.17698,-.09016,.01976,.16494,-.09278,.03589,.15361,-.09392,.05232,.1608,-.09108,.04883,.15736,-.09214,.0357,.19085,-.0909,.04133,.19044,-.09056,.01952,.1646,-.0899,.01843,.16813,-.08994,.02466,.18629,-.09085,.02978,.18943,-.091,.03571,.153,-.08974,.02987,.15437,-.09002,.05208,.16039,-.08752,.0486,.15686,-.08822,.05518,.17748,-.08734,.05578,.17453,-.08692,.04604,.1887,-.09,.0211,.18221,-.09061,.02611,.15642,-.09004,.05592,.17154,-.08668,.04967,.18619,-.08932,.01822,.17444,-.09018,.01909,.1781,-.09037,.02376,.15838,-.08999,.02161,.16087,-.08993,.05564,.16873,-.08663,.05228,.18335,-.08858,.01806,.17123,-.09004,.05508,.16634,-.08675,.0541,.16376,-.08701,.05406,.18041,-.08791,.05174,.18371,-.0862,.05358,.18076,-.08568,.05476,.17777,-.08521,.05539,.17473,-.08482,.05524,.16878,-.08447,.05554,.17165,-.08456,.01955,.16463,-.0876,.01843,.16828,-.08773,.05366,.16384,-.08458,.05466,.16638,-.08448,.0482,.15702,-.08524,.05166,.16052,-.08482,.02981,.15448,-.08707,.03551,.15316,-.08654,.04084,.19055,-.0876,.04546,.18893,-.08723,.02616,.15644,-.08732,.02488,.18654,-.08794,.02977,.1895,-.08792,.01806,.17153,-.0878,.01829,.17489,-.08785,.01926,.17862,-.08789,.02384,.15835,-.08743,.02168,.16084,-.08749,.02135,.18265,-.08791,.03541,.19087,-.08783,.04908,.18652,-.08674,.04836,.18653,-.08435,.05105,.1838,-.08398,.01862,.17526,-.08563,.0197,.17896,-.08554,.02183,.1828,-.08544,.02623,.15689,-.0848,.02399,.15871,-.08504,.03528,.1538,-.08363,.02976,.15503,-.08434,.02522,.1864,-.08532,.02986,.18914,-.08516,.05495,.17185,-.08257,.05465,.169,-.08244,.04034,.19025,-.08492,.0448,.18878,-.08468,.05406,.16666,-.08237,.05293,.18092,-.0836,.03517,.19048,-.08504,.01864,.16858,-.08561,.01832,.17186,-.08568,.05107,.16099,-.08232,.04765,.15757,-.0825,.05413,.17798,-.08322,.01974,.16493,-.0854,.05479,.17495,-.08286,.05306,.16421,-.08232,.05366,.16937,-.08015,.0531,.16716,-.08003,.05008,.18361,-.0815,.05196,.18088,-.08129,.02578,.18586,-.08256,.03007,.18833,-.08231,.02026,.16549,-.08286,.01919,.16903,-.08315,.01894,.17221,-.08322,.05014,.16183,-.07964,.04679,.15858,-.07964,.05316,.17809,-.08099,.03503,.18959,-.08218,.03984,.18948,-.08215,.01933,.17551,-.08309,.02986,.1561,-.08138,.02648,.15778,-.08202,.0538,.17518,-.0806,.0205,.17908,-.08292,.0226,.18264,-.08278,.05212,.16486,-.07985,.05394,.17214,-.08029,.04399,.18822,-.08201,.0474,.18617,-.08176,.02434,.15946,-.08237,.03512,.15503,-.08057,.02058,.16966,-.07979,.02039,.17256,-.07986,.04849,.16324,-.07658,.04541,.16037,-.07648,.0503,.1804,-.0783,.05141,.17791,-.07806,.0351,.1879,-.07883,.03934,.18788,-.07888,.02088,.1756,-.07969,.03044,.15802,-.07789,.02732,.1594,-.07858,.05195,.17525,-.07768,.02208,.17885,-.07951,.02405,.18198,-.07942,.05039,.16589,-.0769,.05207,.17244,-.07738,.04296,.18686,-.07879,.04601,.18509,-.07858,.02689,.1847,-.07921,.02534,.16085,-.07896,.03517,.15722,-.07714,.05184,.1699,-.07726,.0485,.18281,-.07841,.0307,.18678,-.07892,.05134,.16792,-.07715,.02159,.1664,-.07944,.04121,.16829,-.07084,.04548,.16537,-.0733,.04054,.16705,-.07098,.04702,.16736,-.0735,.0478,.16894,-.07363,.04142,.17082,-.07056,.04817,.17056,-.07366,.04146,.16943,-.0707,.02945,.18245,-.0751,.03308,.17861,-.07165,.02723,.18043,-.07511,.03402,.1799,-.07201,.04022,.17879,-.07156,.047,.17906,-.07446,.04084,.17741,-.0712,.04555,.18096,-.07459,.03565,.1608,-.07369,.03884,.16451,-.07162,.03995,.16146,-.07343,.03644,.16414,-.0717,.03947,.18,-.07196,.04361,.18271,-.07477,.03215,.16133,-.07404,.03536,.16496,-.07142,.04314,.16321,-.07327,.03967,.16573,-.07126,.03521,.1809,-.07234,.03558,.18482,-.07508,.0363,.18176,-.07274,.03233,.18394,-.07502,.04787,.17708,-.07424,.04117,.17587,-.07087,.03809,.18181,-.07279,.04136,.18408,-.07501,.03874,.18097,-.07236,.03878,.18487,-.07517,.0331,.16789,-.07087,.02509,.16786,-.07481,.03221,.16974,-.07076,.02665,.1651,-.07465,.0297,.16228,-.0744,.03443,.16582,-.07122,.02419,.17051,-.07508,.03166,.17162,-.07079,.04824,.17492,-.07394,.04129,.17422,-.07062,.03379,.16669,-.07104,.02813,.16337,-.07459,.04831,.17263,-.07372,.04135,.17248,-.07051,.02406,.1729,-.07517,.03156,.17341,-.07087,.02564,.178,-.07505,.03185,.17521,-.07102,.02456,.17538,-.07508,.03239,.177,-.07129,.04094,.15806,-.07664,.06719,.15421,-.08944,.07037,.15088,-.08564,.07987,.12284,-.03972,.0783,.11677,-.01142,.064,.15718,-.09256,.05602,.16442,-.09818,.05306,.16722,-.10163,.05435,.16591,-.10013,.05176,.16853,-.10286,.051,.16942,-.10376,.03002,.01612,-.0137,.02747,.03238,-.01736,.02998,.04495,-.02683,.03643,.05408,-.04099,.04186,.05654,-.05237,.04524,.05806,-.06028,.0483,.05932,-.06674,.04931,.06167,-.0724,.04859,.06463,-.0774,.0479,.06726,-.08249,.00778,.13128,-.13903,.03354,.08576,-.1084,.03473,.08431,-.10753,.03137,.08798,-.10976,.02995,.08947,-.11009,.03074,.08869,-.10998,.02945,.09,-.11033,.02898,.09041,-.11052,.02866,.09072,-.11011,.0284,.09097,-.10914,.02852,.09119,-.1073,.02934,.09126,-.10471,.02912,.09042,-.10302,.02938,.0891,-.10184,.02966,.08832,-.10067,.03062,.08708,-.09797,.03341,.08659,-.09203,.03593,.08688,-.07966,.03956,.08782,-.06109,.0379,.08802,-.03772,.0314,.08815,-.01194,.0227,.08885,-.008,.0237,.09708,-.00776,.03468,.10681,-.01692,.03881,.1153,-.03797,.03882,.11933,-.06209,.03372,.11567,-.08321,.03113,.11052,-.09583,.02839,.10526,-.10201,.02743,.10106,-.10417,.02729,.0976,-.105,.02738,.09427,-.10552,.02765,.0926,-.10748,.02778,.09186,-.10931,.02821,.09144,-.11057,.02879,.09134,-.11116,.02932,.09139,-.11128,.02988,.09143,-.11114,.0309,.09163,-.11102,.03182,.09178,-.11064,.03258,.09238,-.11044,.03436,.09328,-.1097,.03596,.09403,-.1089,.01139,.13122,-.13585,.01459,.13084,-.13262,.01061,.12814,-.13642,.01374,.12824,-.13325,.01759,.12995,-.12802,.01943,.12828,-.12418,.03378,.09773,-.11116,.02056,.1264,-.12108,.07576,.17208,-.07247,.07562,.18049,-.07082,.07766,.17184,-.06692,.07372,.17954,-.07584,.07265,.18888,-.0773,.07087,.18683,-.08147,.06857,.1965,-.0856,.06674,.19355,-.08873,.06019,.1997,-.09631,.05261,.20879,-.10259,.06178,.20354,-.09416,.05141,.20441,-.10387,.04154,.21257,-.10986,.04098,.20766,-.11054,.03006,.21526,-.11573,.02969,.20965,-.11636,.01855,.21664,-.12035,.01835,.2106,-.12076,.00732,.21694,-.12257,.0075,.21068,-.12317,.02075,.12533,-.11868,.02108,.12479,-.11633,.04008,.14274,-.11176,.02563,.14456,-.11374,.0291,.14753,-.113,.03396,.13961,-.11389,.01684,.15437,-.1136,.01169,.15487,-.11834,.0126,.15829,-.11546,.01556,.1513,-.11616,.00409,.14974,-.12854,.00772,.15322,-.12385,.00756,.14843,-.12672,.00416,.15492,-.12584,.02183,.15095,-.1126,.02014,.14796,-.11461,.01974,.12137,-.11815,.03006,.15031,-.11202,.02363,.15558,-.11069,.03055,.15301,-.11086,.02306,.15338,-.11178,.00721,.22411,-.12124,.01897,.22324,-.11942,.03101,.2214,-.11495,.04249,.21816,-.10834,.01466,.1129,-.12205,.02228,.11818,-.1165,.01968,.11401,-.11908,.00707,.128,-.13937,.02999,.10258,-.11478,.02414,.16808,-.10585,.02324,.16726,-.10604,.02227,.16669,-.10619,.02117,.1657,-.10624,.01792,.16322,-.10873,.01958,.16457,-.10669,.05416,.21368,-.10067,.02414,.12578,-.11548,.03924,.14778,-.1104,.02188,.16114,-.0852,.02231,.1618,-.08258,.0235,.163,-.07914,.06376,.20773,-.09144,.00865,.05128,-.11623,.00811,.05797,-.11873,.03883,.15145,-.10939,.01702,.12785,-.12882,.07854,.16336,-.0654,.0766,.16462,-.07127,.01571,.06738,-.11567,.02738,.11934,-.11504,.02329,.07024,-.11153,.0298,.07356,-.10841,.03494,.07714,-.10595,.02054,.13769,-.11663,.02441,.13324,-.11554,.03833,.08064,-.10441,.03961,.08518,-.10459,.03994,.08988,-.10538,.03865,.09473,-.10717,.03606,.09942,-.10997,.03188,.10508,-.11346,.03708,.1146,-.11078,.03538,.10702,-.11138,.03126,.11293,-.11333,.0407,.10852,-.10834,.07033,.19996,-.08142,.07465,.1915,-.07193,.07741,.18186,-.06503,.0794,.17186,-.06042,.07486,.12671,-.06863,.07169,.11245,-.06661,.07086,.1191,-.07481,.07567,.12134,-.06082,.08021,.16219,-.05885,.07997,.15281,-.0587,.07847,.155,-.06536,.07927,.14376,-.06034,.07783,.14698,-.06704,.07774,.13501,-.0637,.07643,.13927,-.07046,.07388,.13192,-.07546,.06983,.12508,-.08161,.05341,.07584,-.0789,.0086,.04298,-.11075,.00911,.04592,-.11309,.04592,.09587,-.10213,.04328,.08923,-.10253,.042,.09532,-.10489,.04652,.08861,-.09892,.0113,.15066,-.12158,.0176,.0532,-.11384,.01814,.04804,-.11053,.04249,.08327,-.10117,.04535,.08131,-.09676,.03821,.0685,-.09914,.03367,.05864,-.09992,.03244,.06238,-.103,.03977,.06502,-.09527,.0252,.05735,-.10838,.02638,.05252,-.10535,.04255,.07463,-.09688,.04814,.07952,-.09181,.0446,.07187,-.09228,.01807,.04544,-.10789,.02636,.0498,-.10282,.06808,.13069,-.08713,.07256,.13666,-.08134,.07903,.13074,-.05638,.07506,.14321,-.07652,.07621,.15017,-.07292,.01472,.14767,-.11893,.01837,.14442,-.1164,.07664,.15731,-.07147,.08146,.1506,-.05168,.08286,.16044,-.046,.08255,.14868,-.04494,.08189,.16118,-.05231,.08195,.17246,-.04836,.08108,.17203,-.05422,.07478,.16586,-.07634,.07498,.15959,-.07646,.07465,.15332,-.078,.07313,.14706,-.08118,.07024,.14107,-.08591,.06596,.13585,-.09164,.08062,.14051,-.05305,.08155,.13753,-.04568,.00726,.2301,-.11929,.0192,.23006,-.11716,.0313,.22808,-.11267,.04409,.22464,-.10644,.05626,.21952,-.09798,.07914,.18352,-.05939,.0801,.18512,-.05358,.07645,.19436,-.06643,.07936,.12653,-.04826,.07584,.11575,-.05201,.07208,.10514,-.05755,.0667,.10489,-.07459,.06604,.11284,-.08204,.05044,.09622,-.09761,.0502,.08797,-.09394,.01634,.06002,-.11543,.03689,.07266,-.10231,.03096,.06794,-.1059,.02388,.06358,-.11044,.04045,.07764,-.10099,.03386,.05592,-.09706,.0229,.14076,-.11494,.02861,.13606,-.1146,.04187,.13223,-.11105,.04621,.12551,-.10775,.03904,.10091,-.10768,.0437,.10224,-.10525,.04104,.06218,-.09127,.04656,.06943,-.08754,.05096,.0778,-.08599,.05466,.08723,-.08624,.05981,.08738,-.07566,.06662,.09612,-.06592,.06475,.11963,-.0885,.01699,.14117,-.11857,.01405,.14413,-.12168,.01103,.14658,-.12461,.02756,.11111,-.11572,.00721,.11969,.08197,.01879,.11348,.07924,.01915,.11948,.08144,.03196,.11825,.07955,.04375,.12689,.07564,.04302,.11777,.07327,.05318,.12653,.0661,.05249,.11711,.06439,.05984,.12697,.05321,.05892,.11723,.05053,.0647,.12761,.03912,.06376,.11844,.03599,.06678,.12222,.02497,.06884,.12634,.01684,.06858,.12037,.0129,.04926,.10336,-.10147,.05275,.11233,-.10068,.05473,.10512,-.09601,.04685,.11016,-.10495,.04355,.11671,-.1081,.05552,.09682,-.09097,.06046,.10793,-.08957,.05915,.11526,-.09523,.05298,.12824,-.10343,.05627,.13722,-.10166,.05968,.13139,-.09804,.04801,.13489,-.10697,.06086,.09923,-.08285,.05164,.14287,-.10526,.04932,.14732,-.10644,.0473,.1513,-.10579,.0456,.15527,-.10548,.04438,.15866,-.10535,.0437,.16124,-.1061,.04316,.16336,-.10698,.04243,.16492,-.10763,.04226,.1662,-.10801,.04172,.15594,-.07991,.04231,.15474,-.08291,.04276,.1541,-.08582,.0431,.15392,-.08903,.04333,.1545,-.09322,.04324,.15672,-.0986,.04266,.16102,-.10355,.04234,.16762,-.10265,.04196,.16714,-.10652,.04223,.1669,-.1076,.04223,.16687,-.10819,.06209,.12566,-.09296,.0499,.11893,-.10457,.05629,.12184,-.09965,.02545,.10824,-.11725,.025,.10458,-.11796,.02504,.10076,-.1185,.01222,.10709,-.12575,.02014,.10855,-.12028,.01872,.09175,-.12196,.01724,.0922,-.11801,.01549,.10967,-.12256,.01703,.09348,-.11684,.01552,.0973,-.11522,.01504,.10256,-.1151,.01481,.10783,-.11441,.01464,.11405,-.11111,.0158,.1226,-.10207,.01798,.13006,-.08663,.02267,.13403,-.06301,.02177,.1297,-.03894,.08633,.17892,.01559,.08341,.20725,-.04254,.08557,.21134,-.03582,.08729,.21514,-.02837,.08879,.21762,-.01932,.08988,.21856,-.00883,.08812,.20287,-.01684,.0888,.20375,-.00895,.08381,.19112,-.03684,.08514,.19591,-.0309,.08656,.19997,-.02473,.08737,.19061,-.01523,.08786,.19177,-.00924,.08458,.17378,-.03089,.0853,.18217,-.02632,.0863,.18734,-.02142,.0733,.13054,.0113,.0725,.12568,.00732,.07594,.14232,.01708,.07459,.13631,.01456,.0727,.12221,.00323,.07471,.11846,-.00314,.08915,.20273,-62e-5,.0881,.19104,-.00296,.09025,.2166,.00229,.08444,.15803,-.02936,.0879,.17975,.00398,.08849,.1755,.00678,.08465,.15832,.01362,.08184,.15007,.01264,.08364,.13313,-.02068,.08443,.144,-.02298,.09557,.16817,.0121,.10278,.1721,.01376,.09655,.17188,.01084,.10279,.16842,.01604,.08342,.11702,-.01025,.08285,.1234,-.01699,.07813,.12956,.00319,.07846,.12528,13e-5,.08538,.16096,-.02171,.08548,.15112,-.01848,.08518,.15254,-.02116,.08569,.15806,-.01891,.08392,.13109,.00216,.0914,.13399,.0107,.08525,.13607,.0052,.08994,.1281,.00678,.08622,.17785,-.01903,.08716,.18108,-.01423,.08494,.1548,-.02473,.08888,.17665,-.00528,.09017,.17665,-.00929,.08802,.17711,-.01007,.09422,.17926,-.00577,.08734,.11675,-.00949,.0899,.12086,-.00238,.08564,.11875,-.0024,.0893,.1203,-.00869,.0873,.17258,-.01292,.08735,.17561,-.0136,.08062,.14424,.01112,.08918,.12358,.00168,.0847,.12238,.00136,.08578,.16733,-.02018,.08603,.16381,-.01799,.09416,.16349,.01318,.10237,.16392,.01752,.08856,.1724,.00959,.0841,.13388,-.0179,.08645,.12654,-.01354,.08546,.12514,-.01523,.08501,.13494,-.016,.0861,.14126,.00763,.09392,.14345,.01552,.08753,.1446,.00948,.09266,.13872,.01312,.08876,.16598,-.01387,.09074,.16969,-.01224,.08672,.16844,-.01602,.08857,.12586,-.00804,.08712,.12968,-.01183,.08755,.1439,-.01427,.08639,.15032,-.0153,.0851,.14335,-.01715,.09469,.13661,.01028,.09205,.13015,.00517,.0934,.17473,-.00947,.08779,.1369,-.01404,.10552,.16686,.01495,.1047,.16264,.01625,.09014,.1256,-.00348,.08656,.15623,-.01566,.08737,.16145,-.01526,.10463,.17507,.00948,.10547,.17039,.01292,.10207,.17561,.01129,.10242,.15684,.01747,.09731,.15024,.0173,.10001,.15058,.0168,.10026,.15722,.0187,.09768,.145,.01525,.09078,.12709,.00116,.0966,.17678,-.00607,.09618,.1408,.01277,.10104,.17752,.00204,.09869,.1797,.00199,.09382,.17146,-.00906,.09707,.17442,-.00625,.0985,.14634,.01364,.09674,.14189,.01108,.10038,.17594,.00202,.10399,.17351,.00828,.08736,.14968,-.01308,.08748,.15492,-.01355,.09278,.1326,.00449,.09109,.12952,61e-5,.08981,.16406,-.01272,.09127,.16766,-.01126,.08862,.12924,-.0072,.08741,.13235,-.01045,.08962,.14371,-.01229,.09527,.13842,.00898,.08892,.13874,-.01183,.10429,.1656,.01338,.10364,.16124,.01458,.08972,.12845,-.00331,.08842,.15972,-.01351,.10493,.16936,.01177,.10292,.15643,.01501,.10081,.14992,.01518,.08896,.15847,-.01226,.08832,.15347,-.01129,.08814,.15402,-.01219,.08904,.15757,-.01126,.08968,.13158,-.00305,.09104,.13421,11e-5,.09106,.13261,3e-4,.08966,.13314,-.00306,.10331,.16464,.0121,.10316,.1682,.00937,.10382,.16862,.01028,.10084,.1642,.0112,.08593,.13984,-.01046,.08249,.13735,-.00856,.0856,.1358,-.0091,.08387,.14116,-.00949,.0929,.17326,-.00498,.09068,.17,-.0063,.09115,.17112,-.00709,.09254,.1722,-.00414,.09605,.14363,.00922,.0965,.14725,.01082,.09742,.14696,.01096,.09534,.14398,.00895,.08708,.14936,-.01076,.08767,.14945,-.01156,.0926,.1351,.00361,.09421,.14134,.00714,.09474,.14078,.00754,.09251,.13598,.00317,.08959,.16507,-.00904,.09023,.16614,-.01018,.1012,.16074,.0128,.10098,.16014,.01189,.08868,.13182,-.00668,.08863,.13391,-.00605,.08382,.14618,-.00942,.08632,.14951,-.01012,.08614,.14531,-.00984,.08186,.1428,-.00854,.09818,.17033,.0058,.10044,.16758,.00815,.09881,.17148,.00672,.09964,.15413,.01116,.09814,.14957,.01129,.09809,.14968,.01052,.09942,.15492,.01205,.09724,.14747,.01006,.09792,.17116,.00146,.09751,.1727,.002,.09257,.13706,.00305,.09136,.13538,2e-5,.0886,.16046,-.00938,.08928,.16409,-.00821,.0891,.16147,-.01038,.08837,.13618,-.00556,.08183,.1398,-.00739,.08464,.14449,-.00107,.08791,.14548,91e-5,.0857,.14374,91e-5,.08664,.14633,-25e-5,.08879,.15409,-.00757,.088,.15121,-.00654,.08777,.15191,-.00775,.08927,.15316,-.00641,.09396,.15966,.00113,.09794,.16092,.00282,.09527,.15904,.00214,.097,.1618,.00125,.08352,.14564,-.00271,.08567,.14729,-.0015,.0936,.14933,.00463,.09308,.14584,.00436,.09254,.14742,.0039,.09491,.148,.00523,.09876,.15767,.00523,.09617,.1582,.00307,.09858,.15968,.00409,.09661,.15716,.00392,.09475,.15301,.00536,.09594,.15023,.006,.09383,.15128,.0054,.09704,.15229,.00616,.08912,.14516,.00211,.0888,.14328,.00172,.08471,.14822,-.00244,.08311,.14872,-.00545,.08422,.14909,-.0031,.08306,.14717,-.00421,.09587,.15456,.00499,.09782,.15432,.00612,.09368,.16276,-.00305,.08873,.15834,-.0029,.09076,.1617,-.00454,.09049,.15949,-.00236,.09715,.14935,.00713,.09785,.15184,.00779,.09905,.15433,.00767,.09961,.16343,.00402,.09836,.16463,.00228,.08878,.15514,-.0086,.08789,.15239,-.00886,.08813,.15797,-.00751,.08801,.15623,-.00636,.08416,.1423,-.00214,.08707,.14112,-79e-5,.1003,.15842,.00684,.10025,.16154,.00565,.08238,.14804,-.00758,.08173,.14602,-.00601,.08897,.16483,-.00518,.08798,.15881,-.00517,.08887,.16158,-.00665,.09353,.14161,.00206,.09479,.1441,.00414,.09181,.14396,.00259,.08531,.15001,-.00826,.08512,.15017,-.0067,.08246,.14424,-.00388,.09211,.14064,43e-5,.09583,.16231,-54e-5,.0952,.16567,26e-5,.09601,.14675,.00589,.09106,.16592,-.0027,.08969,.1626,-.01157,.08912,.14478,-.01032,.08644,.17198,-.01746,.09484,.14257,.00505,.09468,.14212,.0067,.09293,.1383,.00251,.09067,.16884,-.00576,.089,.16296,-.00744,.09053,.16774,-.00533,.10091,.1598,.01073,.10075,.16324,.00809,.10054,.16408,.01003,.10121,.15943,.00952,.08989,.13739,-.00296,.08977,.13495,-.0031,.08604,.1388,-.00433,.08894,.1568,-.01038,.08801,.15275,-.00979,.0882,.15307,-.01054,.08881,.15605,-.00954,.09193,.13714,-14e-5,.09979,.16651,.00626,.08179,.14164,-.00592,.081,.14443,-.00757,.09196,.17094,-.0035,.09234,.1694,-.00334,.0958,.14418,.00824,.09737,.14851,.00924,.09619,.14557,.00706,.08564,.14975,-.00943,.08827,.15942,-.00851,.09859,.14947,.01164,.08714,.15613,-.00364,.08506,.15022,-.00488,.09275,.16004,-8e-5,.10027,.15487,.01262,.10272,.17179,.00728,.09725,.17411,.002,.09112,.14586,.00293,.0879,.1545,-.00512,.08719,.1545,-.00253,.08994,.15337,-.00396,.09016,.15242,-.00515,.08849,.15084,-.00492,.08699,.14965,-.0036,.08732,.14912,-.00295,.08812,.14858,-.00218,.08882,.14807,-.00114,.08965,.14748,-8e-5,.09024,.14684,.00101,.09058,.14636,.00181,.09138,.1473,.00257,.09198,.14884,.00342,.09208,.15062,.00416,.09181,.15238,.00479,.09238,.15388,.00473,.09341,.1551,.0044,.0936,.15658,.00373,.09299,.15718,.00286,.09224,.15764,.00186,.0915,.15799,74e-5,.09064,.15833,-22e-5,.08912,.15779,-.00139,.08809,.15649,-.00181,.09073,.15104,.00364,.09028,.15247,.00391,.08796,.1555,-58e-5,.08756,.15362,-.00134,.0975,.16937,.00118,.09187,.14974,.00236,.09132,.1482,.00175,.09025,.1528,-.00272,.08777,.15305,16e-5,.09024,.1521,-89e-5,.08906,.15496,.00173,.08833,.15509,64e-5,.08826,.1527,.00155,.09028,.15137,-.00338,.09086,.15067,-.0016,.08948,.14968,-.00311,.09014,.14929,-.00193,.09059,.14904,-61e-5,.09011,.15163,5e-4,.09119,.15029,-14e-5,.09005,.1513,.00236,.09162,.15016,.00112,.08918,.15256,.00301,.08981,.15486,.00283,.09086,.15454,.00382,.09097,.14874,67e-5,.08221,.1471,-.00898,.09911,.16794,.00392,.09892,.15428,.01012,.09806,.15114,.00978,.09559,.17486,.00724,.09287,.17678,.00158,.08959,.1499,.01194,.09124,.1578,.01316,.08478,.14344,-.01957,.08833,.16855,.01153,.08497,.16544,-.02512,.07894,.13429,.00624,.08771,.18194,-.00373,.08772,.18233,-.0098,.08029,.12102,-.0053,.08554,.17293,-.02262,.08687,.16441,.01285,.08002,.13949,.00904]),R3=new Uint16Array([0,1,2,0,3,1,4,5,6,4,7,5,8,6,0,8,9,6,9,4,6,9,10,4,11,10,9,11,12,10,13,9,8,13,11,9,14,12,11,14,15,12,16,11,13,16,14,11,17,15,14,17,18,15,19,14,16,19,17,14,20,18,17,20,21,18,22,17,19,22,20,17,23,21,20,23,24,21,25,20,22,25,23,20,26,24,23,26,27,24,28,23,25,28,26,23,29,27,26,29,30,27,31,26,28,31,29,26,32,30,29,32,33,30,34,29,31,34,32,29,35,36,37,35,38,36,39,37,40,39,35,37,41,42,43,41,44,42,44,45,42,44,46,45,47,44,41,47,48,44,48,46,44,48,49,46,50,48,47,50,51,48,51,49,48,51,52,49,53,1,3,53,54,1,55,5,7,55,56,5,57,56,55,57,58,56,59,54,53,59,60,54,61,58,57,61,62,58,63,60,59,63,64,60,65,62,61,65,66,62,67,64,63,67,68,64,69,70,71,69,72,70,73,74,75,73,76,74,77,72,69,77,78,72,79,76,73,79,80,76,81,78,77,81,82,78,83,80,79,83,84,80,85,36,38,85,86,36,87,49,52,87,88,49,88,46,49,88,89,46,89,90,91,89,92,90,93,30,33,93,94,30,94,27,30,94,95,27,95,24,27,95,96,24,96,21,24,96,97,21,97,18,21,97,98,18,98,15,18,98,99,15,100,10,12,100,101,10,102,7,4,102,103,7,103,55,7,103,104,55,101,4,10,101,102,4,105,61,57,105,106,61,104,57,55,104,105,57,99,107,100,99,108,107,109,69,71,109,110,69,110,77,69,110,111,77,111,81,77,111,112,81,113,114,109,113,115,114,71,66,65,71,70,66,75,68,67,75,74,68,106,115,113,106,116,115,117,114,115,117,118,114,118,119,114,118,120,119,120,121,119,120,122,121,122,123,121,122,124,123,125,126,127,125,128,126,129,130,131,129,132,130,132,133,130,132,134,133,128,131,126,128,129,131,135,128,125,135,136,128,136,129,128,136,137,129,137,132,129,137,138,132,138,134,132,138,139,134,140,136,135,140,141,136,142,143,144,142,139,143,141,137,136,141,145,137,145,138,137,145,146,138,146,139,138,146,143,139,147,141,140,147,148,141,144,149,150,144,143,149,148,145,141,148,151,145,151,146,145,151,152,146,152,143,146,152,149,143,90,153,154,90,92,153,155,92,156,155,153,92,157,156,158,157,155,156,159,160,161,159,162,160,163,164,165,163,166,164,167,168,169,167,170,168,166,171,164,166,172,171,170,165,168,170,163,165,172,108,171,172,173,108,174,175,107,174,176,175,177,178,179,177,180,178,176,181,175,176,182,181,183,179,184,183,177,179,180,116,178,180,185,116,182,184,181,182,183,184,117,116,185,117,115,116,108,174,107,108,173,174,127,186,125,127,187,186,125,188,135,125,186,188,135,189,140,135,188,189,140,190,147,140,189,190,191,192,193,191,194,192,195,193,196,195,191,193,197,198,199,197,200,198,201,199,202,201,197,199,200,196,198,200,195,196,187,194,186,187,192,194,203,204,205,203,206,204,206,207,204,206,208,207,209,205,210,209,203,205,208,211,207,208,212,211,212,213,211,212,214,213,202,214,201,202,213,214,215,197,201,215,216,197,201,217,215,201,214,217,218,191,195,218,219,191,219,194,191,219,220,194,221,206,203,221,222,206,222,208,206,222,223,208,224,203,209,224,221,203,223,212,208,223,225,212,226,195,200,226,218,195,227,209,228,227,224,209,225,214,212,225,217,214,216,200,197,216,226,200,186,220,188,186,194,220,188,229,189,188,220,229,189,230,190,189,229,230,231,216,215,231,232,216,232,226,216,232,233,226,233,218,226,233,234,218,235,230,229,235,236,230,237,235,219,237,238,235,239,234,233,239,240,234,219,229,220,219,235,229,241,232,231,241,242,232,238,236,235,238,243,236,242,233,232,242,239,233,244,238,237,244,245,238,245,243,238,245,246,243,247,248,249,247,250,248,250,251,248,250,252,251,252,253,251,252,254,253,255,221,224,255,256,221,257,223,222,257,258,223,256,222,221,256,257,222,259,217,225,259,260,217,261,224,227,261,255,224,258,225,223,258,259,225,262,260,259,262,263,260,264,259,258,264,262,259,265,258,257,265,264,258,231,217,260,231,215,217,231,263,241,231,260,263,266,267,268,266,269,267,247,270,271,247,269,270,272,267,249,272,273,267,274,275,266,274,276,275,277,278,279,277,280,278,281,282,283,281,284,282,285,286,287,285,288,286,289,288,285,289,290,288,291,288,292,291,286,288,290,292,288,290,293,292,294,282,295,294,296,282,297,298,299,297,296,298,298,294,300,298,296,294,295,284,301,295,282,284,283,296,297,283,282,296,302,303,304,302,305,303,300,286,291,300,294,286,306,307,308,306,309,307,310,311,312,310,313,311,314,315,316,314,317,315,308,318,319,308,307,318,320,317,321,320,315,317,316,322,323,316,315,322,319,324,325,319,318,324,326,315,320,326,322,315,323,327,328,323,322,327,325,329,330,325,324,329,331,322,326,331,327,322,332,333,334,332,335,333,336,337,332,336,338,337,339,306,340,339,341,306,342,343,344,342,345,343,346,345,342,346,347,345,308,340,306,308,348,340,319,348,308,319,349,348,325,349,319,325,350,349,330,350,325,330,351,350,335,351,330,335,352,351,332,352,335,332,337,352,336,346,338,336,347,346,311,345,347,311,313,345,313,343,345,313,353,343,354,355,356,354,357,355,341,353,358,341,343,353,359,285,287,359,360,285,289,361,362,289,363,361,362,364,365,362,361,364,366,347,336,366,311,347,367,368,369,367,370,368,328,371,372,328,327,371,373,327,331,373,371,327,338,374,375,338,346,374,375,337,338,375,376,337,350,377,378,350,351,377,340,379,380,340,348,379,381,346,342,381,374,346,348,382,379,348,349,382,339,380,383,339,340,380,351,384,377,351,352,384,385,342,344,385,381,342,376,352,337,376,384,352,349,378,382,349,350,378,386,371,373,386,387,371,388,389,390,388,391,389,392,393,394,392,395,393,335,329,333,335,330,329,334,336,332,334,366,336,344,341,339,344,343,341,306,358,309,306,341,358,344,383,385,344,339,383,396,394,397,396,392,394,398,399,400,398,401,399,402,387,386,402,403,387,377,404,405,377,384,404,406,374,381,406,407,374,408,384,376,408,404,384,375,407,409,375,374,407,380,410,411,380,379,410,379,412,410,379,382,412,409,376,375,409,408,376,413,385,383,413,414,385,382,415,412,382,378,415,383,411,413,383,380,411,378,405,415,378,377,405,414,381,385,414,406,381,416,414,413,416,417,414,417,406,414,417,418,406,419,417,416,419,420,417,420,418,417,420,421,418,416,411,410,416,413,411,406,409,407,406,418,409,409,421,408,409,418,421,421,404,408,421,405,404,420,405,421,420,415,405,419,415,420,419,412,415,416,412,419,416,410,412,397,422,423,397,394,422,394,424,422,394,393,424,391,425,389,391,426,425,427,387,403,427,428,387,426,429,430,426,431,429,430,432,433,430,429,432,434,435,436,434,437,435,436,438,439,436,435,438,439,440,441,439,438,440,442,443,444,442,445,443,446,445,442,446,447,445,448,449,450,448,451,449,452,451,448,452,453,451,454,455,456,454,457,455,458,459,460,458,461,459,462,426,430,462,425,426,433,462,430,433,463,462,434,463,433,434,464,463,439,465,436,439,466,465,441,466,439,441,467,466,468,469,470,468,471,469,472,456,473,472,454,456,461,474,459,461,475,474,396,457,392,396,455,457,476,477,478,476,479,477,480,481,482,480,483,481,484,485,486,484,487,485,488,489,490,488,491,489,492,493,494,492,495,493,496,497,498,496,499,497,500,501,502,500,503,501,504,499,496,504,505,499,506,503,500,506,507,503,508,505,504,508,509,505,510,507,506,510,511,507,512,509,508,512,513,509,514,511,510,514,515,511,516,497,517,516,487,497,499,517,497,499,518,517,505,518,499,505,519,518,509,519,505,509,520,519,513,520,509,513,521,520,495,482,493,495,480,482,502,477,500,502,522,477,479,500,477,479,506,500,506,401,510,506,479,401,398,510,401,398,514,510,523,457,454,523,524,457,525,475,461,525,526,475,527,454,472,527,523,454,392,524,395,392,457,524,528,524,529,528,395,524,523,529,524,523,530,529,527,530,523,527,531,530,531,526,532,531,527,526,525,532,526,525,533,532,534,530,531,534,535,530,535,529,530,535,536,529,537,538,539,537,540,538,528,536,541,528,529,536,542,532,533,542,543,532,433,437,434,433,432,437,450,447,446,450,449,447,436,464,434,436,465,464,475,473,474,475,472,473,483,486,481,483,484,486,503,498,501,503,496,498,507,496,503,507,504,496,511,504,507,511,508,504,515,508,511,515,512,508,526,472,475,526,527,472,533,544,545,533,525,544,543,531,532,543,534,531,545,542,533,545,546,542,517,547,548,517,518,547,518,549,547,518,519,549,516,548,550,516,517,548,545,551,552,545,544,551,458,525,461,458,544,525,520,553,554,520,521,553,519,554,549,519,520,554,555,453,452,555,556,453,554,557,558,554,553,557,559,467,441,559,560,467,548,561,562,548,547,561,563,458,460,563,564,458,552,565,566,552,551,565,549,558,567,549,554,558,552,546,545,552,568,546,547,567,561,547,549,567,564,544,458,564,551,544,550,562,569,550,548,562,441,570,559,441,440,570,558,571,572,558,557,571,561,573,574,561,567,573,567,572,573,567,558,572,566,568,552,566,575,568,569,576,577,569,562,576,578,564,563,578,579,564,580,560,559,580,581,560,559,582,580,559,570,582,562,574,576,562,561,574,583,566,565,583,584,566,579,551,564,579,565,551,585,556,555,585,586,556,587,565,579,587,583,565,588,586,585,588,589,586,572,590,591,572,571,590,574,592,593,574,573,592,573,591,592,573,572,591,584,575,566,584,594,575,577,595,596,577,576,595,597,579,578,597,587,579,598,581,580,598,599,581,580,600,598,580,582,600,576,593,595,576,574,593,584,601,602,584,583,601,603,602,601,603,604,602,605,583,587,605,601,583,606,589,588,606,607,589,591,608,609,591,590,608,593,610,611,593,592,610,592,609,610,592,591,609,602,594,584,602,612,594,596,613,614,596,595,613,615,587,597,615,605,587,616,599,598,616,617,599,598,618,616,598,600,618,619,620,621,619,622,620,595,611,613,595,593,611,623,617,616,623,624,617,616,625,623,616,618,625,626,621,627,626,619,621,613,628,629,613,611,628,604,630,631,604,603,630,632,601,605,632,603,601,627,633,626,627,634,633,635,607,606,635,636,607,609,637,638,609,608,637,634,639,633,634,640,639,611,641,628,611,610,641,610,638,641,610,609,638,604,612,602,604,642,612,614,629,643,614,613,629,644,605,615,644,632,605,638,645,646,638,637,645,639,647,642,639,640,647,628,648,649,628,641,648,641,646,648,641,638,646,631,642,604,631,639,642,643,650,651,643,629,650,652,632,644,652,653,632,654,624,623,654,655,624,623,656,654,623,625,656,657,642,647,657,612,642,629,649,650,629,628,649,658,631,630,658,659,631,653,603,632,653,630,603,612,660,594,612,657,660,661,636,635,661,662,636,663,630,653,663,658,630,594,664,575,594,660,664,665,662,661,665,666,662,646,667,668,646,645,667,575,669,568,575,664,669,649,670,671,649,648,670,648,668,670,648,646,668,659,639,631,659,633,639,651,672,673,651,650,672,674,653,652,674,663,653,675,655,654,675,676,655,654,677,675,654,656,677,568,678,546,568,669,678,650,671,672,650,649,671,658,679,659,658,680,679,681,680,682,681,679,680,683,658,663,683,680,658,546,684,542,546,678,684,685,666,665,685,686,666,668,687,688,668,667,687,542,689,543,542,684,689,671,690,691,671,670,690,670,688,690,670,668,688,679,633,659,679,626,633,673,692,693,673,672,692,694,663,674,694,683,663,695,676,675,695,696,676,675,697,695,675,677,697,698,543,689,698,534,543,672,691,692,672,671,691,688,699,700,688,687,699,534,701,535,534,698,701,691,702,703,691,690,702,690,700,702,690,688,700,681,626,679,681,619,626,693,704,705,693,692,704,706,683,694,706,707,683,708,696,695,708,709,696,695,710,708,695,697,710,535,711,536,535,701,711,692,703,704,692,691,703,712,682,713,712,681,682,707,680,683,707,682,680,714,536,711,714,541,536,715,686,685,715,716,686,717,709,708,717,718,709,708,719,717,708,710,719,704,720,721,704,703,720,722,682,707,722,713,682,723,716,715,723,724,716,700,725,726,700,699,725,703,727,720,703,702,727,702,726,727,702,700,726,712,619,681,712,622,619,705,721,728,705,704,721,729,707,706,729,722,707,730,722,729,730,731,722,732,713,733,732,712,713,622,734,620,622,735,734,736,718,717,736,737,718,717,738,736,717,719,738,739,738,719,739,740,738,731,713,722,731,733,713,741,724,723,741,742,724,726,743,744,726,725,743,720,745,746,720,727,745,727,744,745,727,726,744,712,735,622,712,732,735,728,747,748,728,721,747,747,720,746,747,721,720,748,738,740,748,736,738,730,736,731,730,737,736,254,749,253,254,750,749,751,538,540,751,752,538,753,754,755,753,756,754,423,757,758,423,422,757,471,443,469,471,444,443,757,424,759,757,422,424,760,761,762,760,763,761,764,765,766,764,767,765,768,769,770,768,771,769,772,771,768,772,773,771,774,773,772,774,775,773,776,775,774,776,777,775,778,777,776,778,779,777,780,781,782,780,783,781,784,783,780,784,785,783,786,785,784,786,787,785,788,787,786,788,789,787,790,789,788,790,791,789,767,792,765,767,793,792,794,795,796,794,797,795,796,798,799,796,795,798,799,800,801,799,798,800,801,802,803,801,800,802,804,805,806,804,807,805,803,808,809,803,802,808,809,805,803,809,806,805,807,810,811,807,812,810,788,813,790,788,814,813,786,814,788,786,815,814,798,816,800,798,817,816,818,766,819,818,764,766,271,250,247,271,820,250,770,783,768,770,781,783,768,785,772,768,783,785,772,787,774,772,785,787,774,789,776,774,787,789,776,791,778,776,789,791,771,821,822,771,773,821,777,823,824,777,779,823,775,824,825,775,777,824,773,825,821,773,775,825,822,826,827,822,821,826,821,828,826,821,825,828,825,829,828,825,824,829,824,830,829,824,823,830,827,831,832,827,826,831,830,833,834,830,835,833,826,836,831,826,828,836,828,837,836,828,829,837,829,834,837,829,830,834,832,838,839,832,831,838,834,840,841,834,833,840,831,842,838,831,836,842,836,843,842,836,837,843,837,841,843,837,834,841,839,844,845,839,838,844,841,846,847,841,840,846,838,848,844,838,842,848,842,849,848,842,843,849,843,847,849,843,841,847,845,850,851,845,844,850,847,852,853,847,846,852,844,854,850,844,848,854,848,855,854,848,849,855,849,853,855,849,847,853,856,857,858,856,859,857,860,861,862,860,863,861,859,864,857,859,865,864,865,866,864,865,867,866,867,862,866,867,860,862,868,869,870,868,871,869,871,872,869,871,873,872,874,875,876,874,877,875,878,879,880,878,881,879,877,870,875,877,868,870,881,882,879,881,883,882,884,885,886,884,887,885,886,888,889,886,885,888,890,891,892,890,893,891,894,887,884,894,895,887,896,897,898,896,899,897,889,276,274,889,888,276,900,279,901,900,277,279,892,901,890,892,900,901,897,902,903,897,899,902,904,792,905,904,765,792,771,906,769,771,822,906,827,906,822,827,907,906,832,907,827,832,908,907,839,908,832,839,909,908,845,909,839,845,910,909,851,910,845,851,911,910,912,913,914,912,915,913,916,167,169,916,917,167,159,918,162,159,919,918,920,921,922,920,917,921,920,209,210,920,228,209,923,918,919,923,924,918,913,923,914,913,924,923,173,202,174,173,213,202,163,207,166,163,204,207,117,126,118,117,127,126,167,205,170,167,210,205,177,192,180,177,193,192,120,130,122,120,131,130,182,196,183,182,198,196,172,213,173,172,211,213,118,131,120,118,126,131,170,204,163,170,205,204,180,187,185,180,192,187,183,193,177,183,196,193,174,199,176,174,202,199,127,185,187,127,117,185,166,211,172,166,207,211,176,198,182,176,199,198,122,133,124,122,130,133,793,925,792,793,926,925,905,925,927,905,792,925,800,928,802,800,816,928,929,802,928,929,808,802,762,930,760,762,931,930,932,933,934,932,935,933,936,935,937,936,933,935,938,934,933,938,939,934,938,936,940,938,933,936,941,942,943,941,944,942,805,811,945,805,807,811,803,945,801,803,805,945,804,812,807,804,946,812,944,947,942,944,948,947,949,937,950,949,936,937,949,941,951,949,944,941,952,766,953,952,819,766,954,955,956,954,957,955,815,958,814,815,959,958,814,960,813,814,958,960,961,782,962,961,955,782,963,769,964,963,770,769,965,955,961,965,956,955,963,793,966,963,926,793,962,781,966,962,782,781,967,769,906,967,964,769,968,880,969,968,878,880,970,969,971,970,968,969,972,887,895,972,973,887,873,974,872,873,975,974,883,876,882,883,874,876,926,976,925,926,977,976,978,979,980,978,981,979,982,906,907,982,967,906,983,984,985,983,986,984,987,988,989,987,990,988,991,989,992,991,987,989,993,911,994,993,910,911,995,910,993,995,909,910,996,909,995,996,908,909,997,908,996,997,907,908,998,911,851,998,999,911,897,1e3,1001,897,903,1e3,1002,1003,1004,1002,1005,1003,898,1001,1006,898,897,1001,1007,1008,1009,1007,1010,1008,1011,1006,1012,1011,898,1006,903,1009,1e3,903,1007,1009,1013,1014,1015,1013,1016,1014,1017,981,978,1017,1018,981,1019,978,1020,1019,1017,978,1021,1022,1023,1021,1024,1022,1016,1020,1014,1016,1019,1020,1018,1025,981,1018,1026,1025,979,868,877,979,1027,868,1028,881,878,1028,1029,881,980,877,874,980,979,877,1030,874,883,1030,980,874,1031,975,873,1031,1032,975,1029,883,881,1029,1030,883,1033,1034,1035,1033,1036,1034,1037,278,1038,1037,279,278,820,1039,1040,820,1041,1039,1042,270,1043,1042,271,270,1042,820,271,1042,1041,820,1044,280,1045,1044,278,280,903,1046,1007,903,902,1046,1007,992,1010,1007,1046,992,1047,1048,1049,1047,1050,1048,1039,1051,1040,1039,1052,1051,750,1049,749,750,1047,1049,1053,1041,1042,1053,1054,1041,1053,1043,1055,1053,1042,1043,992,1056,1010,992,989,1056,1057,890,1058,1057,893,890,1058,901,1059,1058,890,901,1054,1039,1041,1054,1060,1039,761,797,794,761,763,797,989,1002,1056,989,988,1002,944,950,948,944,949,950,936,951,940,936,949,951,764,962,767,764,961,962,926,964,1061,926,963,964,818,961,764,818,965,961,770,966,781,770,963,966,767,966,793,767,962,966,1062,964,967,1062,1061,964,1063,967,982,1063,1062,967,1064,907,997,1064,982,907,1065,1012,1066,1065,1011,1012,1067,1015,1068,1067,1013,1015,1069,878,968,1069,1028,878,1058,1070,1071,1058,1059,1070,1058,1072,1057,1058,1071,1072,988,1005,1002,988,1073,1005,1059,1074,1070,1059,1037,1074,1075,1076,1077,1075,1078,1076,1079,867,865,1079,1080,867,1034,1081,1082,1034,1036,1081,1083,1084,1085,1083,1086,1084,1087,1088,1038,1087,1089,1088,240,237,234,240,244,237,1077,1090,1091,1077,1076,1090,1056,1004,1092,1056,1002,1004,1038,1074,1037,1038,1088,1074,1093,865,859,1093,1079,865,1094,873,871,1094,1031,873,1059,279,1037,1059,901,279,1095,1035,1096,1095,1033,1035,1097,863,860,1097,1098,863,998,859,856,998,1093,859,1099,1023,1100,1099,1021,1023,858,986,856,858,984,986,1080,860,867,1080,1097,860,1087,1036,1033,1087,1044,1036,1060,1088,1101,1060,1074,1088,218,237,219,218,234,237,393,538,424,393,539,538,752,424,538,752,759,424,537,1102,540,537,1103,1102,540,1104,751,540,1102,1104,932,762,935,932,931,762,935,761,937,935,762,761,794,937,761,794,950,937,950,796,948,950,794,796,799,948,796,799,947,948,795,817,798,795,1105,817,797,1105,795,797,1106,1105,1106,763,1107,1106,797,763,1107,760,1108,1107,763,760,930,1108,760,930,1109,1108,1110,1111,1112,1110,1113,1111,1114,934,939,1114,1115,934,1115,932,934,1115,1116,932,1116,931,932,1116,1117,931,1117,930,931,1117,1118,930,362,303,305,362,365,303,1119,957,954,1119,1120,957,782,957,780,782,955,957,780,1120,784,780,957,1120,942,810,943,942,811,810,947,811,942,947,945,811,801,947,799,801,945,947,1119,815,1120,1119,959,815,784,815,786,784,1120,815,1066,1121,1065,1066,1122,1121,1123,1068,1124,1123,1067,1068,1015,1029,1028,1015,1014,1029,1091,1125,1077,1091,1126,1125,1126,1052,1125,1126,1051,1052,856,999,998,856,986,999,1036,1045,1081,1036,1044,1045,854,1080,1079,854,855,1080,1033,1089,1087,1033,1095,1089,1010,1092,1008,1010,1056,1092,850,1079,1093,850,854,1079,1027,871,868,1027,1094,871,853,1098,1097,853,852,1098,851,1093,998,851,850,1093,1026,1100,1025,1026,1099,1100,855,1097,1080,855,853,1097,1038,1044,1087,1038,278,1044,1075,1089,1095,1075,1127,1089,1127,1088,1089,1127,1101,1088,1128,1129,1130,1128,1131,1129,1132,1133,1134,1132,1135,1133,1136,1134,1137,1136,1132,1134,1138,1137,1139,1138,1136,1137,1140,1139,1141,1140,1138,1139,1142,1,54,1142,1131,1,1143,80,84,1143,1144,80,1145,1146,1147,1145,1148,1146,1144,76,80,1144,1149,76,1150,1151,1152,1150,1153,1151,1149,74,76,1149,1148,74,1154,1155,1156,1154,1157,1155,1145,64,68,1145,1158,64,1159,1156,1160,1159,1154,1156,1158,60,64,1158,1161,60,1161,54,60,1161,1142,54,1162,1163,1164,1162,1165,1163,1166,1167,1168,1166,1169,1167,1170,1171,1172,1170,1173,1171,1128,1141,2,1128,1140,1141,1174,1172,1175,1174,1170,1172,1135,1175,1133,1135,1174,1175,1176,1177,1178,1176,1179,1177,1180,1181,1182,1180,1183,1181,1184,1185,1186,1184,1187,1185,1188,1189,1130,1188,1190,1189,1191,1192,1193,1191,1194,1192,1179,1195,1177,1179,1196,1195,1187,1197,1185,1187,1198,1197,1190,1199,1189,1190,1200,1199,1147,1201,1202,1147,1146,1201,1202,1193,1147,1202,1191,1193,1203,1204,1205,1203,1206,1204,1198,1207,1197,1198,1208,1207,1200,1209,1199,1200,1210,1209,1211,1146,1212,1211,1201,1146,1213,1214,1215,1213,1216,1214,1210,1217,1209,1210,1218,1217,1219,1212,1220,1219,1211,1212,1221,1129,1222,1221,1223,1129,1218,1186,1217,1218,1184,1186,1130,1223,1188,1130,1129,1223,1224,1220,1225,1224,1219,1220,1194,1222,1192,1194,1221,1222,1226,1221,1194,1226,1227,1221,1228,1179,1176,1228,1229,1179,1230,1183,1180,1230,1231,1183,1232,1187,1184,1232,1233,1187,1234,1190,1188,1234,1235,1190,1236,1194,1191,1236,1226,1194,1229,1196,1179,1229,1237,1196,1233,1198,1187,1233,1238,1198,1235,1200,1190,1235,1239,1200,1202,1240,1241,1202,1201,1240,1241,1191,1202,1241,1236,1191,1242,1206,1203,1242,1243,1206,1238,1208,1198,1238,1244,1208,1239,1210,1200,1239,1245,1210,1246,1201,1211,1246,1240,1201,1247,1216,1213,1247,1248,1216,1245,1218,1210,1245,1249,1218,1250,1211,1219,1250,1246,1211,1227,1223,1221,1227,1251,1223,1249,1184,1218,1249,1232,1184,1188,1251,1234,1188,1223,1251,1252,1219,1224,1252,1250,1219,1253,1246,1250,1253,1254,1246,1255,1251,1227,1255,1256,1251,1257,1232,1249,1257,1258,1232,1234,1256,1259,1234,1251,1256,1260,1250,1252,1260,1253,1250,1261,1227,1226,1261,1255,1227,1262,1229,1228,1262,1263,1229,1264,1231,1230,1264,1265,1231,1258,1233,1232,1258,1266,1233,1259,1235,1234,1259,1267,1235,1268,1226,1236,1268,1261,1226,1263,1237,1229,1263,1269,1237,1266,1238,1233,1266,1270,1238,1267,1239,1235,1267,1271,1239,1241,1272,1273,1241,1240,1272,1273,1236,1241,1273,1268,1236,1274,1243,1242,1274,1275,1243,1270,1244,1238,1270,1276,1244,1271,1245,1239,1271,1277,1245,1254,1240,1246,1254,1272,1240,1278,1248,1247,1278,1279,1248,1277,1249,1245,1277,1257,1249,1280,1267,1259,1280,1281,1267,1282,1261,1268,1282,1283,1261,1284,1269,1263,1284,1285,1269,1286,1270,1266,1286,1287,1270,1281,1271,1267,1281,1288,1271,1273,1289,1290,1273,1272,1289,1290,1268,1273,1290,1282,1268,1291,1275,1274,1291,1292,1275,1287,1276,1270,1287,1293,1276,1288,1277,1271,1288,1294,1277,1295,1272,1254,1295,1289,1272,1296,1279,1278,1296,1297,1279,1294,1257,1277,1294,1298,1257,1299,1254,1253,1299,1295,1254,1300,1256,1255,1300,1301,1256,1298,1258,1257,1298,1302,1258,1259,1301,1280,1259,1256,1301,1303,1253,1260,1303,1299,1253,1283,1255,1261,1283,1300,1255,1304,1263,1262,1304,1284,1263,1305,1265,1264,1305,1306,1265,1302,1266,1258,1302,1286,1266,1280,1307,1308,1280,1301,1307,1309,1299,1303,1309,1310,1299,1311,1300,1283,1311,1312,1300,1313,1284,1304,1313,1314,1284,1315,1306,1305,1315,1316,1306,1317,1286,1302,1317,1318,1286,1308,1281,1280,1308,1319,1281,1320,1283,1282,1320,1311,1283,1314,1285,1284,1314,1321,1285,1318,1287,1286,1318,1322,1287,1319,1288,1281,1319,1323,1288,1290,1324,1325,1290,1289,1324,1325,1282,1290,1325,1320,1282,1326,1292,1291,1326,1327,1292,1322,1293,1287,1322,1328,1293,1323,1294,1288,1323,1329,1294,1330,1289,1295,1330,1324,1289,1331,1297,1296,1331,1332,1297,1329,1298,1294,1329,1333,1298,1310,1295,1299,1310,1330,1295,1312,1301,1300,1312,1307,1301,1333,1302,1298,1333,1317,1302,1334,1333,1329,1334,1335,1333,1333,1336,1317,1333,1335,1336,1317,1337,1318,1317,1336,1337,1322,1338,1328,1322,1339,1338,1340,1310,1309,1340,1341,1310,1331,1342,1332,1331,1343,1342,1315,1344,1316,1315,1345,1344,1313,1346,1314,1313,1347,1346,1348,1319,1308,1348,1349,1319,1314,1350,1321,1314,1346,1350,1312,1351,1352,1312,1311,1351,1337,1322,1318,1337,1339,1322,1310,1353,1330,1310,1341,1353,1325,1354,1355,1325,1324,1354,1330,1354,1324,1330,1353,1354,1356,1327,1326,1356,1357,1327,1325,1358,1320,1325,1355,1358,1320,1351,1311,1320,1358,1351,1312,1359,1307,1312,1352,1359,1348,1307,1359,1348,1308,1307,1319,1360,1323,1319,1349,1360,1323,1334,1329,1323,1360,1334,1332,1345,1315,1332,1342,1345,1305,1332,1315,1305,1297,1332,1264,1297,1305,1264,1279,1297,1279,1230,1248,1279,1264,1230,1334,1361,1362,1334,1360,1361,1355,1363,1364,1355,1354,1363,1358,1364,1365,1358,1355,1364,1356,1366,1367,1356,1350,1366,1346,1368,1369,1346,1347,1368,1352,1370,1371,1352,1351,1370,1338,1372,1373,1338,1339,1372,1349,1374,1375,1349,1348,1374,1351,1365,1370,1351,1358,1365,1343,1373,1376,1343,1338,1373,1335,1362,1377,1335,1334,1362,1360,1375,1361,1360,1349,1375,1359,1371,1378,1359,1352,1371,1353,1379,1380,1353,1341,1379,1344,1381,1382,1344,1345,1381,1336,1377,1383,1336,1335,1377,1341,1384,1379,1341,1340,1384,1354,1380,1363,1354,1353,1380,1350,1369,1366,1350,1346,1369,1337,1383,1385,1337,1336,1383,1348,1378,1374,1348,1359,1378,1345,1386,1381,1345,1342,1386,1339,1385,1372,1339,1337,1385,1376,1387,1388,1376,1373,1387,1377,1389,1390,1377,1362,1389,1371,1391,1392,1371,1370,1391,1379,1393,1394,1379,1384,1393,1380,1394,1395,1380,1379,1394,1382,1396,1397,1382,1381,1396,1383,1390,1398,1383,1377,1390,1374,1399,1400,1374,1378,1399,1363,1395,1401,1363,1380,1395,1366,1402,1403,1366,1369,1402,1385,1398,1404,1385,1383,1398,1364,1401,1405,1364,1363,1401,1365,1405,1406,1365,1364,1405,1381,1407,1396,1381,1386,1407,1372,1404,1408,1372,1385,1404,1361,1409,1410,1361,1375,1409,1370,1406,1391,1370,1365,1406,1367,1403,1411,1367,1366,1403,1369,1412,1402,1369,1368,1412,1373,1408,1387,1373,1372,1408,1375,1400,1409,1375,1374,1400,1362,1410,1389,1362,1361,1410,1378,1392,1399,1378,1371,1392,1395,1413,1414,1395,1394,1413,1397,1415,1416,1397,1396,1415,1398,1417,1418,1398,1390,1417,1400,1419,1420,1400,1399,1419,1401,1414,1421,1401,1395,1414,1403,1422,1423,1403,1402,1422,1404,1418,1424,1404,1398,1418,1405,1421,1425,1405,1401,1421,1406,1425,1426,1406,1405,1425,1396,1427,1415,1396,1407,1427,1408,1424,1428,1408,1404,1424,1410,1429,1430,1410,1409,1429,1391,1426,1431,1391,1406,1426,1411,1423,1432,1411,1403,1423,1402,1433,1422,1402,1412,1433,1387,1428,1434,1387,1408,1428,1409,1420,1429,1409,1400,1420,1389,1430,1435,1389,1410,1430,1399,1436,1419,1399,1392,1436,1388,1434,1437,1388,1387,1434,1390,1435,1417,1390,1389,1435,1392,1431,1436,1392,1391,1431,1394,1438,1413,1394,1393,1438,1439,1440,1441,1439,1442,1440,1443,1444,1445,1443,1446,1444,1447,1448,1449,1447,1450,1448,1451,1452,1453,1451,1454,1452,1455,1456,1457,1455,1458,1456,1453,1459,1451,1453,1460,1459,1457,1461,1455,1457,1462,1461,1442,1463,1440,1442,1464,1463,1465,1466,1467,1465,1468,1466,1454,1469,1452,1454,1470,1469,1471,1472,1473,1471,1474,1472,1475,1476,1477,1475,1478,1476,1449,1467,1447,1449,1465,1467,1462,1479,1461,1462,1480,1479,1478,1481,1476,1478,1482,1481,1483,1470,1484,1483,1469,1470,1485,1477,1486,1485,1475,1477,1445,1441,1443,1445,1439,1441,1473,1468,1471,1473,1466,1468,1484,1487,1483,1484,1488,1487,1486,1480,1485,1486,1479,1480,1482,1489,1481,1482,1490,1489,1491,1492,1493,1491,1494,1492,1446,1488,1444,1446,1487,1488,1450,1493,1448,1450,1491,1493,1464,1458,1463,1464,1456,1458,1490,1494,1489,1490,1492,1494,1473,1429,1420,1473,1472,1429,1434,1487,1446,1434,1428,1487,1461,1423,1422,1461,1479,1423,1431,1450,1447,1431,1426,1450,1472,1430,1429,1472,1460,1430,1432,1479,1486,1432,1423,1479,1483,1428,1424,1483,1487,1428,1455,1422,1433,1455,1461,1422,1426,1491,1450,1426,1425,1491,1425,1494,1491,1425,1421,1494,1443,1427,1437,1443,1441,1427,1424,1469,1483,1424,1418,1469,1441,1415,1427,1441,1440,1415,1489,1421,1414,1489,1494,1421,1420,1466,1473,1420,1419,1466,1433,1458,1455,1433,1495,1458,1452,1418,1417,1452,1469,1418,1440,1416,1415,1440,1463,1416,1481,1414,1413,1481,1489,1414,1496,915,1497,1496,913,915,1498,925,976,1498,927,925,977,1061,1499,977,926,1061,1500,913,1496,1500,924,913,924,922,918,924,1500,922,918,921,162,918,922,921,1501,162,921,1501,160,162,86,1502,36,86,1503,1502,1504,36,1502,1504,37,36,1505,37,1504,1505,40,37,1162,1214,1182,1162,1169,1214,1182,1216,1180,1182,1214,1216,1180,1248,1230,1180,1216,1248,1506,959,1507,1506,958,959,1507,1119,1508,1507,959,1119,1508,954,1509,1508,1119,954,1509,956,1510,1509,954,956,1511,941,1510,1511,951,941,1511,818,1512,1511,965,818,1513,940,1512,1513,938,940,1513,952,1514,1513,819,952,1515,939,1514,1515,1114,939,281,356,284,281,354,356,1516,284,356,1516,301,284,1517,758,1518,1517,423,758,1519,423,1517,1519,397,423,1520,396,1521,1520,455,396,1522,455,1520,1522,456,455,1523,456,1522,1523,473,456,1523,449,1524,1523,447,449,1525,474,1524,1525,459,474,1526,459,1525,1526,460,459,1527,460,1526,1527,563,460,1527,586,1528,1527,556,586,1529,578,1528,1529,597,578,1530,597,1529,1530,615,597,1530,636,1531,1530,607,636,1531,662,1532,1531,636,662,1533,652,1532,1533,674,652,1534,674,1533,1534,694,674,1534,716,1535,1534,686,716,1535,724,1536,1535,716,724,1536,742,1537,1536,724,742,1538,730,1537,1538,737,730,1538,723,1539,1538,741,723,1539,715,1540,1539,723,715,1541,709,1540,1541,696,709,1541,665,1542,1541,685,665,1543,676,1542,1543,655,676,1544,655,1543,1544,624,655,1544,606,1545,1544,635,606,1545,588,1546,1545,606,588,1547,599,1546,1547,581,599,1548,581,1547,1548,560,581,1548,452,1549,1548,555,452,1550,467,1549,1550,466,467,1551,466,1550,1551,465,466,1552,465,1551,1552,464,465,1552,442,1553,1552,446,442,1554,463,1553,1554,462,463,1554,471,1555,1554,444,471,1556,756,1557,1556,468,756,1557,753,1558,1557,756,753,359,1516,1559,359,301,1516,359,1560,360,359,1559,1560,946,1507,812,946,1506,1507,812,1508,810,812,1507,1508,810,1509,943,810,1508,1509,943,1510,941,943,1509,1510,965,1510,956,965,1511,1510,951,1512,940,951,1511,1512,819,1512,818,819,1513,1512,938,1514,939,938,1513,1514,1561,358,1562,1561,309,358,1563,360,1560,1563,363,360,1563,361,363,1563,1564,361,754,1518,755,754,1517,1518,470,1517,754,470,1519,1517,443,1521,469,443,1520,1521,445,1520,443,445,1522,1520,447,1522,445,447,1523,1522,473,1524,474,473,1523,1524,451,1524,449,451,1525,1524,453,1525,451,453,1526,1525,556,1526,453,556,1527,1526,563,1528,578,563,1527,1528,589,1528,586,589,1529,1528,607,1529,589,607,1530,1529,615,1531,644,615,1530,1531,644,1532,652,644,1531,1532,666,1532,662,666,1533,1532,686,1533,666,686,1534,1533,694,1535,706,694,1534,1535,706,1536,729,706,1535,1536,729,1537,730,729,1536,1537,741,1537,742,741,1538,1537,737,1539,718,737,1538,1539,718,1540,709,718,1539,1540,685,1540,715,685,1541,1540,696,1542,676,696,1541,1542,661,1542,665,661,1543,1542,635,1543,661,635,1544,1543,624,1545,617,624,1544,1545,617,1546,599,617,1545,1546,585,1546,588,585,1547,1546,555,1547,585,555,1548,1547,560,1549,467,560,1548,1549,448,1549,452,448,1550,1549,450,1550,448,450,1551,1550,446,1551,450,446,1552,1551,464,1553,463,464,1552,1553,444,1553,442,444,1554,1553,462,1555,425,462,1554,1555,389,1557,390,389,1556,1557,390,1558,1565,390,1557,1558,1566,361,1564,1566,364,361,1567,1568,1569,1567,1570,1568,1569,1571,1572,1569,1568,1571,1572,1573,1574,1572,1571,1573,1575,1576,1577,1575,1578,1576,1577,1579,1580,1577,1576,1579,1580,1581,1582,1580,1579,1581,1582,1583,1584,1582,1581,1583,1584,1585,1586,1584,1583,1585,1586,1587,1588,1586,1585,1587,6,3,0,6,5,3,1141,0,2,1141,8,0,1139,8,1141,1139,13,8,1137,13,1139,1137,16,13,1134,16,1137,1134,19,16,1133,19,1134,1133,22,19,1175,22,1133,1175,25,22,1172,25,1175,1172,28,25,1171,28,1172,1171,31,28,1168,31,1171,1168,34,31,1163,40,1164,1163,39,40,1156,43,1160,1156,41,43,1155,41,1156,1155,47,41,1152,47,1155,1152,50,47,56,3,5,56,53,3,58,53,56,58,59,53,62,59,58,62,63,59,66,63,62,66,67,63,72,75,70,72,73,75,78,73,72,78,79,73,82,79,78,82,83,79,70,67,66,70,75,67,1167,40,1505,1167,1164,40,184,104,103,184,179,104,171,99,98,171,108,99,156,89,88,156,92,89,161,86,85,161,160,86,107,101,100,107,175,101,119,111,110,119,121,111,121,112,111,121,123,112,15,100,12,15,99,100,165,97,96,165,164,97,61,113,65,61,106,113,168,96,95,168,165,96,160,1503,86,160,1501,1503,916,94,93,916,169,94,114,110,109,114,119,110,175,102,101,175,181,102,181,103,102,181,184,103,65,109,71,65,113,109,178,106,105,178,116,106,164,98,97,164,171,98,46,91,45,46,89,91,179,105,104,179,178,105,158,88,87,158,156,88,169,95,94,169,168,95,1504,33,32,1504,1502,33,1589,364,1566,1589,365,364,303,1589,1590,303,365,1589,1591,1592,1593,1591,1594,1592,1595,1596,1597,1595,1598,1596,1599,1600,1601,1599,1602,1600,1603,1597,1604,1603,1595,1597,1599,300,1602,1599,298,300,312,1564,310,312,1566,1564,1605,1601,1606,1605,1599,1601,1605,298,1599,1605,299,298,1594,1604,1592,1594,1603,1604,312,366,1607,312,311,366,1608,1609,1610,1608,1611,1609,1585,1612,1587,1585,1613,1612,1583,1613,1585,1583,1614,1613,1581,1614,1583,1581,1615,1614,1615,1579,1616,1615,1581,1579,329,489,333,329,490,489,1617,333,489,1617,334,333,1618,366,1619,1618,1607,366,324,372,329,324,328,372,318,328,324,318,323,328,307,323,318,307,316,323,316,309,314,316,307,309,309,1620,314,309,1561,1620,301,287,295,301,359,287,388,1565,1621,388,390,1565,314,355,317,314,1620,355,357,317,355,357,321,317,1505,32,34,1505,1504,32,1622,51,50,1622,1623,51,1623,52,51,1623,1624,52,1625,52,1624,1625,87,52,1503,33,1502,1503,93,33,1626,158,1627,1626,157,158,1496,228,1500,1496,227,228,1497,227,1496,1497,261,227,362,290,289,362,305,290,305,293,290,305,302,293,1616,1576,1628,1616,1579,1576,304,1590,1629,304,303,1590,285,363,289,285,360,363,1498,895,894,1498,976,895,1501,917,916,1501,921,917,210,917,920,210,167,917,922,228,920,922,1500,228,1630,1594,1591,1630,1608,1594,977,895,976,977,972,895,155,1611,153,155,1609,1611,1157,1152,1155,1157,1150,1152,1173,1168,1171,1173,1166,1168,1196,1205,1195,1196,1203,1205,1208,1215,1207,1208,1213,1215,1237,1203,1196,1237,1242,1203,1244,1213,1208,1244,1247,1213,1269,1242,1237,1269,1274,1242,1276,1247,1244,1276,1278,1247,1285,1274,1269,1285,1291,1274,1293,1278,1276,1293,1296,1278,1321,1291,1285,1321,1326,1291,1328,1296,1293,1328,1331,1296,1328,1343,1331,1328,1338,1343,1350,1326,1321,1350,1356,1326,1357,1367,1631,1357,1356,1367,1342,1376,1386,1342,1343,1376,1386,1388,1407,1386,1376,1388,1631,1411,1632,1631,1367,1411,1632,1432,1633,1632,1411,1432,1407,1437,1427,1407,1388,1437,1476,1413,1438,1476,1481,1413,1447,1436,1431,1447,1467,1436,1453,1417,1435,1453,1452,1417,1437,1446,1443,1437,1434,1446,1463,1495,1416,1463,1458,1495,1477,1438,1633,1477,1476,1438,1486,1633,1432,1486,1477,1633,1628,1578,1634,1628,1576,1578,1167,34,1168,1167,1505,34,1151,50,1152,1151,1622,50,1501,93,1503,1501,916,93,1627,87,1625,1627,158,87,1635,1104,1636,1635,751,1104,1637,1608,1630,1637,1611,1608,1638,313,310,1638,353,313,295,286,294,295,287,286,353,1562,358,353,1638,1562,428,329,372,428,490,329,1639,1567,1640,1639,1570,1567,1618,1589,1607,1618,1590,1589,372,387,428,372,371,387,751,1641,752,751,1635,1641,1590,1642,1629,1590,1618,1642,1643,752,1641,1643,759,752,759,1644,757,759,1643,1644,1645,757,1644,1645,758,757,1620,356,355,1620,1516,356,1561,1516,1620,1561,1559,1516,1559,1562,1560,1559,1561,1562,1638,1560,1562,1638,1563,1560,1563,310,1564,1563,1638,310,1646,304,1647,1646,302,304,1607,1566,312,1607,1589,1566,1648,758,1645,1648,1518,758,1518,1649,755,1518,1648,1649,1650,755,1649,1650,753,755,1651,753,1650,1651,1558,753,1558,1652,1565,1558,1651,1652,1565,1653,1621,1565,1652,1653,1629,370,367,1629,1642,370,1654,1655,1656,1654,1657,1655,1629,1647,304,1629,367,1647,1111,139,1598,1111,134,139,1573,1634,1578,1573,1658,1634,1658,1571,1659,1658,1573,1571,1112,1598,1595,1112,1111,1598,1659,1568,1660,1659,1571,1568,1660,1570,1661,1660,1568,1570,1610,1595,1603,1610,1112,1595,1662,1663,1664,1662,1665,1663,1570,1666,1661,1570,1639,1666,1667,1639,1668,1667,1666,1639,1668,1669,1667,1668,1670,1669,1670,1671,1669,1670,1672,1671,1662,1672,1673,1662,1671,1672,1674,1662,1673,1674,1665,1662,1515,952,1675,1515,1514,952,1676,1677,1678,1676,1679,1677,150,1601,144,150,1606,1601,144,1600,142,144,1601,1600,1680,1681,1682,1680,1683,1681,1684,142,1600,1684,1596,142,1685,1686,1687,1685,1676,1686,1682,1688,1689,1682,1681,1688,1690,1691,1692,1690,1693,1691,1694,1687,1695,1694,1685,1687,1693,1695,1691,1693,1694,1695,1696,1697,1689,1696,1698,1697,1699,1700,1701,1699,1686,1700,1696,1692,1698,1696,1690,1692,1687,1699,1702,1687,1686,1699,1695,1702,1703,1695,1687,1702,1704,1673,1705,1704,1674,1673,1671,1664,1706,1671,1662,1664,1705,1672,1707,1705,1673,1672,1707,1670,1708,1707,1672,1670,1709,1596,1684,1709,1597,1596,1597,1710,1604,1597,1709,1710,1708,1668,1711,1708,1670,1668,1711,1639,1640,1711,1668,1639,1712,1713,1714,1712,1715,1713,1714,1716,1717,1714,1713,1716,256,265,257,256,1718,265,255,1718,256,255,1719,1718,261,1719,255,261,1720,1719,1720,1497,1721,1720,261,1497,1721,915,1722,1721,1497,915,1722,912,1723,1722,915,912,1724,1715,1712,1724,1725,1715,1049,1726,1727,1049,1048,1726,749,1727,1728,749,1049,1727,251,1729,1730,251,253,1729,249,1731,272,249,248,1731,248,1730,1731,248,251,1730,253,1728,1729,253,749,1728,1716,1732,1717,1716,1733,1732,1733,1734,1732,1733,268,1734,268,273,1734,268,267,273,1725,1706,1735,1725,1724,1706,1735,1664,1736,1735,1706,1664,1736,1663,1737,1736,1664,1663,154,1611,1637,154,153,1611,1665,1738,1663,1665,1739,1738,1686,1678,1700,1686,1676,1678,1740,1682,1741,1740,1680,1682,1742,1676,1685,1742,1679,1676,1741,1689,1697,1741,1682,1689,1743,1693,1690,1743,1744,1693,1745,1685,1694,1745,1742,1685,1744,1694,1693,1744,1745,1694,1746,1689,1688,1746,1696,1689,1746,1690,1696,1746,1743,1690,1691,1703,1747,1691,1695,1703,1748,1604,1710,1748,1592,1604,1749,1592,1748,1749,1593,1592,1750,1749,369,1750,1593,1749,1750,368,1751,1750,369,368,1680,1752,1683,1680,1753,1752,1692,1747,1754,1692,1691,1747,1698,1754,1755,1698,1692,1754,1698,1756,1697,1698,1755,1756,1118,1701,1757,1118,1699,1701,1697,1758,1741,1697,1756,1758,1759,1756,1675,1759,1758,1756,1738,1737,1663,1738,1760,1737,820,252,250,820,1040,252,1040,254,252,1040,1051,254,275,269,266,275,270,269,249,269,247,249,267,269,1733,266,268,1733,274,266,1051,750,254,1051,1126,750,1715,886,1713,1715,884,886,1713,889,1716,1713,886,889,1725,884,1715,1725,894,884,1716,274,1733,1716,889,274,1760,905,1737,1760,904,905,1737,927,1736,1737,905,927,1091,1050,1047,1091,1090,1050,1126,1047,750,1126,1091,1047,1735,927,1498,1735,1736,927,1735,894,1725,1735,1498,894,904,766,765,904,953,766,1754,1115,1114,1754,1747,1115,155,1110,1609,155,157,1110,157,1113,1110,157,1626,1113,1594,1610,1603,1594,1608,1610,142,1598,139,142,1596,1598,1674,1739,1665,1674,1761,1739,1655,1753,1656,1655,1752,1753,369,1647,367,369,1749,1647,1652,1683,1752,1652,1651,1683,1683,1650,1681,1683,1651,1650,1748,1647,1749,1748,1646,1647,1646,1710,1762,1646,1748,1710,1681,1649,1688,1681,1650,1649,1688,1648,1746,1688,1649,1648,293,1646,1762,293,302,1646,1746,1645,1743,1746,1648,1645,1762,1709,1763,1762,1710,1709,1644,1743,1645,1644,1744,1743,293,1763,292,293,1762,1763,1764,292,1763,1764,291,292,1602,291,1764,1602,300,291,1764,1709,1684,1764,1763,1709,1684,1602,1764,1684,1600,1602,1643,1744,1644,1643,1745,1744,1641,1745,1643,1641,1742,1745,1742,1635,1679,1742,1641,1635,1679,1636,1677,1679,1635,1636,1657,1653,1655,1657,1765,1653,1578,1574,1573,1578,1575,1574,990,1766,1767,990,1768,1766,1769,1768,1770,1769,983,1768,994,1770,1771,994,1769,1770,1772,1771,991,1772,1773,1771,1774,1773,1772,1774,1775,1773,1776,1775,1774,1776,1777,1775,1778,1777,1776,1778,1779,1777,1083,1779,1778,1083,1780,1779,1064,1781,1782,1064,1780,1781,1773,994,1771,1773,993,994,1768,985,1766,1768,983,985,1779,996,1777,1779,997,996,1780,997,1779,1780,1064,997,999,983,1769,999,986,983,1775,993,1773,1775,995,993,1777,995,1775,1777,996,995,911,1769,994,911,999,1769,982,1782,1063,982,1064,1782,1653,1752,1655,1653,1652,1752,1783,1784,1785,1783,1786,1784,1680,1783,1753,1680,1740,1783,1785,1753,1783,1785,1656,1753,1654,1785,1787,1654,1656,1785,1783,1788,1786,1783,1740,1788,1788,1741,1758,1788,1740,1741,1747,1116,1115,1747,1703,1116,1703,1117,1116,1703,1702,1117,1702,1118,1117,1702,1699,1118,1755,1114,1515,1755,1754,1114,1755,1675,1756,1755,1515,1675,930,1757,1109,930,1118,1757,953,1675,952,953,1759,1675,1761,1789,1739,1761,1790,1789,1791,1792,1793,1791,1794,1792,1759,1788,1758,1759,1795,1788,1793,1796,1591,1793,1792,1796,1759,1738,1795,1759,1760,1738,1750,1791,1793,1750,1751,1791,1591,1750,1793,1591,1593,1750,1795,1739,1789,1795,1738,1739,953,1760,1759,953,904,1760,1786,1795,1789,1786,1788,1795,1609,1112,1610,1609,1110,1112,1789,1784,1786,1789,1790,1784,1794,912,1792,1794,1723,912,914,1792,912,914,1796,1792,1796,923,1797,1796,914,923,1797,919,1798,1797,923,919,159,1798,919,159,1799,1798,1799,161,1800,1799,159,161,85,1800,161,85,1801,1800,1801,38,1802,1801,85,38,35,1802,38,35,1803,1802,39,1803,35,39,1804,1803,1669,1706,1724,1669,1671,1706,1669,1712,1667,1669,1724,1712,1667,1714,1666,1667,1712,1714,1717,1666,1714,1717,1661,1666,1732,1661,1717,1732,1660,1661,1734,1660,1732,1734,1659,1660,273,1659,1734,273,1658,1659,1467,1419,1436,1467,1466,1419,1416,1805,1397,1416,1495,1805,1397,1806,1382,1397,1805,1806,1807,1382,1806,1807,1344,1382,1808,1344,1807,1808,1316,1344,1316,1809,1306,1316,1808,1809,1306,1810,1265,1306,1809,1810,1265,1811,1231,1265,1810,1811,1231,1812,1183,1231,1811,1812,1183,1813,1181,1183,1812,1813,1814,1181,1813,1814,1165,1181,1804,1163,1815,1804,39,1163,1658,272,1634,1658,273,272,1731,1634,272,1731,1628,1634,1730,1628,1731,1730,1616,1628,1729,1616,1730,1729,1615,1616,1615,1728,1614,1615,1729,1728,1614,1727,1613,1614,1728,1727,1613,1726,1612,1613,1727,1726,1435,1460,1453,1435,1430,1460,1495,1412,1805,1495,1433,1412,1393,1633,1438,1393,1632,1633,1797,1591,1796,1797,1630,1591,1630,1798,1637,1630,1797,1798,1799,1637,1798,1799,154,1637,154,1800,90,154,1799,1800,1113,134,1111,1113,133,134,1626,133,1113,1626,124,133,1627,124,1626,1627,123,124,1474,1460,1472,1474,1459,1460,1471,1465,1474,1471,1468,1465,1474,1449,1459,1474,1465,1449,1459,1448,1451,1459,1449,1448,1451,1493,1454,1451,1448,1493,1454,1492,1470,1454,1493,1492,1490,1470,1492,1490,1484,1470,1484,1482,1488,1484,1490,1482,1478,1488,1482,1478,1444,1488,1475,1444,1478,1475,1445,1444,1485,1445,1475,1485,1439,1445,1439,1480,1442,1439,1485,1480,1442,1462,1464,1442,1480,1462,1457,1464,1462,1457,1456,1464,1805,1368,1806,1805,1412,1368,1347,1806,1368,1347,1807,1806,1807,1313,1808,1807,1347,1313,1304,1808,1313,1304,1809,1808,1809,1262,1810,1809,1304,1262,1810,1228,1811,1810,1262,1228,1176,1811,1228,1176,1812,1811,1178,1812,1176,1178,1813,1812,1159,1813,1178,1159,1814,1813,43,1815,1160,43,1804,1815,1804,42,1803,1804,43,42,1803,45,1802,1803,42,45,91,1802,45,91,1801,1802,1801,90,1800,1801,91,90,1625,123,1627,1625,112,123,112,1624,81,112,1625,1624,1623,81,1624,1623,82,81,1622,82,1623,1622,83,82,83,1151,84,83,1622,1151,1143,1204,1225,1143,1153,1204,1206,1225,1204,1206,1224,1225,1243,1224,1206,1243,1252,1224,1252,1275,1260,1252,1243,1275,1292,1260,1275,1292,1303,1260,1303,1327,1309,1303,1292,1327,1309,1357,1340,1309,1327,1357,1631,1340,1357,1631,1384,1340,1384,1632,1393,1384,1631,1632,1761,1704,1816,1761,1674,1704,1785,1817,1787,1785,1784,1817,1790,1817,1784,1790,1818,1817,1790,1816,1818,1790,1761,1816,1765,1621,1653,1765,1819,1621,1820,1621,1819,1820,388,1621,1821,426,391,1821,431,426,479,399,401,479,476,399,756,470,754,756,468,470,427,478,488,427,476,478,477,1822,478,477,522,1822,494,1820,1823,494,1821,1820,541,539,528,541,537,539,395,539,393,395,528,539,541,1103,537,541,714,1103,1521,397,1519,1521,396,397,1555,468,1556,1555,471,468,469,1519,470,469,1521,1519,425,1556,389,425,1555,1556,1820,391,388,1820,1821,391,435,1824,438,435,485,1824,437,485,435,437,486,485,486,432,481,486,437,432,429,481,432,429,482,481,431,482,429,431,493,482,1821,493,431,1821,494,493,1765,1619,1819,1765,1618,1619,1820,1619,1823,1820,1819,1619,1618,1657,1642,1618,1765,1657,1642,1654,370,1642,1657,1654,370,1787,368,370,1654,1787,368,1817,1751,368,1787,1817,1751,1818,1791,1751,1817,1818,1816,1791,1818,1816,1794,1791,1794,1704,1723,1794,1816,1704,400,403,402,400,399,403,476,403,399,476,427,403,478,491,488,478,1822,491,428,488,490,428,427,488,1824,550,1825,1824,516,550,498,487,484,498,497,487,1826,1822,492,1826,491,1822,501,484,483,501,498,484,522,480,495,522,502,480,1822,495,492,1822,522,495,502,483,480,502,501,483,1824,487,516,1824,485,487,1825,569,1827,1825,550,569,1827,577,1828,1827,569,577,1828,596,1829,1828,577,596,1829,614,1830,1829,596,614,1830,643,1831,1830,614,643,1831,651,1832,1831,643,651,1832,673,1833,1832,651,673,1833,693,1834,1833,673,693,1834,705,1835,1834,693,705,1835,728,739,1835,705,728,739,748,740,739,728,748,1823,492,494,1823,1826,492,1619,334,1617,1619,366,334,1619,1826,1823,1619,1617,1826,491,1617,489,491,1826,1617,731,748,733,731,736,748,733,747,732,733,748,747,747,745,744,747,746,745,732,744,735,732,747,744,735,743,734,735,744,743,710,739,719,710,1835,739,1835,697,1834,1835,710,697,1834,677,1833,1834,697,677,1833,656,1832,1833,677,656,1832,625,1831,1832,656,625,618,1831,625,618,1830,1831,1830,600,1829,1830,618,600,1829,582,1828,1829,600,582,1828,570,1827,1828,582,570,1827,440,1825,1827,570,440,438,1825,440,438,1824,1825,1705,1723,1704,1705,1722,1723,1707,1722,1705,1707,1721,1722,1708,1721,1707,1708,1720,1721,1711,1720,1708,1711,1719,1720,1640,1719,1711,1640,1718,1719,1567,1718,1640,1567,265,1718,265,1569,264,265,1567,1569,264,1572,262,264,1569,1572,262,1574,263,262,1572,1574,1575,263,1574,1575,241,263,241,1577,242,241,1575,1577,242,1580,239,242,1577,1580,239,1582,240,239,1580,1582,240,1584,244,240,1582,1584,244,1586,245,244,1584,1586,245,1588,246,245,1586,1588,981,1027,979,981,1025,1027,1020,980,1030,1020,978,980,1023,1032,1031,1023,1022,1032,1014,1030,1029,1014,1020,1030,1068,1028,1069,1068,1015,1028,1100,1031,1094,1100,1023,1031,1025,1094,1027,1025,1100,1094,970,1069,968,970,1836,1069,1069,1124,1068,1069,1836,1124,1086,898,1011,1086,896,898,1084,1011,1065,1084,1086,1011,1055,1837,1838,1055,1043,1837,1839,1057,1072,1839,1840,1057,893,1840,1841,893,1057,1840,1841,1842,1843,1841,1840,1842,1838,1844,1845,1838,1837,1844,1846,1840,1839,1846,1842,1840,1843,1847,1848,1843,1842,1847,1845,1849,1850,1845,1844,1849,1851,1842,1846,1851,1847,1842,1782,1852,1853,1782,1781,1852,1085,1854,1855,1085,1084,1854,1062,1856,1857,1062,1063,1856,1853,1063,1782,1853,1856,1063,1062,1499,1061,1062,1857,1499,1121,1084,1065,1121,1854,1084,888,1844,276,888,1849,1844,1837,276,1844,1837,275,276,1848,1858,1843,1848,1859,1858,893,1860,891,893,1841,1860,1860,1843,1858,1860,1841,1843,275,1043,270,275,1837,1043,885,1849,888,885,1861,1849,973,885,887,973,1861,885,1862,970,971,1862,1863,970,1864,1121,1122,1864,1865,1121,1866,973,972,1866,1867,973,1868,1869,1870,1868,1871,1869,1872,977,1499,1872,1873,977,1874,1856,1853,1874,1875,1856,1876,1877,1878,1876,1879,1877,1880,1881,1882,1880,1883,1881,1884,1847,1851,1884,1885,1847,1867,1861,973,1867,1886,1861,1887,1888,1889,1887,1890,1888,1891,1892,1893,1891,1894,1892,1890,1895,1888,1890,1896,1895,1865,1854,1121,1865,1897,1854,1894,1898,1892,1894,1899,1898,1900,1878,1901,1900,1876,1878,1902,1870,1903,1902,1868,1870,1863,1836,970,1863,1904,1836,1905,1906,1907,1905,1908,1906,1909,1910,1911,1909,1912,1910,1913,1895,1914,1913,1915,1895,1916,1906,1893,1916,1917,1906,1918,1877,1919,1918,1920,1877,1882,1921,1922,1882,1881,1921,1888,1915,1923,1888,1895,1915,1924,1919,1907,1924,1918,1919,1903,1925,1926,1903,1870,1925,1893,1927,1916,1893,1892,1927,1901,1928,1929,1901,1878,1928,1930,1869,1931,1930,1932,1869,1933,1934,1935,1933,1936,1934,1936,1910,1934,1936,1937,1910,1892,1938,1927,1892,1898,1938,1870,1932,1925,1870,1869,1932,1907,1917,1924,1907,1906,1917,1889,1923,1939,1889,1888,1923,1911,1937,1940,1911,1910,1937,1941,1931,1942,1941,1930,1931,1878,1920,1928,1878,1877,1920,1922,1898,1882,1922,1938,1898,1939,1943,1944,1939,1923,1943,1940,1945,1946,1940,1937,1945,1947,1930,1941,1947,1948,1930,1928,1949,1950,1928,1920,1949,1951,1938,1922,1951,1952,1938,1953,1915,1913,1953,1954,1915,1955,1917,1916,1955,1956,1917,1957,1920,1918,1957,1949,1920,1922,1958,1951,1922,1921,1958,1923,1954,1943,1923,1915,1954,1959,1918,1924,1959,1957,1918,1926,1960,1961,1926,1925,1960,1916,1962,1955,1916,1927,1962,1929,1950,1963,1929,1928,1950,1948,1932,1930,1948,1964,1932,1965,1936,1933,1965,1966,1936,1966,1937,1936,1966,1945,1937,1927,1952,1962,1927,1938,1952,1925,1964,1960,1925,1932,1964,1924,1956,1959,1924,1917,1956,1967,1968,1969,1967,1970,1968,1971,1972,1973,1971,1974,1972,1975,1976,1977,1975,1978,1976,1979,1980,1981,1979,1982,1980,1983,1984,1985,1983,1986,1984,1987,1988,1989,1987,1990,1988,1970,1991,1968,1970,1992,1991,1993,1994,1995,1993,1996,1994,1986,1997,1984,1986,1998,1997,1999,1977,2e3,1999,1975,1977,2001,1973,2002,2001,1971,1973,2003,1991,2004,2003,2005,1991,2006,2004,1981,2006,2003,2004,2007,1976,2008,2007,2009,1976,2010,2011,2012,2010,2013,2011,2013,1988,2011,2013,2014,1988,2015,2008,2016,2015,2007,2008,2017,1972,1995,2017,2018,1972,2019,1997,2020,2019,2021,1997,2022,1980,2002,2022,2023,1980,2024,2025,2026,2024,2027,2025,2028,2029,2030,2028,2031,2029,2032,2033,2034,2032,2035,2033,2026,2036,2024,2026,2037,2036,2038,2039,2040,2038,2041,2039,2042,2043,2044,2042,2045,2043,2046,2047,2048,2046,2049,2047,2027,2050,2025,2027,2051,2050,2045,2035,2043,2045,2033,2035,2052,2053,2054,2052,2055,2053,2056,2048,2057,2056,2046,2048,2058,2059,2060,2058,2061,2059,2040,2049,2038,2040,2047,2049,2048,2062,2063,2048,2047,2062,2057,2063,2064,2057,2048,2063,2034,2065,2066,2034,2033,2065,2067,2031,2028,2067,2068,2031,2028,2069,2067,2028,2070,2069,2071,2027,2024,2071,2072,2027,2073,2045,2042,2073,2074,2045,2054,2075,2076,2054,2053,2075,2077,2078,2061,2077,2079,2078,2080,2039,2081,2080,2082,2039,2053,2083,2075,2053,2084,2083,2024,2085,2071,2024,2036,2085,2070,2079,2069,2070,2078,2079,2081,2086,2080,2081,2051,2086,2068,2084,2031,2068,2083,2084,2087,2066,2088,2087,2034,2066,2089,2047,2040,2089,2062,2047,2090,2061,2058,2090,2077,2061,1983,1943,1986,1983,1944,1943,1986,1954,1998,1986,1943,1954,1953,1998,1954,1953,2091,1998,1963,2091,1953,1963,1967,2091,1967,1950,1970,1967,1963,1950,1970,1949,1992,1970,1950,1949,1957,1992,1949,1957,2092,1992,1770,990,987,1770,1768,990,1771,987,991,1771,1770,987,1071,1054,1053,1071,1070,1054,1071,1055,1072,1071,1053,1055,1070,1060,1054,1070,1074,1060,1095,1078,1075,1095,1096,1078,1780,1085,1781,1780,1083,1085,1039,1101,1052,1039,1060,1101,1077,1127,1075,1077,1125,1127,1125,1101,1127,1125,1052,1101,988,1767,1073,988,990,1767,1046,991,992,1046,1772,991,902,1772,1046,902,1774,1772,899,1774,902,899,1776,1774,896,1776,899,896,1778,1776,1086,1778,896,1086,1083,1778,1072,1838,1839,1072,1055,1838,1839,1845,1846,1839,1838,1845,1846,1850,1851,1846,1845,1850,1781,1855,1852,1781,1085,1855,2093,1901,1914,2093,1900,1901,1883,1911,1881,1883,1909,1911,1914,1929,1913,1914,1901,1929,1881,1940,1921,1881,1911,1940,1921,1946,1958,1921,1940,1946,1913,1963,1953,1913,1929,1963,2091,1969,2020,2091,1967,1969,1996,1989,1994,1996,1987,1989,2076,2036,2054,2076,2085,2036,2074,2033,2045,2074,2065,2033,2072,2051,2027,2072,2086,2051,2040,2082,2089,2040,2039,2082,1959,2092,1957,1959,1979,2092,1979,1956,1982,1979,1959,1956,2017,2094,2095,2017,2096,2094,2097,2098,2099,2097,2021,2098,2100,2101,2102,2100,2103,2101,2022,2104,2105,2022,2106,2104,2107,2108,2109,2107,2110,2108,2106,2111,2104,2106,2018,2111,2103,2112,2101,2103,2009,2112,2006,2113,2114,2006,2023,2113,2115,2099,2116,2115,2097,2099,2117,2118,2119,2117,2014,2118,2110,2120,2108,2110,2005,2120,2019,2109,2121,2019,2107,2109,2096,2119,2094,2096,2117,2119,2002,1982,2001,2002,1980,1982,1955,1982,1956,1955,2001,1982,2001,1962,1971,2001,1955,1962,1971,1952,1974,1971,1962,1952,1951,1974,1952,1951,1993,1974,1993,1958,1996,1993,1951,1958,2011,1990,2122,2011,1988,1990,1946,1996,1958,1946,1987,1996,2061,2123,2059,2061,2078,2123,2055,2084,2053,2055,2124,2084,1995,1974,1993,1995,1972,1974,2125,2034,2087,2125,2032,2034,1981,2092,1979,1981,2004,2092,2012,2122,2126,2012,2011,2122,1987,1945,1990,1987,1946,1945,2008,1978,2127,2008,1976,1978,1966,1990,1945,1966,2122,1990,2020,1998,2091,2020,1997,1998,2004,1992,2092,2004,1991,1992,1965,2122,1966,1965,2126,2122,2016,2127,2128,2016,2008,2127,1999,1960,1975,1999,1961,1960,1975,1964,1978,1975,1960,1964,1948,1978,1964,1948,2127,1978,1947,2127,1948,1947,2128,2127,2081,2041,2129,2081,2039,2041,2030,2070,2028,2030,2130,2070,2130,2078,2070,2130,2123,2078,2054,2037,2052,2054,2036,2037,2130,2131,2123,2130,2132,2131,2031,2124,2029,2031,2084,2124,2030,2132,2130,2030,2133,2132,2133,2029,2134,2133,2030,2029,2134,2124,2135,2134,2029,2124,2055,2135,2124,2055,2136,2135,2052,2136,2055,2052,2137,2136,2137,2037,2138,2137,2052,2037,2026,2138,2037,2026,2139,2138,2139,2025,2140,2139,2026,2025,2140,2050,2141,2140,2025,2050,2129,2141,2050,2129,2142,2141,2129,2051,2081,2129,2050,2051,2142,2041,2143,2142,2129,2041,2038,2143,2041,2038,2144,2143,2144,2049,2145,2144,2038,2049,2046,2145,2049,2046,2146,2145,2056,2146,2046,2056,2147,2146,2148,2043,2149,2148,2044,2043,2149,2035,2150,2149,2043,2035,2032,2150,2035,2032,2151,2150,2125,2151,2032,2125,2152,2151,2153,2059,2154,2153,2060,2059,2154,2123,2131,2154,2059,2123,2155,2145,2156,2155,2144,2145,2157,2131,2158,2157,2154,2131,2088,2116,2090,2088,2159,2116,2160,2144,2155,2160,2143,2144,2161,2143,2160,2161,2142,2143,2088,2058,2087,2088,2090,2058,2162,2163,2158,2162,2164,2163,2165,2163,2166,2165,2167,2163,2153,2125,2060,2153,2152,2125,2168,2164,2162,2168,2169,2164,2170,2169,2168,2170,2171,2169,2172,2137,2138,2172,2171,2137,2169,2173,2164,2169,2174,2173,2087,2060,2125,2087,2058,2060,2164,2166,2163,2164,2173,2166,2174,2175,2173,2174,2176,2175,2167,2158,2163,2167,2157,2158,2132,2158,2131,2132,2162,2158,2133,2162,2132,2133,2168,2162,2134,2168,2133,2134,2170,2168,2175,2156,2177,2175,2155,2156,2178,2166,2177,2178,2165,2166,2171,2174,2169,2171,2172,2174,2152,2167,2151,2152,2157,2167,2151,2165,2150,2151,2167,2165,2173,2177,2166,2173,2175,2177,2170,2135,2136,2170,2134,2135,2147,2179,2146,2147,2148,2179,2178,2150,2165,2178,2149,2150,2179,2177,2156,2179,2178,2177,2172,2176,2174,2172,2180,2176,2146,2156,2145,2146,2179,2156,2180,2160,2176,2180,2161,2160,2176,2155,2175,2176,2160,2155,2180,2138,2139,2180,2172,2138,2171,2136,2137,2171,2170,2136,2142,2140,2141,2142,2161,2140,2161,2139,2140,2161,2180,2139,2181,2005,2003,2181,2120,2005,2114,2003,2006,2114,2181,2003,2182,2009,2007,2182,2112,2009,2183,2013,2010,2183,2184,2013,2184,2014,2013,2184,2118,2014,2159,2007,2015,2159,2182,2007,2095,2018,2017,2095,2111,2018,2121,2021,2019,2121,2098,2021,2105,2023,2022,2105,2113,2023,1995,2096,2017,1995,1994,2096,1984,2021,2097,1984,1997,2021,2e3,2103,2100,2e3,1977,2103,2002,2106,2022,2002,1973,2106,1969,2110,2107,1969,1968,2110,1973,2018,2106,1973,1972,2018,1977,2009,2103,1977,1976,2009,1981,2023,2006,1981,1980,2023,1985,2097,2115,1985,1984,2097,1989,2014,2117,1989,1988,2014,1968,2005,2110,1968,1991,2005,2020,2107,2019,2020,1969,2107,1994,2117,2096,1994,1989,2117,2121,2079,2098,2121,2069,2079,2109,2069,2121,2109,2067,2069,2067,2108,2068,2067,2109,2108,2068,2120,2083,2068,2108,2120,2181,2083,2120,2181,2075,2083,2114,2075,2181,2114,2076,2075,2076,2113,2085,2076,2114,2113,2105,2085,2113,2105,2071,2085,2071,2104,2072,2071,2105,2104,2072,2111,2086,2072,2104,2111,2095,2086,2111,2095,2080,2086,2080,2094,2082,2080,2095,2094,2119,2082,2094,2119,2089,2082,2089,2118,2062,2089,2119,2118,2184,2062,2118,2184,2063,2062,2183,2063,2184,2183,2064,2063,2073,2101,2074,2073,2102,2101,2074,2112,2065,2074,2101,2112,2182,2065,2112,2182,2066,2065,2159,2066,2182,2159,2088,2066,2090,2099,2077,2090,2116,2099,2077,2098,2079,2077,2099,2098,1942,2185,2186,1942,1931,2185,1935,2187,2188,1935,1934,2187,1907,2189,1905,1907,1919,2189,2190,1871,1868,2190,1904,1871,1893,1908,1891,1893,1906,1908,1882,1899,1880,1882,1898,1899,1947,1983,2128,1947,1944,1983,2191,1879,1876,2191,1886,1879,1874,1883,1880,1874,2192,1883,1914,1896,2093,1914,1895,1896,1919,1879,2189,1919,1877,1879,2193,1890,1887,2193,2194,1890,1872,1894,1891,1872,2195,1894,2194,1896,1890,2194,1885,1896,2128,1985,2016,2128,1983,1985,1934,1912,2187,1934,1910,1912,2195,1899,1894,2195,1875,1899,2196,1876,1900,2196,2191,1876,2197,1868,1902,2197,2190,1868,1931,1871,2185,1931,1869,1871,1866,1908,1905,1866,1873,1908,2198,1912,1909,2198,1897,1912,1884,1900,2093,1884,2196,1900,2192,1909,1883,2192,2198,1909,2186,1863,1862,2186,2185,1863,2188,1865,1864,2188,2187,1865,1905,1867,1866,1905,2189,1867,1891,1873,1872,1891,1908,1873,1880,1875,1874,1880,1899,1875,2093,1885,1884,2093,1896,1885,2189,1886,1867,2189,1879,1886,2187,1897,1865,2187,1912,1897,2185,1904,1863,2185,1871,1904,2148,2056,2044,2148,2147,2056,1124,1904,2190,1124,1836,1904,2115,2016,1985,2115,2015,2016,1849,1886,2191,1849,1861,1886,1853,2192,1874,1853,1852,2192,1859,2194,2193,1859,1848,2194,1499,2195,1872,1499,1857,2195,1848,1885,2194,1848,1847,1885,2115,2159,2015,2115,2116,2159,1857,1875,2195,1857,1856,1875,1850,2191,2196,1850,1849,2191,1123,2190,2197,1123,1124,2190,972,1873,1866,972,977,1873,1855,1897,2198,1855,1854,1897,1851,2196,1884,1851,1850,2196,1852,2198,2192,1852,1855,2198,2179,2149,2178,2179,2148,2149,2152,2154,2157,2152,2153,2154,2057,2044,2056,2057,2042,2044,2064,2042,2057,2064,2073,2042,2073,2183,2102,2073,2064,2183,2010,2102,2183,2010,2100,2102,2100,2012,2e3,2100,2010,2012,2126,2e3,2012,2126,1999,2e3,1965,1999,2126,1965,1961,1999,1933,1961,1965,1933,1926,1961,1926,1935,1903,1926,1933,1935,2188,1903,1935,2188,1902,1903,1864,1902,2188,1864,2197,1902,2197,1122,1123,2197,1864,1122,1123,1066,1067,1123,1122,1066,1012,1067,1066,1012,1013,1067,1013,1006,1016,1013,1012,1006,1016,1001,1019,1016,1006,1001,1944,1941,1939,1944,1947,1941,1942,1939,1941,1942,1889,1939,2186,1889,1942,2186,1887,1889,1862,1887,2186,1862,2193,1887,2193,971,1859,2193,1862,971,969,1859,971,969,1858,1859,880,1858,969,880,1860,1858,879,1860,880,879,891,1860,882,891,879,882,892,891,876,892,882,876,900,892,875,900,876,875,277,900,870,277,875,870,280,277,869,280,870,869,1045,280,872,1045,869,872,1081,1045,974,1081,872,974,1082,1081,1019,1e3,1017,1019,1001,1e3,1017,1009,1018,1017,1e3,1009,1018,1008,1026,1018,1009,1008,1092,1026,1008,1092,1099,1026,1099,1004,1021,1099,1092,1004,1021,1003,1024,1021,1004,1003,2,1131,1128,2,1,1131,1217,1135,1132,1217,1186,1135,1209,1132,1136,1209,1217,1132,1199,1136,1138,1199,1209,1136,1189,1138,1140,1189,1199,1138,1222,1131,1142,1222,1129,1131,1225,1144,1143,1225,1220,1144,68,1148,1145,68,74,1148,1220,1149,1144,1220,1212,1149,1205,1153,1150,1205,1204,1153,1212,1148,1149,1212,1146,1148,1177,1157,1154,1177,1195,1157,1147,1158,1145,1147,1193,1158,1178,1154,1159,1178,1177,1154,1193,1161,1158,1193,1192,1161,1192,1142,1161,1192,1222,1142,1182,1165,1162,1182,1181,1165,1215,1169,1166,1215,1214,1169,1197,1173,1170,1197,1207,1173,1130,1140,1128,1130,1189,1140,1185,1170,1174,1185,1197,1170,1186,1174,1135,1186,1185,1174,1164,1169,1162,1164,1167,1169,1195,1150,1157,1195,1205,1150,1207,1166,1173,1207,1215,1166,1815,1165,1814,1815,1163,1165,1160,1814,1159,1160,1815,1814,84,1153,1143,84,1151,1153,2199,2200,2201,2199,2202,2200,2203,2204,2205,2203,2206,2204,2207,2206,2208,2207,2199,2206,2208,2203,2209,2208,2206,2203,2210,2209,2211,2210,2208,2209,2212,2208,2210,2212,2207,2208,2213,2211,2214,2213,2210,2211,2215,2210,2213,2215,2212,2210,2216,2214,2217,2216,2213,2214,2218,2213,2216,2218,2215,2213,2219,2217,2220,2219,2216,2217,2221,2216,2219,2221,2218,2216,2222,2220,2223,2222,2219,2220,2224,2219,2222,2224,2221,2219,2225,2223,2226,2225,2222,2223,2227,2222,2225,2227,2224,2222,2228,2226,2229,2228,2225,2226,2230,2225,2228,2230,2227,2225,2231,2229,2232,2231,2228,2229,2233,2228,2231,2233,2230,2228,2234,2235,2236,2234,2237,2235,2238,2237,2234,2238,2239,2237,2240,2241,2242,2240,2243,2241,2242,2244,2245,2242,2241,2244,2246,2242,2247,2246,2240,2242,2247,2245,2248,2247,2242,2245,2249,2247,2250,2249,2246,2247,2250,2248,2251,2250,2247,2248,2252,2200,2253,2252,2201,2200,2254,2204,2255,2254,2205,2204,2256,2255,2257,2256,2254,2255,2258,2253,2259,2258,2252,2253,2260,2257,2261,2260,2256,2257,2262,2259,2263,2262,2258,2259,2264,2261,2265,2264,2260,2261,2266,2263,2267,2266,2262,2263,2268,2269,2270,2268,2271,2269,2272,2273,2274,2272,2275,2273,2276,2270,2277,2276,2268,2270,2278,2274,2279,2278,2272,2274,2280,2277,2281,2280,2276,2277,2282,2279,2283,2282,2278,2279,2284,2235,2285,2284,2236,2235,2286,2248,2287,2286,2251,2248,2287,2245,2288,2287,2248,2245,2288,2289,2290,2288,2291,2289,2292,2229,2293,2292,2232,2229,2293,2226,2294,2293,2229,2226,2294,2223,2295,2294,2226,2223,2295,2220,2296,2295,2223,2220,2296,2217,2297,2296,2220,2217,2297,2214,2298,2297,2217,2214,2299,2209,2300,2299,2211,2209,2301,2205,2302,2301,2203,2205,2302,2254,2303,2302,2205,2254,2300,2203,2301,2300,2209,2203,2304,2260,2305,2304,2256,2260,2303,2256,2304,2303,2254,2256,2298,2306,2307,2298,2299,2306,2308,2268,2309,2308,2271,2268,2309,2276,2310,2309,2268,2276,2310,2280,2311,2310,2276,2280,2312,2313,2314,2312,2308,2313,2271,2265,2269,2271,2264,2265,2275,2267,2273,2275,2266,2267,2305,2314,2315,2305,2312,2314,2316,2313,2317,2316,2314,2313,2317,2318,2319,2317,2313,2318,2319,2320,2321,2319,2318,2320,2321,2322,2323,2321,2320,2322,2324,2325,2326,2324,2327,2325,2328,2329,2330,2328,2331,2329,2330,2332,2333,2330,2329,2332,2326,2331,2328,2326,2325,2331,2334,2326,2335,2334,2324,2326,2335,2328,2336,2335,2326,2328,2336,2330,2337,2336,2328,2330,2337,2333,2338,2337,2330,2333,2339,2335,2340,2339,2334,2335,2341,2342,2338,2341,2343,2342,2340,2336,2344,2340,2335,2336,2344,2337,2345,2344,2336,2337,2345,2338,2342,2345,2337,2338,147,2340,148,147,2339,2340,2343,149,2342,2343,150,149,148,2344,151,148,2340,2344,151,2345,152,151,2344,2345,152,2342,149,152,2345,2342,2289,2346,2290,2289,2347,2346,2348,2290,2346,2348,2349,2290,2350,2349,2348,2350,2351,2349,2352,2353,2354,2352,2355,2353,2356,2357,2358,2356,2359,2357,2360,2361,2362,2360,2363,2361,2358,2364,2365,2358,2357,2364,2362,2359,2356,2362,2361,2359,2365,2307,2366,2365,2364,2307,2367,2368,2369,2367,2306,2368,2370,2371,2372,2370,2373,2371,2369,2374,2375,2369,2368,2374,2376,2373,2370,2376,2377,2373,2372,2315,2378,2372,2371,2315,2375,2377,2376,2375,2374,2377,2316,2315,2314,2316,2378,2315,2307,2367,2366,2307,2306,2367,2327,2379,2380,2327,2324,2379,2324,2381,2379,2324,2334,2381,2334,2382,2381,2334,2339,2382,2339,190,2382,2339,147,190,2383,2384,2385,2383,2386,2384,2387,2386,2383,2387,2388,2386,2389,2390,2391,2389,2392,2390,2393,2392,2389,2393,2394,2392,2391,2388,2387,2391,2390,2388,2380,2385,2384,2380,2379,2385,2395,2396,2397,2395,2398,2396,2397,2399,2400,2397,2396,2399,2401,2398,2395,2401,2402,2398,2400,2403,2404,2400,2399,2403,2404,2405,2406,2404,2403,2405,2394,2406,2405,2394,2393,2406,2407,2389,2408,2407,2393,2389,2393,2409,2406,2393,2407,2409,2410,2383,2411,2410,2387,2383,2411,2385,2412,2411,2383,2385,2413,2397,2414,2413,2395,2397,2414,2400,2415,2414,2397,2400,2416,2395,2413,2416,2401,2395,2415,2404,2417,2415,2400,2404,2418,2387,2410,2418,2391,2387,2419,2401,2416,2419,2420,2401,2417,2406,2409,2417,2404,2406,2408,2391,2418,2408,2389,2391,2379,2412,2385,2379,2381,2412,2381,2421,2412,2381,2382,2421,2382,230,2421,2382,190,230,2422,2408,2423,2422,2407,2408,2423,2418,2424,2423,2408,2418,2424,2410,2425,2424,2418,2410,2426,2427,2428,2426,2411,2427,2429,2425,2430,2429,2424,2425,2411,2421,2427,2411,2412,2421,2431,2423,2432,2431,2422,2423,2428,236,243,2428,2427,236,2432,2424,2429,2432,2423,2424,2433,2428,2434,2433,2426,2428,2434,243,246,2434,2428,243,2435,2436,2437,2435,2438,2436,2437,2439,2440,2437,2436,2439,2440,2441,2442,2440,2439,2441,2443,2413,2444,2443,2416,2413,2445,2415,2446,2445,2414,2415,2444,2414,2445,2444,2413,2414,2447,2409,2448,2447,2417,2409,2449,2416,2443,2449,2419,2416,2446,2417,2447,2446,2415,2417,2450,2448,2451,2450,2447,2448,2452,2447,2450,2452,2446,2447,2453,2446,2452,2453,2445,2446,2422,2409,2407,2422,2448,2409,2422,2451,2448,2422,2431,2451,2454,2455,2456,2454,2457,2455,2435,2458,2456,2435,2459,2458,2460,2455,2461,2460,2438,2455,2462,2463,2464,2462,2454,2463,2465,2466,2467,2465,2468,2466,281,2469,2470,281,283,2469,2471,2472,2473,2471,2474,2472,2475,2473,2476,2475,2471,2473,2477,2473,2472,2477,2478,2473,2476,2478,2479,2476,2473,2478,2480,2469,2481,2480,2482,2469,297,2483,2481,297,299,2483,2483,2480,2481,2483,2484,2480,2482,2470,2469,2482,2485,2470,283,2481,2469,283,297,2481,2486,2487,2488,2486,2489,2487,2484,2472,2480,2484,2477,2472,2490,2491,2492,2490,2493,2491,2494,2495,2496,2494,2497,2495,2498,2499,2500,2498,2501,2499,2493,2502,2491,2493,2503,2502,320,2500,2499,320,321,2500,2501,2504,2499,2501,2505,2504,2503,2506,2502,2503,2507,2506,326,2499,2504,326,320,2499,2505,2508,2504,2505,2509,2508,2507,2510,2506,2507,2511,2510,331,2504,2508,331,326,2504,2512,2513,2514,2512,2515,2513,2516,2517,2518,2516,2512,2517,2519,2490,2520,2519,2521,2490,2522,2523,2524,2522,2525,2523,2526,2524,2527,2526,2522,2524,2493,2521,2528,2493,2490,2521,2503,2528,2529,2503,2493,2528,2507,2529,2530,2507,2503,2529,2511,2530,2531,2511,2507,2530,2514,2531,2532,2514,2511,2531,2512,2532,2517,2512,2514,2532,2516,2526,2527,2516,2518,2526,2495,2524,2496,2495,2527,2524,2496,2523,2533,2496,2524,2523,354,2534,357,354,2535,2534,2520,2533,2523,2520,2536,2533,2537,2471,2538,2537,2474,2471,2475,2539,2540,2475,2541,2539,2541,2542,2539,2541,2543,2542,2544,2527,2495,2544,2516,2527,2545,2546,2547,2545,2548,2546,2509,2549,2508,2509,2550,2549,373,2508,2549,373,331,2508,2518,2551,2526,2518,2552,2551,2552,2517,2553,2552,2518,2517,2530,2554,2531,2530,2555,2554,2521,2556,2528,2521,2557,2556,2558,2526,2551,2558,2522,2526,2528,2559,2529,2528,2556,2559,2519,2557,2521,2519,2560,2557,2531,2561,2532,2531,2554,2561,2562,2522,2558,2562,2525,2522,2553,2532,2561,2553,2517,2532,2529,2555,2530,2529,2559,2555,386,2549,2563,386,373,2549,2564,2565,2566,2564,2567,2565,2568,2569,2570,2568,2571,2569,2514,2510,2511,2514,2513,2510,2515,2516,2544,2515,2512,2516,2525,2520,2523,2525,2519,2520,2490,2536,2520,2490,2492,2536,2525,2560,2519,2525,2562,2560,2572,2571,2568,2572,2573,2571,398,2574,2575,398,400,2574,402,2563,2576,402,386,2563,2554,2577,2561,2554,2578,2577,2579,2551,2580,2579,2558,2551,2581,2561,2577,2581,2553,2561,2552,2580,2551,2552,2582,2580,2557,2583,2556,2557,2584,2583,2556,2585,2559,2556,2583,2585,2582,2553,2581,2582,2552,2553,2586,2562,2587,2586,2560,2562,2559,2588,2555,2559,2585,2588,2560,2584,2557,2560,2586,2584,2555,2578,2554,2555,2588,2578,2587,2558,2579,2587,2562,2558,2589,2587,2590,2589,2586,2587,2590,2579,2591,2590,2587,2579,2592,2590,2593,2592,2589,2590,2593,2591,2594,2593,2590,2591,2589,2584,2586,2589,2583,2584,2579,2582,2591,2579,2580,2582,2582,2594,2591,2582,2581,2594,2594,2577,2578,2594,2581,2577,2593,2578,2588,2593,2594,2578,2592,2588,2585,2592,2593,2588,2589,2585,2583,2589,2592,2585,2573,2595,2571,2573,2596,2595,2571,2597,2569,2571,2595,2597,2566,2598,2599,2566,2565,2598,2600,2563,2601,2600,2576,2563,2599,2602,2603,2599,2604,2602,2604,2605,2602,2604,2606,2605,2607,2608,2609,2607,2610,2608,2610,2611,2608,2610,2612,2611,2612,2613,2611,2612,2614,2613,2615,2616,2617,2615,2618,2616,2619,2617,2620,2619,2615,2617,2621,2622,2623,2621,2624,2622,2625,2623,2626,2625,2621,2623,2627,2628,2629,2627,2630,2628,2631,2632,2633,2631,2634,2632,2635,2599,2598,2635,2604,2599,2606,2635,2636,2606,2604,2635,2607,2636,2637,2607,2606,2636,2612,2638,2639,2612,2610,2638,2614,2639,2640,2614,2612,2639,2641,2642,2643,2641,2644,2642,2645,2630,2627,2645,2646,2630,2633,2647,2648,2633,2632,2647,2572,2629,2628,2572,2568,2629,2649,2650,2651,2649,2652,2650,2653,2654,2655,2653,2656,2654,2657,2658,2659,2657,2660,2658,2661,2662,2663,2661,2664,2662,2665,2666,2667,2665,2668,2666,2669,2670,2671,2669,2672,2670,2673,2674,2675,2673,2676,2674,2677,2671,2678,2677,2669,2671,2679,2675,2680,2679,2673,2675,2681,2678,2682,2681,2677,2678,2683,2680,2684,2683,2679,2680,512,2682,513,512,2681,2682,514,2684,515,514,2683,2684,2685,2670,2659,2685,2686,2670,2671,2686,2687,2671,2670,2686,2678,2687,2688,2678,2671,2687,2682,2688,2689,2682,2678,2688,513,2689,521,513,2682,2689,2667,2656,2653,2667,2666,2656,2676,2650,2690,2676,2673,2650,2651,2673,2679,2651,2650,2673,2679,2575,2651,2679,2683,2575,398,2683,514,398,2575,2683,2691,2629,2692,2691,2627,2629,2693,2648,2694,2693,2633,2648,2695,2627,2691,2695,2645,2627,2568,2692,2629,2568,2570,2692,2696,2692,2570,2696,2697,2692,2691,2697,2698,2691,2692,2697,2695,2698,2699,2695,2691,2698,2699,2694,2695,2699,2700,2694,2693,2700,2701,2693,2694,2700,2702,2698,2703,2702,2699,2698,2703,2697,2704,2703,2698,2697,2705,2706,2707,2705,2708,2706,2696,2704,2697,2696,2709,2704,2710,2700,2711,2710,2701,2700,2606,2609,2605,2606,2607,2609,2624,2620,2622,2624,2619,2620,2610,2637,2638,2610,2607,2637,2648,2646,2645,2648,2647,2646,2655,2660,2657,2655,2654,2660,2675,2672,2669,2675,2674,2672,2680,2669,2677,2680,2675,2669,2684,2677,2681,2684,2680,2677,515,2681,512,515,2684,2681,2694,2645,2695,2694,2648,2645,2701,2712,2693,2701,2713,2712,2711,2699,2702,2711,2700,2699,2713,2710,2714,2713,2701,2710,2686,2715,2687,2686,2716,2715,2687,2717,2688,2687,2715,2717,2685,2716,2686,2685,2718,2716,2713,2719,2712,2713,2720,2719,2631,2693,2712,2631,2633,2693,2689,553,521,2689,2721,553,2688,2721,2689,2688,2717,2721,2722,2626,2723,2722,2625,2626,2714,684,678,2714,2710,684,2724,2640,2725,2724,2614,2640,2716,2726,2715,2716,2727,2726,2728,2631,2729,2728,2634,2631,2720,2730,2719,2720,2731,2730,2717,2732,2721,2717,2733,2732,2720,2714,2734,2720,2713,2714,2715,2733,2717,2715,2726,2733,2729,2712,2719,2729,2631,2712,2718,2727,2716,2718,2735,2727,2614,2736,2613,2614,2724,2736,2726,2737,2733,2726,2738,2737,2733,2739,2732,2733,2737,2739,2731,2734,2740,2731,2720,2734,2735,2741,2727,2735,2742,2741,2743,2729,2744,2743,2728,2729,2745,2725,2746,2745,2724,2725,2724,2747,2736,2724,2745,2747,2727,2738,2726,2727,2741,2738,2748,2731,2749,2748,2730,2731,2744,2719,2730,2744,2729,2719,2750,2723,2751,2750,2722,2723,2752,2730,2748,2752,2744,2730,2753,2751,2754,2753,2750,2751,2739,590,571,2739,2755,590,2738,2756,2737,2738,2757,2756,2737,2755,2739,2737,2756,2755,2749,2740,2758,2749,2731,2740,2742,2759,2741,2742,2760,2759,2761,2744,2752,2761,2743,2744,2762,2746,2763,2762,2745,2746,2745,2764,2747,2745,2762,2764,2741,2757,2738,2741,2759,2757,2749,2765,2748,2749,2766,2765,2767,2766,2768,2767,2765,2766,2769,2748,2765,2769,2752,2748,2770,2754,2771,2770,2753,2754,2755,608,590,2755,2772,608,2757,2773,2756,2757,2774,2773,2756,2772,2755,2756,2773,2772,2766,2758,2775,2766,2749,2758,2760,2776,2759,2760,2777,2776,2778,2752,2769,2778,2761,2752,2779,2763,2780,2779,2762,2763,2762,2781,2764,2762,2779,2781,2782,620,2783,2782,621,620,2759,2774,2757,2759,2776,2774,2784,2780,2785,2784,2779,2780,2779,2786,2781,2779,2784,2786,2787,621,2782,2787,627,621,2776,2788,2774,2776,2789,2788,2768,2790,2767,2768,2791,2790,2792,2765,2767,2792,2769,2765,627,2793,634,627,2787,2793,2794,2771,2795,2794,2770,2771,2772,637,608,2772,2796,637,634,2797,640,634,2793,2797,2774,2798,2773,2774,2788,2798,2773,2796,2772,2773,2798,2796,2768,2775,2799,2768,2766,2775,2777,2789,2776,2777,2800,2789,2801,2769,2792,2801,2778,2769,2796,645,637,2796,2802,645,2797,647,640,2797,2799,647,2788,2803,2798,2788,2804,2803,2798,2802,2796,2798,2803,2802,2791,2799,2797,2791,2768,2799,2800,2805,2789,2800,2806,2805,2807,2792,2808,2807,2801,2792,2809,2785,2810,2809,2784,2785,2784,2811,2786,2784,2809,2811,657,2799,2775,657,647,2799,2789,2804,2788,2789,2805,2804,2812,2791,2813,2812,2790,2791,2808,2767,2790,2808,2792,2767,2775,660,657,2775,2758,660,2814,2795,2815,2814,2794,2795,2816,2790,2812,2816,2808,2790,2758,664,660,2758,2740,664,2817,2815,2818,2817,2814,2815,2802,667,645,2802,2819,667,2740,669,664,2740,2734,669,2804,2820,2803,2804,2821,2820,2803,2819,2802,2803,2820,2819,2813,2797,2793,2813,2791,2797,2806,2822,2805,2806,2823,2822,2824,2808,2816,2824,2807,2808,2825,2810,2826,2825,2809,2810,2809,2827,2811,2809,2825,2827,2805,2821,2804,2805,2822,2821,2812,2828,2829,2812,2813,2828,2830,2829,2828,2830,2831,2829,2832,2812,2829,2832,2816,2812,2703,711,701,2703,2704,711,2833,2818,2834,2833,2817,2818,2819,687,667,2819,2835,687,2821,2836,2820,2821,2837,2836,2820,2835,2819,2820,2836,2835,2828,2793,2787,2828,2813,2793,2823,2838,2822,2823,2839,2838,2840,2816,2832,2840,2824,2816,2841,2826,2842,2841,2825,2826,2825,2843,2827,2825,2841,2843,698,2711,2702,698,689,2711,2822,2837,2821,2822,2838,2837,2835,699,687,2835,2844,699,2837,2845,2836,2837,2846,2845,2836,2844,2835,2836,2845,2844,2830,2787,2782,2830,2828,2787,2839,2847,2838,2839,2848,2847,2849,2832,2850,2849,2840,2832,2851,2842,2852,2851,2841,2842,2841,2853,2843,2841,2851,2853,2838,2846,2837,2838,2847,2846,2854,2831,2830,2854,2855,2831,2850,2829,2831,2850,2832,2829,2705,1102,1103,2705,2707,1102,2856,2834,2857,2856,2833,2834,2858,2852,2859,2858,2851,2852,2851,2860,2853,2851,2858,2860,2847,2861,2846,2847,2862,2861,2863,2831,2855,2863,2850,2831,2864,2857,2865,2864,2856,2857,2844,725,699,2844,2866,725,2846,2867,2845,2846,2861,2867,2845,2866,2844,2845,2867,2866,2854,2782,2783,2854,2830,2782,2848,2862,2847,2848,2868,2862,2869,2850,2863,2869,2849,2850,2870,2863,2871,2870,2869,2863,2872,2855,2854,2872,2873,2855,2783,734,2874,2783,620,734,2875,2859,2876,2875,2858,2859,2858,2877,2860,2858,2875,2877,2878,2877,2879,2878,2860,2877,2871,2855,2873,2871,2863,2855,2880,2865,2881,2880,2864,2865,2866,743,725,2866,2882,743,2861,2883,2867,2861,2884,2883,2867,2882,2866,2867,2883,2882,2854,2874,2872,2854,2783,2874,2868,2885,2862,2868,2886,2885,2885,2861,2862,2885,2884,2861,2886,2877,2875,2886,2879,2877,2870,2875,2876,2870,2871,2875,2442,2887,2888,2442,2441,2887,2889,2706,2890,2889,2707,2706,2891,2892,2893,2891,2894,2892,2596,2895,2595,2596,2896,2895,2643,2616,2618,2643,2642,2616,2895,2597,2595,2895,2897,2597,2898,2899,2900,2898,2901,2899,2902,2903,2904,2902,2905,2903,2906,2907,2908,2906,2909,2907,2910,2908,2911,2910,2906,2908,2912,2911,2913,2912,2910,2911,2914,2913,2915,2914,2912,2913,2916,2915,2917,2916,2914,2915,2918,2919,2920,2918,2921,2919,2922,2920,2923,2922,2918,2920,2924,2923,2925,2924,2922,2923,2926,2925,2927,2926,2924,2925,2928,2927,2929,2928,2926,2927,2904,2930,2931,2904,2903,2930,2932,2933,2934,2932,2935,2933,2935,2936,2933,2935,2937,2936,2937,2938,2936,2937,2939,2938,2939,2940,2938,2939,2941,2940,2942,2943,2944,2942,2945,2943,2941,2946,2940,2941,2947,2946,2947,2943,2945,2947,2941,2943,2944,2948,2949,2944,2950,2948,2926,2951,2952,2926,2928,2951,2924,2952,2953,2924,2926,2952,2936,816,817,2936,2938,816,2954,2905,2902,2954,2955,2905,2459,2437,2956,2459,2435,2437,2909,2920,2919,2909,2906,2920,2906,2923,2920,2906,2910,2923,2910,2925,2923,2910,2912,2925,2912,2927,2925,2912,2914,2927,2914,2929,2927,2914,2916,2929,2908,2957,2911,2908,2958,2957,2915,2959,2917,2915,2960,2959,2913,2960,2915,2913,2961,2960,2911,2961,2913,2911,2957,2961,2958,2962,2957,2958,2963,2962,2957,2964,2961,2957,2962,2964,2961,2965,2960,2961,2964,2965,2960,2966,2959,2960,2965,2966,2963,2967,2962,2963,2968,2967,2966,2969,2970,2966,2971,2969,2962,2972,2964,2962,2967,2972,2964,2973,2965,2964,2972,2973,2965,2971,2966,2965,2973,2971,2968,2974,2967,2968,2975,2974,2971,2976,2969,2971,2977,2976,2967,2978,2972,2967,2974,2978,2972,2979,2973,2972,2978,2979,2973,2977,2971,2973,2979,2977,2975,2980,2974,2975,2981,2980,2977,2982,2976,2977,2983,2982,2974,2984,2978,2974,2980,2984,2978,2985,2979,2978,2984,2985,2979,2983,2977,2979,2985,2983,2981,2986,2980,2981,2987,2986,2983,2988,2982,2983,2989,2988,2980,2990,2984,2980,2986,2990,2984,2991,2985,2984,2990,2991,2985,2989,2983,2985,2991,2989,2992,857,2993,2992,858,857,2994,861,2995,2994,862,861,2993,864,2996,2993,857,864,2996,866,2997,2996,864,866,2997,862,2994,2997,866,862,2998,2999,3e3,2998,3001,2999,3e3,3002,3003,3e3,2999,3002,3004,3005,3006,3004,3007,3005,3008,3009,3010,3008,3011,3009,3006,3001,2998,3006,3005,3001,3010,3012,3013,3010,3009,3012,3014,3015,3016,3014,3017,3015,3017,3018,3015,3017,3019,3018,3020,3021,3022,3020,3023,3021,3024,3016,3025,3024,3014,3016,3026,3027,3028,3026,3029,3027,3019,2464,3018,3019,2462,2464,3030,2468,2465,3030,3031,2468,3023,3031,3030,3023,3020,3031,3027,3032,3028,3027,3033,3032,3034,2930,2903,3034,3035,2930,2908,3036,2958,2908,2907,3036,2963,3036,3037,2963,2958,3036,2968,3037,3038,2968,2963,3037,2975,3038,3039,2975,2968,3038,2981,3039,3040,2981,2975,3039,2987,3040,3041,2987,2981,3040,3042,3043,3044,3042,3045,3043,3046,2360,3047,3046,2363,2360,2352,3048,3049,2352,2354,3048,3050,3051,3047,3050,3052,3051,3050,2401,2420,3050,2402,2401,3053,3048,3054,3053,3049,3048,3043,3053,3054,3043,3045,3053,2366,2394,2405,2366,2367,2394,2356,2399,2396,2356,2358,2399,2316,2325,2327,2316,2317,2325,2360,2398,2402,2360,2362,2398,2370,2384,2386,2370,2372,2384,2319,2329,2331,2319,2321,2329,2375,2388,2390,2375,2376,2388,2365,2405,2403,2365,2366,2405,2317,2331,2325,2317,2319,2331,2362,2396,2398,2362,2356,2396,2372,2380,2384,2372,2378,2380,2376,2386,2388,2376,2370,2386,2367,2392,2394,2367,2369,2392,2327,2378,2316,2327,2380,2378,2358,2403,2399,2358,2365,2403,2369,2390,2392,2369,2375,2390,2321,2332,2329,2321,2323,2332,2931,3055,3056,2931,2930,3055,3035,3055,2930,3035,3057,3055,2938,928,816,2938,2940,928,929,2940,2946,929,928,2940,2901,3058,3059,2901,2898,3058,3060,3061,3062,3060,3063,3061,3064,3062,3061,3064,3065,3062,3066,3063,3067,3066,3061,3063,3066,3064,3061,3066,3068,3064,3069,3070,3071,3069,3072,3070,2943,2950,2944,2943,3073,2950,2941,3073,2943,2941,2939,3073,2942,2949,3074,2942,2944,2949,3071,3075,3076,3071,3070,3075,3077,3065,3064,3077,3078,3065,3077,3069,3071,3077,3079,3069,3080,2905,2955,3080,3081,2905,3082,3083,3084,3082,3085,3083,2953,3086,3087,2953,2952,3086,2952,3088,3086,2952,2951,3088,3089,2921,3083,3089,3090,2921,3091,2907,2909,3091,3092,2907,3093,3083,3085,3093,3089,3083,3091,2931,3056,3091,3094,2931,3090,2919,2921,3090,3094,2919,3095,2907,3092,3095,3036,2907,3096,3011,3008,3096,3097,3011,3098,3097,3096,3098,3099,3097,3100,3016,3101,3100,3025,3016,3003,974,975,3003,3002,974,3013,3007,3004,3013,3012,3007,3056,3102,3103,3056,3055,3102,3104,3105,3106,3104,3107,3105,3108,3036,3095,3108,3037,3036,3109,984,3110,3109,985,984,3111,3112,3113,3111,3114,3112,3115,3114,3111,3115,3116,3114,3117,3041,3040,3117,3118,3041,3119,3040,3039,3119,3117,3040,3120,3039,3038,3120,3119,3039,3121,3038,3037,3121,3120,3038,3122,3041,3123,3122,2987,3041,3027,3124,3033,3027,3125,3124,3126,1003,1005,3126,3127,1003,3029,3125,3027,3029,3128,3125,3129,3130,3131,3129,3132,3130,3133,3128,3029,3133,3134,3128,3033,3132,3129,3033,3124,3132,3135,3136,3137,3135,3138,3136,3139,3106,3140,3139,3104,3106,3141,3104,3139,3141,3142,3104,3143,1022,1024,3143,3144,1022,3137,3142,3141,3137,3136,3142,3140,3145,3146,3140,3106,3145,3105,2998,3147,3105,3006,2998,3148,3010,3149,3148,3008,3010,3107,3006,3105,3107,3004,3006,3150,3004,3107,3150,3013,3004,3151,975,1032,3151,3003,975,3149,3013,3150,3149,3010,3013,3152,1034,3153,3152,1035,1034,3154,2466,2468,3154,3155,2466,2956,3156,3157,2956,3158,3156,3159,2458,2459,3159,3160,2458,3159,2956,3157,3159,2459,2956,3161,2467,2466,3161,3162,2467,3033,3163,3032,3033,3129,3163,3129,3116,3163,3129,3131,3116,3164,1048,1050,3164,3165,1048,3156,3166,3167,3156,3158,3166,2888,3165,3164,2888,2887,3165,3168,3157,3169,3168,3159,3157,3168,3160,3159,3168,3170,3160,3116,3171,3114,3116,3131,3171,3172,3020,3022,3172,3173,3020,3173,3031,3020,3173,3174,3031,3169,3156,3175,3169,3157,3156,2899,2934,2900,2899,2932,2934,3114,3126,3112,3114,3171,3126,3071,3078,3077,3071,3076,3078,3064,3079,3077,3064,3068,3079,2902,3090,3089,2902,2904,3090,3056,3092,3091,3056,3176,3092,2954,3089,3093,2954,2902,3089,2909,3094,3091,2909,2919,3094,2904,3094,3090,2904,2931,3094,3177,3092,3176,3177,3095,3092,3178,3095,3177,3178,3108,3095,3179,3037,3108,3179,3121,3037,3180,3134,3133,3180,3181,3134,3182,3138,3135,3182,3183,3138,3184,3008,3148,3184,3096,3008,3173,3185,3174,3173,3186,3185,3173,3187,3186,3173,3172,3187,3112,1005,1073,3112,3126,1005,3174,3188,3154,3174,3185,3188,3189,1076,1078,3189,3190,1076,3191,2997,3192,3191,2996,2997,1034,3193,3153,1034,1082,3193,3194,3195,3196,3194,3197,3195,3198,3199,3200,3198,3155,3199,2430,2426,2433,2430,2425,2426,3190,1090,1076,3190,3201,1090,3171,3127,3126,3171,3202,3127,3155,3188,3199,3155,3154,3188,3203,2996,3191,3203,2993,2996,3204,3003,3151,3204,3e3,3003,3174,2468,3031,3174,3154,2468,3205,1035,3152,3205,1096,1035,3206,2995,3207,3206,2994,2995,3122,2993,3203,3122,2992,2993,3208,3144,3143,3208,3209,3144,858,3110,984,858,2992,3110,3192,2994,3206,3192,2997,2994,3198,3153,3161,3198,3152,3153,3175,3199,3188,3175,3210,3199,2410,2426,2425,2410,2411,2426,2569,2706,2708,2569,2597,2706,2890,2597,2897,2890,2706,2597,3211,1104,2889,3211,1636,1104,3060,2901,3059,3060,3062,2901,3062,2899,2901,3062,3065,2899,2932,3065,3078,2932,2899,3065,3078,2935,2932,3078,3076,2935,2937,3076,3075,2937,2935,3076,2933,817,1105,2933,2936,817,2934,1105,1106,2934,2933,1105,1106,2900,2934,1106,1107,2900,1107,2898,2900,1107,1108,2898,3058,1108,1109,3058,2898,1108,3212,3213,3214,3212,3215,3213,3216,3063,3217,3216,3067,3063,3217,3060,3218,3217,3063,3060,3218,3059,3219,3218,3060,3059,3219,3058,3220,3219,3059,3058,2541,2487,2543,2541,2488,2487,3221,3084,3222,3221,3082,3084,2921,3084,3083,2921,2918,3084,2918,3222,3084,2918,2922,3222,3070,2948,2950,3070,3072,2948,3075,2950,3073,3075,3070,2950,2939,3075,3073,2939,2937,3075,3221,2953,3087,3221,3222,2953,2922,2953,3222,2922,2924,2953,3181,3223,3224,3181,3180,3223,3225,3183,3182,3225,3226,3183,3138,3149,3136,3138,3148,3149,3201,3227,3228,3201,3190,3227,3228,3167,3166,3228,3227,3167,2992,3123,3110,2992,3122,3123,3153,3162,3161,3153,3193,3162,2990,3192,2991,2990,3191,3192,3152,3200,3205,3152,3198,3200,3131,3202,3171,3131,3130,3202,2986,3191,2990,2986,3203,3191,3147,3e3,3204,3147,2998,3e3,2989,3207,2988,2989,3206,3207,2987,3203,2986,2987,3122,3203,3146,3209,3208,3146,3145,3209,2991,3206,2989,2991,3192,3206,3155,3161,2466,3155,3198,3161,3189,3200,3229,3189,3205,3200,3229,3199,3210,3229,3200,3199,3230,3231,3232,3230,3233,3231,3234,3235,3236,3234,3237,3235,3238,3237,3234,3238,3239,3237,3240,3239,3238,3240,3241,3239,3242,3241,3240,3242,3243,3241,3244,2200,3232,3244,2253,2200,3245,2279,3246,3245,2283,2279,3247,3248,3249,3247,3250,3248,3246,2274,3251,3246,2279,2274,3252,3253,3254,3252,3255,3253,3251,2273,3249,3251,2274,2273,3256,3257,3258,3256,3259,3257,3247,2263,3260,3247,2267,2263,3261,3259,3256,3261,3262,3259,3260,2259,3263,3260,2263,2259,3263,2253,3244,3263,2259,2253,3264,3265,3266,3264,3267,3265,3268,3269,3270,3268,3271,3269,3272,3273,3274,3272,3275,3273,3230,3243,3242,3230,2202,3243,3276,3275,3272,3276,3277,3275,3236,3277,3276,3236,3235,3277,3278,3279,3280,3278,3281,3279,3282,3283,3284,3282,3285,3283,3286,3287,3288,3286,3289,3287,3290,3291,3292,3290,3233,3291,3293,3294,3295,3293,3296,3294,3280,3297,3298,3280,3279,3297,3288,3299,3300,3288,3287,3299,3292,3301,3302,3292,3291,3301,3250,3303,3248,3250,3304,3303,3304,3296,3293,3304,3250,3296,3305,3306,3307,3305,3308,3306,3300,3309,3310,3300,3299,3309,3302,3311,3312,3302,3301,3311,3313,3248,3303,3313,3314,3248,3315,3316,3317,3315,3318,3316,3312,3319,3320,3312,3311,3319,3321,3314,3313,3321,3322,3314,3323,3231,3324,3323,3325,3231,3320,3289,3286,3320,3319,3289,3233,3324,3231,3233,3290,3324,3326,3322,3321,3326,3327,3322,3295,3325,3323,3295,3294,3325,3328,3323,3329,3328,3295,3323,3330,3280,3331,3330,3278,3280,3332,3284,3333,3332,3282,3284,3334,3288,3335,3334,3286,3288,3336,3292,3337,3336,3290,3292,3338,3295,3328,3338,3293,3295,3331,3298,3339,3331,3280,3298,3335,3300,3340,3335,3288,3300,3337,3302,3341,3337,3292,3302,3304,3342,3303,3304,3343,3342,3343,3293,3338,3343,3304,3293,3344,3307,3345,3344,3305,3307,3340,3310,3346,3340,3300,3310,3341,3312,3347,3341,3302,3312,3348,3303,3342,3348,3313,3303,3349,3317,3350,3349,3315,3317,3347,3320,3351,3347,3312,3320,3352,3313,3348,3352,3321,3313,3329,3324,3353,3329,3323,3324,3351,3286,3334,3351,3320,3286,3290,3353,3324,3290,3336,3353,3354,3321,3352,3354,3326,3321,3355,3348,3356,3355,3352,3348,3357,3353,3358,3357,3329,3353,3359,3334,3360,3359,3351,3334,3336,3358,3353,3336,3361,3358,3362,3352,3355,3362,3354,3352,3363,3329,3357,3363,3328,3329,3364,3331,3365,3364,3330,3331,3366,3333,3367,3366,3332,3333,3360,3335,3368,3360,3334,3335,3361,3337,3369,3361,3336,3337,3370,3328,3363,3370,3338,3328,3365,3339,3371,3365,3331,3339,3368,3340,3372,3368,3335,3340,3369,3341,3373,3369,3337,3341,3343,3374,3342,3343,3375,3374,3375,3338,3370,3375,3343,3338,3376,3345,3377,3376,3344,3345,3372,3346,3378,3372,3340,3346,3373,3347,3379,3373,3341,3347,3356,3342,3374,3356,3348,3342,3380,3350,3381,3380,3349,3350,3379,3351,3359,3379,3347,3351,3382,3369,3383,3382,3361,3369,3384,3363,3385,3384,3370,3363,3386,3371,3387,3386,3365,3371,3388,3372,3389,3388,3368,3372,3383,3373,3390,3383,3369,3373,3375,3391,3374,3375,3392,3391,3392,3370,3384,3392,3375,3370,3393,3377,3394,3393,3376,3377,3389,3378,3395,3389,3372,3378,3390,3379,3396,3390,3373,3379,3397,3374,3391,3397,3356,3374,3398,3381,3399,3398,3380,3381,3396,3359,3400,3396,3379,3359,3401,3356,3397,3401,3355,3356,3402,3358,3403,3402,3357,3358,3400,3360,3404,3400,3359,3360,3361,3403,3358,3361,3382,3403,3405,3355,3401,3405,3362,3355,3385,3357,3402,3385,3363,3357,3406,3365,3386,3406,3364,3365,3407,3367,3408,3407,3366,3367,3404,3368,3388,3404,3360,3368,3382,3409,3403,3382,3410,3409,3411,3401,3412,3411,3405,3401,3413,3402,3414,3413,3385,3402,3415,3386,3416,3415,3406,3386,3417,3408,3418,3417,3407,3408,3419,3388,3420,3419,3404,3388,3410,3383,3421,3410,3382,3383,3422,3385,3413,3422,3384,3385,3416,3387,3423,3416,3386,3387,3420,3389,3424,3420,3388,3389,3421,3390,3425,3421,3383,3390,3392,3426,3391,3392,3427,3426,3427,3384,3422,3427,3392,3384,3428,3394,3429,3428,3393,3394,3424,3395,3430,3424,3389,3395,3425,3396,3431,3425,3390,3396,3432,3391,3426,3432,3397,3391,3433,3399,3434,3433,3398,3399,3431,3400,3435,3431,3396,3400,3412,3397,3432,3412,3401,3397,3414,3403,3409,3414,3402,3403,3435,3404,3419,3435,3400,3404,3436,3435,3437,3436,3431,3435,3435,3438,3437,3435,3419,3438,3419,3439,3438,3419,3420,3439,3424,3440,3441,3424,3430,3440,3442,3412,3443,3442,3411,3412,3433,3444,3445,3433,3434,3444,3417,3446,3447,3417,3418,3446,3415,3448,3449,3415,3416,3448,3450,3421,3451,3450,3410,3421,3416,3452,3448,3416,3423,3452,3414,3453,3413,3414,3454,3453,3439,3424,3441,3439,3420,3424,3412,3455,3443,3412,3432,3455,3427,3456,3426,3427,3457,3456,3432,3456,3455,3432,3426,3456,3458,3429,3459,3458,3428,3429,3427,3460,3457,3427,3422,3460,3422,3453,3460,3422,3413,3453,3414,3461,3454,3414,3409,3461,3450,3409,3410,3450,3461,3409,3421,3462,3451,3421,3425,3462,3425,3436,3462,3425,3431,3436,3434,3447,3444,3434,3417,3447,3407,3434,3399,3407,3417,3434,3366,3399,3381,3366,3407,3399,3381,3332,3366,3381,3350,3332,3436,3463,3462,3436,3464,3463,3457,3465,3456,3457,3466,3465,3460,3466,3457,3460,3467,3466,3458,3468,3452,3458,3469,3468,3448,3470,3449,3448,3471,3470,3454,3472,3453,3454,3473,3472,3440,3474,3441,3440,3475,3474,3451,3476,3450,3451,3477,3476,3453,3467,3460,3453,3472,3467,3445,3475,3440,3445,3478,3475,3437,3464,3436,3437,3479,3464,3462,3477,3451,3462,3463,3477,3461,3473,3454,3461,3480,3473,3455,3481,3443,3455,3482,3481,3446,3483,3447,3446,3484,3483,3438,3479,3437,3438,3485,3479,3443,3486,3442,3443,3481,3486,3456,3482,3455,3456,3465,3482,3452,3471,3448,3452,3468,3471,3439,3485,3438,3439,3487,3485,3450,3480,3461,3450,3476,3480,3447,3488,3444,3447,3483,3488,3441,3487,3439,3441,3474,3487,3478,3489,3475,3478,3490,3489,3479,3491,3464,3479,3492,3491,3473,3493,3472,3473,3494,3493,3481,3495,3486,3481,3496,3495,3482,3496,3481,3482,3497,3496,3484,3498,3483,3484,3499,3498,3485,3492,3479,3485,3500,3492,3476,3501,3480,3476,3502,3501,3465,3497,3482,3465,3503,3497,3468,3504,3471,3468,3505,3504,3487,3500,3485,3487,3506,3500,3466,3503,3465,3466,3507,3503,3467,3507,3466,3467,3508,3507,3483,3509,3488,3483,3498,3509,3474,3506,3487,3474,3510,3506,3463,3511,3477,3463,3512,3511,3472,3508,3467,3472,3493,3508,3469,3505,3468,3469,3513,3505,3471,3514,3470,3471,3504,3514,3475,3510,3474,3475,3489,3510,3477,3502,3476,3477,3511,3502,3464,3512,3463,3464,3491,3512,3480,3494,3473,3480,3501,3494,3497,3515,3496,3497,3516,3515,3499,3517,3498,3499,3518,3517,3500,3519,3492,3500,3520,3519,3502,3521,3501,3502,3522,3521,3503,3516,3497,3503,3523,3516,3505,3524,3504,3505,3525,3524,3506,3520,3500,3506,3526,3520,3507,3523,3503,3507,3527,3523,3508,3527,3507,3508,3528,3527,3498,3529,3509,3498,3517,3529,3510,3526,3506,3510,3530,3526,3512,3531,3511,3512,3532,3531,3493,3528,3508,3493,3533,3528,3513,3525,3505,3513,3534,3525,3504,3535,3514,3504,3524,3535,3489,3530,3510,3489,3536,3530,3511,3522,3502,3511,3531,3522,3491,3532,3512,3491,3537,3532,3501,3538,3494,3501,3521,3538,3490,3536,3489,3490,3539,3536,3492,3537,3491,3492,3519,3537,3494,3533,3493,3494,3538,3533,3496,3540,3495,3496,3515,3540,3541,3542,3543,3541,3544,3542,3545,3546,3547,3545,3548,3546,3549,3550,3551,3549,3552,3550,3553,3554,3555,3553,3556,3554,3557,3558,3559,3557,3560,3558,3556,3561,3562,3556,3553,3561,3560,3563,3564,3560,3557,3563,3543,3565,3566,3543,3542,3565,3567,3568,3569,3567,3570,3568,3555,3571,3572,3555,3554,3571,3573,3574,3575,3573,3576,3574,3577,3578,3579,3577,3580,3578,3552,3570,3567,3552,3549,3570,3564,3581,3582,3564,3563,3581,3579,3583,3584,3579,3578,3583,3585,3572,3571,3585,3586,3572,3587,3580,3577,3587,3588,3580,3548,3544,3541,3548,3545,3544,3576,3569,3568,3576,3573,3569,3586,3589,3590,3586,3585,3589,3588,3582,3581,3588,3587,3582,3584,3591,3592,3584,3583,3591,3593,3594,3595,3593,3596,3594,3547,3590,3589,3547,3546,3590,3551,3596,3593,3551,3550,3596,3566,3559,3558,3566,3565,3559,3592,3595,3594,3592,3591,3595,3576,3531,3574,3576,3522,3531,3536,3589,3530,3536,3547,3589,3563,3525,3581,3563,3524,3525,3533,3551,3528,3533,3549,3551,3574,3532,3562,3574,3531,3532,3534,3581,3525,3534,3588,3581,3585,3530,3589,3585,3526,3530,3557,3524,3563,3557,3535,3524,3528,3593,3527,3528,3551,3593,3527,3595,3523,3527,3593,3595,3545,3529,3544,3545,3539,3529,3526,3571,3520,3526,3585,3571,3544,3517,3542,3544,3529,3517,3591,3523,3595,3591,3516,3523,3522,3568,3521,3522,3576,3568,3535,3559,3597,3535,3557,3559,3554,3520,3571,3554,3519,3520,3542,3518,3565,3542,3517,3518,3583,3516,3591,3583,3515,3516,3598,3044,3043,3598,3599,3044,3600,3055,3057,3600,3102,3055,3103,3176,3056,3103,3601,3176,3602,3043,3054,3602,3598,3043,3054,3052,3602,3054,3048,3052,3048,3051,3052,3048,2354,3051,3603,2354,2353,3603,3051,2354,2285,3604,3605,2285,2235,3604,3606,2235,2237,3606,3604,2235,3607,2237,2239,3607,3606,2237,3264,3316,3270,3264,3285,3316,3285,3317,3316,3285,3282,3317,3282,3350,3317,3282,3332,3350,3608,3087,3086,3608,3609,3087,3609,3221,3087,3609,3610,3221,3610,3082,3221,3610,3611,3082,3611,3085,3082,3611,3612,3085,3613,3069,3079,3613,3612,3069,3613,2954,3093,3613,3614,2954,3615,3068,3066,3615,3614,3068,3615,3080,2955,3615,3616,3080,3617,3067,3216,3617,3616,3067,281,2535,354,281,2470,2535,3618,2470,2485,3618,2535,2470,3619,2896,2596,3619,3620,2896,3621,2596,2573,3621,3619,2596,3622,2572,2628,3622,3623,2572,3624,2628,2630,3624,3622,2628,3625,2630,2646,3625,3624,2630,3625,2622,2620,3625,3626,2622,3627,2647,2632,3627,3626,2647,3628,2632,2634,3628,3627,2632,3629,2634,2728,3629,3628,2634,3629,2751,2723,3629,3630,2751,3631,2743,2761,3631,3630,2743,3632,2761,2778,3632,3631,2761,3632,2795,2771,3632,3633,2795,3633,2815,2795,3633,3634,2815,3635,2807,2824,3635,3634,2807,3636,2824,2840,3636,3635,2824,3636,2857,2834,3636,3637,2857,3637,2865,2857,3637,3638,2865,3638,2881,2865,3638,3639,2881,3640,2870,2876,3640,3639,2870,3640,2864,2880,3640,3641,2864,3641,2856,2864,3641,3642,2856,3643,2852,2842,3643,3642,2852,3643,2817,2833,3643,3644,2817,3645,2826,2810,3645,3644,2826,3646,2810,2785,3646,3645,2810,3646,2770,2794,3646,3647,2770,3647,2753,2770,3647,3648,2753,3649,2763,2746,3649,3648,2763,3650,2746,2725,3650,3649,2746,3650,2625,2722,3650,3651,2625,3652,2640,2639,3652,3651,2640,3653,2639,2638,3653,3652,2639,3654,2638,2637,3654,3653,2638,3654,2615,2619,3654,3655,2615,3656,2636,2635,3656,3655,2636,3656,2643,2618,3656,3657,2643,3658,2893,2641,3658,3659,2893,3659,2891,2893,3659,3660,2891,2537,3618,2485,2537,3661,3618,2537,3662,3661,2537,2538,3662,3074,3609,3608,3074,2949,3609,2949,3610,3609,2949,2948,3610,2948,3611,3610,2948,3072,3611,3072,3612,3611,3072,3069,3612,3093,3612,3613,3093,3085,3612,3079,3614,3613,3079,3068,3614,2955,3614,3615,2955,2954,3614,3066,3616,3615,3066,3067,3616,3663,2536,2492,3663,3664,2536,3665,2538,2540,3665,3662,2538,3665,2539,3666,3665,2540,2539,2892,3620,3619,2892,2894,3620,2644,3619,3621,2644,2892,3619,2616,3623,3622,2616,2642,3623,2617,3622,3624,2617,2616,3622,2620,3624,3625,2620,2617,3624,2646,3626,3625,2646,2647,3626,2623,3626,3627,2623,2622,3626,2626,3627,3628,2626,2623,3627,2723,3628,3629,2723,2626,3628,2728,3630,3629,2728,2743,3630,2754,3630,3631,2754,2751,3630,2771,3631,3632,2771,2754,3631,2778,3633,3632,2778,2801,3633,2801,3634,3633,2801,2807,3634,2818,3634,3635,2818,2815,3634,2834,3635,3636,2834,2818,3635,2840,3637,3636,2840,2849,3637,2849,3638,3637,2849,2869,3638,2869,3639,3638,2869,2870,3639,2880,3639,3640,2880,2881,3639,2876,3641,3640,2876,2859,3641,2859,3642,3641,2859,2852,3642,2833,3642,3643,2833,2856,3642,2842,3644,3643,2842,2826,3644,2814,3644,3645,2814,2817,3644,2794,3645,3646,2794,2814,3645,2785,3647,3646,2785,2780,3647,2780,3648,3647,2780,2763,3648,2750,3648,3649,2750,2753,3648,2722,3649,3650,2722,2750,3649,2725,3651,3650,2725,2640,3651,2621,3651,3652,2621,2625,3651,2624,3652,3653,2624,2621,3652,2619,3653,3654,2619,2624,3653,2637,3655,3654,2637,2636,3655,2618,3655,3656,2618,2615,3655,2635,3657,3656,2635,2598,3657,2565,3659,3658,2565,2567,3659,2567,3660,3659,2567,3667,3660,3668,2539,2542,3668,3666,2539,3669,3670,3671,3669,3672,3670,3672,3673,3670,3672,3674,3673,3674,3675,3673,3674,3676,3675,3677,3678,3679,3677,3680,3678,3680,3681,3678,3680,3682,3681,3682,3683,3681,3682,3684,3683,3684,3685,3683,3684,3686,3685,3686,3687,3685,3686,3688,3687,2206,2201,2204,2206,2199,2201,3243,2199,2207,3243,2202,2199,3241,2207,2212,3241,3243,2207,3239,2212,2215,3239,3241,2212,3237,2215,2218,3237,3239,2215,3235,2218,2221,3235,3237,2218,3277,2221,2224,3277,3235,2221,3275,2224,2227,3275,3277,2224,3273,2227,2230,3273,3275,2227,3271,2230,2233,3271,3273,2230,3265,2239,2238,3265,3267,2239,3259,2243,2240,3259,3262,2243,3257,2240,2246,3257,3259,2240,3255,2246,2249,3255,3257,2246,2255,2201,2252,2255,2204,2201,2257,2252,2258,2257,2255,2252,2261,2258,2262,2261,2257,2258,2265,2262,2266,2265,2261,2262,2270,2275,2272,2270,2269,2275,2277,2272,2278,2277,2270,2272,2281,2278,2282,2281,2277,2278,2269,2266,2275,2269,2265,2266,3269,2239,3267,3269,3607,2239,2377,2303,2373,2377,2302,2303,2364,2298,2307,2364,2297,2298,2349,2288,2290,2349,2287,2288,2355,2285,2353,2355,2284,2285,2306,2300,2368,2306,2299,2300,2318,2310,2320,2318,2309,2310,2320,2311,2322,2320,2310,2311,2214,2299,2298,2214,2211,2299,2359,2296,2357,2359,2295,2296,2260,2312,2305,2260,2264,2312,2361,2295,2359,2361,2294,2295,2353,3605,3603,2353,2285,3605,3046,2293,2363,3046,2292,2293,2313,2309,2318,2313,2308,2309,2368,2301,2374,2368,2300,2301,2374,2302,2377,2374,2301,2302,2264,2308,2312,2264,2271,2308,2371,2305,2315,2371,2304,2305,2357,2297,2364,2357,2296,2297,2245,2291,2288,2245,2244,2291,2373,2304,2371,2373,2303,2304,2351,2287,2349,2351,2286,2287,2363,2294,2361,2363,2293,2294,3606,2232,3604,3606,2231,2232,3689,2542,2543,3689,3668,2542,2487,3689,2543,2487,3690,3689,3691,3692,3693,3691,3694,3692,3695,3696,3697,3695,3698,3696,3699,3700,3701,3699,3702,3700,3703,3698,3695,3703,3704,3698,3699,2484,2483,3699,3701,2484,2497,3666,3668,2497,2494,3666,1605,3702,3699,1605,1606,3702,1605,2483,299,1605,3699,2483,3693,3704,3703,3693,3692,3704,2497,2544,2495,2497,3705,2544,3706,3707,3708,3706,3709,3707,3687,1612,3710,3687,1587,1612,3685,3710,3711,3685,3687,3710,3683,3711,3712,3683,3685,3711,3712,3681,3683,3712,3713,3681,2510,2662,2664,2510,2513,2662,3714,2513,2515,3714,2662,2513,3715,2544,3705,3715,3716,2544,2506,2550,2509,2506,2510,2550,2502,2509,2505,2502,2506,2509,2491,2505,2501,2491,2502,2505,2501,2492,2491,2501,2498,2492,2492,3717,3663,2492,2498,3717,2485,2474,2537,2485,2482,2474,2564,3667,2567,2564,3718,3667,2498,2534,3717,2498,2500,2534,357,2500,321,357,2534,2500,3607,2231,3606,3607,2233,2231,3719,2250,3720,3719,2249,2250,3720,2251,3721,3720,2250,2251,3722,2251,2286,3722,3721,2251,3605,2232,2292,3605,3604,2232,3723,2351,2350,3723,3724,2351,3598,2420,2419,3598,3602,2420,3599,2419,2449,3599,3598,2419,2541,2476,2488,2541,2475,2476,2488,2479,2486,2488,2476,2479,3713,3678,3681,3713,3725,3678,2489,3690,2487,2489,3726,3690,2471,2540,2538,2471,2475,2540,3600,3025,3102,3600,3024,3025,3603,3047,3051,3603,3046,3047,2402,3047,2360,2402,3050,3047,3052,2420,3602,3052,3050,2420,3727,3693,3706,3727,3691,3693,3103,3025,3100,3103,3102,3025,2348,3708,3707,2348,2346,3708,3258,3255,3252,3258,3257,3255,3274,3271,3268,3274,3273,3271,3298,3308,3305,3298,3297,3308,3310,3318,3315,3310,3309,3318,3339,3305,3344,3339,3298,3305,3346,3315,3349,3346,3310,3315,3371,3344,3376,3371,3339,3344,3378,3349,3380,3378,3346,3349,3387,3376,3393,3387,3371,3376,3395,3380,3398,3395,3378,3380,3423,3393,3428,3423,3387,3393,3430,3398,3433,3430,3395,3398,3430,3445,3440,3430,3433,3445,3452,3428,3458,3452,3423,3428,3459,3469,3458,3459,3728,3469,3444,3478,3445,3444,3488,3478,3488,3490,3478,3488,3509,3490,3728,3513,3469,3728,3729,3513,3729,3534,3513,3729,3730,3534,3509,3539,3490,3509,3529,3539,3578,3515,3583,3578,3540,3515,3549,3538,3570,3549,3533,3538,3556,3519,3554,3556,3537,3519,3539,3547,3536,3539,3545,3547,3565,3597,3559,3565,3518,3597,3580,3540,3578,3580,3730,3540,3588,3730,3580,3588,3534,3730,3725,3679,3678,3725,3731,3679,3269,2233,3607,3269,3271,2233,3253,2249,3719,3253,3255,2249,3603,2292,3046,3603,3605,2292,3724,2286,2351,3724,3722,2286,3732,1677,3733,3732,1678,1677,3734,3706,3708,3734,3727,3706,3735,2496,2533,3735,2494,2496,2482,2472,2474,2482,2480,2472,2533,3664,3735,2533,2536,3664,2601,2510,2664,2601,2550,2510,3736,3669,3671,3736,3737,3669,3715,3689,3690,3715,3705,3689,2550,2563,2549,2550,2601,2563,2889,3738,3211,2889,2890,3738,3690,3739,3715,3690,3726,3739,3740,2890,2897,3740,3738,2890,2897,3741,3740,2897,2895,3741,3742,2895,2896,3742,3741,2895,3717,2535,3618,3717,2534,2535,3663,3618,3661,3663,3717,3618,3661,3664,3663,3661,3662,3664,3735,3662,3665,3735,3664,3662,3665,2494,3735,3665,3666,2494,3743,2489,2486,3743,3744,2489,3705,3668,3689,3705,2497,3668,3745,2896,3620,3745,3742,2896,3620,3746,3745,3620,2894,3746,3747,2894,2891,3747,3746,2894,3748,2891,3660,3748,3747,2891,3660,3749,3748,3660,3667,3749,3667,3750,3749,3667,3718,3750,3726,2547,3739,3726,2545,2547,3751,3752,3753,3751,3754,3752,3726,3744,2545,3726,2489,3744,3213,2338,2333,3213,3697,2338,3675,3731,3755,3675,3679,3731,3755,3673,3675,3755,3756,3673,3215,3697,3213,3215,3695,3697,3756,3670,3673,3756,3757,3670,3757,3671,3670,3757,3758,3671,3709,3695,3215,3709,3703,3695,3759,3760,3761,3759,3762,3760,3671,3763,3736,3671,3758,3763,3764,3736,3763,3764,3765,3736,3765,3766,3767,3765,3764,3766,3767,3768,3769,3767,3766,3768,3759,3769,3768,3759,3770,3769,3771,3759,3761,3771,3770,3759,3617,3080,3616,3617,3772,3080,3773,1700,3774,3773,1701,1700,150,3702,1606,150,2343,3702,2343,3700,3702,2343,2341,3700,3775,3776,3777,3775,3778,3776,3779,2341,3696,3779,3700,2341,3780,3774,3732,3780,3781,3774,3778,3782,3776,3778,3783,3782,3784,3785,3786,3784,3787,3785,3788,3781,3780,3788,3789,3781,3786,3789,3788,3786,3785,3789,3790,3791,3792,3790,3783,3791,3058,1757,3220,3058,1109,1757,3790,3787,3784,3790,3792,3787,3781,3773,3774,3781,3793,3773,3789,3793,3781,3789,3794,3793,3795,3770,3771,3795,3796,3770,3768,3762,3759,3768,3797,3762,3796,3769,3770,3796,3798,3769,3798,3767,3769,3798,3799,3767,3800,3696,3698,3800,3779,3696,3698,3801,3800,3698,3704,3801,3799,3765,3767,3799,3802,3765,3802,3736,3765,3802,3737,3736,3803,3804,3805,3803,3806,3804,3806,3807,3804,3806,3808,3807,2444,2453,3809,2444,2445,2453,2443,3809,3810,2443,2444,3809,2449,3810,3811,2449,2443,3810,3811,3599,2449,3811,3812,3599,3812,3044,3599,3812,3813,3044,3813,3042,3044,3813,3814,3042,3815,3805,3816,3815,3803,3805,3165,1726,1048,3165,3817,1726,2887,3817,3165,2887,3818,3817,2439,3819,2441,2439,3820,3819,2438,3821,2436,2438,2460,3821,2436,3820,2439,2436,3821,3820,2441,3818,2887,2441,3819,3818,3807,3822,3823,3807,3808,3822,3823,3824,2457,3823,3822,3824,2457,2461,2455,2457,3824,2461,3816,3797,3815,3816,3825,3797,3825,3762,3797,3825,3826,3762,3826,3760,3762,3826,3827,3760,2347,3708,2346,2347,3734,3708,3761,3828,3829,3761,3760,3828,3830,3778,3775,3830,3831,3778,3832,3732,3733,3832,3780,3732,3831,3783,3778,3831,3791,3783,3833,3786,3834,3833,3784,3786,3835,3780,3832,3835,3788,3780,3834,3788,3835,3834,3786,3788,3836,3783,3790,3836,3782,3783,3836,3784,3833,3836,3790,3784,3785,3794,3789,3785,3837,3794,3838,3704,3692,3838,3801,3704,3839,3692,3694,3839,3838,3692,3840,3839,3694,3840,2548,3839,3840,2546,2548,3840,3841,2546,3775,3842,3843,3775,3777,3842,3787,3837,3785,3787,3844,3837,3792,3844,3787,3792,3845,3844,3792,3846,3845,3792,3791,3846,3791,3847,3846,3791,3831,3847,3848,3846,3847,3848,3772,3846,3828,3827,3849,3828,3760,3827,2956,2440,3158,2956,2437,2440,3158,2442,3166,3158,2440,2442,2463,2456,2458,2463,2454,2456,2438,2456,2455,2438,2435,2456,3823,2454,2462,3823,2457,2454,3166,2888,3228,3166,2442,2888,3805,3017,3014,3805,3804,3017,3804,3019,3017,3804,3807,3019,3816,3014,3024,3816,3805,3014,3807,2462,3019,3807,3823,2462,3849,3035,3034,3849,3827,3035,3827,3057,3035,3827,3826,3057,3201,1050,1090,3201,3164,1050,3228,3164,3201,3228,2888,3164,3825,3057,3826,3825,3600,3057,3825,3024,3600,3825,3816,3024,3034,2905,3081,3034,2903,2905,3844,3217,3837,3844,3216,3217,2348,3212,2350,2348,3707,3212,2350,3214,3723,2350,3212,3214,3693,3709,3706,3693,3703,3709,2341,3697,3696,2341,2338,3697,3771,3829,3850,3771,3761,3829,3752,3843,3842,3752,3754,3843,2548,3744,3839,2548,2545,3744,3749,3777,3748,3749,3842,3777,3777,3747,3748,3777,3776,3747,3838,3744,3743,3838,3839,3744,3743,3801,3838,3743,3851,3801,3776,3746,3747,3776,3782,3746,3782,3745,3746,3782,3836,3745,2479,3743,2486,2479,3851,3743,3836,3742,3745,3836,3833,3742,3851,3800,3801,3851,3852,3800,3741,3833,3834,3741,3742,3833,2479,3852,3851,2479,2478,3852,3853,2478,2477,3853,3852,2478,3701,2477,2484,3701,3853,2477,3853,3800,3852,3853,3779,3800,3779,3701,3700,3779,3853,3701,3740,3834,3835,3740,3741,3834,3738,3835,3832,3738,3740,3835,3832,3211,3738,3832,3733,3211,3753,3750,3854,3753,3752,3750,3679,3676,3677,3679,3675,3676,3113,1766,3855,3113,1767,1766,3856,3855,3109,3856,3857,3855,3118,3857,3856,3118,3858,3857,3859,3858,3860,3859,3115,3858,3861,3860,3862,3861,3859,3860,3863,3862,3864,3863,3861,3862,3865,3864,3866,3865,3863,3864,3194,3866,3867,3194,3865,3866,3179,3868,3867,3179,3869,3868,3860,3118,3117,3860,3858,3118,3855,985,3109,3855,1766,985,3866,3120,3121,3866,3864,3120,3867,3121,3179,3867,3866,3121,3123,3109,3110,3123,3856,3109,3862,3117,3119,3862,3860,3117,3864,3119,3120,3864,3862,3119,3041,3856,3123,3041,3118,3856,3108,3869,3179,3108,3178,3869,3750,3842,3749,3750,3752,3842,3870,3871,3872,3870,3873,3871,3775,3870,3830,3775,3843,3870,3873,3843,3754,3873,3870,3843,3751,3873,3754,3751,3874,3873,3870,3875,3830,3870,3872,3875,3875,3831,3830,3875,3847,3831,3837,3218,3794,3837,3217,3218,3794,3219,3793,3794,3218,3219,3793,3220,3773,3793,3219,3220,3845,3216,3844,3845,3617,3216,3845,3772,3617,3845,3846,3772,3081,3772,3848,3081,3080,3772,3850,3876,3877,3850,3829,3876,3878,3879,3880,3878,3881,3879,3848,3875,3882,3848,3847,3875,3881,3883,3879,3881,3691,3883,3848,3828,3849,3848,3882,3828,3840,3878,3841,3840,3881,3878,3691,3840,3694,3691,3881,3840,3882,3829,3828,3882,3876,3829,3081,3849,3034,3081,3848,3849,3872,3882,3875,3872,3876,3882,3707,3215,3212,3707,3709,3215,3876,3871,3877,3876,3872,3871,3880,3042,3814,3880,3879,3042,3045,3879,3883,3045,3042,3879,3883,3053,3045,3883,3884,3053,3884,3049,3053,3884,3885,3049,2352,3885,3886,2352,3049,3885,3886,2355,2352,3886,3887,2355,2284,3887,3888,2284,2355,3887,3888,2236,2284,3888,3889,2236,2234,3889,3890,2234,2236,3889,2238,3890,3891,2238,2234,3890,3766,3797,3768,3766,3815,3797,3766,3803,3815,3766,3764,3803,3764,3806,3803,3764,3763,3806,3808,3763,3758,3808,3806,3763,3822,3758,3757,3822,3808,3758,3824,3757,3756,3824,3822,3757,2461,3756,3755,2461,3824,3756,3570,3521,3568,3570,3538,3521,3518,3892,3597,3518,3499,3892,3499,3893,3892,3499,3484,3893,3894,3484,3446,3894,3893,3484,3895,3446,3418,3895,3894,3446,3418,3896,3895,3418,3408,3896,3408,3897,3896,3408,3367,3897,3367,3898,3897,3367,3333,3898,3333,3899,3898,3333,3284,3899,3284,3900,3899,3284,3283,3900,3901,3283,3266,3901,3900,3283,3891,3265,2238,3891,3902,3265,3755,2460,2461,3755,3731,2460,3821,3731,3725,3821,2460,3731,3820,3725,3713,3820,3821,3725,3819,3713,3712,3819,3820,3713,3712,3818,3819,3712,3711,3818,3711,3817,3818,3711,3710,3817,2434,1588,3688,2434,246,1588,3537,3562,3532,3537,3556,3562,3597,3514,3535,3597,3892,3514,3495,3730,3729,3495,3540,3730,3884,3691,3727,3884,3883,3691,3727,3885,3884,3727,3734,3885,3886,3734,2347,3886,3885,3734,2347,3887,3886,2347,2289,3887,3214,2333,2332,3214,3213,2333,3723,2332,2323,3723,3214,2332,3724,2323,2322,3724,3723,2323,3575,3562,3561,3575,3574,3562,3573,3567,3569,3573,3575,3567,3575,3552,3567,3575,3561,3552,3561,3550,3552,3561,3553,3550,3553,3596,3550,3553,3555,3596,3555,3594,3596,3555,3572,3594,3592,3572,3586,3592,3594,3572,3586,3584,3592,3586,3590,3584,3579,3590,3546,3579,3584,3590,3577,3546,3548,3577,3579,3546,3587,3548,3541,3587,3577,3548,3541,3582,3587,3541,3543,3582,3543,3564,3582,3543,3566,3564,3560,3566,3558,3560,3564,3566,3892,3470,3514,3892,3893,3470,3449,3893,3894,3449,3470,3893,3894,3415,3449,3894,3895,3415,3406,3895,3896,3406,3415,3895,3896,3364,3406,3896,3897,3364,3897,3330,3364,3897,3898,3330,3278,3898,3899,3278,3330,3898,3281,3899,3900,3281,3278,3899,3261,3900,3901,3261,3281,3900,2243,3902,3891,2243,3262,3902,3891,2241,2243,3891,3890,2241,3890,2244,2241,3890,3889,2244,2291,3889,3888,2291,2244,3889,3888,2289,2291,3888,3887,2289,3722,2322,2311,3722,3724,2322,2311,3721,3722,2311,2280,3721,3720,2280,2281,3720,3721,2280,3719,2281,2282,3719,3720,2281,2282,3253,3719,2282,2283,3253,3245,3306,3254,3245,3327,3306,3307,3327,3326,3307,3306,3327,3345,3326,3354,3345,3307,3326,3354,3377,3345,3354,3362,3377,3394,3362,3405,3394,3377,3362,3405,3429,3394,3405,3411,3429,3411,3459,3429,3411,3442,3459,3728,3442,3486,3728,3459,3442,3486,3729,3728,3486,3495,3729,3850,3795,3771,3850,3903,3795,3873,3904,3871,3873,3874,3904,3877,3904,3905,3877,3871,3904,3877,3903,3850,3877,3905,3903,3854,3718,3906,3854,3750,3718,3907,3718,2564,3907,3906,3718,3908,2599,2603,3908,2566,2599,2651,2574,2649,2651,2575,2574,2893,2644,2641,2893,2892,2644,2600,2652,2649,2600,2661,2652,2650,3909,2690,2650,2652,3909,2668,3907,3908,2668,3910,3907,2709,2708,2705,2709,2696,2708,2570,2708,2696,2570,2569,2708,3623,2573,2572,3623,3621,2573,3657,2641,2643,3657,3658,2641,2642,3621,3623,2642,2644,3621,2598,3658,3657,2598,2565,3658,3907,2566,3908,3907,2564,2566,2608,3911,2658,2608,2611,3911,2609,2658,2660,2609,2608,2658,2660,2605,2609,2660,2654,2605,2602,2654,2656,2602,2605,2654,2603,2656,2666,2603,2602,2656,3908,2666,2668,3908,2603,2666,3854,3716,3715,3854,3906,3716,3907,3716,3906,3907,3910,3716,3715,3753,3854,3715,3739,3753,3739,3751,3753,3739,2547,3751,2547,3874,3751,2547,2546,3874,2546,3904,3874,2546,3841,3904,3841,3905,3904,3841,3878,3905,3903,3878,3880,3903,3905,3878,3880,3795,3903,3880,3814,3795,400,2576,2574,400,402,2576,2649,2576,2600,2649,2574,2576,2652,2663,3909,2652,2661,2663,2601,2661,2600,2601,2664,2661,3911,2718,2685,3911,3912,2718,2672,2659,2670,2672,2657,2659,3913,3909,2663,3913,2665,3909,2674,2657,2672,2674,2655,2657,2690,2653,2676,2690,2667,2653,3909,2667,2690,3909,2665,2667,2676,2655,2674,2676,2653,2655,3911,2659,2658,3911,2685,2659,3912,2735,2718,3912,3914,2735,3914,2742,2735,3914,3915,2742,3915,2760,2742,3915,3916,2760,3916,2777,2760,3916,3917,2777,3917,2800,2777,3917,3918,2800,3918,2806,2800,3918,3919,2806,3919,2823,2806,3919,3920,2823,3920,2839,2823,3920,3921,2839,3921,2848,2839,3921,3922,2848,3922,2868,2848,3922,2878,2868,2878,2886,2868,2878,2879,2886,3910,2665,3913,3910,2668,2665,3716,2515,2544,3716,3714,2515,3716,3913,3714,3716,3910,3913,2663,3714,3913,2663,2662,3714,2871,2886,2875,2871,2873,2886,2873,2885,2886,2873,2872,2885,2885,2883,2884,2885,2882,2883,2872,2882,2885,2872,2874,2882,2874,743,2882,2874,734,743,2853,2878,3922,2853,2860,2878,3922,2843,2853,3922,3921,2843,3921,2827,2843,3921,3920,2827,3920,2811,2827,3920,3919,2811,3919,2786,2811,3919,3918,2786,2781,3918,3917,2781,2786,3918,3917,2764,2781,3917,3916,2764,3916,2747,2764,3916,3915,2747,3915,2736,2747,3915,3914,2736,3914,2613,2736,3914,3912,2613,2611,3912,3911,2611,2613,3912,3796,3814,3813,3796,3795,3814,3798,3813,3812,3798,3796,3813,3799,3812,3811,3799,3798,3812,3802,3811,3810,3802,3799,3811,3737,3810,3809,3737,3802,3810,3669,3809,2453,3669,3737,3809,2453,3672,3669,2453,2452,3672,2452,3674,3672,2452,2450,3674,2450,3676,3674,2450,2451,3676,3677,2451,2431,3677,3676,2451,2431,3680,3677,2431,2432,3680,2432,3682,3680,2432,2429,3682,2429,3684,3682,2429,2430,3684,2430,3686,3684,2430,2433,3686,2433,3688,3686,2433,2434,3688,3106,3147,3145,3106,3105,3147,3142,3107,3104,3142,3150,3107,3144,1032,1022,3144,3151,1032,3136,3150,3142,3136,3149,3150,3183,3148,3138,3183,3184,3148,3209,3151,3144,3209,3204,3151,3145,3204,3209,3145,3147,3204,3098,3184,3923,3098,3096,3184,3184,3226,3923,3184,3183,3226,3196,3029,3026,3196,3133,3029,3195,3133,3196,3195,3180,3133,3170,3924,3160,3170,3925,3924,3926,3172,3927,3926,3187,3172,3022,3927,3172,3022,3928,3927,3928,3929,3927,3928,3930,3929,3925,3931,3924,3925,3932,3931,3933,3927,3929,3933,3926,3927,3930,3934,3929,3930,3935,3934,3932,3936,3931,3932,3937,3936,3938,3929,3934,3938,3933,3929,3869,3939,3868,3869,3940,3939,3197,3941,3195,3197,3942,3941,3177,3943,3178,3177,3944,3943,3940,3178,3943,3940,3869,3178,3177,3601,3944,3177,3176,3601,3223,3195,3941,3223,3180,3195,3018,3931,3936,3018,2464,3931,3924,2464,2463,3924,3931,2464,3935,3945,3946,3935,3930,3945,3022,3947,3928,3022,3021,3947,3947,3930,3928,3947,3945,3930,2463,3160,3924,2463,2458,3160,3015,3936,3948,3015,3018,3936,3101,3015,3948,3101,3016,3015,3949,3098,3950,3949,3099,3098,3951,3223,3952,3951,3224,3223,3953,3101,3954,3953,3100,3101,3955,3956,3957,3955,3958,3956,3959,3103,3960,3959,3601,3103,3961,3943,3962,3961,3940,3943,3963,3964,3965,3963,3966,3964,3967,3968,3969,3967,3970,3968,3971,3934,3972,3971,3938,3934,3954,3948,3973,3954,3101,3948,3974,3975,3976,3974,3977,3975,3978,3979,3980,3978,3981,3979,3976,3982,3983,3976,3975,3982,3952,3941,3984,3952,3223,3941,3980,3985,3986,3980,3979,3985,3987,3966,3963,3987,3988,3966,3989,3958,3955,3989,3990,3958,3950,3923,3991,3950,3098,3923,3992,3993,3994,3992,3995,3993,3996,3997,3998,3996,3999,3997,4e3,3982,4001,4e3,4002,3982,4003,3993,4004,4003,3981,3993,4005,3964,4006,4005,4007,3964,3970,4008,3968,3970,4009,4008,3975,4001,3982,3975,4010,4001,4011,4007,4005,4011,3995,4007,3990,4012,3958,3990,4013,4012,3981,4014,3979,3981,4003,4014,3988,4015,3966,3988,4016,4015,4017,3956,4018,4017,4019,3956,4020,4021,4022,4020,4023,4021,4022,3997,4024,4022,4021,3997,3979,4025,3985,3979,4014,4025,3958,4018,3956,3958,4012,4018,3995,4004,3993,3995,4011,4004,3977,4010,3975,3977,4026,4010,3999,4024,3997,3999,4027,4024,4028,4019,4017,4028,4029,4019,3966,4006,3964,3966,4015,4006,4009,3985,4025,4009,3970,3985,4026,4030,4010,4026,4031,4030,4027,4032,4024,4027,4033,4032,4034,4017,4035,4034,4028,4017,4015,4036,4006,4015,4037,4036,4038,4025,4039,4038,4009,4025,4040,4001,4041,4040,4e3,4001,4042,4004,4043,4042,4003,4004,4044,4006,4036,4044,4005,4006,4009,4045,4008,4009,4038,4045,4010,4041,4001,4010,4030,4041,4046,4005,4044,4046,4011,4005,4013,4047,4012,4013,4048,4047,4003,4049,4014,4003,4042,4049,4016,4037,4015,4016,4050,4037,4035,4018,4051,4035,4017,4018,4052,4022,4053,4052,4020,4022,4053,4024,4032,4053,4022,4024,4014,4039,4025,4014,4049,4039,4012,4051,4018,4012,4047,4051,4011,4043,4004,4011,4046,4043,4054,4055,4056,4054,4057,4055,4058,4059,4060,4058,4061,4059,4062,4063,4064,4062,4065,4063,4066,4067,4068,4066,4069,4067,4070,4071,4072,4070,4073,4071,4074,4075,4076,4074,4077,4075,4056,4078,4079,4056,4055,4078,4080,4081,4082,4080,4083,4081,4072,4084,4085,4072,4071,4084,4086,4065,4062,4086,4087,4065,4088,4061,4058,4088,4089,4061,4090,4078,4091,4090,4092,4078,4093,4092,4090,4093,4069,4092,4094,4063,4095,4094,4096,4063,4097,4098,4099,4097,4100,4098,4099,4075,4101,4099,4098,4075,4102,4096,4094,4102,4103,4096,4104,4059,4105,4104,4083,4059,4106,4084,4107,4106,4108,4084,4109,4067,4110,4109,4089,4067,4111,4112,4113,4111,4114,4112,4115,4116,4117,4115,4118,4116,4119,4120,4121,4119,4122,4120,4114,4123,4124,4114,4111,4123,4125,4126,4127,4125,4128,4126,4129,4130,4131,4129,4132,4130,4133,4134,4135,4133,4136,4134,4113,4137,4138,4113,4112,4137,4131,4121,4120,4131,4130,4121,4139,4140,4141,4139,4142,4140,4143,4136,4133,4143,4144,4136,4145,4146,4147,4145,4148,4146,4128,4135,4134,4128,4125,4135,4136,4149,4134,4136,4150,4149,4144,4150,4136,4144,4151,4150,4122,4152,4120,4122,4153,4152,4154,4117,4155,4154,4115,4117,4115,4156,4157,4115,4154,4156,4158,4113,4159,4158,4111,4113,4160,4131,4161,4160,4129,4131,4142,4162,4140,4142,4163,4162,4164,4165,4166,4164,4147,4165,4167,4126,4168,4167,4169,4126,4140,4170,4171,4140,4162,4170,4111,4172,4123,4111,4158,4172,4157,4166,4165,4157,4156,4166,4169,4173,4138,4169,4167,4173,4155,4171,4170,4155,4117,4171,4174,4153,4122,4174,4175,4153,4176,4134,4149,4176,4128,4134,4177,4147,4164,4177,4145,4147,4070,4030,4031,4070,4072,4030,4072,4041,4030,4072,4085,4041,4040,4085,4178,4040,4041,4085,4050,4178,4054,4050,4040,4178,4054,4037,4050,4054,4056,4037,4056,4036,4037,4056,4079,4036,4044,4079,4179,4044,4036,4079,3857,3113,3855,3857,3111,3113,3858,3111,3857,3858,3115,3111,3186,3169,3185,3186,3168,3169,3186,3170,3168,3186,3187,3170,3185,3175,3188,3185,3169,3175,3205,1078,1096,3205,3189,1078,3867,3197,3194,3867,3868,3197,3156,3210,3175,3156,3167,3210,3190,3229,3227,3190,3189,3229,3227,3210,3167,3227,3229,3210,3112,1767,3113,3112,1073,1767,3163,3115,3859,3163,3116,3115,3032,3859,3861,3032,3163,3859,3028,3861,3863,3028,3032,3861,3026,3863,3865,3026,3028,3863,3196,3865,3194,3196,3026,3865,3187,3925,3170,3187,3926,3925,3926,3932,3925,3926,3933,3932,3933,3937,3932,3933,3938,3937,3868,3942,3197,3868,3939,3942,4180,3988,3987,4180,4002,3988,3969,3999,3996,3969,3968,3999,4002,4016,3988,4002,4e3,4016,3968,4027,3999,3968,4008,4027,4008,4033,4027,4008,4045,4033,4e3,4050,4016,4e3,4040,4050,4178,4057,4054,4178,4108,4057,4082,4077,4074,4082,4081,4077,4163,4123,4172,4163,4142,4123,4161,4120,4152,4161,4131,4120,4159,4138,4173,4159,4113,4138,4128,4168,4126,4128,4176,4168,4046,4179,4066,4046,4044,4179,4066,4043,4046,4066,4068,4043,4104,4181,4182,4104,4183,4181,4184,4185,4107,4184,4186,4185,4187,4188,4189,4187,4190,4188,4109,4191,4192,4109,4193,4191,4194,4195,4196,4194,4197,4195,4192,4198,4105,4192,4191,4198,4189,4199,4095,4189,4188,4199,4093,4200,4110,4093,4201,4200,4202,4186,4184,4202,4203,4186,4204,4205,4101,4204,4206,4205,4196,4207,4091,4196,4195,4207,4106,4197,4194,4106,4208,4197,4182,4206,4204,4182,4181,4206,4089,4068,4067,4089,4088,4068,4042,4068,4088,4042,4043,4068,4088,4049,4042,4088,4058,4049,4058,4039,4049,4058,4060,4039,4038,4060,4080,4038,4039,4060,4080,4045,4038,4080,4082,4045,4098,4076,4075,4098,4209,4076,4033,4082,4074,4033,4045,4082,4147,4210,4165,4147,4146,4210,4141,4171,4211,4141,4140,4171,4083,4060,4059,4083,4080,4060,4212,4122,4119,4212,4174,4122,4069,4179,4092,4069,4066,4179,4100,4209,4098,4100,4213,4209,4074,4032,4033,4074,4076,4032,4096,4064,4063,4096,4214,4064,4053,4076,4209,4053,4032,4076,4108,4085,4084,4108,4178,4085,4092,4079,4078,4092,4179,4079,4052,4209,4213,4052,4053,4209,4103,4214,4096,4103,4215,4214,4086,4047,4048,4086,4062,4047,4062,4051,4047,4062,4064,4051,4035,4064,4214,4035,4051,4064,4034,4214,4215,4034,4035,4214,4169,4127,4126,4169,4216,4127,4118,4157,4217,4118,4115,4157,4217,4165,4210,4217,4157,4165,4142,4124,4123,4142,4139,4124,4217,4218,4219,4217,4210,4218,4117,4211,4171,4117,4116,4211,4118,4219,4220,4118,4217,4219,4220,4116,4118,4220,4221,4116,4221,4211,4116,4221,4222,4211,4141,4222,4223,4141,4211,4222,4139,4223,4224,4139,4141,4223,4224,4124,4139,4224,4225,4124,4114,4225,4226,4114,4124,4225,4226,4112,4114,4226,4227,4112,4227,4137,4112,4227,4228,4137,4216,4228,4229,4216,4137,4228,4216,4138,4137,4216,4169,4138,4229,4127,4216,4229,4230,4127,4125,4230,4231,4125,4127,4230,4231,4135,4125,4231,4232,4135,4133,4232,4233,4133,4135,4232,4143,4233,4234,4143,4133,4233,4235,4130,4132,4235,4236,4130,4236,4121,4130,4236,4237,4121,4119,4237,4238,4119,4121,4237,4212,4238,4239,4212,4119,4238,4240,4146,4148,4240,4241,4146,4241,4210,4146,4241,4218,4210,4242,4232,4231,4242,4243,4232,4244,4218,4241,4244,4245,4218,4175,4203,4246,4175,4177,4203,4247,4231,4230,4247,4242,4231,4248,4230,4229,4248,4247,4230,4175,4145,4177,4175,4174,4145,4249,4250,4251,4249,4245,4250,4252,4250,4253,4252,4254,4250,4240,4212,4239,4240,4148,4212,4255,4251,4256,4255,4249,4251,4257,4256,4258,4257,4255,4256,4259,4224,4258,4259,4225,4224,4256,4260,4261,4256,4251,4260,4174,4148,4145,4174,4212,4148,4251,4254,4260,4251,4250,4254,4261,4262,4263,4261,4260,4262,4253,4245,4244,4253,4250,4245,4219,4245,4249,4219,4218,4245,4220,4249,4255,4220,4219,4249,4221,4255,4257,4221,4220,4255,4262,4243,4242,4262,4264,4243,4265,4254,4252,4265,4264,4254,4258,4261,4259,4258,4256,4261,4239,4253,4244,4239,4238,4253,4238,4252,4253,4238,4237,4252,4260,4264,4262,4260,4254,4264,4257,4222,4221,4257,4223,4222,4234,4266,4235,4234,4233,4266,4265,4237,4236,4265,4252,4237,4266,4264,4265,4266,4243,4264,4259,4263,4267,4259,4261,4263,4233,4243,4266,4233,4232,4243,4267,4247,4248,4267,4263,4247,4263,4242,4247,4263,4262,4242,4267,4225,4259,4267,4226,4225,4258,4223,4257,4258,4224,4223,4229,4227,4248,4229,4228,4227,4248,4226,4267,4248,4227,4226,4268,4091,4207,4268,4090,4091,4201,4090,4268,4201,4093,4090,4269,4095,4199,4269,4094,4095,4270,4099,4271,4270,4097,4099,4271,4101,4205,4271,4099,4101,4246,4094,4269,4246,4102,4094,4183,4105,4198,4183,4104,4105,4208,4107,4185,4208,4106,4107,4193,4110,4200,4193,4109,4110,4083,4182,4081,4083,4104,4182,4071,4107,4084,4071,4184,4107,4087,4189,4065,4087,4187,4189,4089,4192,4061,4089,4109,4192,4057,4196,4055,4057,4194,4196,4061,4105,4059,4061,4192,4105,4065,4095,4063,4065,4189,4095,4069,4110,4067,4069,4093,4110,4073,4184,4071,4073,4202,4184,4077,4101,4075,4077,4204,4101,4055,4091,4078,4055,4196,4091,4108,4194,4057,4108,4106,4194,4081,4204,4077,4081,4182,4204,4208,4166,4156,4208,4185,4166,4197,4156,4154,4197,4208,4156,4154,4195,4197,4154,4155,4195,4155,4207,4195,4155,4170,4207,4268,4170,4162,4268,4207,4170,4201,4162,4163,4201,4268,4162,4163,4200,4201,4163,4172,4200,4193,4172,4158,4193,4200,4172,4158,4191,4193,4158,4159,4191,4159,4198,4191,4159,4173,4198,4183,4173,4167,4183,4198,4173,4167,4181,4183,4167,4168,4181,4206,4168,4176,4206,4181,4168,4176,4205,4206,4176,4149,4205,4271,4149,4150,4271,4205,4149,4270,4150,4151,4270,4271,4150,4160,4188,4190,4160,4161,4188,4161,4199,4188,4161,4152,4199,4269,4152,4153,4269,4199,4152,4246,4153,4175,4246,4269,4153,4177,4186,4203,4177,4164,4186,4164,4185,4186,4164,4166,4185,4029,4272,4019,4029,4273,4272,4023,4274,4021,4023,4275,4274,3995,4276,4007,3995,3992,4276,4277,3957,3991,4277,3955,3957,3981,3994,3993,3981,3978,3994,3970,3986,3985,3970,3967,3986,4034,4070,4031,4034,4215,4070,4278,3965,3973,4278,3963,3965,3961,3969,4279,3961,3967,3969,4002,3983,3982,4002,4180,3983,4007,3965,3964,4007,4276,3965,4280,3976,4281,4280,3974,3976,3959,3980,4282,3959,3978,3980,4281,3983,3972,4281,3976,3983,4215,4073,4070,4215,4103,4073,4021,3998,3997,4021,4274,3998,4282,3986,3962,4282,3980,3986,4283,3963,4278,4283,3987,3963,4284,3955,4277,4284,3989,3955,4019,3957,3956,4019,4272,3957,3953,3994,3960,3953,3992,3994,4285,3998,3984,4285,3996,3998,3971,3987,4283,3971,4180,3987,4279,3996,4285,4279,3969,3996,4273,3950,4272,4273,3949,3950,4275,3952,4274,4275,3951,3952,3992,3954,4276,3992,3953,3954,3978,3960,3994,3978,3959,3960,3967,3962,3986,3967,3961,3962,4180,3972,3983,4180,3971,3972,4276,3973,3965,4276,3954,3973,4274,3984,3998,4274,3952,3984,4272,3991,3957,4272,3950,3991,4235,4143,4234,4235,4132,4143,3226,3991,3923,3226,4277,3991,4202,4103,4102,4202,4073,4103,3936,3973,3948,3936,4278,3973,3940,4279,3939,3940,3961,4279,3946,4281,3935,3946,4280,4281,3601,4282,3944,3601,3959,4282,3935,3972,3934,3935,4281,3972,4202,4246,4203,4202,4102,4246,3944,3962,3943,3944,4282,3962,3937,4278,3936,3937,4283,4278,3225,4277,3226,3225,4284,4277,3100,3960,3103,3100,3953,3960,3942,3984,3941,3942,4285,3984,3938,4283,3937,3938,3971,4283,3939,4285,3942,3939,4279,4285,4266,4236,4235,4266,4265,4236,4239,4241,4240,4239,4244,4241,4144,4132,4129,4144,4143,4132,4151,4129,4160,4151,4144,4129,4160,4270,4151,4160,4190,4270,4097,4190,4187,4097,4270,4190,4187,4100,4097,4187,4087,4100,4213,4087,4086,4213,4100,4087,4052,4086,4048,4052,4213,4086,4020,4048,4013,4020,4052,4048,4013,4023,4020,4013,3990,4023,4275,3990,3989,4275,4023,3990,3951,3989,4284,3951,4275,3989,4284,3224,3951,4284,3225,3224,3225,3181,3224,3225,3182,3181,3134,3182,3135,3134,3181,3182,3135,3128,3134,3135,3137,3128,3137,3125,3128,3137,3141,3125,4031,4028,4034,4031,4026,4028,4029,4026,3977,4029,4028,4026,4273,3977,3974,4273,4029,3977,3949,3974,4280,3949,4273,3974,4280,3099,3949,4280,3946,3099,3097,3946,3945,3097,3099,3946,3011,3945,3947,3011,3097,3945,3009,3947,3021,3009,3011,3947,3012,3021,3023,3012,3009,3021,3007,3023,3030,3007,3012,3023,3005,3030,2465,3005,3007,3030,3001,2465,2467,3001,3005,2465,2999,2467,3162,2999,3001,2467,3002,3162,3193,3002,2999,3162,974,3193,1082,974,3002,3193,3141,3124,3125,3141,3139,3124,3139,3132,3124,3139,3140,3132,3140,3130,3132,3140,3146,3130,3202,3146,3208,3202,3130,3146,3208,3127,3202,3208,3143,3127,3143,1003,3127,3143,1024,1003,2202,3232,2200,2202,3230,3232,3319,3236,3289,3319,3234,3236,3311,3234,3319,3311,3238,3234,3301,3238,3311,3301,3240,3238,3291,3240,3301,3291,3242,3240,3325,3232,3231,3325,3244,3232,3327,3246,3322,3327,3245,3246,2267,3249,2273,2267,3247,3249,3322,3251,3314,3322,3246,3251,3308,3254,3306,3308,3252,3254,3314,3249,3248,3314,3251,3249,3279,3258,3297,3279,3256,3258,3250,3260,3296,3250,3247,3260,3281,3256,3279,3281,3261,3256,3296,3263,3294,3296,3260,3263,3294,3244,3325,3294,3263,3244,3285,3266,3283,3285,3264,3266,3318,3270,3316,3318,3268,3270,3299,3274,3309,3299,3272,3274,3233,3242,3291,3233,3230,3242,3287,3272,3299,3287,3276,3272,3289,3276,3287,3289,3236,3276,3267,3270,3269,3267,3264,3270,3297,3252,3308,3297,3258,3252,3309,3268,3318,3309,3274,3268,3902,3266,3265,3902,3901,3266,3262,3901,3902,3262,3261,3901,2283,3254,3253,2283,3245,3254,3688,1587,3687,3688,1588,1587,2427,230,236,2427,2421,230,2734,678,669,2734,2714,678,2710,689,684,2710,2711,689,2702,701,698,2702,2703,701,714,2704,2709,714,711,2704,2709,1103,714,2709,2705,1103,2707,1104,1102,2707,2889,1104,3733,1636,3211,3733,1677,1636,3774,1678,3732,3774,1700,1678,3220,1701,3773,3220,1757,1701,3710,1726,3817,3710,1612,1726,2732,571,557,2732,2739,571,2721,557,553,2721,2732,557]);var Xd="0.187.0",k0=i=>new U(i.charCodeAt(0)-100.5,0,3.5-(Number(i[1])-1));function ms(i){let t=String(i||"").split(" ")[0].split("/"),e=new Map;if(t.length!==8)throw Error("Invalid cinematic board position.");return t.forEach((n,s)=>{let r=0;for(let a of n)if(/^[1-8]$/.test(a))r+=Number(a);else{if(!/^[prnbqkPRNBQK]$/.test(a)||r>7)throw Error("Invalid cinematic piece.");e.set("abcdefgh"[r++]+(8-s),a)}if(r!==8)throw Error("Invalid cinematic rank.")}),e}var C3=class{constructor(t,{onSquare:e=()=>{},onFailure:n=()=>{}}={}){this.container=t,this.onSquare=e,this.onFailure=n,this.disposed=!1,this.failed=!1,this.frame=0,this.meshes=new Map,this.tiles=[],this.geometries=new Set,this.materials=new Set,this.textures=new Set,this.animation=null,this.snapshot=null,this.motion=matchMedia("(prefers-reduced-motion: reduce)"),this.cameraView=ys(),this.canvas=document.createElement("canvas"),this.canvas.setAttribute("aria-hidden","true"),this.canvas.style.cssText="display:block;width:100%;height:100%;touch-action:manipulation;border-radius:12px";let s=this.canvas.getContext("webgl2",{alpha:!1,antialias:!1,powerPreference:"low-power"});if(!s)throw Error("3D chess needs WebGL2. Use the 2D board on this device.");try{this.renderer=new xa({canvas:this.canvas,context:s,antialias:!1}),this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)),this.renderer.outputColorSpace=We,this.renderer.toneMapping=is,this.renderer.toneMappingExposure=1.2,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Ar,this.renderer.setClearColor(1055785),this.scene=new Ai,this.scene.fog=new wi(1055785,17,35),this.camera=new Xe(39,1,.1,60),this.scene.add(new Qi(14214128,1317931,1.1));let r=new Qn(16770235,3.6);r.position.set(-5,12,7),r.castShadow=!0,r.shadow.mapSize.set(512,512),Object.assign(r.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:25}),r.shadow.bias=-.001,this.scene.add(r);let a=new Qn(7136719,1.5);a.position.set(6,5,-5),this.scene.add(a),this.pieces=new ge,this.scene.add(this.pieces),this.overlays=new ge,this.scene.add(this.overlays),this.white=this.material({color:12830137,roughness:.9,metalness:.02}),this.black=this.material({color:3488315,roughness:.9,metalness:.02});let o=this.stoneTexture();for(let p of[this.white,this.black])p.map=o,p.bumpMap=o,p.bumpScale=.009,p.roughness=.89,p.metalness=.02;this.gold=this.material({color:7830902,roughness:.94,metalness:.04}),this.recess=this.material({color:1581610,roughness:.94,metalness:.05}),this.headTemplate=this.geometry(new Te),this.headTemplate.setAttribute("position",new Ne(bn,3)),this.headTemplate.setIndex(new Ne(R3,1)),this.headTemplate.computeVertexNormals();let l=new Float32Array(bn.length/3*2);for(let p=0;p<bn.length/3;p++)l[p*2]=(Math.atan2(bn[p*3],bn[p*3+2])+Math.PI)/(Math.PI*2),l[p*2+1]=bn[p*3+1]/.32;this.headTemplate.setAttribute("uv",new Ne(l,2));let c=this.material({color:3360600,roughness:.93}),h=this.material({color:10927022,roughness:.93}),u=this.material({color:1780286,roughness:.8,metalness:.2});this.part(this.scene,new ie(8.65,.35,8.65),u,0,-.22,0);let d=this.part(this.scene,new fe(7.3,7.6,.22,48),u,0,-.52,0);d.receiveShadow=!0;let f=new ge;this.scene.add(f);for(let p of[-6,6])for(let m of[-5.5,5.5]){this.part(f,new fe(.28,.38,2.5,12),u,p,.65,m),this.part(f,new ie(.85,.22,.85),u,p,1.95,m),this.part(f,new ie(.9,.18,.9),u,p,-.5,m);let y=this.part(f,new Le(.08,8,6),this.gold,p,2.13,m);y.material=this.gold}let _=this.geometry(new ie(.994,.12,.994)),v=new oe;for(let p of[0,1]){let m=new Pi(_,p?c:h,32);m.userData.squares=[],m.receiveShadow=!0;let y=0;for(let b=1;b<=8;b++)for(let x=0;x<8;x++)if((x+b)%2===p){let w="abcdefgh"[x]+b,T=k0(w);v.makeTranslation(T.x,-.04,T.z),m.setMatrixAt(y++,v),m.userData.squares.push(w)}m.instanceMatrix.needsUpdate=!0,this.scene.add(m),this.tiles.push(m)}this.marker=this.material({color:5631954,transparent:!0,opacity:.8,depthWrite:!1}),this.selectedMaterial=this.material({color:16765561,transparent:!0,opacity:.8,depthWrite:!1}),this.dustMaterial=this.material({color:11907492,transparent:!0,opacity:.25,depthWrite:!1}),this.raycaster=new es,this.pointer=new nt,this.click=p=>{if(this.disabled||this.failed||this.disposed||this.presentationQueue||this.cameraBusy&&this.animation||this.battleCamera&&this.animation?.captured)return;let m=this.canvas.getBoundingClientRect();if(!m.width||!m.height)return;this.pointer.set((p.clientX-m.left)/m.width*2-1,1-(p.clientY-m.top)/m.height*2),this.raycaster.setFromCamera(this.pointer,this.camera);let y=this.raycaster.intersectObjects([...this.tiles,...this.meshes.values()],!0);for(let b of y){let x=b.object.userData.squares?.[b.instanceId];if(x){this.onSquare(x);break}let w=b.object;for(;w&&!w.userData.square;)w=w.parent;if(w?.userData.square){this.onSquare(w.userData.square);break}}},this.loss=p=>{p.preventDefault(),this.fail("3D graphics became unavailable. The 2D board is ready.")},this.canvas.addEventListener("click",this.click),this.canvas.addEventListener("webglcontextlost",this.loss),this.visibility=()=>{document.hidden?this.finishPresentation():this.render()},this.motionChange=()=>{this.motion.matches&&(this.finishPresentation(),this.render())},document.addEventListener("visibilitychange",this.visibility),this.motion.addEventListener("change",this.motionChange),t.append(this.canvas),this.resizeObserver=new ResizeObserver(()=>this.resize()),this.resizeObserver.observe(t),this.resize(),this.orientation("white"),this.render()}catch(r){throw this.destroy(),r}}material(t){let e=new Ji(t);return this.materials.add(e),e}stoneTexture(){let e=new Uint8Array(65536),n=(r,a)=>{let o=Math.sin(r*127.1+a*311.7)*43758.5453;return o-Math.floor(o)};for(let r=0;r<128;r++)for(let a=0;a<128;a++){let o=n(a,r),l=Math.pow(Math.abs(Math.sin(a*.065+Math.sin(r*.075)*1.8)),18),c=Math.round(205+o*39-l*34),h=(r*128+a)*4;e[h]=c,e[h+1]=c,e[h+2]=c,e[h+3]=255}let s=new mn(e,128,128,s0);return s.wrapS=s.wrapT=Gn,s.repeat.set(2,2),s.needsUpdate=!0,this.textures.add(s),s}geometry(t){return this.geometries.add(t),t}part(t,e,n,s=0,r=0,a=0){let o=new Je(this.geometry(e),n);return o.position.set(s,r,a),t.add(o),o}indexedGeometry(t){return t.index||t.setIndex(Array.from({length:t.attributes.position.count},(e,n)=>n)),t}mergeParts(t){t.updateMatrixWorld(!0);let e=[],n=t.children.filter(r=>r.isMesh),s=t.children.filter(r=>!r.isMesh);for(let r of new Set(n.map(a=>a.material))){let a=n.filter(l=>l.material===r).map(l=>this.indexedGeometry(l.geometry.clone().applyMatrix4(l.matrix))),o=n1(a,!1);if(!o)throw Error("Incompatible stone figure geometry.");e.push([o,r]);for(let l of a)l.dispose()}for(let r of n)this.disposeGeometry(r);t.clear();for(let r of s)t.add(r);for(let[r,a]of e)this.part(t,r,a)}bakeFigure(t){if(!t||t.userData.baked)return;t.updateMatrixWorld(!0);let e=t.matrixWorld.clone().invert(),n=[];t.traverse(r=>{r.isMesh&&n.push(r)});let s=[];for(let r of new Set(n.map(a=>a.material))){let a=n.filter(l=>l.material===r).map(l=>this.indexedGeometry(l.geometry.clone().applyMatrix4(new oe().multiplyMatrices(e,l.matrixWorld)))),o=n1(a,!1);if(!o)throw Error("Incompatible resting figure geometry.");s.push([o,r]);for(let l of a)l.dispose()}this.disposeGeometry(t),t.clear();for(let[r,a]of s){let o=this.part(t,r,a);o.castShadow=o.receiveShadow=!0}t.userData.joints=[],t.userData.rig=null,t.userData.baked=!0}fortressFigure(t){let e=new ge,n=new ge,s=t===t.toUpperCase()?this.white:this.black;e.add(n),this.part(n,new fe(.39,.43,.15,12),s,0,.1),this.part(n,new fe(.31,.36,.15,12),s,0,.24),this.part(n,new fe(.27,.32,.83,16),s,0,.7),this.part(n,new fe(.36,.28,.16,16),s,0,1.17),this.part(n,new fe(.37,.37,.1,16),s,0,1.29);for(let r=0;r<8;r++){let a=r*Math.PI/4,o=Math.sin(a),l=Math.cos(a);this.part(n,new ie(.15,.22,.14),s,o*.29,1.44,l*.29).rotation.y=a,this.part(n,new ie(.042,.28,.018),this.recess,o*.285,.86,l*.285).rotation.y=a,this.part(n,new ie(.13,.018,.018),this.recess,o*.29,.91,l*.29).rotation.y=a}for(let r=0;r<4;r++){let a=this.part(n,new S0(.28+(3-r)*.01,.006,4,24),this.gold,0,.42+r*.18);a.rotation.x=Math.PI/2}this.mergeParts(n);for(let r of n.children)r.castShadow=r.receiveShadow=!0;return e.userData={token:t,baseScale:1,baseYaw:t===t.toUpperCase()?0:Math.PI,joints:[],restJoints:[],restLower:[],rig:{fortress:!0}},e.rotation.y=e.userData.baseYaw,e}horseFigure(t){let e=new ge,n=new ge,s=new ge,r=t===t.toUpperCase()?this.white:this.black;e.add(n,s),s.position.set(0,1.44,-.17);let a=(y,b,x,w=0)=>this.part(n,y,r,b,x,w);a(new fe(.39,.43,.14,16),0,.09);let o=a(new Le(1,20,14),0,.91,.09);o.scale.set(.23,.43,.26),o.rotation.x=-.23,a(new Le(1,16,12),0,.57,.19).scale.set(.23,.25,.25);let c=a(new Le(1,16,14),0,1.32,-.1);c.scale.set(.15,.34,.17),c.rotation.x=-.3;let h=this.part(s,new Le(1,16,12),r,0,.18,-.05);h.scale.set(.12,.18,.16),h.rotation.x=.25,this.part(s,new Le(1,16,10),r,0,.075,-.23).scale.set(.095,.095,.17);for(let y of[-.085,.085]){let b=this.part(s,new M0(.055,.22,8),r,y,.39,.015);b.rotation.x=-.16,this.part(s,new Le(.014,8,6),this.recess,y*1.3,.2,-.12),this.part(s,new Le(.02,8,6),this.recess,y*.75,.08,-.36)}let d=this.part(s,new ie(.13,.06,.23),this.gold,0,.005,-.23);d.rotation.x=-.07;let f=new gn([new U(0,1.01,.31),new U(0,1.35,.13),new U(0,1.67,-.1)]);a(new Kn(f,14,.05,6,!1),0,0);let _=new gn([new U(0,.64,.36),new U(.04,.36,.53),new U(.08,.16,.38)]);a(new Kn(_,12,.05,7,!1),0,0);for(let y=0;y<5;y++){let b=a(new fe(.17-y*.006,.19-y*.006,.105,12,1,!0,0,Math.PI),0,1.05+y*.1,-.12-y*.025);b.rotation.y=Math.PI/2,b.rotation.x=-.3}let v=[];for(let y=0;y<4;y++){let b=y>=2,x=y%2?1:-1,w=b?.25:.2,T=b?.22:.19,g=new ge;g.position.set(x*(b?.17:.15),b?1.03:.55,b?-.11:.2),e.add(g),this.part(g,new fe(b?.065:.085,.047,w,10),r,0,-w/2);let S=new ge;S.position.y=-w,g.add(S),this.part(S,new Le(.06,10,8),r),this.part(S,new fe(.045,.035,T,10),r,0,-T/2),this.part(S,new ie(.105,.09,.14),r,0,-T,-.02),g.userData.lower=S,v.push(g)}for(let y of[n,s,...v,...v.map(b=>b.userData.lower)])this.mergeParts(y);let p=[-.2,-.12,1.9,1.75],m=[.2,.12,-1.15,-1.05];e.userData={token:t,baseScale:1,baseYaw:t===t.toUpperCase()?0:Math.PI,joints:v,restJoints:p,restLower:m,rig:{horse:!0,head:s,legLength:[.2,.2,.25,.25],legHeight:.39}},e.traverse(y=>{y.isMesh&&(y.receiveShadow=!0)});for(let y of[n,s])for(let b of y.children)b.castShadow=!0;return this.restFigure(e),e}figure(t){if(t.toLowerCase()==="n")return this.horseFigure(t);if(t.toLowerCase()==="r")return this.fortressFigure(t);let e=new ge,n=new ge,s=new ge,r=new ge,a=t.toLowerCase(),o=t===t.toUpperCase(),l=o?this.white:this.black;e.add(n,s),s.add(r),s.position.y=.84,r.position.y=.32,e.rotation.y=o?0:Math.PI;let c={p:.72,r:1,n:1.01,b:1.1,q:1.15,k:1.2}[a],h=(g,S,C,R,L)=>{let F=R>=1.24?r:n;return this.part(F,g,S,C,R-(F===r?1.16:0),L)},u=(g,S,C,R=0)=>h(g,l,S,C,R),d=(g,S,C,R=0)=>h(g,this.gold,S,C,R);u(new fe(.35,.39,.12,16),0,.08),d(new fe(.355,.355,.035,16),0,.15);let f=[new nt(.14,.62),new nt(.17,.72),new nt(.18,.83),new nt(.23,.99),new nt(.21,1.08),new nt(.12,1.12)],_=this.part(s,new $n(f,20),l,0,-.84);_.scale.z=.72,this.part(s,new fe(.065,.08,.13,10),l,0,.32),this.part(r,this.headTemplate.clone(),l);for(let g of[-.044,.044])this.part(r,new Le(.01,8,6),this.recess,g,.202,-.103);for(let g of[-1,1]){u(new Le(.115,16,8,0,Math.PI*2,0,Math.PI*.7),g*.24,1.07).scale.set(1.12,.8,1),d(new S0(.108,.009,5,16,Math.PI),g*.24,1.07,-.012).rotation.x=-Math.PI/2;for(let C=0;C<3;C++){let R=u(new ie(.13,.055,.12),g*(.16+C*.014),.75-C*.045,-.045);R.rotation.z=g*.13}}this.part(s,new fe(.19,.21,.055,20),this.gold,0,.25),d(new ie(.035,.28,.022),0,.94,-.175),d(new ie(.32,.05,.13),0,.71,-.02);let v=(g,S,C)=>{let R=new ge;R.position.set(g,S,0),e.add(R);let L=C?.23:.26;this.part(R,new fe(C?.075:.09,C?.06:.07,L,10),l,0,-L/2);let F=new ge;if(F.position.y=-L,R.add(F),this.part(F,new Le(C?.066:.075,10,6),l),this.part(F,new fe(C?.06:.075,C?.045:.055,L,10),l,0,-L/2),C)this.part(F,new qi(.065,1),l,0,-L);else{let H=new ge;H.position.set(0,-L,-.05),F.add(H),this.part(H,new ie(.145,.105,.24),l),R.userData.foot=H}return R.userData.lower=F,R},p=v(-.115,.72,!1),m=v(.115,.72,!1),y=v(-.27,1.06,!0),b=v(.27,1.06,!0),x=(g,S,C,R,L,F=0)=>{let H=g==="left"?y:b,P=H.userData.lower;if(!H.userData.weapon){let G=new ge;G.position.y=-.23,P.add(G),H.userData.weapon=G}return this.part(H.userData.weapon,S,C,R-H.position.x,L-H.position.y-P.position.y+.23,F)};if(a==="b"){let g=new fe(.13,.31,.65,32,6);for(let S=0;S<g.attributes.position.count;S++){let C=g.attributes.position.getX(S),R=g.attributes.position.getZ(S),L=1+Math.cos(Math.atan2(R,C)*12)*.055;g.attributes.position.setX(S,C*L),g.attributes.position.setZ(S,R*L)}g.computeVertexNormals(),u(g,0,.51),u(new M0(.2,.38,12),0,1.51),d(new Le(.06,8,6),0,1.72),x("right",new fe(.035,.035,1.14,8),this.gold,.32,.89),x("right",new S0(.12,.027,6,16),this.gold,.32,1.5)}else if(a==="p"){u(new $n([new nt(.17,0),new nt(.15,.065),new nt(.11,.14),new nt(.015,.18)],20),0,1.38),u(new ie(.025,.14,.025),0,1.36,-.155);for(let S of[-1,1])u(new ie(.025,.14,.11),S*.1,1.33,.005);x("right",new fe(.025,.025,1.25,6),this.gold,.34,.84),x("right",new M0(.065,.21,6),l,.34,1.56);let g=new Zn;g.moveTo(-.17,.18),g.quadraticCurveTo(0,.25,.17,.18),g.lineTo(.14,-.1),g.lineTo(0,-.25),g.lineTo(-.14,-.1),g.closePath(),x("left",new Xi(g,{depth:.045,bevelEnabled:!0,bevelSize:.012,bevelThickness:.008,bevelSegments:1,steps:1}),l,-.29,.78,-.13)}else if(a==="r"){u(new ie(.39,.15,.32),0,1.36);for(let g of[-.15,0,.15])u(new ie(.08,.12,.32),g,1.49);x("left",new ie(.39,.57,.12),l,-.28,.78,-.13),x("left",new ie(.035,.43,.035),this.gold,-.28,.8,-.2)}else if(a==="n"){let g=u(new ie(.09,.28,.27),0,1.51,.02);g.rotation.x=-.35,u(new ie(.11,.12,.22),0,1.55,-.16),u(new M0(.08,.2,4),0,1.72,.04),x("left",new fe(.23,.23,.08,12),l,-.29,.83,-.08).rotation.x=Math.PI/2,x("right",new ie(.065,.67,.04),this.gold,.32,1,-.03),x("right",new ie(.24,.055,.08),this.gold,.32,.75,-.03)}else{let g=new fe(.13,.29,.65,32,6);for(let C=0;C<g.attributes.position.count;C++){let R=g.attributes.position.getX(C),L=g.attributes.position.getZ(C),F=1+Math.cos(Math.atan2(L,R)*12)*.055;g.attributes.position.setX(C,R*F),g.attributes.position.setZ(C,L*F)}g.computeVertexNormals(),u(g,0,.54),d(new fe(.2,.17,.12,12),0,1.4);let S=a==="q"?7:5;for(let C=0;C<S;C++){let R=C*Math.PI*2/S;d(new M0(.045,.14,6),Math.cos(R)*.17,1.52,Math.sin(R)*.17)}a==="k"?(d(new ie(.07,.23,.07),0,1.62),d(new ie(.21,.07,.07),0,1.67),x("right",new ie(.065,.9,.025),l,.09,1.12,-.24),x("right",new M0(.046,.15,4),l,.09,1.64,-.24),x("right",new ie(.28,.045,.055),this.gold,.09,.68,-.24)):(x("right",new fe(.03,.03,.95,8),this.gold,.33,.91),x("right",new Le(.11,10,8),this.gold,.33,1.44))}for(let g of[n,s,r,p,m,y,b,...[p,m,y,b].map(S=>S.userData.lower),y.userData.weapon,b.userData.weapon].filter(Boolean))this.mergeParts(g);let w=a==="p"?[.35,.35,.4,.3]:[0,0,.05,.05],T=a==="p"?[-.65,-.65,.3,.25]:[0,0,.08,.08];e.scale.setScalar(c),e.userData={token:t,joints:[p,m,y,b],baseScale:c,baseYaw:o?0:Math.PI,restJoints:w,restLower:T,rig:{chest:s,head:r,weapon:b.userData.weapon,feet:[p.userData.foot,m.userData.foot],legLength:.26,legHeight:.49}},a==="p"&&(s.rotation.x=-.32,r.rotation.x=-.12,e.userData.restChest=-.32,e.userData.restHead=-.12),e.traverse(g=>{g.isMesh&&(g.receiveShadow=!0)});for(let g of[n,s,r])for(let S of g.children)S.castShadow=!0;return this.restFigure(e),e}restFigure(t){if(t){t.rotation.set(0,t.userData.baseYaw||0,0);for(let[e,n]of(t.userData.joints||[]).entries())n.rotation.set(t.userData.restJoints?.[e]||0,0,0),n.userData.lower&&n.userData.lower.rotation.set(t.userData.restLower?.[e]||0,0,0);for(let e of t.userData.rig?.feet||[])e?.rotation.set(0,0,0);t.userData.rig?.weapon?.rotation.set(0,0,0),t.userData.rig?.chest?.rotation.set(t.userData.restChest||0,0,0),t.userData.rig?.head?.rotation.set(t.userData.restHead||0,0,0)}}finishPresentation(){let t=this.animation,e=this.presentationQueue;if(this.presentationQueue=null,!(!t&&!e)){if(this.frame&&cancelAnimationFrame(this.frame),this.frame=0,e){this.presentPosition(e.match,ms(e.match.fen),null),this.animation=null,this.cameraBusy=!1,this.orientation(this.viewSide||"white");return}t.moving&&t.moving.position.copy(t.to),this.restFigure(t.moving),this.bakeFigure(t.moving);for(let n of t.companions||[])n.mesh.position.copy(n.to),this.restFigure(n.mesh),this.bakeFigure(n.mesh);for(let n of[t.captured,t.halo,t.dust,...t.chips||[]])n&&(this.pieces.remove(n),this.disposeGeometry(n));this.animation=null,this.cameraBusy=!1,this.orientation(this.viewSide||"white")}}makeStoneChips(t,e,n=8){let s=[];for(let r=0;r<Math.max(0,Math.min(8,n));r++){let a=this.part(this.pieces,new Zi(.035+r%3*.012,0),e===e.toUpperCase()?this.white:this.black,t.x,.3,t.z);a.scale.setScalar(.001),s.push(a)}return s}orientation(t){let e=t==="black"?"black":"white",n=this.viewSide!==e;this.viewSide=e,(n||!this.animation)&&this.applyCameraView()}getCameraView(){return{...this.cameraView}}setCameraView(t={}){return this.disposed||this.failed?this.getCameraView():(this.cameraView=ys(this.cameraView,t),this.applyCameraView(),this.render(),this.getCameraView())}resetCameraView(){return this.setCameraView({preset:"angled"})}applyCameraView(){if(!this.camera)return;let t=E1(this.cameraView,this.viewSide,this.camera.aspect,this.camera.fov);this.camera.position.set(t.position.x,t.position.y,t.position.z),this.camera.lookAt(t.target.x,t.target.y,t.target.z);let e=this.camera.position.distanceTo(new U(t.target.x,t.target.y,t.target.z)),n=Math.max(60,e+30);this.camera.far!==n&&(this.camera.far=n,this.camera.updateProjectionMatrix()),this.scene?.fog&&(this.scene.fog.near=Math.max(17,e+2),this.scene.fog.far=Math.max(35,e+20)),this.animation&&(this.animation.cameraBase={...t.position})}resize(){if(this.disposed||this.failed)return;let t=this.container.getBoundingClientRect();!t.width||!t.height||(this.renderer.setSize(t.width,t.height,!1),this.camera.aspect=t.width/t.height,this.camera.updateProjectionMatrix(),this.applyCameraView(),this.render())}nextPresentation(){let t=this.presentationQueue;if(this.presentationQueue=null,!t||this.disposed||this.failed)return;let e=this.motion.matches||document.hidden?null:t.move;this.presentPosition(t.match,ms(t.match.fen),e),this.render()}presentPosition(t,e,n){let s=!!n,r=n?.slice(0,2),a=n?.slice(2,4),o=this.meshes.get(r)?.userData.token,l=s?[...this.meshes.keys()].find(x=>{let w=this.meshes.get(x).userData.token;return o&&w===w.toUpperCase()!=(o===o.toUpperCase())&&(!e.has(x)||x===a&&w!==e.get(x))}):null,c=null;if(l){let x=this.meshes.get(l).userData.token;c=this.figure(x),c.position.copy(k0(l)),c.userData.square=l}let h=s&&o?.toLowerCase()==="k"&&Math.abs(r.charCodeAt(0)-a.charCodeAt(0))===2?{from:(a[0]==="g"?"h":"a")+r[1],to:(a[0]==="g"?"f":"d")+r[1]}:null;for(let x of[...this.pieces.children])this.pieces.remove(x),this.disposeGeometry(x);c&&this.pieces.add(c),this.meshes.clear(),this.animation=null;for(let[x,w]of e){let T=this.figure(w);T.userData.square=x,T.position.copy(k0(x)),this.pieces.add(T),this.meshes.set(x,T),(!s||x!==a&&x!==h?.to)&&this.bakeFigure(T)}if(!s)return;let u=this.meshes.get(a),d=k0(r),f=k0(a);if(!u)return;u.position.copy(d);let _=[];if(h){let x=this.meshes.get(h.to);x&&(x.position.copy(k0(h.from)),_.push({mesh:x,from:k0(h.from),to:k0(h.to)}))}let v=null;if(t.reason==="checkmate"){let x=[...this.meshes.values()].find(w=>w.userData.token===(t.result==="white"?"k":"K"));x&&(v=this.part(this.pieces,new S0(.45,.045,6,32),this.gold,x.position.x,.14,x.position.z),v.rotation.x=-Math.PI/2)}let p=null;c&&(p=this.part(this.pieces,new S0(.32,.065,6,24),this.dustMaterial,f.x,.12,f.z),p.rotation.x=-Math.PI/2,p.scale.setScalar(.01));let m=u.userData.baseYaw||0,y=Math.atan2(-(f.x-d.x),-(f.z-d.z)),b=(y-m+Math.PI*3)%(Math.PI*2)-Math.PI;this.animation={start:performance.now(),moving:u,from:d,to:f,captured:c,companions:_,halo:v,dust:p,baseYaw:m,yawDelta:b,fast:!!this.fast}}update(t,{orientation:e="white",effects:n=!0,animate:s=!0,selected:r=null,targets:a=[],disabled:o=!1,fast:l,battleCamera:c}={}){if(!(this.disposed||this.failed))try{this.disabled=o,l!==void 0&&(this.fast=!!l),c!==void 0&&(this.battleCamera=!!c),this.orientation(e),this.animation&&(!n||!s||this.motion.matches||document.hidden||l===!0&&!this.animation.choreography?.fast)&&this.finishPresentation();let h=ms(t?.fen),u=Array.isArray(t?.moves)?t.moves:[],d=t?.id,f=t?.revision;if(!this.snapshot||this.snapshot.fen!==t.fen||this.snapshot.id!==d||this.snapshot.revision!==f){this.presentationQueue&&(this.presentationQueue=null,this.presentPosition(this.snapshot,ms(this.snapshot.fen),null)),this.animation?.moving&&(this.animation.moving.position.copy(this.animation.to),this.restFigure(this.animation.moving)),this.animation=null,this.cameraBusy=!1;let v=this.snapshot,p=b1(v,t,{animate:s&&n&&!this.motion.matches&&!document.hidden});this.presentationQueue=p.length===2?{match:{...t,moves:u.slice()},move:p[1].move}:null;let m=p[0];this.presentPosition(this.presentationQueue?{...t,reason:null,result:null}:t,m?ms(m.fen):h,m?.move||null),this.snapshot={id:d,fen:t.fen,revision:f,moves:u.slice()}}this.disposeGeometry(this.overlays),this.overlays.clear();for(let v of[...new Set([r,...a].filter(p=>/^[a-h][1-8]$/.test(p||"")))]){let p=k0(v),m=this.part(this.overlays,new S0(v===r?.39:.16,.035,6,24),v===r?this.selectedMaterial:this.marker,p.x,.055,p.z);m.rotation.x=-Math.PI/2}this.render()}catch{this.fail("3D chess could not display this position. Use the 2D board.")}}disposeGeometry(t){t.traverse(e=>{e.geometry&&(e.geometry.dispose(),this.geometries.delete(e.geometry))})}render(){if(!(this.disposed||this.failed))try{this.frame&&(cancelAnimationFrame(this.frame),this.frame=0),this.animation&&(this.motion.matches||document.hidden)&&this.finishPresentation(),v1(this,performance.now()),this.renderer.render(this.scene,this.camera)}catch{this.fail("3D graphics stopped. Continue using the 2D board.")}}fail(t){this.failed||this.disposed||(this.failed=!0,this.presentationQueue=null,this.cameraBusy=!1,this.frame&&cancelAnimationFrame(this.frame),this.frame=0,this.onFailure(t))}destroy(){if(!this.disposed){this.disposed=!0,this.frame&&cancelAnimationFrame(this.frame),this.resizeObserver?.disconnect(),this.canvas?.removeEventListener("click",this.click),this.canvas?.removeEventListener("webglcontextlost",this.loss),document.removeEventListener("visibilitychange",this.visibility),this.motion.removeEventListener("change",this.motionChange);for(let t of this.tiles)t.isInstancedMesh&&t.dispose();for(let t of this.geometries)t.dispose();for(let t of this.materials)t.dispose();for(let t of this.textures)t.dispose();this.geometries.clear(),this.materials.clear(),this.textures.clear(),this.renderer?.dispose(),this.canvas?.remove(),this.meshes.clear(),this.animation=null,this.presentationQueue=null}}},l5=Xd;export{C3 as ChessCinema,l5 as THREE_VERSION};
