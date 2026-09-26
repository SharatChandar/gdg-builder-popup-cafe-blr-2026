import {chromium} from '@playwright/test';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.argv[2];const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('heading',{name:'Hello, coffee person.'}).waitFor();assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth),390);assert.equal(await page.getByText('Demo café',{exact:false}).count(),0);
 await page.screenshot({path:'.data/live-mobile.png',fullPage:true});
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Seats',exact:true}).click();await page.getByRole('button',{name:'Table 1, available, 2 seats',exact:true}).waitFor();
 await page.getByRole('button',{name:'Your profile',exact:true}).click();await page.getByRole('heading',{name:'Your visits, together.'}).waitFor();assert.equal(await page.getByText('Phone login needs Firebase configuration.',{exact:false}).count(),0);
 const credentials=await readFile('.data/staff-access.txt','utf8');const password=credentials.split('\n').find(l=>l.startsWith('owner (')).split(': ')[1];
 await page.goto(base+'/staff');await page.getByLabel('Staff username').fill('owner');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Open staff space'}).click();await page.getByRole('heading',{name:'On the floor.'}).waitFor();await page.getByRole('button',{name:'Team',exact:true}).click();await page.getByRole('heading',{name:'Staff accounts'}).waitFor();await page.screenshot({path:'.data/live-staff.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Live mobile layout, available tables, Firebase login UI, individual staff login and team screen verified. No operational records created.');
}finally{await browser.close();}
