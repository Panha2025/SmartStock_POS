import {asInteger,toMinor,safeAmount,itemPrice,itemCost} from './utils.js';

export const TABLES=['products','sales','movements','settings','returns','categories','suppliers','operations'];
export const DEFAULT_SETTINGS={shopName:'My Shop',shopDetails:'',currency:'USD',language:'en',defaultLowStock:5,appearance:'comfortable',lastBackupAt:null};
export const settingsFrom=rows=>({...DEFAULT_SETTINGS,...Object.fromEntries(rows.map(r=>[r.key,r.value]))});
const fail=message=>{throw new Error(message);};
const text=(value,max,label,required=false)=>{
  if(typeof value!=='string'||value.length>max||(required&&!value.trim())) fail(`Invalid ${label}.`);
};
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))fail('Invalid record date.');};
const amount=value=>{if(!Number.isSafeInteger(value)||value<0)fail('Invalid integer money amount.');};
export function validateSettings(input) {
  for(const [key,value] of Object.entries(input)) {
    if(!Object.hasOwn(DEFAULT_SETTINGS,key))fail(`Unknown setting: ${key}.`);
    if(key==='shopName')text(value,70,'shop name',true);
    if(key==='shopDetails')text(value,400,'shop details');
    if(key==='currency'&&!['USD','KHR'].includes(value))fail('Invalid currency.');
    if(key==='language'&&!['en','km'].includes(value))fail('Invalid language.');
    if(key==='appearance'&&!['comfortable','compact'].includes(value))fail('Invalid appearance.');
    if(key==='defaultLowStock')asInteger(value,'Low-stock threshold',1000000);
    if(key==='lastBackupAt'&&value!==null)date(value);
  }
  return input;
}
// Retain all original fields. Version 1 had neither currency snapshots nor integer money.
export function upgradeLegacy(data) {
  const d=structuredClone(data),currency=settingsFrom(d.settings||[]).currency;
  for(const table of TABLES)d[table]??=[];
  for(const p of d.products) Object.assign(p,{costMinor:toMinor(Number(p.cost).toFixed(2)),priceMinor:toMinor(Number(p.price).toFixed(2)),supplier:p.supplier||'',status:p.status||'active'});
  for(const s of d.sales) {
    s.currency=currency;s.customer=s.customer||'';
    for(const i of s.items) Object.assign(i,{unitPriceMinor:toMinor(Number(i.unitPrice).toFixed(2)),unitCostMinor:toMinor(Number(i.unitCost).toFixed(2)),returnedQuantity:s.voidedAt?i.quantity:0});
    s.totalMinor=safeAmount(s.items.reduce((n,i)=>n+i.quantity*i.unitPriceMinor,0));
    s.costMinor=safeAmount(s.items.reduce((n,i)=>n+i.quantity*i.unitCostMinor,0));
    if(s.voidedAt)d.returns.push({id:`legacy-void-${s.id}`,saleId:s.id,kind:'void',reason:'Legacy void',createdAt:s.voidedAt,currency,items:s.items.map(i=>({...i})),totalMinor:s.totalMinor,costMinor:s.costMinor});
  }
  // Old releases allowed deletion of sold products. Keep recoverable archived identities.
  const ids=new Set(d.products.map(p=>p.id));
  for(const m of [...d.movements,...d.sales.flatMap(s=>s.items.map(i=>({productId:i.productId,productName:i.name,createdAt:s.createdAt})))]) {
    if(ids.has(m.productId))continue;
    ids.add(m.productId);
    const at=m.createdAt;
    d.products.push({id:m.productId,name:m.productName||'Previously deleted product',sku:'',category:'Uncategorized',supplier:'',description:'Recovered historical identity from version 1; archived.',quantity:0,lowStockAt:5,cost:0,price:0,costMinor:0,priceMinor:0,status:'archived',createdAt:at,updatedAt:at});
    const balance=d.movements.filter(x=>x.productId===m.productId).reduce((n,x)=>n+x.delta,0);
    if(balance)d.movements.push({id:`legacy-balance-${m.productId}`,productId:m.productId,productName:m.productName,delta:-balance,type:'adjustment',note:'Preserved deleted-product balance during migration',createdAt:at});
  }
  for(const p of d.products)for(const [table,name] of [['categories',p.category],['suppliers',p.supplier]])if(name&&!d[table].some(r=>r.name===name))d[table].push({id:name,name});
  return d;
}
export function validateBackup(backup) {
  if(!backup||backup.format!=='smartstock-backup'||![1,2].includes(backup.version)||!backup.data)fail('Not a supported SmartStock backup (versions 1 or 2).');
  date(backup.exportedAt);
  if(backup.version===2&&backup.schemaVersion!==2)fail('Unsupported backup schema version.');
  let d=backup.data;
  const tables=backup.version===1?TABLES.slice(0,4):TABLES;
  for(const table of tables) {
    if(!Array.isArray(d[table])||d[table].length>1000000)fail(`Invalid backup table: ${table}.`);
    const seen=new Set();
    for(const r of d[table]) {
      if(!r||typeof r!=='object'||Array.isArray(r))fail(`Invalid ${table} record.`);
      const id=table==='settings'?r.key:r.id;text(id,180,`${table} identifier`,true);
      if(seen.has(id))fail(`Duplicate ${table} identifier.`);seen.add(id);
    }
  }
  if(backup.version===1){if(TABLES.slice(4).some(table=>Object.hasOwn(d,table)))fail('Version 1 backup has unexpected tables.');d=upgradeLegacy(d);}
  validateSettings(Object.fromEntries(d.settings.map(r=>[r.key,r.value])));
  const currency=settingsFrom(d.settings).currency;
  const products=new Map(d.products.map(p=>[p.id,p])),skus=new Set();
  for(const p of d.products) {
    text(p.name,120,'product name',true);text(p.sku,60,'SKU');text(p.category,60,'category',true);text(p.supplier,120,'supplier');text(p.description,400,'description');
    const sku=p.sku.toLowerCase();if(sku&&skus.has(sku))fail('Duplicate SKU in backup.');if(sku)skus.add(sku);
    if(typeof p.quantity!=='number'||typeof p.lowStockAt!=='number')fail('Stock and thresholds must be numbers.');
    if(p.revision!==undefined&&(!Number.isSafeInteger(p.revision)||p.revision<0))fail('Invalid product revision.');
    asInteger(p.quantity,'Stock');asInteger(p.lowStockAt,'Low stock',1000000);amount(p.costMinor);amount(p.priceMinor);
    safeAmount(p.quantity*p.costMinor);safeAmount(p.quantity*p.priceMinor);
    if(!['active','archived'].includes(p.status))fail('Invalid product status.');date(p.createdAt);date(p.updatedAt);
  }
  const sales=new Map(d.sales.map(s=>[s.id,s]));
  const checkItems=(record,isSale)=>{
    if(record.currency!==currency)fail('Backup contains inconsistent currencies.');
    if(!Array.isArray(record.items)||!record.items.length||record.items.length>10000)fail('Invalid sale/return items.');
    const seen=new Set();let total=0,cost=0;
    for(const i of record.items) {
      if(!products.has(i.productId)||seen.has(i.productId))fail('Broken or duplicate product relationship.');seen.add(i.productId);
      text(i.name,120,'sale item name',true);text(i.sku||'',60,'sale SKU');
      if(typeof i.quantity!=='number'||(isSale&&typeof i.returnedQuantity!=='number'))fail('Sale quantities must be numbers.');
      if(asInteger(i.quantity,'Sale quantity')<1)fail('Sale quantity must be positive.');
      amount(i.unitPriceMinor);amount(i.unitCostMinor);
      if(isSale&&(asInteger(i.returnedQuantity,'Returned quantity')>i.quantity))fail('Invalid returned quantity.');
      total=safeAmount(total+i.quantity*itemPrice(i));cost=safeAmount(cost+i.quantity*itemCost(i));
    }
    if(record.totalMinor!==total||record.costMinor!==cost)fail('Sale/return totals do not match items.');
    date(record.createdAt);
  };
  for(const s of d.sales) {checkItems(s,true);text(s.note,400,'sale note');text(s.customer,120,'customer');if(s.voidedAt)date(s.voidedAt);}
  const returned=new Map();
  for(const r of d.returns) {
    checkItems(r,false);text(r.reason,400,'return reason',true);
    if(!['return','void'].includes(r.kind)||!sales.has(r.saleId))fail('Broken return relationship.');
    const s=sales.get(r.saleId);
    for(const i of r.items) {
      const original=s.items.find(x=>x.productId===i.productId);
      if(!original||itemPrice(original)!==itemPrice(i)||itemCost(original)!==itemCost(i))fail('Return prices differ from original sale.');
      const key=JSON.stringify([r.saleId,i.productId]);returned.set(key,(returned.get(key)||0)+i.quantity);
    }
  }
  for(const s of d.sales)for(const i of s.items) {
    if((returned.get(JSON.stringify([s.id,i.productId]))||0)!==i.returnedQuantity)fail('Returned quantities do not match return records.');
    if(s.voidedAt&&i.returnedQuantity!==i.quantity)fail('Voided sale has unreturned items.');
  }
  const balances=new Map(),returnsById=new Map(d.returns.map(r=>[r.id,r]));
  for(const m of d.movements) {
    if(!products.has(m.productId)||!Number.isSafeInteger(m.delta)||m.delta===0)fail('Invalid stock movement.');
    if(m.returnId&&(!returnsById.has(m.returnId)||returnsById.get(m.returnId).saleId!==m.saleId))fail('Broken movement return relationship.');
    if(m.saleId&&sales.has(m.saleId)&&!sales.get(m.saleId).items.some(i=>i.productId===m.productId))fail('Movement product is absent from its sale.');
    if(m.saleId&&!sales.has(m.saleId))fail('Broken movement sale relationship.');
    text(m.productName,120,'movement product',true);text(m.note||'',400,'movement note');text(m.type,30,'movement type',true);date(m.createdAt);
    balances.set(m.productId,(balances.get(m.productId)||0)+m.delta);
  }
  for(const p of d.products)if((balances.get(p.id)||0)!==p.quantity)fail('Stock balance does not match movement history.');
  for(const table of ['categories','suppliers'])for(const r of d[table])text(r.name,table==='categories'?60:120,table,true);
  for(const r of d.operations) {text(r.fingerprint,2000000,'operation fingerprint',true);text(r.kind,40,'operation kind',true);date(r.createdAt);if(typeof r.resultId!=='string')fail('Invalid operation result.');}
  return d;
}
