import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
      this.white = this.material({ color: 0xd7ded5, roughness: 0.83, metalness: 0.12 });
      this.black = this.material({ color: 0x40536b, roughness: 0.72, metalness: 0.26 });
      const stone=this.stoneTexture();
      for(const material of [this.white,this.black]){material.map=stone;material.bumpMap=stone;material.bumpScale=0.035;material.roughness=0.96;material.metalness=0.02;}
      this.gold = this.material({ color: 0xbfa365, roughness: 0.55, metalness: 0.55 });
      const dark = this.material({ color: 0x334758, roughness: 0.93 });
      const light = this.material({ color: 0xa6bbae, roughness: 0.93 });
      const frame = this.material({ color: 0x1b2a3e, roughness: 0.8, metalness: 0.2 });
      this.part(this.scene, new THREE.BoxGeometry(8.65, 0.35, 8.65), frame, 0, -0.22, 0);
      const floor=this.part(this.scene,new THREE.CylinderGeometry(7.3,7.6,0.22,48),frame,0,-0.52,0);floor.receiveShadow=true;
      for (let rank = 1; rank <= 8; rank++) for (let file = 0; file < 8; file++) {
        const square = 'abcdefgh'[file] + rank, p = point(square);
        const tile = this.part(this.scene, new THREE.BoxGeometry(0.994, 0.12, 0.994), (file + rank) % 2 ? dark : light, p.x, -0.04, p.z);
        tile.userData.square = square; tile.receiveShadow=true;this.tiles.push(tile);
      }
      this.marker = this.material({ color: 0x55efd2, transparent: true, opacity: 0.8, depthWrite: false });
      this.selectedMaterial = this.material({ color: 0xffd279, transparent: true, opacity: 0.8, depthWrite: false });
      this.dustMaterial = this.material({color:0xb5b1a4,transparent:true,opacity:0.25,depthWrite:false});
      this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
      this.click = event => {
        if (this.disabled || this.failed || this.disposed) return;
        const r = this.canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
        this.pointer.set((event.clientX-r.left)/r.width*2-1, 1-(event.clientY-r.top)/r.height*2);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects([...this.tiles,...this.meshes.values()], true);
        for(const hit of hits){let object=hit.object;while(object&&!object.userData.square)object=object.parent;if(object?.userData.square){this.onSquare(object.userData.square);break;}}
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
  figure(token) {
    const group=new THREE.Group(),body=new THREE.Group(),kind=token.toLowerCase(),white=token===token.toUpperCase(),mat=white?this.white:this.black;
    group.add(body);group.rotation.y=white?0:Math.PI;
    const scale={p:0.84,r:1.00,n:1.01,b:1.06,q:1.10,k:1.15}[kind];
    const stone=(geometry,x,y,z=0)=>this.part(body,geometry,mat,x,y,z);
    const metal=(geometry,x,y,z=0)=>this.part(body,geometry,this.gold,x,y,z);
    stone(new THREE.CylinderGeometry(0.35,0.39,0.12,16),0,0.08);
    metal(new THREE.CylinderGeometry(0.355,0.355,0.035,16),0,0.15);
    // Heavy armored figures, rather than classical turned chess figurines.
    stone(new THREE.CylinderGeometry(0.22,0.15,0.40,8),0,0.88);
    stone(new THREE.SphereGeometry(0.15,12,8),0,1.22);
    stone(new THREE.CylinderGeometry(0.17,0.15,0.13,12),0,1.28);
    metal(new THREE.BoxGeometry(0.24,0.035,0.035),0,1.23,-0.14);
    stone(new THREE.SphereGeometry(0.12,8,6),-0.25,1.02);
    stone(new THREE.SphereGeometry(0.12,8,6),0.25,1.02);
    metal(new THREE.BoxGeometry(0.32,0.05,0.13),0,0.71,-0.02);
    const limb=(x,y,arm)=>{
      const joint=new THREE.Group();joint.position.set(x,y,0);group.add(joint);
      this.part(joint,new THREE.CylinderGeometry(arm?0.065:0.085,arm?0.085:0.095,arm?0.34:0.42,8),mat,0,arm?-0.17:-0.21);
      this.part(joint,new THREE.SphereGeometry(arm?0.075:0.09,8,6),mat,0,arm?-0.35:-0.43);
      if(!arm)this.part(joint,new THREE.BoxGeometry(0.16,0.12,0.25),mat,0,-0.49,-0.045);
      return joint;
    };
    const leftLeg=limb(-0.12,0.69,false),rightLeg=limb(0.12,0.69,false),leftArm=limb(-0.27,0.99,true),rightArm=limb(0.27,0.99,true);
    if(kind==='b'){
      stone(new THREE.ConeGeometry(0.31,0.65,12),0,0.51);
      stone(new THREE.ConeGeometry(0.20,0.38,12),0,1.51);
      metal(new THREE.SphereGeometry(0.06,8,6),0,1.72);
      metal(new THREE.CylinderGeometry(0.035,0.035,1.14,8),0.32,0.89);
      metal(new THREE.TorusGeometry(0.12,0.027,6,16),0.32,1.5);
    }else if(kind==='p'){
      stone(new THREE.SphereGeometry(0.18,12,8,0,Math.PI*2,0,Math.PI/2),0,1.28);
      metal(new THREE.CylinderGeometry(0.025,0.025,1.25,6),0.34,0.84);
      stone(new THREE.ConeGeometry(0.065,0.21,6),0.34,1.56);
      stone(new THREE.BoxGeometry(0.30,0.40,0.075),-0.29,0.78,-0.10);
    }else if(kind==='r'){
      stone(new THREE.BoxGeometry(0.39,0.15,0.32),0,1.36);
      for(const x of [-0.15,0,0.15])stone(new THREE.BoxGeometry(0.08,0.12,0.32),x,1.49);
      stone(new THREE.BoxGeometry(0.39,0.57,0.12),-0.28,0.78,-0.13);
      metal(new THREE.BoxGeometry(0.035,0.43,0.035),-0.28,0.80,-0.2);
    }else if(kind==='n'){
      // Horse crest identifies the knight without requiring a large mounted mesh.
      const crest=stone(new THREE.BoxGeometry(0.09,0.28,0.27),0,1.51,0.02);crest.rotation.x=-0.35;
      stone(new THREE.BoxGeometry(0.11,0.12,0.22),0,1.55,-0.16);
      stone(new THREE.ConeGeometry(0.08,0.20,4),0,1.72,0.04);
      stone(new THREE.CylinderGeometry(0.23,0.23,0.08,8),-0.29,0.83,-0.08).rotation.x=Math.PI/2;
      metal(new THREE.BoxGeometry(0.065,0.67,0.04),0.32,1.00,-0.03);
      metal(new THREE.BoxGeometry(0.24,0.055,0.08),0.32,0.75,-0.03);
    }else{
      stone(new THREE.ConeGeometry(0.28,0.65,10),0,0.54);
      metal(new THREE.CylinderGeometry(0.20,0.17,0.12,12),0,1.40);
      const points=kind==='q'?7:5;for(let i=0;i<points;i++){const a=i*Math.PI*2/points;metal(new THREE.ConeGeometry(0.045,0.14,6),Math.cos(a)*0.17,1.52,Math.sin(a)*0.17);}
      if(kind==='k'){metal(new THREE.BoxGeometry(0.07,0.23,0.07),0,1.62);metal(new THREE.BoxGeometry(0.21,0.07,0.07),0,1.67);}
      else{metal(new THREE.CylinderGeometry(0.03,0.03,0.95,8),0.33,0.91);metal(new THREE.SphereGeometry(0.11,10,8),0.33,1.44);}
    }
    // Merge static body parts per material; joints remain independently animatable.
    for(const container of [body,leftLeg,rightLeg,leftArm,rightArm]){
      container.updateMatrixWorld(true);
      const batches=[];
      for(const material of [mat,this.gold]){
        const parts=container.children.filter(mesh=>mesh.material===material),geometries=parts.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrix));
        if(geometries.length){const merged=mergeGeometries(geometries,false);if(merged)batches.push([merged,material]);}
        for(const geometry of geometries)geometry.dispose();
      }
      this.disposeGeometry(container);container.clear();
      for(const [geometry,material]of batches)this.part(container,geometry,material);
    }
    group.scale.setScalar(scale);group.userData={token,joints:[leftLeg,rightLeg,leftArm,rightArm],baseScale:scale};
    group.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    return group;
  }
  orientation(side) {
    const sign=side==='black'?-1:1; this.camera.position.set(0,10.8,sign*11.9); this.camera.lookAt(0,0.15,0);
  }
  resize() {
    if(this.disposed||this.failed)return;
    const r=this.container.getBoundingClientRect(); if(!r.width||!r.height)return;
    this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.render();
  }
  update(match, {orientation='white',effects=true,selected=null,targets=[],disabled=false}={}) {
    if(this.disposed||this.failed)return;
    try {
      this.disabled=disabled;this.orientation(orientation);
      if(this.animation&&(!effects||this.motion.matches||document.hidden)){
        const a=this.animation;if(a.moving)a.moving.position.copy(a.to);
        if(a.moving){a.moving.rotation.x=0;for(const joint of a.moving.userData.joints||[])joint.rotation.x=0;}
        for(const mesh of [a.captured,a.halo,a.dust])if(mesh){this.pieces.remove(mesh);this.disposeGeometry(mesh);}
        this.animation=null;
      }
      const next=position(match?.fen),moves=Array.isArray(match?.moves)?match.moves:[];
      const identity=match?.id,revision=match?.revision;
      const changed=!this.snapshot||this.snapshot.fen!==match.fen||this.snapshot.id!==identity||this.snapshot.revision!==revision;
      if(changed){
        this.animation=null;
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
        const captured=captureSquare?this.meshes.get(captureSquare):null;
        // Dispose replaced geometry; only the final snapshot survives interrupted animation.
        for(const mesh of [...this.pieces.children]){if(mesh!==captured){this.pieces.remove(mesh);this.disposeGeometry(mesh);}}
        this.meshes.clear();
        for(const [square,token]of next){const mesh=this.figure(token);mesh.userData.square=square;mesh.position.copy(point(square));this.pieces.add(mesh);this.meshes.set(square,mesh);}
        if(animate){
          const moving=this.meshes.get(to),start=point(from),end=point(to);
          if(moving)moving.position.copy(start);
          let halo=null;
          if(match.reason==='checkmate'){
            const king=[...this.meshes.values()].find(mesh=>mesh.userData.token===(match.result==='white'?'k':'K'));
            if(king){halo=this.part(this.pieces,new THREE.TorusGeometry(0.45,0.045,6,32),this.gold,king.position.x,0.14,king.position.z);halo.rotation.x=-Math.PI/2;}
          }
          let dust=null;if(captured){dust=this.part(this.pieces,new THREE.TorusGeometry(0.32,0.065,6,24),this.dustMaterial,end.x,0.12,end.z);dust.rotation.x=-Math.PI/2;dust.scale.setScalar(0.01);}
          this.animation={start:performance.now(),duration:captured?1100:halo?1000:760,moving,from:start,to:end,captured,halo,dust};
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
      const a=this.animation;
      if(a){const t=Math.min(1,(performance.now()-a.start)/a.duration),travel=a.captured?Math.min(1,t/0.70):t,smooth=travel*travel*(3-2*travel);
        if(a.moving){a.moving.position.lerpVectors(a.from,a.to,smooth);a.moving.position.y=Math.abs(Math.sin(travel*Math.PI*3))*0.045*(1-travel);
          a.moving.rotation.x=Math.sin(travel*Math.PI*2)*0.035;
          const joints=a.moving.userData.joints||[];for(let i=0;i<joints.length;i++)joints[i].rotation.x=Math.sin(travel*Math.PI*4)*(i%2?-1:1)*(i<2?0.30:0.12)*(1-travel);
        }
        const impact=Math.max(0,(t-0.55)/0.45);
        if(a.captured){a.captured.scale.setScalar((a.captured.userData.baseScale||1)*Math.max(0.01,1-impact));a.captured.rotation.z=impact*1.25;a.captured.position.y=-impact*0.35;}
        if(a.dust)a.dust.scale.setScalar(Math.max(0.01,Math.sin(impact*Math.PI)*1.8));
        if(a.halo)a.halo.scale.setScalar(1+Math.sin(t*Math.PI)*0.65);
        if(t<1)this.frame=requestAnimationFrame(()=>{this.frame=0;this.render();});
        else{if(a.moving){a.moving.position.copy(a.to);a.moving.rotation.x=0;for(const joint of a.moving.userData.joints||[])joint.rotation.x=0;}for(const mesh of [a.captured,a.halo,a.dust])if(mesh){this.pieces.remove(mesh);this.disposeGeometry(mesh);}this.animation=null;}
      }
      this.renderer.render(this.scene,this.camera);
    } catch(error){this.fail('3D graphics stopped. Continue using the 2D board.');}
  }
  fail(message){if(this.failed||this.disposed)return;this.failed=true;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.onFailure(message);}
  destroy(){
    if(this.disposed)return;this.disposed=true;if(this.frame)cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();this.canvas?.removeEventListener('click',this.click);this.canvas?.removeEventListener('webglcontextlost',this.loss);
    for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose();for(const texture of this.textures)texture.dispose();
    this.geometries.clear();this.materials.clear();this.textures.clear();this.renderer?.dispose();this.canvas?.remove();this.meshes.clear();this.animation=null;
  }
}
export const THREE_VERSION = VERSION;
