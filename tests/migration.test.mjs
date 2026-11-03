import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
const at='2026-01-01T12:00:00.000Z';
const legacy={products:[{id:'kept',name:'Existing product',sku:'OLD',category:'Legacy',description:'Preserve me',cost:2,price:5,quantity:50,lowStockAt:5,createdAt:at,updatedAt:at}],sales:[{id:'old-sale',createdAt:at,items:[{productId:'deleted',name:'Previously deleted',sku:'GONE',quantity:3,unitPrice:4,unitCost:2}],total:12,cost:6,note:'Historical sale',voidedAt:null}],movements:[{id:'m1',productId:'kept',productName:'Existing product',delta:50,type:'initial',note:'Initial stock',createdAt:at},{id:'m2',productId:'deleted',productName:'Previously deleted',delta:7,type:'initial',note:'Initial stock',createdAt:at},{id:'m3',productId:'deleted',productName:'Previously deleted',delta:-3,type:'sale',note:'Sold',saleId:'old-sale',createdAt:at}],settings:[{key:'shopName',value:'Existing shop'},{key:'currency',value:'KHR'}]};

test('real version 1 database upgrades in place without deleting products or sale history',async()=>{
 await new Promise((resolve,reject)=>{
  const request=indexedDB.open('smartstock-local-v1',1);
  request.onupgradeneeded=()=>{const db=request.result;for(const table of Object.keys(legacy)){const store=db.createObjectStore(table,{keyPath:table==='settings'?'key':'id'});for(const row of legacy[table])store.put(row);}};
  request.onsuccess=()=>{request.result.close();resolve();};request.onerror=()=>reject(request.error);
 });
 const db=await import('../js/db.js');const snapshot=await db.getSnapshot();
 assert.equal(snapshot.products.find(p=>p.id==='kept').quantity,50);assert.equal(snapshot.products.find(p=>p.id==='kept').description,'Preserve me');
 assert.equal(snapshot.products.find(p=>p.id==='deleted').status,'archived');assert.equal(snapshot.products.find(p=>p.id==='deleted').quantity,0);
 assert.equal(snapshot.sales[0].id,'old-sale');assert.equal(snapshot.sales[0].currency,'KHR');assert.equal(snapshot.sales[0].totalMinor,1200);
 assert.equal((await db.openDatabase()).version,2);db.validateBackup(await db.exportBackup());
 await db.returnSale('old-sale',[{productId:'deleted',quantity:1}],'Legacy product return');assert.equal((await db.getProducts()).find(p=>p.id==='deleted').quantity,1);
 db.validateBackup(await db.exportBackup());
});

test('version 1 backup with a void migrates and can round-trip in version 2',async()=>{
 const db=await import('../js/db.js');const data=structuredClone(legacy);data.sales[0].voidedAt=at;
 data.movements.push({id:'m4',productId:'deleted',productName:'Previously deleted',delta:3,type:'return',note:'Old void',saleId:'old-sale',createdAt:at});
 const old={format:'smartstock-backup',version:1,exportedAt:at,data};
 await db.restoreBackup(old);const restored=await db.exportBackup();assert.equal(restored.data.returns.length,1);assert.equal(restored.data.sales[0].items[0].returnedQuantity,3);db.validateBackup(restored);
});
