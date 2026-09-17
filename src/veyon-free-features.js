"use strict";

const dgram=require("node:dgram");

// Protocol identifiers verified against upstream v4.9.7. Keep this allowlist
// separate from discovery: WebAPI advertises local plugins, not endpoint proof.
const POWER_FEATURES=Object.freeze({
  powerDownNow:"a88039f2-6716-40d8-b4e1-9f5cd48e91ed",
  installUpdatesAndPowerDown:"09bcb3a1-fc11-4d03-8cf1-efd26be8655b",
  powerDownConfirmed:"ea2406be-d5c7-42b8-9f04-53469d3cc34c",
  powerDownDelayed:"352de795-7fc4-4850-bc57-525bcb7033f5"
});

const CLIPBOARD_FEATURE="d344032e-70ce-4a83-8cb8-3ebd6d6f6f39";
const INPUT_FEATURE_UID="6c33a9b1-8b1f-4c71-bc64-85f7df210cab";
const KEY_SEQUENCES=Object.freeze(["Enter","Tab","Escape","Backspace","Delete","Left","Up","Right","Down","Home","End","PageUp","PageDown","Ctrl+A","Ctrl+C","Ctrl+V"]);
function keyArguments(args,active=true){
  if(active===false||!KEY_SEQUENCES.includes(args?.sequence))throw Error("Choose a supported key or shortcut.");
  return {sequence:args.sequence};
}
function keyAdvertised(features){
  return Array.isArray(features)&&features.some(f=>String(f.name||f.Name||"")==="RoomGoblinKeySequence"&&String(f.uid||f.Uid||f.UID||"").replace(/[{}]/g,"").toLowerCase()===INPUT_FEATURE_UID);
}
function clipboardArguments(args,active=true){
  const text=args?.clipboardText;
  if(active===false||typeof text!=="string"||!text.length||text.includes("\0")||Buffer.byteLength(text,"utf8")>8192)throw Error("Clipboard requires 1–8192 UTF-8 bytes of text and cannot be stopped.");
  return {clipboardText:text};
}
function clipboardAdvertised(features){
  return Array.isArray(features)&&features.some(f=>String(f.name||f.Name||"")==="RoomGoblinClipboardWrite"&&String(f.uid||f.Uid||f.UID||"").replace(/[{}]/g,"").toLowerCase()===CLIPBOARD_FEATURE);
}

function normalizeMac(value){
  const input=String(value||"").trim();
  if(!input)return "";
  if(!/^(?:[a-f\d]{12}|(?:[a-f\d]{2}:){5}[a-f\d]{2}|(?:[a-f\d]{2}-){5}[a-f\d]{2})$/i.test(input))throw Error("Use a six-byte MAC address.");
  const mac=input.replace(/[:-]/g,"").toUpperCase();
  if(/^0{12}$/.test(mac)||(parseInt(mac.slice(0,2),16)&1))throw Error("A unicast MAC address is required.");
  return mac.match(/../g).join(":");
}
function magicPacket(mac){
  const normalized=normalizeMac(mac);if(!normalized)throw Error("Save this computer's MAC address first.");
  const bytes=Buffer.from(normalized.replace(/:/g,""),"hex");
  return Buffer.concat([Buffer.alloc(6,255),...Array(16).fill(bytes)]);
}
function wakeComputer(mac,createSocket=dgram.createSocket){
  const packet=magicPacket(mac);
  return new Promise((resolve,reject)=>{
    const socket=createSocket("udp4");let done=false;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);try{socket.close()}catch{};error?reject(Error("Wake-on-LAN packet could not be sent.")):resolve({accepted:true,verified:false})};
    const timer=setTimeout(()=>finish(Error("timeout")),3000);
    socket.once("error",finish);
    try{socket.bind(0,()=>{try{socket.setBroadcast(true);socket.send(packet,9,"255.255.255.255",finish)}catch(error){finish(error)}})}catch(error){finish(error)}
  });
}
function powerArguments(feature,args={},active=true){
  if(!Object.hasOwn(POWER_FEATURES,feature))return args;
  if(active===false)throw Error("Shutdown requests cannot be cancelled through Veyon WebAPI.");
  if(feature!=="powerDownDelayed")return {};
  const seconds=Number(args.shutdownTimeout);
  if(!Number.isInteger(seconds)||seconds<30||seconds>3600)throw Error("Shutdown delay must be 30–3600 seconds.");
  return {shutdownTimeout:seconds};
}
const CATALOG=Object.freeze([
  ["MonitoringMode","Monitor screens","web","Live previews and live view"],
  ["RemoteView","Remote view","web","Open Live View"],
  ["RemoteControl","Remote keyboard and mouse","desktop","Full browser remote control is not implemented; explicit shortcuts use the web bridge"],
  ["RoomGoblinKeySequence","Send key or shortcut","web","Press and release a fixed shortcut; requires RoomGoblinWebBridge; endpoint delivery unverified"],
  ["RoomGoblinClipboardWrite","Send clipboard text","web","Send clipboard text button; requires RoomGoblinWebBridge on the appliance; endpoint delivery unverified"],
  ["ClipboardExchange","Clipboard exchange","desktop","Native remote-control window and Veyon clipboard settings"],
  ["ClassroomChat","Two-way classroom chat","web","Community chat button; matching native browser bridge and endpoint chat plugin required"],
  ["RemoteFileBrowser","Browse pilot files","web","Community file browser; matching bridge and endpoint plugin, pilot-folder access only"],
  ["Screenshot","Screenshots","web","Download screenshot"],
  ["Demo","Broadcast","web","Teacher or selected student source, fullscreen or windowed"],
  ...["DemoServer","FullScreenDemo","WindowDemo","ShareOwnScreenFullScreen","ShareOwnScreenWindow","ShareUserScreenFullScreen","ShareUserScreenWindow"].map(name=>[name,"Broadcast component","workflow","Use broadcast controls; these components are coordinated together"]),
  ["ScreenLock","Screen lock","web","Lock and unlock with read-back and restart recovery"],
  ["InputDevicesLock","Input lock","web","Lock and unlock keyboard/mouse input"],
  ["TextMessage","Message","web","Send message"],
  ["StartApp","Launch applications","web","Start app or saved lesson action"],
  ["OpenWebsite","Open websites","web","Open website or saved lesson action"],
  ["FileTransfer","Distribute files","desktop","Native transfer available; a browser transfer adapter is not implemented"],
  ["FileCollect","Collect files","desktop","Requires an advertised collection feature and a browser collection adapter"],
  ["PowerOn","Wake-on-LAN","web","Save MAC address, select offline computer, then Wake"],
  ["Reboot","Restart","web","Reboot"],
  ["PowerDown","Shutdown","web","Shut down"],
  ...Object.keys(POWER_FEATURES).map(name=>[name[0].toUpperCase()+name.slice(1),"Shutdown option","web","Power options; acceptance does not prove shutdown"]),
  ["UserLogin","Log in","web","Masked login dialog"],
  ["UserLogoff","Log off","web","Log off selected computers"],
  ["UserInfo","Signed-in user","web","Device details"],
  ["SessionInfo","Session information","web","Device details"],
  ["QueryScreens","Monitor selection","desktop","Native remote access; browser monitor selection is not implemented"],
  ["QueryApplicationVersion","Endpoint version query","internal","Internal Veyon protocol; use native diagnostics"],
  ["QueryActiveFeatures","Active feature query","workflow","Lock/broadcast state; action features do not have persistent active state"],
  ["SystemTrayIcon","Student notification icon","configuration","Configure in Veyon Configurator"],
  ["DesktopAccessDialog","Access confirmation","configuration","Configure endpoint access confirmation in Veyon Configurator"],
  ["AccessControlProvider","Access rules","configuration","Configure Veyon authorization; never expose as arbitrary classroom commands"]
].map(([name,label,provider,detail])=>Object.freeze({name,label,provider,detail})));
function featureCatalog(advertised){
  const names=new Set((Array.isArray(advertised)?advertised:[]).map(f=>String(f.name||f.Name||"")));
  return CATALOG.filter(row=>["web","workflow"].includes(row.provider)).map(row=>({...row,advertised:row.name==="RoomGoblinKeySequence"?keyAdvertised(advertised):row.name==="RoomGoblinClipboardWrite"?clipboardAdvertised(advertised):names.has(row.name),endpointVerified:false}));
}
function normalizeLessonAction(input){
  const name=String(input?.name||"").trim();
  if(!name||name.length>80)throw Error("Lesson action needs a name of 1–80 characters.");
  const feature=String(input?.feature||""),value=String(input?.value||"").trim();
  if(!["openWebsite","startApp","textMessage"].includes(feature))throw Error("Only website, app and message lesson actions can be saved.");
  if(!value||value.length>2000)throw Error("Lesson action content must be 1–2000 characters.");
  if(feature==="openWebsite"){
    let url;try{url=new URL(value)}catch{throw Error("Enter a valid HTTP or HTTPS URL.")}
    if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw Error("Use HTTP(S) without embedded credentials.");
  }
  return {name,feature,value};
}
module.exports={INPUT_FEATURE_UID,KEY_SEQUENCES,keyArguments,keyAdvertised,CLIPBOARD_FEATURE,clipboardArguments,clipboardAdvertised,POWER_FEATURES,normalizeMac,magicPacket,wakeComputer,powerArguments,CATALOG,featureCatalog,normalizeLessonAction};
