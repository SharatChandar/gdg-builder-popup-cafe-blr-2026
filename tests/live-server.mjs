import {spawn} from 'node:child_process';
import {scryptSync} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const path=await mkdtemp(`${tmpdir()}/cafe-live-verification-`);
const password='integration-private-pass';const salt='abcdef1234567890';
const users=['owner','barista','floor'].map(role=>({username:role,role,active:true,passwordHash:salt+':'+scryptSync(password,salt,64).toString('hex')}));
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',DEMO_MODE:'false',DATA_STORE:'pglite',DATA_PATH:path,PORT:'8083',PUBLIC_URL:'https://cafe.test',SESSION_SECRET:'test-session-secret-at-least-32-characters',STAFF_ACCOUNTS_JSON:JSON.stringify(users)},stdio:'pipe'});
let stderr='';server.stderr.on('data',d=>stderr+=d);
async function call(route,body,cookie=''){
 const response=await fetch('http://localhost:8083/api'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
try{
 for(let i=0;i<600;i++){try{if((await call('/health')).status===200)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 const guest=await call('/session',{});assert.equal(guest.body.demo,false);assert.equal(guest.body.localDemoPin,false);
 let state=(await call('/state',undefined,guest.cookie)).body;
 assert.equal(state.tables.every(t=>t.status==='available'),true);assert.deepEqual(state.orders,[]);assert.deepEqual(state.requests,[]);
 const staff={};for(const username of ['owner','barista','floor']){staff[username]=(await call('/staff/login',{username,password})).cookie;assert.ok(staff[username]);}
 assert.equal((await call('/staff/login',{pin:'2468'})).status,401);
 for(const role of Object.keys(staff)){
  const data=(await call('/staff',undefined,staff[role])).body;
  assert.equal(data.staffAccount.role,role);assert.equal(data.staffUsers,undefined);assert.equal(JSON.stringify(data).includes('passwordHash'),false);
 }
 assert.equal((await call('/staff/settings',{acceptOrders:false},staff.floor)).status,403);
 assert.equal((await call('/staff/receipts',{confirmed:true},staff.barista)).status,403);
 assert.equal((await call('/tables/claim',{tableId:'T01',partySize:2},guest.cookie)).status,200);
 assert.equal((await call('/staff/tables/T01',{action:'seat'},staff.floor)).status,200);
 const order=(await call('/orders',{requestId:'live-integration',name:'Verification',service:'dine-in',items:[{id:'flat-white',quantity:1}]},guest.cookie)).body;
 assert.ok(order.id,JSON.stringify(order));
 state=(await call('/state',undefined,guest.cookie)).body;
 const bill=state.bills[0];const share=bill.shares[0];const token=share.link.split('/pay/')[1];
 assert.equal((await call('/pay/'+token,{})).status,503);
 for(const status of ['preparing','ready','served'])assert.equal((await call('/staff/orders/'+order.id,{status},staff.barista)).status,200);
 assert.equal((await call('/staff/receipts',{billId:bill.id,shareId:share.id,confirmed:false},staff.floor)).status,400);
 assert.equal((await call('/staff/receipts',{billId:bill.id,shareId:share.id,confirmed:true},staff.floor)).status,200);
 assert.equal((await call('/pay/'+token)).body.status,'paid');
 assert.equal((await call('/staff/receipts',{billId:bill.id,shareId:share.id,confirmed:true},staff.floor)).status,409);
 console.log('Live-mode integration passed: empty operations, 3 staff roles, private hashes, real table/order transitions, blocked simulated payment, audited counter receipt.');
}finally{server.kill();await new Promise(r=>server.once('exit',r));await rm(path,{recursive:true,force:true});if(stderr)console.error(stderr);}
