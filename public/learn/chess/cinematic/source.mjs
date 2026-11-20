import { advanceCinema } from './animation.mjs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HEAD_POSITIONS, HEAD_INDICES } from './assets/stone-head.mjs';

// Presentation only. The caller supplies server-confirmed state and owns every move.
const VERSION = '0.187.0';
const point = square => new THREE.Vector3(square.charCodeAt(0) - 100.5, 0, 3.5 - (Number(square[1]) - 1));
function position(fen) {
  const rows = String(fen || '').split(' ')[0].split('/'), pieces = new Map();
  if (rows.length !== 8) throw Error('Invalid cinematic board position.');
  rows.forEach((row, rank) => { let file = 0; for (const token of row) {
    if (/^[1-8]$/.test(token)) file += Number(token);
    else { if (!/^[prnbqkPRNBQK]$/.test(token) || file > 7) throw Error('Invalid cinematic piece.'); pieces.set('abcdefgh'[file++] + (8 - rank), token); }
  } if (file !== 8) throw Error('Invalid cinematic rank.'); });
  return pieces;
}

export class ChessCinema {
  constructor(container, { onSquare = () => {}, onFailure = () => {} } = {}) {
    this.container = container; this.onSquare = onSquare; this.onFailure = onFailure;
    this.disposed = false; this.failed = false; this.frame = 0; this.meshes = new Map(); this.tiles = [];
    this.geometries = new Set(); this.materials = new Set(); this.textures = new Set(); this.animation = null; this.snapshot = null;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:manipulation;border-radius:12px';
    const context = this.canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!context) throw Error('3D chess needs WebGL2. Use the 2D board on this device.');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context, antialias: false });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setClearColor(0x101c29);
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x101c29, 17, 35);
      this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 60);
      this.scene.add(new THREE.HemisphereLight(0xd8e3f0, 0x141c2b, 1.1));
      const key = new THREE.DirectionalLight(0xffe4bb, 3.6); key.position.set(-5, 12, 7);
      key.castShadow=true;key.shadow.mapSize.set(512,512);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:25});key.shadow.bias=-0.001;this.scene.add(key);
      const rim = new THREE.DirectionalLight(0x6ce5cf, 1.5); rim.position.set(6, 5, -5); this.scene.add(rim);
      this.pieces = new THREE.Group(); this.scene.add(this.pieces);
      this.overlays = new THREE.Group(); this.scene.add(this.overlays);
      this.white = this.material({ color: 0xc3c5b9, roughness: 0.9, metalness: 0.02 });
      this.black = this.material({ color: 0x353a3b, roughness: 0.9, metalness: 0.02 });
      const stone=this.stoneTexture();
      for(const material of [this.white,this.black]){material.map=stone;material.bumpMap=stone;material.bumpScale=0.009;material.roughness=0.89;material.metalness=0.02;}
      this.gold = this.material({ color: 0x777d76, roughness: 0.94, metalness: 0.04 });
      this.recess = this.material({color:0x18222a,roughness:0.94,metalness:0.05});
      this.headTemplate=this.geometry(new THREE.BufferGeometry());
      this.headTemplate.setAttribute('position',new THREE.BufferAttribute(HEAD_POSITIONS,3));this.headTemplate.setIndex(new THREE.BufferAttribute(HEAD_INDICES,1));this.headTemplate.computeVertexNormals();
      const uv=new Float32Array(HEAD_POSITIONS.length/3*2);
      for(let i=0;i<HEAD_POSITIONS.length/3;i++){uv[i*2]=(Math.atan2(HEAD_POSITIONS[i*3],HEAD_POSITIONS[i*3+2])+Math.PI)/(Math.PI*2);uv[i*2+1]=HEAD_POSITIONS[i*3+1]/0.32;}
      this.headTemplate.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      const dark = this.material({ color: 0x334758, roughness: 0.93 });
      const light = this.material({ color: 0xa6bbae, roughness: 0.93 });
      const frame = this.material({ color: 0x1b2a3e, roughness: 0.8, metalness: 0.2 });
      this.part(this.scene, new THREE.BoxGeometry(8.65, 0.35, 8.65), frame, 0, -0.22, 0);
      const floor=this.part(this.scene,new THREE.CylinderGeometry(7.3,7.6,0.22,48),frame,0,-0.52,0);floor.receiveShadow=true;
      // Original low-cost ruined-hall silhouettes frame the board without a
      // downloadable environment or distracting animated background.
      const architecture=new THREE.Group();this.scene.add(architecture);
      for(const x of [-6.0,6.0])for(const z of [-5.5,5.5]){
        this.part(architecture,new THREE.CylinderGeometry(0.28,0.38,2.5,12),frame,x,0.65,z);
        this.part(architecture,new THREE.BoxGeometry(0.85,0.22,0.85),frame,x,1.95,z);
        this.part(architecture,new THREE.BoxGeometry(0.90,0.18,0.90),frame,x,-0.5,z);
        const flame=this.part(architecture,new THREE.SphereGeometry(0.08,8,6),this.gold,x,2.13,z);flame.material=this.gold;
      }
      const tileGeometry=this.geometry(new THREE.BoxGeometry(0.994,0.12,0.994)),matrix=new THREE.Matrix4();
      for(const parity of [0,1]){
        const tiles=new THREE.InstancedMesh(tileGeometry,parity?dark:light,32);tiles.userData.squares=[];tiles.receiveShadow=true;let instance=0;
        for(let rank=1;rank<=8;rank++)for(let file=0;file<8;file++)if((file+rank)%2===parity){
          const square='abcdefgh'[file]+rank,p=point(square);matrix.makeTranslation(p.x,-0.04,p.z);tiles.setMatrixAt(instance++,matrix);tiles.userData.squares.push(square);
        }
        tiles.instanceMatrix.needsUpdate=true;this.scene.add(tiles);this.tiles.push(tiles);
      }
      this.marker = this.material({ color: 0x55efd2, transparent: true, opacity: 0.8, depthWrite: false });
      this.selectedMaterial = this.material({ color: 0xffd279, transparent: true, opacity: 0.8, depthWrite: false });
      this.dustMaterial = this.material({color:0xb5b1a4,transparent:true,opacity:0.25,depthWrite:false});
      this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
      this.click = event => {
        if (this.disabled || this.failed || this.disposed || this.cameraBusy&&this.animation || this.battleCamera&&this.animation?.captured) return;
        const r = this.canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
        this.pointer.set((event.clientX-r.left)/r.width*2-1, 1-(event.clientY-r.top)/r.height*2);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects([...this.tiles,...this.meshes.values()], true);
        for(const hit of hits){
          const instanced=hit.object.userData.squares?.[hit.instanceId];if(instanced){this.onSquare(instanced);break;}
          let object=hit.object;while(object&&!object.userData.square)object=object.parent;if(object?.userData.square){this.onSquare(object.userData.square);break;}
        }
      };
      this.loss = event => { event.preventDefault(); this.fail('3D graphics became unavailable. The 2D board is ready.'); };
      this.canvas.addEventListener('click', this.click);
      this.canvas.addEventListener('webglcontextlost', this.loss);
      container.append(this.canvas);
      this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
      this.resize(); this.orientation('white'); this.render();
    } catch (error) { this.destroy(); throw error; }
  }
  material(options) { const material = new THREE.MeshStandardMaterial(options); this.materials.add(material); return material; }
  stoneTexture(){
    // Original deterministic mineral grain. No downloaded photographic assets.
    const size=128,data=new Uint8Array(size*size*4);
    const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const grain=noise(x,y),vein=Math.pow(Math.abs(Math.sin(x*0.065+Math.sin(y*0.075)*1.8)),18);
      const shade=Math.round(205+grain*39-vein*34),i=(y*size+x)*4;data[i]=shade;data[i+1]=shade;data[i+2]=shade;data[i+3]=255;
    }
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);texture.needsUpdate=true;this.textures.add(texture);return texture;
  }
  geometry(geometry) { this.geometries.add(geometry); return geometry; }
  part(parent, geometry, material, x=0, y=0, z=0) {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }
  indexedGeometry(geometry){
    // Extruded shields are non-indexed; all other primitives/head data use
    // indices. A material batch must not silently drop the whole figure when
    // the two forms meet. Preserve existing smooth normals and make an index.
    if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));return geometry;
  }
  mergeParts(container){
    container.updateMatrixWorld(true);const batches=[],meshes=container.children.filter(child=>child.isMesh),groups=container.children.filter(child=>!child.isMesh);
    for(const material of new Set(meshes.map(mesh=>mesh.material))){
      const geometries=meshes.filter(mesh=>mesh.material===material).map(mesh=>this.indexedGeometry(mesh.geometry.clone().applyMatrix4(mesh.matrix)));
      const geometry=mergeGeometries(geometries,false);if(!geometry)throw Error('Incompatible stone figure geometry.');batches.push([geometry,material]);for(const part of geometries)part.dispose();
    }
    for(const mesh of meshes)this.disposeGeometry(mesh);container.clear();for(const child of groups)container.add(child);for(const [geometry,material]of batches)this.part(container,geometry,material);
  }
  bakeFigure(group){
    if(!group||group.userData.baked)return;
    group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),meshes=[];
    group.traverse(object=>{if(object.isMesh)meshes.push(object);});const batches=[];
    for(const material of new Set(meshes.map(mesh=>mesh.material))){
      const geometries=meshes.filter(mesh=>mesh.material===material).map(mesh=>this.indexedGeometry(mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld))));
      const geometry=mergeGeometries(geometries,false);if(!geometry)throw Error('Incompatible resting figure geometry.');batches.push([geometry,material]);for(const item of geometries)item.dispose();
    }
    this.disposeGeometry(group);group.clear();
    for(const [geometry,material]of batches){const mesh=this.part(group,geometry,material);mesh.castShadow=mesh.receiveShadow=true;}
    group.userData.joints=[];group.userData.rig=null;group.userData.baked=true;
  }
  fortressFigure(token){
    const group=new THREE.Group(),body=new THREE.Group(),mat=token===token.toUpperCase()?this.white:this.black;group.add(body);
    this.part(body,new THREE.CylinderGeometry(0.39,0.43,0.15,12),mat,0,0.10);
    this.part(body,new THREE.CylinderGeometry(0.31,0.36,0.15,12),mat,0,0.24);
    this.part(body,new THREE.CylinderGeometry(0.27,0.32,0.83,16),mat,0,0.70);
    this.part(body,new THREE.CylinderGeometry(0.36,0.28,0.16,16),mat,0,1.17);
    this.part(body,new THREE.CylinderGeometry(0.37,0.37,0.10,16),mat,0,1.29);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,x=Math.sin(angle),z=Math.cos(angle);
      this.part(body,new THREE.BoxGeometry(0.15,0.22,0.14),mat,x*0.29,1.44,z*0.29).rotation.y=angle;
      this.part(body,new THREE.BoxGeometry(0.042,0.28,0.018),this.recess,x*0.285,0.86,z*0.285).rotation.y=angle;
      this.part(body,new THREE.BoxGeometry(0.13,0.018,0.018),this.recess,x*0.29,0.91,z*0.29).rotation.y=angle;
    }
    for(let row=0;row<4;row++){const ring=this.part(body,new THREE.TorusGeometry(0.28+(3-row)*0.01,0.006,4,24),this.gold,0,0.42+row*0.18);ring.rotation.x=Math.PI/2;}
    this.mergeParts(body);for(const mesh of body.children)mesh.castShadow=mesh.receiveShadow=true;
    group.userData={token,baseScale:1,baseYaw:token===token.toUpperCase()?0:Math.PI,joints:[],restJoints:[],restLower:[],rig:{fortress:true}};group.rotation.y=group.userData.baseYaw;return group;
  }
  horseFigure(token){
    const group=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group(),mat=token===token.toUpperCase()?this.white:this.black;
    group.add(body,head);head.position.set(0,1.44,-0.17);
    const stone=(geometry,x,y,z=0)=>this.part(body,geometry,mat,x,y,z);
    stone(new THREE.CylinderGeometry(0.39,0.43,0.14,16),0,0.09);
    const barrel=stone(new THREE.SphereGeometry(1,20,14),0,0.91,0.09);barrel.scale.set(0.23,0.43,0.26);barrel.rotation.x=-0.23;
    const haunch=stone(new THREE.SphereGeometry(1,16,12),0,0.57,0.19);haunch.scale.set(0.23,0.25,0.25);
    const neck=stone(new THREE.SphereGeometry(1,16,14),0,1.32,-0.10);neck.scale.set(0.15,0.34,0.17);neck.rotation.x=-0.30;
    const skull=this.part(head,new THREE.SphereGeometry(1,16,12),mat,0,0.18,-0.05);skull.scale.set(0.12,0.18,0.16);skull.rotation.x=0.25;
    const muzzle=this.part(head,new THREE.SphereGeometry(1,16,10),mat,0,0.075,-0.23);muzzle.scale.set(0.095,0.095,0.17);
    for(const x of [-0.085,0.085]){
      const ear=this.part(head,new THREE.ConeGeometry(0.055,0.22,8),mat,x,0.39,0.015);ear.rotation.x=-0.16;
      this.part(head,new THREE.SphereGeometry(0.014,8,6),this.recess,x*1.30,0.20,-0.12);
      this.part(head,new THREE.SphereGeometry(0.020,8,6),this.recess,x*0.75,0.08,-0.36);
    }
    const jaw=this.part(head,new THREE.BoxGeometry(0.13,0.06,0.23),this.gold,0,0.005,-0.23);jaw.rotation.x=-0.07;
    const mane=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.01,0.31),new THREE.Vector3(0,1.35,0.13),new THREE.Vector3(0,1.67,-0.10)]);
    stone(new THREE.TubeGeometry(mane,14,0.05,6,false),0,0);
    const tail=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0.64,0.36),new THREE.Vector3(0.04,0.36,0.53),new THREE.Vector3(0.08,0.16,0.38)]);
    stone(new THREE.TubeGeometry(tail,12,0.05,7,false),0,0);
    for(let row=0;row<5;row++){
      const plate=stone(new THREE.CylinderGeometry(0.17-row*0.006,0.19-row*0.006,0.105,12,1,true,0,Math.PI),0,1.05+row*0.10,-0.12-row*0.025);plate.rotation.y=Math.PI/2;plate.rotation.x=-0.30;
    }
    const limbs=[];
    for(let i=0;i<4;i++){
      const front=i>=2,side=i%2?1:-1,length=front?0.25:0.20,lowerLength=front?0.22:0.19;
      const joint=new THREE.Group();joint.position.set(side*(front?0.17:0.15),front?1.03:0.55,front?-0.11:0.20);group.add(joint);
      this.part(joint,new THREE.CylinderGeometry(front?0.065:0.085,0.047,length,10),mat,0,-length/2);
      const lower=new THREE.Group();lower.position.y=-length;joint.add(lower);
      this.part(lower,new THREE.SphereGeometry(0.06,10,8),mat);
      this.part(lower,new THREE.CylinderGeometry(0.045,0.035,lowerLength,10),mat,0,-lowerLength/2);
      this.part(lower,new THREE.BoxGeometry(0.105,0.09,0.14),mat,0,-lowerLength,-0.02);
      joint.userData.lower=lower;limbs.push(joint);
    }
    for(const container of [body,head,...limbs,...limbs.map(j=>j.userData.lower)])this.mergeParts(container);
    const restJoints=[-0.20,-0.12,1.9,1.75],restLower=[0.20,0.12,-1.15,-1.05];
    group.userData={token,baseScale:1,baseYaw:token===token.toUpperCase()?0:Math.PI,joints:limbs,restJoints,restLower,rig:{horse:true,head,legLength:[0.20,0.20,0.25,0.25],legHeight:0.39}};
    group.traverse(object=>{if(object.isMesh)object.receiveShadow=true;});for(const part of [body,head])for(const mesh of part.children)mesh.castShadow=true;this.restFigure(group);return group;
  }
  figure(token) {
    if(token.toLowerCase()==='n')return this.horseFigure(token);
    if(token.toLowerCase()==='r')return this.fortressFigure(token);
    const group=new THREE.Group(),body=new THREE.Group(),chest=new THREE.Group(),headPivot=new THREE.Group(),kind=token.toLowerCase(),white=token===token.toUpperCase(),mat=white?this.white:this.black;
    group.add(body,chest);chest.add(headPivot);chest.position.y=0.84;headPivot.position.y=0.32;group.rotation.y=white?0:Math.PI;
    const scale={p:0.72,r:1.00,n:1.01,b:1.10,q:1.15,k:1.20}[kind];
    const attach=(geometry,material,x,y,z)=>{const parent=y>=1.24?headPivot:body;return this.part(parent,geometry,material,x,y-(parent===headPivot?1.16:0),z);};
    const stone=(geometry,x,y,z=0)=>attach(geometry,mat,x,y,z);
    const metal=(geometry,x,y,z=0)=>attach(geometry,this.gold,x,y,z);
    stone(new THREE.CylinderGeometry(0.35,0.39,0.12,16),0,0.08);
    metal(new THREE.CylinderGeometry(0.355,0.355,0.035,16),0,0.15);
    // Sculpt the torso/face and separate upper/lower limbs so the figures read
    // as armored people at board scale, while staying entirely original.
    const torso=[new THREE.Vector2(0.14,0.62),new THREE.Vector2(0.17,0.72),new THREE.Vector2(0.18,0.83),new THREE.Vector2(0.23,0.99),new THREE.Vector2(0.21,1.08),new THREE.Vector2(0.12,1.12)];
    const cuirass=this.part(chest,new THREE.LatheGeometry(torso,20),mat,0,-0.84);cuirass.scale.z=0.72;
    this.part(chest,new THREE.CylinderGeometry(0.065,0.08,0.13,10),mat,0,0.32);
    this.part(headPivot,this.headTemplate.clone(),mat);
    for(const x of [-0.044,0.044])this.part(headPivot,new THREE.SphereGeometry(0.010,8,6),this.recess,x,0.202,-0.103);
    for(const side of [-1,1]){
      const pauldron=stone(new THREE.SphereGeometry(0.115,16,8,0,Math.PI*2,0,Math.PI*0.70),side*0.24,1.07);pauldron.scale.set(1.12,0.8,1);
      metal(new THREE.TorusGeometry(0.108,0.009,5,16,Math.PI),side*0.24,1.07,-0.012).rotation.x=-Math.PI/2;
      for(let j=0;j<3;j++){const plate=stone(new THREE.BoxGeometry(0.13,0.055,0.12),side*(0.16+j*0.014),0.75-j*0.045,-0.045);plate.rotation.z=side*0.13;}
    }
    this.part(chest,new THREE.CylinderGeometry(0.19,0.21,0.055,20),this.gold,0,0.25);
    metal(new THREE.BoxGeometry(0.035,0.28,0.022),0,0.94,-0.175);
    metal(new THREE.BoxGeometry(0.32,0.05,0.13),0,0.71,-0.02);
    const limb=(x,y,arm)=>{
      const joint=new THREE.Group();joint.position.set(x,y,0);group.add(joint);
      const length=arm?0.23:0.26;
      this.part(joint,new THREE.CylinderGeometry(arm?0.075:0.09,arm?0.06:0.07,length,10),mat,0,-length/2);
      const lower=new THREE.Group();lower.position.y=-length;joint.add(lower);
      this.part(lower,new THREE.SphereGeometry(arm?0.066:0.075,10,6),mat);
      this.part(lower,new THREE.CylinderGeometry(arm?0.06:0.075,arm?0.045:0.055,length,10),mat,0,-length/2);
      if(arm)this.part(lower,new THREE.IcosahedronGeometry(0.065,1),mat,0,-length);
      else{const foot=new THREE.Group();foot.position.set(0,-length,-0.05);lower.add(foot);this.part(foot,new THREE.BoxGeometry(0.145,0.105,0.24),mat);joint.userData.foot=foot;}
      joint.userData.lower=lower;
      return joint;
    };
    const leftLeg=limb(-0.115,0.72,false),rightLeg=limb(0.115,0.72,false),leftArm=limb(-0.27,1.06,true),rightArm=limb(0.27,1.06,true);
    const held=(side,geometry,material,x,y,z=0)=>{
      const arm=side==='left'?leftArm:rightArm,hand=arm.userData.lower;
      if(!arm.userData.weapon){const pivot=new THREE.Group();pivot.position.y=-0.23;hand.add(pivot);arm.userData.weapon=pivot;}
      return this.part(arm.userData.weapon,geometry,material,x-arm.position.x,y-arm.position.y-hand.position.y+0.23,z);
    };
    if(kind==='b'){
      const robe=new THREE.CylinderGeometry(0.13,0.31,0.65,32,6);for(let i=0;i<robe.attributes.position.count;i++){const x=robe.attributes.position.getX(i),z=robe.attributes.position.getZ(i),f=1+Math.cos(Math.atan2(z,x)*12)*0.055;robe.attributes.position.setX(i,x*f);robe.attributes.position.setZ(i,z*f);}robe.computeVertexNormals();stone(robe,0,0.51);
      stone(new THREE.ConeGeometry(0.20,0.38,12),0,1.51);
      metal(new THREE.SphereGeometry(0.06,8,6),0,1.72);
      held('right',new THREE.CylinderGeometry(0.035,0.035,1.14,8),this.gold,0.32,0.89);
      held('right',new THREE.TorusGeometry(0.12,0.027,6,16),this.gold,0.32,1.5);
    }else if(kind==='p'){
      stone(new THREE.LatheGeometry([new THREE.Vector2(0.17,0),new THREE.Vector2(0.15,0.065),new THREE.Vector2(0.11,0.14),new THREE.Vector2(0.015,0.18)],20),0,1.38);
      stone(new THREE.BoxGeometry(0.025,0.14,0.025),0,1.36,-0.155);
      for(const side of [-1,1])stone(new THREE.BoxGeometry(0.025,0.14,0.11),side*0.10,1.33,0.005);
      held('right',new THREE.CylinderGeometry(0.025,0.025,1.25,6),this.gold,0.34,0.84);
      held('right',new THREE.ConeGeometry(0.065,0.21,6),mat,0.34,1.56);
      const shield=new THREE.Shape();shield.moveTo(-0.17,0.18);shield.quadraticCurveTo(0,0.25,0.17,0.18);shield.lineTo(0.14,-0.10);shield.lineTo(0,-0.25);shield.lineTo(-0.14,-0.10);shield.closePath();
      held('left',new THREE.ExtrudeGeometry(shield,{depth:0.045,bevelEnabled:true,bevelSize:0.012,bevelThickness:0.008,bevelSegments:1,steps:1}),mat,-0.29,0.78,-0.13);
    }else if(kind==='r'){
      stone(new THREE.BoxGeometry(0.39,0.15,0.32),0,1.36);
      for(const x of [-0.15,0,0.15])stone(new THREE.BoxGeometry(0.08,0.12,0.32),x,1.49);
      held('left',new THREE.BoxGeometry(0.39,0.57,0.12),mat,-0.28,0.78,-0.13);
      held('left',new THREE.BoxGeometry(0.035,0.43,0.035),this.gold,-0.28,0.80,-0.2);
    }else if(kind==='n'){
      // Horse crest identifies the knight without requiring a large mounted mesh.
      const crest=stone(new THREE.BoxGeometry(0.09,0.28,0.27),0,1.51,0.02);crest.rotation.x=-0.35;
      stone(new THREE.BoxGeometry(0.11,0.12,0.22),0,1.55,-0.16);
      stone(new THREE.ConeGeometry(0.08,0.20,4),0,1.72,0.04);
      held('left',new THREE.CylinderGeometry(0.23,0.23,0.08,12),mat,-0.29,0.83,-0.08).rotation.x=Math.PI/2;
      held('right',new THREE.BoxGeometry(0.065,0.67,0.04),this.gold,0.32,1.00,-0.03);
      held('right',new THREE.BoxGeometry(0.24,0.055,0.08),this.gold,0.32,0.75,-0.03);
    }else{
      const robe=new THREE.CylinderGeometry(0.13,0.29,0.65,32,6);for(let i=0;i<robe.attributes.position.count;i++){const x=robe.attributes.position.getX(i),z=robe.attributes.position.getZ(i),f=1+Math.cos(Math.atan2(z,x)*12)*0.055;robe.attributes.position.setX(i,x*f);robe.attributes.position.setZ(i,z*f);}robe.computeVertexNormals();stone(robe,0,0.54);
      metal(new THREE.CylinderGeometry(0.20,0.17,0.12,12),0,1.40);
      const points=kind==='q'?7:5;for(let i=0;i<points;i++){const a=i*Math.PI*2/points;metal(new THREE.ConeGeometry(0.045,0.14,6),Math.cos(a)*0.17,1.52,Math.sin(a)*0.17);}
      if(kind==='k'){
        metal(new THREE.BoxGeometry(0.07,0.23,0.07),0,1.62);metal(new THREE.BoxGeometry(0.21,0.07,0.07),0,1.67);
        held('right',new THREE.BoxGeometry(0.065,0.90,0.025),mat,0.09,1.12,-0.24);
        held('right',new THREE.ConeGeometry(0.046,0.15,4),mat,0.09,1.64,-0.24);
        held('right',new THREE.BoxGeometry(0.28,0.045,0.055),this.gold,0.09,0.68,-0.24);
      }
      else{held('right',new THREE.CylinderGeometry(0.03,0.03,0.95,8),this.gold,0.33,0.91);held('right',new THREE.SphereGeometry(0.11,10,8),this.gold,0.33,1.44);}
    }
    // Merge static body parts per material; joints remain independently animatable.
    for(const container of [body,chest,headPivot,leftLeg,rightLeg,leftArm,rightArm,...[leftLeg,rightLeg,leftArm,rightArm].map(j=>j.userData.lower),leftArm.userData.weapon,rightArm.userData.weapon].filter(Boolean))this.mergeParts(container);
    const restJoints=kind==='p'?[0.35,0.35,0.40,0.30]:[0,0,0.05,0.05],restLower=kind==='p'?[-0.65,-0.65,0.30,0.25]:[0,0,0.08,0.08];
    group.scale.setScalar(scale);group.userData={token,joints:[leftLeg,rightLeg,leftArm,rightArm],baseScale:scale,baseYaw:white?0:Math.PI,restJoints,restLower,rig:{chest,head:headPivot,weapon:rightArm.userData.weapon,feet:[leftLeg.userData.foot,rightLeg.userData.foot],legLength:0.26,legHeight:0.49}};
    if(kind==='p'){chest.rotation.x=-0.32;headPivot.rotation.x=-0.12;group.userData.restChest=-0.32;group.userData.restHead=-0.12;}
    group.traverse(object=>{if(object.isMesh)object.receiveShadow=true;});
    // The merged torso/base casts the major silhouette. Avoid a second shadow
    // draw for every tiny articulated finger/weapon on school GPUs.
    for(const part of [body,chest,headPivot])for(const mesh of part.children)mesh.castShadow=true;
    this.restFigure(group);return group;
  }
  restFigure(mesh){
    if(!mesh)return;mesh.rotation.set(0,mesh.userData.baseYaw||0,0);
    for(const [i,joint]of (mesh.userData.joints||[]).entries()){joint.rotation.set(mesh.userData.restJoints?.[i]||0,0,0);if(joint.userData.lower)joint.userData.lower.rotation.set(mesh.userData.restLower?.[i]||0,0,0);}
    for(const foot of mesh.userData.rig?.feet||[])foot?.rotation.set(0,0,0);
    mesh.userData.rig?.weapon?.rotation.set(0,0,0);
    mesh.userData.rig?.chest?.rotation.set(mesh.userData.restChest||0,0,0);mesh.userData.rig?.head?.rotation.set(mesh.userData.restHead||0,0,0);
  }
  finishPresentation(){
    const a=this.animation;if(!a)return;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
    if(a.moving)a.moving.position.copy(a.to);this.restFigure(a.moving);this.bakeFigure(a.moving);
    for(const mesh of [a.captured,a.halo,a.dust,...(a.chips||[])])if(mesh){this.pieces.remove(mesh);this.disposeGeometry(mesh);}
    this.animation=null;this.cameraBusy=false;this.orientation(this.viewSide||'white');
  }
  makeStoneChips(center,token,count=8){
    const chips=[];for(let i=0;i<Math.max(0,Math.min(8,count));i++){
      const mesh=this.part(this.pieces,new THREE.TetrahedronGeometry(0.035+(i%3)*0.012,0),token===token.toUpperCase()?this.white:this.black,center.x,0.30,center.z);mesh.scale.setScalar(0.001);chips.push(mesh);
    }return chips;
  }
  orientation(side) {
    this.viewSide=side==='black'?'black':'white';const sign=this.viewSide==='black'?-1:1; this.camera.position.set(0,10.8,sign*11.9); this.camera.lookAt(0,0.15,0);
  }
  resize() {
    if(this.disposed||this.failed)return;
    const r=this.container.getBoundingClientRect(); if(!r.width||!r.height)return;
    this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.render();
  }
  update(match, {orientation='white',effects=true,selected=null,targets=[],disabled=false,fast,battleCamera}={}) {
    if(this.disposed||this.failed)return;
    try {
      this.disabled=disabled;if(fast!==undefined)this.fast=!!fast;if(battleCamera!==undefined)this.battleCamera=!!battleCamera;this.orientation(orientation);
      if(this.animation&&(!effects||this.motion.matches||document.hidden||fast===true&&!this.animation.choreography?.fast))this.finishPresentation();
      const next=position(match?.fen),moves=Array.isArray(match?.moves)?match.moves:[];
      const identity=match?.id,revision=match?.revision;
      const changed=!this.snapshot||this.snapshot.fen!==match.fen||this.snapshot.id!==identity||this.snapshot.revision!==revision;
      if(changed){
        if(this.animation?.moving){this.animation.moving.position.copy(this.animation.to);this.restFigure(this.animation.moving);}
        this.animation=null;this.cameraBusy=false;
        const old=this.snapshot;
        const contiguous=old&&old.id===identity&&Number.isSafeInteger(revision)&&revision===old.revision+1&&moves.length===old.moves.length+1&&old.moves.every((m,i)=>m===moves[i]);
        const move=contiguous&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moves.at(-1))?moves.at(-1):null;
        const animate=move&&effects&&!this.motion.matches&&!document.hidden;
        const from=move?.slice(0,2),to=move?.slice(2,4);
        const mover=this.meshes.get(from)?.userData.token;
        const captureSquare=animate?[...this.meshes.keys()].find(s=>{
          const token=this.meshes.get(s).userData.token;
          return mover&&(token===token.toUpperCase())!==(mover===mover.toUpperCase())&&(!next.has(s)||s===to&&token!==next.get(s));
        }):null;
        let captured=null;
        if(captureSquare){const token=this.meshes.get(captureSquare).userData.token;captured=this.figure(token);captured.position.copy(point(captureSquare));captured.userData.square=captureSquare;}
        // Dispose replaced geometry; only the final snapshot survives interrupted animation.
        for(const mesh of [...this.pieces.children]){this.pieces.remove(mesh);this.disposeGeometry(mesh);}
        if(captured)this.pieces.add(captured);
        this.meshes.clear();
        for(const [square,token]of next){const mesh=this.figure(token);mesh.userData.square=square;mesh.position.copy(point(square));this.pieces.add(mesh);this.meshes.set(square,mesh);if(!animate||square!==to)this.bakeFigure(mesh);}
        if(animate){
          const moving=this.meshes.get(to),start=point(from),end=point(to);
          if(moving)moving.position.copy(start);
          let halo=null;
          if(match.reason==='checkmate'){
            const king=[...this.meshes.values()].find(mesh=>mesh.userData.token===(match.result==='white'?'k':'K'));
            if(king){halo=this.part(this.pieces,new THREE.TorusGeometry(0.45,0.045,6,32),this.gold,king.position.x,0.14,king.position.z);halo.rotation.x=-Math.PI/2;}
          }
          let dust=null;if(captured){dust=this.part(this.pieces,new THREE.TorusGeometry(0.32,0.065,6,24),this.dustMaterial,end.x,0.12,end.z);dust.rotation.x=-Math.PI/2;dust.scale.setScalar(0.01);}
          const baseYaw=moving?.userData.baseYaw||0,facing=Math.atan2(-(end.x-start.x),-(end.z-start.z));
          const yawDelta=((facing-baseYaw+Math.PI*3)%(Math.PI*2))-Math.PI;
          this.animation={start:performance.now(),duration:captured?1400:1000,moving,from:start,to:end,captured,halo,dust,baseYaw,yawDelta};
        } else if(captured){this.pieces.remove(captured);this.disposeGeometry(captured);}
        this.snapshot={id:identity,fen:match.fen,revision,moves:moves.slice()};
      }
      this.disposeGeometry(this.overlays);this.overlays.clear();
      for(const square of [...new Set([selected,...targets].filter(s=>/^[a-h][1-8]$/.test(s||'')))]){
        const p=point(square),ring=this.part(this.overlays,new THREE.TorusGeometry(square===selected?0.39:0.16,0.035,6,24),square===selected?this.selectedMaterial:this.marker,p.x,0.055,p.z);ring.rotation.x=-Math.PI/2;
      }
      this.render();
    } catch(error){this.fail('3D chess could not display this position. Use the 2D board.');}
  }
  disposeGeometry(root){root.traverse(object=>{if(object.geometry){object.geometry.dispose();this.geometries.delete(object.geometry);}});}
  render() {
    if(this.disposed||this.failed)return;
    try {
      if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
      if(this.animation&&(this.motion.matches||document.hidden))this.finishPresentation();
      advanceCinema(this, performance.now());
      this.renderer.render(this.scene,this.camera);
    } catch(error){this.fail('3D graphics stopped. Continue using the 2D board.');}
  }
  fail(message){if(this.failed||this.disposed)return;this.failed=true;this.cameraBusy=false;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.onFailure(message);}
  destroy(){
    if(this.disposed)return;this.disposed=true;if(this.frame)cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();this.canvas?.removeEventListener('click',this.click);this.canvas?.removeEventListener('webglcontextlost',this.loss);
    for(const tile of this.tiles)if(tile.isInstancedMesh)tile.dispose();
    for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose();for(const texture of this.textures)texture.dispose();
    this.geometries.clear();this.materials.clear();this.textures.clear();this.renderer?.dispose();this.canvas?.remove();this.meshes.clear();this.animation=null;
  }
}
export const THREE_VERSION = VERSION;
