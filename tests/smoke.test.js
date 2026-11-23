import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';

test('isolated fictional app: login, tenant boundaries, queue persistence and simulated SMTP', async () => {
 const password = randomBytes(24).toString('hex');
 const port = 8973;
 const child = spawn(process.execPath, ['server.js'], {env: {...process.env, DEMO_MODE:'true', DEMO_PASSWORD:password, PORT:String(port), HOST:'127.0.0.1', DATABASE_URL:''}, stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const base='http://127.0.0.1:'+port;
 const req = async (path,token,body) => {
  const response = await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
 };
 try {
  let ready=false;
  for(let i=0;i<120;i++) {try {const response=await fetch(base+'/api/announcement');if(response.ok){ready=true;break}}catch{};await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'application did not become ready: '+logs.replace(password,'[REDACTED]'));
  assert.equal((await fetch(base+'/')).status,200);
  assert.equal((await req('/api/leads')).status,401);
  const first=await req('/api/auth/login',null,{email:'operator@example.com',password});
  const second=await req('/api/auth/login',null,{email:'second@example.org',password});
  assert.equal(first.status,200);assert.equal(second.status,200);
  const a=first.data.token,b=second.data.token;assert.ok(a&&b);
  assert.equal((await req('/api/leads',a)).data.length,2);
  assert.equal((await req('/api/leads',b)).data.length,1);
  const queued=(await req('/api/queue',a)).data;
  assert.equal(queued.length,1);assert.equal(queued[0].email_sent,3);
  assert.equal((await req('/api/queue',b)).data.length,0);
  assert.equal((await req('/api/admin/users',a)).status,403);
  assert.equal((await req('/api/scraper/search',a,{query:'fictional'})).status,403);
  const sent=await req('/api/queue/send-now',a,{email:'team@example.org',subject:'Fictional subject',body:'No actual delivery'});assert.equal(sent.status,200);
  await new Promise(r=>setTimeout(r,200));
  const after=(await req('/api/leads',a)).data.find(l=>l.email==='team@example.org');assert.equal(after.email_sent,1);
  assert.equal((await req('/api/leads',b)).data.length,1);
 } finally {if(child.exitCode === null) {const ended=once(child,'exit');child.kill('SIGTERM');await ended;}}
});
