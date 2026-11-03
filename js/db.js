import {uid,normalizedProduct,asInteger,safeAmount} from './utils.js';
import {TABLES,DEFAULT_SETTINGS,settingsFrom,validateSettings,upgradeLegacy,validateBackup} from './schema.js';
export {validateBackup};
const DB_NAME='smartstock-local-v1',DB_VERSION=2;
let connection;
const listeners=new Set();
const channel=typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('smartstock-changes'):null;
channel?.addEventListener('message',()=>listeners.forEach(fn=>fn()));
export const onDatabaseChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
const requestDone=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Database request failed.'));});
export function openDatabase() {
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('IndexedDB is unavailable. Enable site storage in a normal browser window.'));return;}
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=event=>{
      const db=request.result,tx=request.transaction;
      for(const table of TABLES)if(!db.objectStoreNames.contains(table)) {
        const store=db.createObjectStore(table,{keyPath:table==='settings'?'key':'id'});
        if(['sales','movements','returns'].includes(table))store.createIndex('createdAt','createdAt');
        if(table==='products'){store.createIndex('name','name');store.createIndex('category','category');}
      }
      if(event.oldVersion===1) {
        const legacy={};
        Promise.all(TABLES.slice(0,4).map(async name=>{legacy[name]=await requestDone(tx.objectStore(name).getAll());})).then(()=>{
          const upgraded=upgradeLegacy(legacy);
          for(const table of TABLES)for(const row of upgraded[table])tx.objectStore(table).put(row);
        }).catch(()=>tx.abort());
      }
    };
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;listeners.forEach(fn=>fn());};resolve(db);};
    request.onerror=()=>{connection=null;reject(request.error||new Error('Unable to open local data. Existing records were preserved.'));};
    request.onblocked=()=>{globalThis.dispatchEvent?.(new Event('smartstock-db-blocked'));};
  });
  return connection;
}
async function writeTransaction(stores,work) {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,'readwrite');let output,error;
    tx.oncomplete=()=>{channel?.postMessage('changed');resolve(output);};
    tx.onabort=()=>reject(error||tx.error||new Error('Save cancelled. No partial changes were made.'));
    tx.onerror=()=>{};
    Promise.resolve().then(()=>work(tx,requestDone)).then(result=>{output=result;}).catch(err=>{error=err;try{tx.abort();}catch{reject(err);}});
  });
}
async function readAll(store) {const db=await openDatabase();return requestDone(db.transaction(store,'readonly').objectStore(store).getAll());}
export const getProducts=()=>readAll('products');
export const getSales=()=>readAll('sales');
export const getMovements=()=>readAll('movements');
export const getReturns=()=>readAll('returns');
export const getSettings=async()=>settingsFrom(await readAll('settings'));
export async function saveSettings(input) {
  validateSettings(input);
  return writeTransaction(['settings','products','sales'],async(tx,req)=>{
    const current=settingsFrom(await req(tx.objectStore('settings').getAll()));
    if(input.currency&&input.currency!==current.currency) {
      if(await req(tx.objectStore('products').count())||await req(tx.objectStore('sales').count()))throw new Error('Currency is locked while inventory or sales exist. Export a backup and start a separate shop to use another currency.');
    }
    for(const [key,value] of Object.entries(input))await req(tx.objectStore('settings').put({key,value}));
  });
}
async function command(tx,req,id,kind,input,work,resultStore) {
  if(typeof id!=='string'||!id||id.length>128)throw new Error('Invalid operation identifier.');
  const fingerprint=JSON.stringify(input),store=tx.objectStore('operations'),previous=await req(store.get(id));
  if(previous) {
    if(previous.kind!==kind||previous.fingerprint!==fingerprint)throw new Error('Operation identifier was already used for another change.');
    return req(tx.objectStore(resultStore).get(previous.resultId));
  }
  const result=await work();
  await req(store.add({id,kind,fingerprint,resultId:result.id,createdAt:new Date().toISOString()}));
  return result;
}
async function saveNames(tx,req,p) {
  for(const [table,name] of [['categories',p.category],['suppliers',p.supplier]])if(name)await req(tx.objectStore(table).put({id:name,name}));
}
async function assertSkuUnique(tx,req,sku,except=null) {
  if(!sku)return;
  const products=await req(tx.objectStore('products').getAll());
  if(products.some(p=>p.id!==except&&p.sku?.toLowerCase()===sku.toLowerCase()))throw new Error(`SKU "${sku}" is already used. Archived products also reserve their SKU.`);
}
export async function saveProduct(input,existingId=null,operationId=uid()) {
  return writeTransaction(['products','movements','operations','categories','suppliers'],async(tx,req)=>command(tx,req,operationId,'product',[input,existingId],async()=>{
    const store=tx.objectStore('products'),current=existingId?await req(store.get(existingId)):null;
    if(existingId&&!current)throw new Error('Product no longer exists.');
    if(current&&input.expectedRevision!==undefined&&Number(input.expectedRevision)!==(current.revision||0))throw new Error('This product changed in another tab. Reopen it before editing.');
    if(current&&input.expectedUpdatedAt&&input.expectedUpdatedAt!==current.updatedAt)throw new Error('This product changed in another tab. Reopen it before editing.');
    const p=normalizedProduct(input,current);
    safeAmount(p.quantity*p.costMinor);safeAmount(p.quantity*p.priceMinor);
    await assertSkuUnique(tx,req,p.sku,existingId);await req(store.put(p));await saveNames(tx,req,p);
    if(!current&&p.quantity)await req(tx.objectStore('movements').add({id:uid(),productId:p.id,productName:p.name,delta:p.quantity,type:'initial',note:'Initial inventory',createdAt:p.createdAt}));
    return p;
  },'products'));
}
export async function archiveProduct(id,archived=true) {
  return writeTransaction(['products'],async(tx,req)=>{
    const p=await req(tx.objectStore('products').get(id));if(!p)throw new Error('Product does not exist.');
    const updated={...p,revision:(p.revision||0)+1,status:archived?'archived':'active',updatedAt:new Date().toISOString()};await req(tx.objectStore('products').put(updated));return updated;
  });
}
export async function deleteProduct(id) {
  return writeTransaction(['products','sales','movements'],async(tx,req)=>{
    const p=await req(tx.objectStore('products').get(id));if(!p)throw new Error('Product does not exist.');
    const sales=await req(tx.objectStore('sales').getAll()),movements=await req(tx.objectStore('movements').getAll());
    if(p.quantity||sales.some(s=>s.items.some(i=>i.productId===id))||movements.some(m=>m.productId===id))throw new Error('Products with stock or history must be archived. Only unused, zero-stock products may be deleted.');
    await req(tx.objectStore('products').delete(id));
  });
}
export async function adjustStock(id,delta,kind='restock',note='',operationId=uid()) {
  if(!Number.isSafeInteger(delta)||!delta||Math.abs(delta)>1e9)throw new Error('Enter a valid non-zero whole-number quantity.');
  if(!['restock','adjustment'].includes(kind)||kind==='restock'&&delta<0)throw new Error('Invalid stock change type.');
  if(!String(note).trim())throw new Error('A reason is required for stock changes.');
  return writeTransaction(['products','movements','operations'],async(tx,req)=>command(tx,req,operationId,'stock',[id,delta,kind,note],async()=>{
    const p=await req(tx.objectStore('products').get(id));if(!p)throw new Error('Product no longer exists.');
    if(p.status==='archived')throw new Error('Reactivate the product before adjusting stock.');
    if(p.quantity+delta<0)throw new Error(`Only ${p.quantity} unit(s) available.`);
    asInteger(p.quantity+delta,'Stock');safeAmount((p.quantity+delta)*p.priceMinor);safeAmount((p.quantity+delta)*p.costMinor);
    const updated={...p,revision:(p.revision||0)+1,quantity:p.quantity+delta,updatedAt:new Date().toISOString()};await req(tx.objectStore('products').put(updated));
    await req(tx.objectStore('movements').add({id:uid(),productId:id,productName:p.name,delta,type:kind,note:String(note).trim().slice(0,400),createdAt:updated.updatedAt}));return updated;
  },'products'));
}
export async function createSale(cart,note='',customer='',operationId=uid()) {
  if(!Array.isArray(cart)||!cart.length||cart.length>10000)throw new Error('Add at least one product (maximum 10,000 lines).');
  const counts=new Map();for(const row of cart){const qty=asInteger(row.quantity,'Quantity');if(!qty)throw new Error('Quantity must be at least one.');counts.set(row.productId,asInteger((counts.get(row.productId)||0)+qty,'Quantity'));}
  return writeTransaction(['products','sales','movements','settings','operations'],async(tx,req)=>command(tx,req,operationId,'sale',[cart,note,customer],async()=>{
    const items=[],products=new Map(),currency=settingsFrom(await req(tx.objectStore('settings').getAll())).currency;
    for(const [id,qty] of counts) {
      const p=await req(tx.objectStore('products').get(id));if(!p||p.status==='archived')throw new Error('A cart product is unavailable or archived.');
      if(cart.some(row=>row.productId===id&&row.expectedPriceMinor!==undefined&&row.expectedPriceMinor!==p.priceMinor))throw new Error('A price changed. Refresh and review your cart before confirming.');
      if(p.quantity<qty)throw new Error(`Not enough stock for ${p.name}. Available: ${p.quantity}.`);products.set(id,p);
      items.push({productId:p.id,name:p.name,sku:p.sku,quantity:qty,returnedQuantity:0,unitPriceMinor:p.priceMinor,unitCostMinor:p.costMinor,unitPrice:p.priceMinor/100,unitCost:p.costMinor/100});
    }
    const createdAt=new Date().toISOString(),id=uid();
    const totalMinor=safeAmount(items.reduce((n,i)=>safeAmount(n+i.quantity*i.unitPriceMinor),0));
    const costMinor=safeAmount(items.reduce((n,i)=>safeAmount(n+i.quantity*i.unitCostMinor),0));
    for(const item of items) {
      const p=products.get(item.productId);await req(tx.objectStore('products').put({...p,revision:(p.revision||0)+1,quantity:p.quantity-item.quantity,updatedAt:createdAt}));
      await req(tx.objectStore('movements').add({id:uid(),productId:p.id,productName:p.name,delta:-item.quantity,type:'sale',note:`Sale #${id.slice(0,8)}`,saleId:id,createdAt}));
    }
    const sale={id,createdAt,currency,items,totalMinor,costMinor,total:totalMinor/100,cost:costMinor/100,note:String(note).trim().slice(0,400),customer:String(customer).trim().slice(0,120),voidedAt:null};
    await req(tx.objectStore('sales').add(sale));return sale;
  },'sales'));
}
async function restoreSaleStock(saleId,requested,reason,kind,operationId) {
  if(!String(reason).trim())throw new Error('A return reason is required.');
  return writeTransaction(['products','sales','returns','movements','operations'],async(tx,req)=>command(tx,req,operationId,kind,[saleId,requested,reason],async()=>{
    const sale=await req(tx.objectStore('sales').get(saleId));if(!sale)throw new Error('Sale no longer exists.');
    if(sale.voidedAt)throw new Error('Sale has already been voided.');
    const quantities=kind==='void'?sale.items.map(i=>({productId:i.productId,quantity:i.quantity-i.returnedQuantity})).filter(i=>i.quantity>0):requested;
    if(!Array.isArray(quantities)||!quantities.length)throw new Error('No items remain to return.');
    const items=[],seen=new Set(),at=new Date().toISOString(),id=uid();
    for(const row of quantities) {
      const qty=asInteger(row.quantity,'Return quantity');if(!qty||seen.has(row.productId))throw new Error('Return quantities must be positive and products unique.');seen.add(row.productId);
      const i=sale.items.find(i=>i.productId===row.productId);if(!i||qty>i.quantity-i.returnedQuantity)throw new Error('Return exceeds the remaining sold quantity.');
      const p=await req(tx.objectStore('products').get(i.productId));if(!p)throw new Error('Historical product identity is missing.');
      asInteger(p.quantity+qty,'Stock');safeAmount((p.quantity+qty)*p.costMinor);safeAmount((p.quantity+qty)*p.priceMinor);
      items.push({...i,quantity:qty});i.returnedQuantity+=qty;
      await req(tx.objectStore('products').put({...p,revision:(p.revision||0)+1,quantity:p.quantity+qty,updatedAt:at}));
      await req(tx.objectStore('movements').add({id:uid(),productId:p.id,productName:p.name,delta:qty,type:'return',note:String(reason).trim().slice(0,400),saleId,returnId:id,createdAt:at}));
    }
    if(kind==='void')sale.voidedAt=at;
    const result={id,saleId,kind,reason:String(reason).trim().slice(0,400),createdAt:at,currency:sale.currency,items,totalMinor:safeAmount(items.reduce((n,i)=>n+i.quantity*i.unitPriceMinor,0)),costMinor:safeAmount(items.reduce((n,i)=>n+i.quantity*i.unitCostMinor,0))};
    await req(tx.objectStore('sales').put(sale));await req(tx.objectStore('returns').add(result));return result;
  },'returns'));
}
export const returnSale=(id,items,reason,operationId=uid())=>restoreSaleStock(id,items,reason,'return',operationId);
export const voidSale=(id,reason='Voided transaction',operationId=uid())=>restoreSaleStock(id,null,reason,'void',operationId);
export async function getSnapshot() {
  const db=await openDatabase(),tx=db.transaction(TABLES,'readonly'),result={};
  await Promise.all(TABLES.map(async table=>{result[table]=await requestDone(tx.objectStore(table).getAll());}));return result;
}
export async function exportBackup() {return {format:'smartstock-backup',version:2,schemaVersion:2,exportedAt:new Date().toISOString(),data:await getSnapshot()};}
export async function restoreBackup(backup) {
  const data=validateBackup(backup);
  return writeTransaction(TABLES,async(tx,req)=>{for(const table of TABLES)await req(tx.objectStore(table).clear());for(const table of TABLES)for(const row of data[table])await req(tx.objectStore(table).put(row));});
}
export async function clearAllData(confirmation) {
  if(confirmation!=='DELETE ALL DATA')throw new Error('Type DELETE ALL DATA exactly to confirm.');
  return writeTransaction(TABLES,async(tx,req)=>{for(const table of TABLES)await req(tx.objectStore(table).clear());});
}
export async function importProducts(products) {
  if(!Array.isArray(products)||!products.length||products.length>25000)throw new Error('Import between 1 and 25,000 products.');
  const rows=products.map(p=>normalizedProduct(p));
  return writeTransaction(['products','movements','categories','suppliers'],async(tx,req)=>{
    const existing=await req(tx.objectStore('products').getAll()),skus=new Set(existing.map(p=>p.sku.toLowerCase()).filter(Boolean));
    for(const p of rows){safeAmount(p.quantity*p.priceMinor);safeAmount(p.quantity*p.costMinor);const sku=p.sku.toLowerCase();if(sku&&skus.has(sku))throw new Error(`Duplicate SKU in import: ${p.sku}. Nothing was imported.`);if(sku)skus.add(sku);}
    for(const p of rows){await req(tx.objectStore('products').add(p));await saveNames(tx,req,p);if(p.quantity)await req(tx.objectStore('movements').add({id:uid(),productId:p.id,productName:p.name,delta:p.quantity,type:'import',note:'CSV import',createdAt:p.createdAt}));}return rows.length;
  });
}
