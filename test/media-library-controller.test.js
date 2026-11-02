"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/display.html"),"utf8").replace(/\r\n/g,"\n");
function fixture(type="pdf"){
 const node=()=>({children:[],dataset:{},value:"",checked:false,textContent:"",append(...items){this.children.push(...items)},appendChild(item){this.children.push(item)},set innerHTML(v){this.html=v;this.children=[]},get innerHTML(){return this.html||""}}),nodes={},el=id=>nodes[id]||=node(),calls=[],results=[];
 const file={type,storedName:"lesson #1."+(type==="video"?"mp4":type==="image"?"png":"pdf"),originalName:"Lesson",url:"/media/lesson",size:8},h={file,nodes,calls,results,target:["tv1","tv2"],send:async()=>({ok:true})};
 const ctx=vm.createContext({window:null,el,document:{createElement:node},api:async(url,options)=>{calls.push({url,options});return options?h.send():{files:[file]}},targetArg:()=>{if(!h.target.length)throw Error("Select at least one display target.");return [...h.target]},setResultSummary:(...args)=>results.push(args)});ctx.window=ctx;
 el("mediaFit").value="cover";el("mediaOpacity").value="0.4";el("videoAutoplay").checked=false;el("videoLoop").checked=true;el("videoMuted").checked=true;el("mediaLocalDirect").checked=true;
 const a=source.indexOf("let mediaLibraryGeneration="),b=source.indexOf("\nwindow.loadScenes=",a);assert.ok(a>0&&b>a);vm.runInContext(source.slice(a,b),ctx);h.ctx=ctx;return h;
}
for(const type of ["image","video","pdf","document","presentation"])test("display library routes "+type+" through canonical media dispatch",async()=>{
 const h=fixture(type);await h.ctx.loadMedia();const toolbar=h.nodes.mediaGrid.children[0].children[1].children[2];await toolbar.children[1].onclick();
 assert.equal(h.calls.length,2);assert.equal(h.calls[1].url,"/api/v1/media/"+encodeURIComponent(h.file.storedName)+"/display");assert.equal(h.calls[1].options.method,"POST");
 assert.deepEqual(JSON.parse(h.calls[1].options.body),{target:["tv1","tv2"],fit:"cover",opacity:.4,autoplay:false,loop:true,muted:true,localDirect:true});assert.match(h.results.at(-1)[0],/sent to tv1, tv2/);
});
test("display library preserves target evidence across a pending dispatch",async()=>{
 const h=fixture();let finish;h.send=()=>new Promise(resolve=>finish=resolve);const p=h.ctx.showLibraryMedia(h.file);h.target=["other"];finish({ok:true});await p;assert.match(h.results.at(-1)[0],/tv1, tv2/);assert.doesNotMatch(h.results.at(-1)[0],/other/);
});
test("display library surfaces missing selection and conversion or dispatch errors",async()=>{
 const h=fixture();h.target=[];await h.ctx.showLibraryMedia(h.file);assert.equal(h.calls.length,0);assert.equal(h.results.at(-1)[1],false);assert.match(h.results.at(-1)[0],/Select at least one/);
 h.target=["tv1"];h.send=async()=>{throw Error("Document conversion is not ready")};await h.ctx.showLibraryMedia(h.file);assert.match(h.results.at(-1)[0],/conversion is not ready/);assert.equal(h.results.at(-1)[1],false);
});
test("selecting a video does not dispatch it or create a second decoder",async()=>{
 const h=fixture("video");await h.ctx.loadMedia();const card=h.nodes.mediaGrid.children[0];assert.equal(card.children[0].dataset.mediaPlaceholder,"video");card.children[1].children[2].children[0].onclick();assert.equal(h.calls.length,1);assert.equal(h.nodes.mediaUrl.value,h.file.url);
});
