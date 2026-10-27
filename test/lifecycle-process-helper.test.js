"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {waitFor}=require("./helpers/lifecycle-process.cjs");

test("lifecycle readiness budgets survive wall-clock corrections",async()=>{
  const original=Date.now;
  let clock=original(),checks=0;
  Date.now=()=>{clock+=20000;return clock};
  try{
    await waitFor(()=>++checks===3,"fixture readiness");
    assert.equal(checks,3);
  }finally{Date.now=original}
});
