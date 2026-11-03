import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedProduct,stockStatus,computeMetrics,parseCSV,asCSV,escapeHTML,asInteger,money,uid,todayLocal} from '../js/utils.js';

test('new product sanitizes and preserves core fields',()=>{
 const p=normalizedProduct({name:'  USB Cable  ',sku:' U-100 ',category:' Accessories ',cost:'1.25',price:'4.50',quantity:'20',lowStockAt:'3',description:'  Charging  '});
 assert.equal(p.name,'USB Cable');assert.equal(p.sku,'U-100');assert.equal(p.price,4.5);assert.equal(p.quantity,20);assert.equal(p.lowStockAt,3);assert.equal(p.description,'Charging');assert.ok(p.id);
});
test('edit does not silently override stock quantity',()=>{
 const p=normalizedProduct({name:'A',cost:2,price:4,quantity:5});
 const changed=normalizedProduct({name:'B',cost:3,price:5,quantity:999},p);
 assert.equal(changed.id,p.id);assert.equal(changed.quantity,5);assert.equal(changed.createdAt,p.createdAt);
});
test('invalid prices and quantities rejected',()=>{
 for(const q of ['-3','1.2','abc']) assert.throws(()=>normalizedProduct({name:'X',cost:2,price:4,quantity:q}));
 assert.throws(()=>normalizedProduct({name:'',cost:2,price:4,quantity:1}));
 assert.throws(()=>normalizedProduct({name:'X',cost:-1,price:4,quantity:1}));
 assert.throws(()=>asInteger(1.1,'Quantity'));
});
test('status logic distinguishes in-stock low and empty',()=>{
 assert.equal(stockStatus({quantity:12,lowStockAt:5}),'ok');
 assert.equal(stockStatus({quantity:5,lowStockAt:5}),'low');
 assert.equal(stockStatus({quantity:0,lowStockAt:5}),'out');
});
test('metrics omit voided sale revenue and track profit',()=>{
 const products=[{quantity:10,price:8,cost:3,lowStockAt:2},{quantity:0,price:10,cost:5,lowStockAt:2}];
 const sales=[{total:24,cost:9,createdAt:new Date().toISOString(),voidedAt:null},{total:100,cost:70,createdAt:new Date().toISOString(),voidedAt:new Date().toISOString()}];
 const m=computeMetrics(products,sales);
 assert.equal(m.products,2);assert.equal(m.inStock,1);assert.equal(m.out,1);assert.equal(m.low,0);
 assert.equal(m.inventoryCost,30);assert.equal(m.revenue,24);assert.equal(m.profit,15);assert.equal(m.todayRevenue,24);
});
test('CSV round trip handles quotes comma and embedded newlines',()=>{
 const rows=[['name','sku','price'],['USB, Cable','"U1"',4],['Line\nBreak','B',5]];
 assert.deepEqual(parseCSV(asCSV(rows)),rows.map(r=>r.map(String)));
});
test('CSV export prevents formula injection in text fields',()=>{
 const csv=asCSV([['name'],['=HYPERLINK("https://bad.example")'],['+SUM(1,1)'],['-3']]);
 assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes("'+SUM"));assert.ok(csv.includes("'-3"));
});
test('HTML string escaping is safe for user-supplied names',()=>{
 assert.equal(escapeHTML('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('money formatter supports both currencies',()=>{
 assert.ok(money(4.5,'USD').includes('4.50'));
 assert.ok(money(4000,'KHR').includes('4,000'));
});
test('UUID and local date utilities return expected shapes',()=>{
 assert.ok(uid().length>=10);
 assert.match(todayLocal(),/^\d{4}-\d{2}-\d{2}$/);
});
test('CSV rejects malformed quotation instead of importing ambiguous records',()=>{
 for(const input of ['name,price\n"bad"text,2','name,price\nbad"name,2','name,price\n"unclosed,2'])assert.throws(()=>parseCSV(input),/Invalid CSV/);
});
