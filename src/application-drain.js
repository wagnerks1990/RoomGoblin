"use strict";

const {METHODS}=require("node:http");
const {setTimeout:delay}=require("node:timers/promises");

// A response closing does not cancel its async handler. Track returned promises
// through this application's public registration methods, including bridge
// registrations, without changing Express prototypes or inspecting its stack.
function trackApplicationHandlers(app){
  let pending=0;
  const handlers=new WeakMap(),routes=new WeakSet();
  function invoke(handler,self,args){
    const result=handler.apply(self,args);
    if(!result||typeof result.then!=="function")return result;
    pending++;
    return Promise.resolve(result).finally(()=>{pending--});
  }
  function wrap(value){
    if(Array.isArray(value))return value.map(wrap);
    if(typeof value!=="function")return value;
    if(handlers.has(value))return handlers.get(value);
    // Express uses arity to distinguish error middleware. Preserve rejection
    // propagation and next('route')/next('router') semantics.
    const wrapped=value.length===4
      ? function(error,req,res,next){return invoke(value,this,[error,req,res,next])}
      : function(req,res,next){
        // A disconnected body parser can call next after HTTP close. Do not
        // start another handler for that abandoned request.
        if(req.aborted)return;
        return invoke(value,this,[req,res,next]);
      };
    handlers.set(value,wrapped);handlers.set(wrapped,wrapped);
    return wrapped;
  }
  const route=app.route,use=app.use;
  app.route=function(...args){
    const result=route.apply(this,args);
    if(!routes.has(result)){
      routes.add(result);
      for(const method of [...METHODS.map(name=>name.toLowerCase()),"all"]){
        if(typeof result[method]!=="function")continue;
        const register=result[method];
        result[method]=function(...callbacks){return register.apply(this,callbacks.map(wrap))};
      }
    }
    return result;
  };
  app.use=function(...args){return use.apply(this,args.map(wrap))};
  return {get pending(){return pending}};
}

async function waitUntilDrained(ready){
  while(!ready())await delay(25);
}

function closeWebSockets(server){
  return new Promise((resolve,reject)=>{
    // A client may never acknowledge a close frame. Its close callbacks must
    // still run before SQLite closes, so bound the handshake and await close.
    const timer=setTimeout(()=>{for(const client of server.clients)client.terminate()},1000);
    server.close(error=>{clearTimeout(timer);error?reject(error):resolve()});
    for(const client of server.clients)client.close(1001,"Server shutting down");
  });
}

module.exports={trackApplicationHandlers,waitUntilDrained,closeWebSockets};
