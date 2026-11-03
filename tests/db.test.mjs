import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveProduct,getProducts,getMovements,getSales,getReturns,adjustStock,createSale,voidSale,returnSale,archiveProduct,deleteProduct,saveSettings,getSettings,exportBackup,restoreBackup,validateBackup,importProducts,clearAllData} from '../js/db.js';
import {computeMetrics,reportData,saleNet} from '../js/utils.js';
const product=(overrides={})=>saveProduct({name:'USB cable',sku:'USB',category:'Cables',cost:'1.25',price:'3.50',quantity:50,lowStockAt:5,...overrides});
const stock=async id=>(await getProducts()).find(p=>p.id===id).quantity;
beforeEach(()=>clearAllData('DELETE ALL DATA'));

test('add and edit persist all product fields; edit preserves audited stock',async()=>{
 const p=await product({supplier:'Local supplier',description:'Braided cable'});
 assert.equal(p.priceMinor,350);assert.equal(p.costMinor,125);assert.equal(p.status,'active');
 const edited=await saveProduct({...p,name:'New name',price:'4.10',quantity:999,expectedUpdatedAt:p.updatedAt},p.id);
 assert.equal(edited.quantity,50);assert.equal(edited.createdAt,p.createdAt);assert.equal(edited.supplier,'Local supplier');assert.equal(edited.priceMinor,410);
 assert.equal((await getMovements()).length,1);
});
test('invalid product and case insensitive duplicate SKU fail without writes',async()=>{
 await product();
 await assert.rejects(()=>product({sku:'usb'}),/already used/);
 for(const values of [{name:''},{price:-1},{cost:'1.005'},{quantity:1.2},{quantity:-1},{quantity:true},{price:'1e5'}])await assert.rejects(()=>product({...values,sku:''}));
 assert.equal((await getProducts()).length,1);
});
test('idempotent product submission writes one record and rejects mismatched reuse',async()=>{
 const input={name:'Pen',cost:1,price:2,quantity:4};
 const a=await saveProduct(input,null,'same-command'),b=await saveProduct(input,null,'same-command');
 assert.equal(a.id,b.id);assert.equal((await getProducts()).length,1);assert.equal((await getMovements()).length,1);
 await assert.rejects(()=>saveProduct({...input,name:'Other'},null,'same-command'),/already used/);
});
test('archive hides an identity without destroying stock or sales; safe deletion only unused',async()=>{
 const p=await product();const sale=await createSale([{productId:p.id,quantity:2}]);
 await archiveProduct(p.id);assert.equal((await getProducts())[0].status,'archived');
 await assert.rejects(()=>createSale([{productId:p.id,quantity:1}]),/archived/);
 await assert.rejects(()=>deleteProduct(p.id),/archived/);
 await voidSale(sale.id);assert.equal(await stock(p.id),50);
 await archiveProduct(p.id,false);assert.equal((await getProducts())[0].status,'active');
 const unused=await product({sku:'UNUSED',quantity:0});await deleteProduct(unused.id);assert.equal((await getProducts()).length,1);
});
test('restock, adjustment, reasons and duplicate protection maintain movement history',async()=>{
 const p=await product();await createSale([{productId:p.id,quantity:5}]);assert.equal(await stock(p.id),45);
 await adjustStock(p.id,20,'restock','Delivery','delivery-1');await adjustStock(p.id,20,'restock','Delivery','delivery-1');assert.equal(await stock(p.id),65);
 await adjustStock(p.id,-60,'adjustment','Count correction');assert.equal(await stock(p.id),5);
 await assert.rejects(()=>adjustStock(p.id,-6,'adjustment','Damaged'),/Only 5/);
 await assert.rejects(()=>adjustStock(p.id,1,'adjustment',''),/reason/);
 assert.equal((await getMovements()).length,4);
 assert.equal(computeMetrics(await getProducts(),await getSales(),await getMovements(),await getReturns()).low,1);
});
test('single and multi item sale snapshot amounts and stock are atomic',async()=>{
 const a=await product({price:'0.10',cost:'0.03'}),b=await product({name:'Case',sku:'CASE',price:'0.20',cost:'0.05',quantity:10});
 const sale=await createSale([{productId:a.id,quantity:3},{productId:b.id,quantity:2}],'cash','Customer','checkout-1');
 assert.equal(sale.totalMinor,70);assert.equal(sale.costMinor,19);assert.equal(sale.currency,'USD');assert.equal(sale.customer,'Customer');
 await createSale([{productId:a.id,quantity:3},{productId:b.id,quantity:2}],'cash','Customer','checkout-1');
 assert.equal(await stock(a.id),47);assert.equal(await stock(b.id),8);assert.equal((await getSales()).length,1);
 await saveProduct({...a,price:'10.00',cost:'8.00'},a.id);assert.equal((await getSales())[0].totalMinor,70);
 const before=await exportBackup();await assert.rejects(()=>createSale([{productId:a.id,quantity:1},{productId:b.id,quantity:99}]),/Not enough stock/);
 assert.deepEqual((await exportBackup()).data,before.data);
 await assert.rejects(()=>createSale([{productId:a.id,quantity:1,expectedPriceMinor:10}]),/price changed/);
});
test('concurrent sales and restocks serialize without overselling or lost stock',async()=>{
 const p=await product({quantity:5});
 const sales=await Promise.allSettled([createSale([{productId:p.id,quantity:4}]),createSale([{productId:p.id,quantity:4}])]);
 assert.equal(sales.filter(r=>r.status==='fulfilled').length,1);assert.equal(await stock(p.id),1);
 await Promise.all([adjustStock(p.id,3,'restock','A'),adjustStock(p.id,7,'restock','B')]);assert.equal(await stock(p.id),11);
});
test('partial return then void restores only remaining quantities and reverses money once',async()=>{
 const a=await product(),b=await product({sku:'SECOND',name:'Case'});
 const sale=await createSale([{productId:a.id,quantity:5},{productId:b.id,quantity:2}]);
 const ret=await returnSale(sale.id,[{productId:a.id,quantity:2}],'Wrong size','return-1');assert.equal(ret.totalMinor,700);
 await returnSale(sale.id,[{productId:a.id,quantity:2}],'Wrong size','return-1');assert.equal(await stock(a.id),47);
 await assert.rejects(()=>returnSale(sale.id,[{productId:a.id,quantity:4}],'Too many'),/exceeds/);
 const before=await exportBackup();await assert.rejects(()=>returnSale(sale.id,[{productId:a.id,quantity:1},{productId:b.id,quantity:3}],'Invalid multi return'),/exceeds/);assert.deepEqual((await exportBackup()).data,before.data);
 await voidSale(sale.id);assert.equal(await stock(a.id),50);assert.equal(await stock(b.id),50);
 await assert.rejects(()=>voidSale(sale.id),/already been voided/);
 const metrics=computeMetrics(await getProducts(),await getSales(),await getMovements(),await getReturns());assert.equal(metrics.revenue,0);assert.equal(metrics.profit,0);
 assert.equal((await getReturns()).length,2);validateBackup(await exportBackup());
});
test('full return and repeated returns cannot double restock',async()=>{
 const p=await product();const s=await createSale([{productId:p.id,quantity:4}]);
 await returnSale(s.id,[{productId:p.id,quantity:4}],'Full refund');assert.equal(await stock(p.id),50);
 await assert.rejects(()=>returnSale(s.id,[{productId:p.id,quantity:1}],'Again'),/exceeds/);
 await assert.rejects(()=>voidSale(s.id),/No items remain/);assert.equal(saleNet((await getSales())[0]).revenueMinor,0);
 validateBackup(await exportBackup());
});
test('metrics and dated reports use integer snapshots and refund processing date',async()=>{
 const p=await product();const s=await createSale([{productId:p.id,quantity:5}]);await returnSale(s.id,[{productId:p.id,quantity:2}],'Return');
 const m=computeMetrics(await getProducts(),await getSales(),await getMovements(),await getReturns());
 assert.equal(m.products,1);assert.equal(m.units,47);assert.equal(m.inventoryCost,58.75);assert.equal(m.revenue,10.5);assert.equal(m.profit,6.75);assert.equal(m.todayRevenue,10.5);
 const sales=await getSales(),returns=await getReturns();sales[0].createdAt='2026-01-02T12:00:00.000Z';returns[0].createdAt='2026-02-03T12:00:00.000Z';
 assert.equal(reportData(sales,returns,'2026-01-01','2026-01-31').revenueMinor,1750);
 assert.equal(reportData(sales,returns,'2026-02-01','2026-02-28').revenueMinor,-700);
 assert.equal(reportData(sales,returns,'2025-01-01','2025-12-31').revenueMinor,0);
});
test('currency selection is validated and locked after data exists',async()=>{
 await saveSettings({currency:'KHR',language:'km',shopName:'Test shop',shopDetails:'Phnom Penh',appearance:'compact'});await product({price:4000,cost:2000});
 await assert.rejects(()=>saveSettings({currency:'USD'}),/locked/);assert.equal((await getSettings()).currency,'KHR');
 await assert.rejects(()=>saveSettings({language:'xx'}),/Invalid/);await assert.rejects(()=>saveSettings({defaultLowStock:-1}));
 const s=await createSale([{productId:(await getProducts())[0].id,quantity:1}]);assert.equal(s.currency,'KHR');
});
test('CSV bulk import validates all rows and duplicate archived SKU without partial changes',async()=>{
 const p=await product();await archiveProduct(p.id);
 await assert.rejects(()=>importProducts([{name:'New',sku:'NEW',cost:1,price:2,quantity:1},{name:'Duplicate',sku:'usb',cost:1,price:2,quantity:2}]),/Duplicate SKU/);
 assert.equal((await getProducts()).length,1);
 await importProducts([{name:'New',sku:'NEW',cost:1,price:2,quantity:1,supplier:'Supplier'}]);assert.equal((await getProducts()).length,2);
});
test('versioned backup includes all records and restores transactionally',async()=>{
 const p=await product({supplier:'Supplier'}),s=await createSale([{productId:p.id,quantity:5}]);await returnSale(s.id,[{productId:p.id,quantity:1}],'Return');
 const backup=await exportBackup();validateBackup(backup);assert.equal(backup.version,2);assert.equal(backup.data.suppliers.length,1);assert.equal(backup.data.categories.length,1);assert.equal(backup.data.returns.length,1);
 await product({sku:'SECOND'});await restoreBackup(backup);assert.deepEqual((await exportBackup()).data,backup.data);
 // A request-level structured clone failure after stores are cleared must roll back.
 const uncloneable=structuredClone(backup);uncloneable.data.products[0].unexpected=()=>{};
 await assert.rejects(()=>restoreBackup(uncloneable));assert.deepEqual((await exportBackup()).data,backup.data);
});
test('corrupt backup structures, arithmetic and foreign keys never replace current data',async()=>{
 const p=await product(),s=await createSale([{productId:p.id,quantity:2}]);await returnSale(s.id,[{productId:p.id,quantity:1}],'Returned');
 const original=await exportBackup();
 const mutations=[b=>b.version=999,b=>b.data.products[0].quantity=-1,b=>b.data.products[0].quantity++,b=>b.data.products[0].quantity='48',b=>b.data.products[0].revision='invalid',b=>b.data.sales[0].totalMinor++,b=>b.data.returns[0].items[0].productId='missing',b=>b.data.sales[0].items[0].returnedQuantity=0,b=>b.data.movements[0].saleId='missing',b=>b.data.movements[0].returnId='missing',b=>b.data.settings.push({key:'currency',value:'BAD'}),b=>b.data.products.push({...b.data.products[0],id:'new'})];
 for(const change of mutations){const bad=structuredClone(original);change(bad);await assert.rejects(()=>restoreBackup(bad));assert.deepEqual((await exportBackup()).data,original.data);}
});
test('clear all data requires exact confirmation',async()=>{
 await product();await assert.rejects(()=>clearAllData('yes'));assert.equal((await getProducts()).length,1);await clearAllData('DELETE ALL DATA');assert.equal((await getProducts()).length,0);
});
