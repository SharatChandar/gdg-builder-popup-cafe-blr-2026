import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2];assert.ok(base?.startsWith('https://'));
const credentials=await readFile(new URL('../.data/staff-access.txt',import.meta.url),'utf8');
async function call(path,body,cookie=''){
 const res=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json();if(!res.ok)throw Error(path+': '+res.status+' '+JSON.stringify(data));
 return {data,cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
const session=await call('/session',{});assert.equal(session.data.demo,false);assert.equal(session.data.localDemoPin,false);assert.equal(session.data.staffPasswordLogin,true);assert.equal(session.data.aiEnabled,true);assert.ok(session.data.firebaseConfig);
const state=(await call('/state',undefined,session.cookie)).data;assert.equal(state.tables.length,10);
for(const username of ['owner','barista','floor']){
 const password=credentials.split('\n').find(l=>l.startsWith(username+' (')).split(': ')[1];
 const signed=await call('/staff/login',{username,password});const staff=(await call('/staff',undefined,signed.cookie)).data;
 assert.equal(staff.staffAccount.role,username);assert.equal(staff.staffUsers,undefined);assert.equal(JSON.stringify(staff).includes('passwordHash'),false);
 console.log(username+': live sign-in verified');
}
const draft=(await call('/ai/suggest',{text:'One flat white, standard milk'},session.cookie)).data;assert.equal(draft.items[0].id,'flat-white');
console.log(JSON.stringify({live:true,tables:state.tables.length,available:state.tables.filter(t=>t.status==='available').length,orders:state.orders.length,requests:state.requests.length,geminiDraft:draft.items,firebaseConfigured:true,onlinePayments:session.data.onlinePayments,smsInvites:session.data.smsEnabled}));
