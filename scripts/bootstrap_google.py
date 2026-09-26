"""Idempotent MVP bootstrap. Credentials are captured in memory, never printed."""
import argparse, hashlib, json, os, pathlib, secrets, subprocess, time, urllib.request, urllib.error
p=argparse.ArgumentParser();p.add_argument('--project',required=True);p.add_argument('action',choices=['firebase','secrets','database','auth-domain','verify-gemini','staff']);p.add_argument('--domain');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent
private=root/'.data';private.mkdir(exist_ok=True)
def gc(*parts,input=None):
 r=subprocess.run(['gcloud',*parts,'--project='+args.project,'--quiet'],input=input,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr[:1500])
 return r.stdout.strip()
token=gc('auth','print-access-token')
def req(url,method='GET',body=None):
 data=None if body is None else json.dumps(body).encode()
 request=urllib.request.Request(url,data=data,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','x-goog-user-project':args.project})
 try:
  with urllib.request.urlopen(request,timeout=60) as response:
   raw=response.read();return json.loads(raw) if raw else {}
 except urllib.error.HTTPError as error:
  detail=json.loads(error.read() or b'{}').get('error',{});raise RuntimeError(f"HTTP {error.code}: {detail.get('message','API request failed')}") from None

def wait_operation(base,op):
 for _ in range(25):
  if op.get('done'):
   if op.get('error'):raise RuntimeError(op['error'].get('message','Operation failed'))
   return op.get('response',{})
  time.sleep(2);op=req(base+'/'+op['name'])
 raise RuntimeError('Operation is still running; re-run this step.')

def secret(name):return gc('secrets','versions','access','latest','--secret='+name)
def save_private(path,value):
 fd=os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f:f.write(value)

if args.action=='firebase':
 base='https://firebase.googleapis.com/v1beta1';project=base+'/projects/'+args.project
 try:req(project)
 except RuntimeError as e:
  if 'HTTP 404' not in str(e):raise
  op=req(project+':addFirebase','POST',{});wait_operation(base,op)
 apps=req(project+'/webApps').get('apps',[])
 app=next((a for a in apps if a.get('displayName')=='Common Ground Café'),None)
 if not app:app=wait_operation(base,req(project+'/webApps','POST',{'displayName':'Common Ground Café'}))
 config=req(base+'/'+app['name']+'/config')
 save_private(private/'firebase-web-config.json',json.dumps(config,indent=2))
 print(json.dumps({'firebaseProject':args.project,'webApp':app['appId'],'configSaved':True}))
elif args.action=='secrets':
 existing=set(gc('secrets','list','--format=value(name)').splitlines())
 for name,value in [('cafe-session-secret',secrets.token_urlsafe(48)),('cafe-staff-pin',str(secrets.randbelow(90000000)+10000000)),('cafe-db-password',secrets.token_urlsafe(32))]:
  if name not in existing:gc('secrets','create',name,'--replication-policy=automatic','--data-file=-',input=value)
  print(name+': ready')
 if 'cafe-gemini-key' not in existing:
  gc('services','api-keys','create','--key-id=common-ground-gemini-live','--display-name=Common Ground Gemini live','--api-target=service=generativelanguage.googleapis.com','--format=value(name)')
  key=gc('services','api-keys','get-key-string','common-ground-gemini-live','--location=global','--format=value(keyString)')
  gc('secrets','create','cafe-gemini-key','--replication-policy=automatic','--data-file=-',input=key)
 print('cafe-gemini-key: ready')
 save_private(private/'deployment-access.txt','Project: '+args.project+'\nStaff PIN: '+secret('cafe-staff-pin')+'\nStored privately; do not commit or share publicly.\n')
elif args.action=='staff':
 existing=set(gc('secrets','list','--format=value(name)').splitlines())
 if 'cafe-staff-accounts' not in existing:
  accounts=[]; access=['Project: '+args.project,'Staff sign-in: /staff','Keep these passwords private.']
  for username,role in [('owner','owner'),('barista','barista'),('floor','floor')]:
   password=secrets.token_urlsafe(18);salt=secrets.token_hex(16)
   hashed=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1,dklen=64).hex()
   accounts.append({'username':username,'role':role,'active':True,'passwordHash':salt+':'+hashed})
   access.append(username+' ('+role+'): '+password)
  save_private(private/'staff-access.txt','\n'.join(access)+'\n')
  gc('secrets','create','cafe-staff-accounts','--replication-policy=automatic','--data-file=-',input=json.dumps(accounts))
 print('Three individual staff accounts configured. Credentials are in .data/staff-access.txt (private).')
elif args.action=='database':
 base=f'https://sqladmin.googleapis.com/sql/v1beta4/projects/{args.project}/instances/common-ground-db'
 instance=req(base);assert instance['state']=='RUNNABLE','Database is still provisioning.'
 if not any(d['name']=='cafe' for d in req(base+'/databases').get('items',[])):
  req(base+'/databases','POST',{'name':'cafe'});print('Database creation requested.')
 if not any(u['name']=='cafe' for u in req(base+'/users').get('items',[])):
  req(base+'/users','POST',{'name':'cafe','password':secret('cafe-db-password')});print('Database user creation requested.')
 print('Cloud SQL connection: '+instance['connectionName'])
elif args.action=='auth-domain':
 url=f'https://identitytoolkit.googleapis.com/admin/v2/projects/{args.project}/config'
 try:config=req(url)
 except RuntimeError as e:
  if 'CONFIGURATION_NOT_FOUND' not in str(e):raise
  req(f'https://identitytoolkit.googleapis.com/v2/projects/{args.project}/identityPlatform:initializeAuth','POST',{})
  config=req(url)
 domains=config.get('authorizedDomains',[])
 if args.domain and args.domain not in domains:domains.append(args.domain)
 result=req(url+'?updateMask=authorizedDomains,signIn.phoneNumber.enabled,smsRegionConfig','PATCH',{'authorizedDomains':domains,'signIn':{'phoneNumber':{'enabled':True}},'smsRegionConfig':{'allowlistOnly':{'allowedRegions':['IN']}}})
 print(json.dumps({'phoneEnabled':result.get('signIn',{}).get('phoneNumber',{}).get('enabled'),'authorizedDomains':result.get('authorizedDomains'),'smsRegions':['IN']}))
elif args.action=='verify-gemini':
 key=secret('cafe-gemini-key')
 request=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',data=json.dumps({'contents':[{'parts':[{'text':'Respond only with OK.'}]}],'generationConfig':{'maxOutputTokens':16,'thinkingConfig':{'thinkingLevel':'low'}}}).encode(),headers={'Content-Type':'application/json','x-goog-api-key':key},method='POST')
 try:
  with urllib.request.urlopen(request,timeout=45) as r:body=json.load(r)
  print(json.dumps({'geminiReachable':bool(body.get('candidates'))}))
 except urllib.error.HTTPError as e:
  error=json.loads(e.read()).get('error',{});print(json.dumps({'geminiReachable':False,'status':e.code,'message':error.get('message','API error')}))
