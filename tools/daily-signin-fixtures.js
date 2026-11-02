"use strict";
// Public, synthetic interoperability vectors. Never use this seed outside tests.
const crypto=require("node:crypto"),{dailyCode,dayAt,FORMAT}=require("../src/daily-signin");
const seed=Buffer.from(Array.from({length:32},(_,i)=>i)),groupId="00112233-4455-4677-8899-aabbccddeeff";
const vectors=["2026-10-29T03:59:59Z","2026-10-29T04:00:00Z","2026-11-01T05:30:00Z","2026-11-01T06:30:00Z","2026-03-08T06:59:59Z","2026-03-08T07:00:00Z"].map(now=>{const day=dayAt("America/New_York",new Date(now));return {now,day,code:dailyCode(seed,groupId,day)};});
const passphrase="synthetic enrollment test only",salt=Buffer.alloc(16,3),nonce=Buffer.alloc(12,4);
const key=crypto.pbkdf2Sync(passphrase,salt,600000,32,"sha256"),cipher=crypto.createCipheriv("aes-256-gcm",key,nonce);cipher.setAAD(Buffer.from(FORMAT));
const policy={format:FORMAT,groupId,groupName:"Synthetic",timeZone:"America/New_York",computerName:"TEST-PC",username:"esports",seed:seed.toString("base64"),issuedAt:"2026-10-29T12:00:00Z",expiresAt:"2026-10-30T12:00:00Z"};
const ciphertext=Buffer.concat([cipher.update(JSON.stringify(policy)),cipher.final()]);
process.stdout.write(JSON.stringify({seed:seed.toString("base64"),groupId,vectors,passphrase,envelope:{format:FORMAT,iterations:600000,salt:salt.toString("base64"),nonce:nonce.toString("base64"),ciphertext:ciphertext.toString("base64"),tag:cipher.getAuthTag().toString("base64")}}));
