import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const nav=async(page,route)=>page.locator(`[data-action="nav-${route}"]`).first().click();
async function addProduct(page,name,sku,cost,price,quantity,category='Accessories'){
 await page.locator('[data-action=add-product]').first().click();
 const form=page.locator('#product-form');
 for(const [field,value] of Object.entries({name,sku,cost,price,quantity,category}))await form.locator(`[name=${field}]`).fill(String(value));
 await form.locator('[name=supplier]').fill('Test supplier');
 await form.getByRole('button',{name:'Save Product',exact:true}).click();await expect(form).toHaveCount(0);
}
const snapshot=page=>page.evaluate(async()=> (await import('./js/db.js')).getSnapshot());
async function seed(page,rows){await page.evaluate(async rows=>(await import('./js/db.js')).importProducts(rows),rows);await page.reload();await expect(page.locator('#side-nav')).toContainText('Products');}
const sample=(overrides={})=>({name:'Cable',sku:'CABLE',cost:2,price:5,quantity:50,category:'Cables',...overrides});
async function checkout(page){await page.locator('[data-action=checkout]').click();await page.locator('[data-action=confirm-checkout]').click();await expect(page.locator('#receipt-content')).toBeVisible();await page.keyboard.press('Escape');}

test('five product acceptance workflow: edit, multi sale, restock, reports, backup, isolated restore',async({page,browser})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 for(const args of [['USB Cable','USB',2,5,50,'Cables'],['Charger','CHG',4,8,20,'Power'],['Earphones','EAR',3,7,12,'Audio'],['Mouse Pad','PAD',1.5,4,0,'Accessories'],['Phone Case','CASE',1,3,6,'Accessories']])await addProduct(page,...args);
 let data=await snapshot(page);expect(data.products).toHaveLength(5);
 await nav(page,'products');await page.getByRole('button',{name:'Edit USB Cable',exact:true}).click();
 await page.locator('#product-form [name=name]').fill('USB Cable Pro');await page.locator('#product-form [name=price]').fill('6');await page.getByRole('button',{name:'Save Product',exact:true}).click();
 await nav(page,'sales');await page.locator('.sale-product').filter({hasText:'USB Cable Pro'}).getByRole('button',{name:'Add to Cart'}).click();
 await page.locator('[data-cart-id]').fill('5');await page.locator('[data-cart-id]').press('Tab');
 await page.locator('.sale-product').filter({hasText:'Charger'}).getByRole('button',{name:'Add to Cart'}).click();
 const charger=data.products.find(p=>p.sku==='CHG');await page.locator(`[data-cart-id="${charger.id}"]`).fill('2');await page.locator(`[data-cart-id="${charger.id}"]`).press('Tab');
 await page.locator('#sale-customer').fill('Test customer');await page.locator('#sale-note').fill('Cash');await checkout(page);
 data=await snapshot(page);expect(data.sales).toHaveLength(1);expect(data.sales[0].totalMinor).toBe(4600);expect(data.products.find(p=>p.sku==='USB').quantity).toBe(45);expect(data.products.find(p=>p.sku==='CHG').quantity).toBe(18);
 await nav(page,'restock');await page.locator('#stock-select').selectOption(data.products.find(p=>p.sku==='EAR').id);await page.locator('#stock-form [name=amount]').fill('20');await page.locator('#stock-form [name=note]').fill('New delivery');await page.locator('#stock-form button[type=submit]').click();
 await expect.poll(async()=>(await snapshot(page)).products.find(p=>p.sku==='EAR').quantity).toBe(32);
 await nav(page,'dashboard');await expect(page.locator('#main')).toContainText('Recent sales');await expect(page.locator('#main')).toContainText('Recent restocks');await expect(page.locator('#main')).toContainText('Recent adjustments');await expect(page.locator('#main')).toContainText('$46.00');await expect(page.locator('#main')).toContainText('$28.00');await expect(page.locator('#main')).toContainText('$264.00');
 await expect(page.locator('.toast')).toHaveCount(0);await page.screenshot({path:'test-results/acceptance-desktop.png',fullPage:true});
 await nav(page,'reports');await expect(page.locator('#main')).toContainText('$18.00');await expect(page.locator('#main')).toContainText('$28.00');
 await page.locator('#report-period').selectOption('custom');await page.locator('#report-from').fill('2000-01-01');await page.locator('#report-to').fill('2000-01-31');await expect(page.locator('.stat-value').first()).toHaveText('$0.00');
 await page.reload();expect((await snapshot(page)).products).toHaveLength(5);
 await nav(page,'backup');const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=download-backup]').click();const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/^SmartStock_Backup_\d{4}-\d{2}-\d{2}.json$/);const buffer=await fs.readFile(await download.path());const backup=JSON.parse(buffer);expect(backup.version).toBe(2);expect(backup.data.products).toHaveLength(5);expect(backup.data.sales[0].customer).toBe('Test customer');expect(backup.data.suppliers).toHaveLength(1);
 const isolated=await browser.newContext();const restored=await isolated.newPage();await restored.goto('/');await nav(restored,'backup');await restored.locator('#restore-file').setInputFiles({name:'restore.json',mimeType:'application/json',buffer});
 await expect(restored.getByRole('dialog')).toContainText('5 Products');await restored.locator('[data-action=confirm-restore]').click();await expect.poll(async()=>(await snapshot(restored)).products.length).toBe(5);
 expect((await snapshot(restored)).sales[0].totalMinor).toBe(4600);await isolated.close();expect(errors).toEqual([]);
});

test('search, category, stock filters, sorting, details, archive and safe delete',async({page})=>{
 await page.goto('/');await seed(page,[sample(),sample({name:'Alpha',sku:'A',quantity:2,category:'Other',price:10}),sample({name:'Zero',sku:'Z',quantity:0})]);await nav(page,'products');
 await page.locator('#product-search').fill('Alpha');await expect(page.locator('.data-table tbody tr')).toHaveCount(1);await page.locator('#product-search').fill('');
 await page.locator('#product-category').selectOption('Other');await expect(page.locator('.data-table tbody tr')).toHaveCount(1);await page.locator('#product-category').selectOption('all');
 await page.locator('#product-filter').selectOption('low');await expect(page.locator('.data-table tbody')).toContainText('Alpha');await page.locator('#product-filter').selectOption('out');await expect(page.locator('.data-table tbody')).toContainText('Zero');await page.locator('#product-filter').selectOption('all');
 for(const [value,first] of [['name','Alpha'],['quantity','Zero'],['price','Alpha']]){await page.locator('#product-sort').selectOption(value);await expect(page.locator('.data-table tbody tr').first()).toContainText(first);}
 await page.locator('[data-action=product-details]').first().click();await expect(page.getByRole('dialog')).toContainText('Last updated');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Archive / Reactivate Cable',exact:true}).click();await page.locator('[data-action=confirm-archive]').click();await expect(page.locator('.data-table tbody tr')).toHaveCount(2);
 await page.locator('#archived-filter').check();await expect(page.locator('.data-table tbody')).toContainText('Cable');await page.getByRole('button',{name:'Delete Cable',exact:true}).click();await page.locator('[data-action=confirm-delete]').click();await expect(page.locator('.toast-error').last()).toContainText('archived');
 await page.getByRole('button',{name:'Reactivate Cable',exact:true}).click();await page.locator('[data-action=confirm-archive]').click();await page.locator('#archived-filter').uncheck();await page.getByRole('button',{name:'Delete Zero',exact:true}).click();await page.locator('[data-action=confirm-delete]').click();await expect.poll(async()=>(await snapshot(page)).products.length).toBe(2);
});

test('partial return, receipt, history search and void preserve stock exactly',async({page})=>{
 await page.goto('/');await seed(page,[sample()]);await nav(page,'sales');await page.getByRole('button',{name:'Add to Cart'}).click();await page.locator('[data-cart-id]').fill('5');await page.locator('[data-cart-id]').press('Tab');await checkout(page);
 await page.locator('[data-action=return-sale]').click();await page.locator('[data-return-id]').fill('2');await page.locator('#return-form [name=reason]').fill('Customer returned two');await page.getByRole('button',{name:'Confirm return',exact:true}).click();
 await expect.poll(async()=>(await snapshot(page)).products[0].quantity).toBe(47);await expect(page.locator('.data-table')).toContainText('$15.00');
 await page.locator('#history-search').fill('not-found');await expect(page.locator('.data-table')).toHaveCount(0);await page.locator('#history-search').fill('Cable');await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
 await page.locator('[data-action=receipt]').click();await expect(page.locator('#receipt-content')).toContainText('Refunded: $10.00');await page.keyboard.press('Escape');
 await page.locator('[data-action=void-sale]').click();await page.locator('[data-action=confirm-void]').click();await expect.poll(async()=>(await snapshot(page)).products[0].quantity).toBe(50);
 await expect(page.locator('.data-table')).toContainText('Voided');await expect(page.locator('[data-action=void-sale]')).toHaveCount(0);expect((await snapshot(page)).returns).toHaveLength(2);
});

test('CSV template round trip, validation, exports and thousands of paged products',async({page})=>{
 await page.goto('/');await nav(page,'backup');let promise=page.waitForEvent('download');await page.locator('[data-action=download-template]').click();let download=await promise;let buffer=await fs.readFile(await download.path());
 await page.locator('#csv-file').setInputFiles({name:'template.csv',mimeType:'text/csv',buffer});await expect.poll(async()=>(await snapshot(page)).products.length).toBe(1);
 await page.locator('#csv-file').setInputFiles({name:'duplicate.csv',mimeType:'text/csv',buffer});await expect(page.locator('.toast-error').last()).toContainText('Duplicate SKU');expect((await snapshot(page)).products).toHaveLength(1);
 await seed(page,Array.from({length:1000},(_,i)=>sample({name:`Item ${String(i).padStart(4,'0')}`,sku:`SKU-${i}`})));
 await nav(page,'products');await expect(page.locator('.data-table tbody tr')).toHaveCount(25);await expect(page.locator('.pagination')).toContainText('1001');await page.locator('[data-action=page-next]').click();await expect(page.locator('.data-table tbody tr').first()).toContainText('Item 0025');
 await page.locator('#product-search').fill('SKU-999');await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
 promise=page.waitForEvent('download');await page.locator('[data-action=csv-products]').click();download=await promise;expect((await fs.readFile(await download.path(),'utf8'))).toContain('SKU-999');
});

test('two tabs serialize stock and detect stale edit',async({page,context})=>{
 await page.goto('/');await seed(page,[sample({quantity:5})]);const second=await context.newPage();await second.goto('/');await expect(second.locator('#main')).toContainText('Cable');
 const id=(await snapshot(page)).products[0].id;
 const results=await Promise.all([page,second].map(p=>p.evaluate(async id=>{try{await (await import('./js/db.js')).createSale([{productId:id,quantity:4}]);return 'ok';}catch(e){return e.message;}},id)));
 expect(results.filter(r=>r==='ok')).toHaveLength(1);expect((await snapshot(page)).products[0].quantity).toBe(1);
 await nav(page,'products');await page.getByRole('button',{name:'Edit Cable',exact:true}).click();await page.locator('#product-form [name=name]').fill('Stale edit');
 await second.evaluate(async id=>{const db=await import('./js/db.js');await db.adjustStock(id,1,'restock','Other tab');},id);
 await page.getByRole('button',{name:'Save Product',exact:true}).click();await expect(page.locator('.toast-error').last()).toContainText('changed in another tab');expect((await snapshot(page)).products[0].name).toBe('Cable');
});

test('settings, Khmer, keyboard focus, mobile navigation and destructive confirmation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#mobile-menu').click();await nav(page,'settings');
 await page.locator('#settings-form [name=shopName]').fill('My Test Shop');await page.locator('#settings-form [name=shopDetails]').fill('Phnom Penh');await page.locator('#settings-form [name=currency]').selectOption('KHR');await page.locator('#settings-form [name=appearance]').selectOption('compact');await page.locator('#settings-form button[type=submit]').click();
 await page.locator('#lang-km').click();await expect(page.locator('html')).toHaveAttribute('lang','km');await expect(page.locator('#main')).toContainText('ការកំណត់');await page.evaluate(()=>scrollTo(0,0));await expect(page.locator('.toast')).toHaveCount(0);await page.screenshot({path:'test-results/acceptance-mobile-khmer.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#lang-en').click();await page.locator('#mobile-menu').click();await nav(page,'products');await addProduct(page,'KHR product','KHR',2000,4000,10);await page.reload();expect((await snapshot(page)).products).toHaveLength(1);
 await page.locator('[data-action=add-product]').first().click();await page.locator('#product-form [name=name]').focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('button[data-action=close-modal]').first()).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.locator('#product-form button[type=submit]')).toBeFocused();await page.keyboard.press('Escape');
 await page.locator('#mobile-menu').click();await nav(page,'settings');await page.locator('[data-action=clear-data]').click();await page.locator('#clear-form [name=confirmation]').fill('no');await page.locator('#clear-form button').click();expect((await snapshot(page)).products).toHaveLength(1);
 await page.locator('#clear-form [name=confirmation]').fill('DELETE ALL DATA');await page.locator('#clear-form button').click();await expect.poll(async()=>(await snapshot(page)).products.length).toBe(0);
});

test('offline shell and writes work under the GitHub Pages subdirectory',async({page,context,request})=>{
 for(const path of ['/.git/config','/.env','/README.md','/SmartStock_Backup_2026-01-01.json'])expect((await request.get(path)).status()).toBe(404);
 await page.goto('/SmartStock_POS/');await expect(page.locator('#main')).toContainText('My Inventory');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 expect(await page.evaluate(async()=> (await navigator.serviceWorker.getRegistration()).scope)).toContain('/SmartStock_POS/');
 await context.setOffline(true);await page.reload();await expect(page.locator('#main')).toContainText('My Inventory');await addProduct(page,'Offline cable','OFFLINE',1,3,20);
 await nav(page,'sales');await page.getByRole('button',{name:'Add to Cart'}).click();await checkout(page);await page.reload();
 expect((await page.evaluate(async()=>(await import('./js/db.js')).getSnapshot())).products[0].quantity).toBe(19);
 await nav(page,'reports');await expect(page.locator('#main')).toContainText('$3.00');
 const cacheURLs=await page.evaluate(async()=>{const cache=await caches.open('smartstock-app-v2.0.0');return (await cache.keys()).map(r=>r.url);});expect(cacheURLs.every(url=>!url.includes('backup.json'))).toBe(true);
 await context.setOffline(false);
});

test('user text is escaped and invalid restore leaves records untouched',async({page})=>{
 await page.goto('/');await addProduct(page,'<img src=x onerror=alert(1)>','XSS',1,2,3);await expect(page.locator('#main img')).toHaveCount(0);
 await nav(page,'backup');await page.locator('#restore-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"smartstock-backup","version":999,"data":{}}')});await expect(page.locator('.toast-error').last()).toContainText('supported');expect((await snapshot(page)).products).toHaveLength(1);
});

test('full return button, duplicate submit protection and printable receipt',async({page})=>{
 await page.goto('/');await seed(page,[sample({quantity:10})]);await nav(page,'sales');await page.getByRole('button',{name:'Add to Cart'}).click();
 await page.locator('[data-cart-id]').fill('3');await page.locator('[data-cart-id]').press('Tab');await page.locator('[data-action=checkout]').click();
 await page.locator('[data-action=confirm-checkout]').evaluate(button=>{button.click();button.click();});await expect(page.locator('#receipt-content')).toBeVisible();expect((await snapshot(page)).sales).toHaveLength(1);
 await page.evaluate(()=>{window.print=()=>{window.__printed=true;};});await page.locator('[data-action=print-receipt]').click();expect(await page.evaluate(()=>window.__printed)).toBe(true);
 await page.emulateMedia({media:'print'});await expect(page.locator('#app')).toBeHidden();await expect(page.locator('#receipt-content')).toBeVisible();await page.pdf({path:'test-results/receipt.pdf',format:'A5'});await page.emulateMedia({media:'screen'});await page.keyboard.press('Escape');
 await page.locator('[data-action=return-sale]').click();await page.locator('[data-action=return-all]').click();await expect(page.locator('[data-return-id]')).toHaveValue('3');await page.locator('#return-form [name=reason]').fill('Full refund');await page.locator('#return-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
 await expect.poll(async()=>(await snapshot(page)).products[0].quantity).toBe(10);expect((await snapshot(page)).returns).toHaveLength(1);await expect(page.locator('[data-action=return-sale]')).toHaveCount(0);
});

test('every page fits phone and tablet widths and stock form validates adjustments',async({page})=>{
 await page.goto('/');await seed(page,[sample({name:'Long product name for a Cambodian retail store',quantity:2}),sample({name:'Other product',sku:'OTHER'})]);
 for(const width of [390,768]){
  await page.setViewportSize({width,height:844});
  for(const route of ['dashboard','products','sales','restock','reports','backup','settings']){
   if(width<760)await page.locator('#mobile-menu').click();await nav(page,route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} at ${width}px`).toBe(true);
  }
 }
 await page.setViewportSize({width:1280,height:800});await nav(page,'restock');const id=(await snapshot(page)).products.find(p=>p.sku==='CABLE').id;await page.locator('#stock-select').selectOption(id);
 await page.locator('#stock-form [name=direction]').selectOption('remove');await page.locator('#stock-form [name=amount]').fill('3');await page.locator('#stock-form [name=note]').fill('Damage');await page.locator('#stock-form button[type=submit]').click();await expect(page.locator('#stock-form .form-error')).toContainText('Only 2');
 await page.locator('#stock-form [name=amount]').fill('1');await page.locator('#stock-form button[type=submit]').click();await expect.poll(async()=>(await snapshot(page)).products.find(p=>p.id===id).quantity).toBe(1);
});

test('an existing version 1 browser database upgrades without losing inventory',async({page})=>{
 await page.route('**/js/app.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* isolated legacy fixture setup */'}));
 await page.goto('/');await page.evaluate(async()=>{
  await new Promise((resolve,reject)=>{
   const request=indexedDB.open('smartstock-local-v1',1),at='2026-01-01T12:00:00.000Z';
   request.onupgradeneeded=()=>{
    const db=request.result;
    for(const table of ['products','sales','movements','settings'])db.createObjectStore(table,{keyPath:table==='settings'?'key':'id'});
    request.transaction.objectStore('products').put({id:'legacy-product',name:'Existing inventory',sku:'OLD',category:'Accessories',description:'Preserved',cost:2,price:5,quantity:40,lowStockAt:5,createdAt:at,updatedAt:at});
    request.transaction.objectStore('movements').put({id:'legacy-movement',productId:'legacy-product',productName:'Existing inventory',type:'initial',note:'Opening stock',delta:40,createdAt:at});
   };
   request.onsuccess=()=>{request.result.close();resolve();};request.onerror=()=>reject(request.error);
  });
 });
 await page.unroute('**/js/app.js');await page.reload();await expect(page.locator('#main')).toContainText('Existing inventory');
 const data=await snapshot(page);expect(data.products[0].quantity).toBe(40);expect(data.products[0].costMinor).toBe(200);
 expect(await page.evaluate(async()=>{const db=await import('./js/db.js');db.validateBackup(await db.exportBackup());return (await db.openDatabase()).version;})).toBe(2);
});
