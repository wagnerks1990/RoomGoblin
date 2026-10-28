"use strict";
// In-memory preference substitute with the same synchronous transaction boundary.
module.exports=values=>({
 getPreference:(key,fallback)=>values.has(key)?structuredClone(values.get(key)):fallback,
 setPreference:(key,value)=>values.set(key,structuredClone(value)),
 tx(fn){const before=structuredClone(values);try{return fn()}catch(error){values.clear();for(const [key,value]of before)values.set(key,value);throw error}}
});
