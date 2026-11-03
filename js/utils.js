export const money = (value, currency = 'USD') => {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency === 'KHR' ? 'KHR' : 'USD',
    minimumFractionDigits: currency === 'KHR' && Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
};

export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function todayLocal(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function localDate(value) {
  return new Date(value).toLocaleString(undefined, {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
export function dateOnly(value) {
  return new Date(value).toLocaleDateString(undefined, {month:'short',day:'numeric'});
}
export function asNonNegative(value, field, max = 1e12) {
  const n = Number(value);
  if (typeof value === 'boolean' || (typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(n) || n < 0 || n > max) throw new Error(`${field} must be between 0 and ${max.toLocaleString()}.`);
  return n;
}
export function asInteger(value, field, max = 1e9) {
  const n = asNonNegative(value, field, max);
  if (!Number.isSafeInteger(n)) throw new Error(`${field} must be a whole number.`);
  return n;
}
export function normalizedProduct(input, previous = null) {
  if(input.status&&!['active','archived'].includes(input.status))throw new Error('Invalid product status.');
  const name = String(input.name || '').trim();
  if (!name || name.length > 120) throw new Error('Product name must contain 1–120 characters.');
  const sku = String(input.sku || '').trim().slice(0,60);
  const category = String(input.category || 'Uncategorized').trim().slice(0,60) || 'Uncategorized';
  const description = String(input.description || '').trim().slice(0,400);
  return {
    id: previous?.id || uid(), revision:(previous?.revision||0)+1, name, sku, category, description,
    supplier: String(input.supplier || '').trim().slice(0,120), status: previous?.status || (input.status==='archived'?'archived':'active'),
    costMinor: toMinor(input.cost, 'Purchase cost'), priceMinor: toMinor(input.price, 'Selling price'),
    cost: toMinor(input.cost, 'Purchase cost')/100,
    price: toMinor(input.price, 'Selling price')/100,
    quantity: previous ? previous.quantity : asInteger(input.quantity ?? 0,'Quantity'),
    lowStockAt: asInteger(input.lowStockAt ?? 5, 'Low-stock threshold', 1000000),
    createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}
export function stockStatus(product) {
  return product.quantity <= 0 ? 'out' : product.quantity <= product.lowStockAt ? 'low' : 'ok';
}
export function csvEscape(value) {
  let s = String(value ?? '');
  // Prevent spreadsheet formula execution on exported text cells.
  if (/^[\s]*[=+@\-\t\r]/.test(s) && typeof value === 'string') s = "'" + s;
  return `"${s.replace(/"/g,'""')}"`;
}
export function asCSV(rows) {
  return rows.map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}
export function parseCSV(text) {
  const lines = [], row = [];
  let current='', quoted=false,closedQuote=false;
  const input = String(text).replace(/^\uFEFF/,'');
  for (let i=0;i<input.length;i++) {
    const c=input[i];
    if (quoted) {
      if (c==='"' && input[i+1]==='"') {current+='"';i++;}
      else if(c==='"') {quoted=false;closedQuote=true;}
      else current+=c;
    } else if (closedQuote && ![',','\n','\r'].includes(c)) {throw new Error('Invalid CSV: text after closing quote.');}
    else if (c==='"') {if(current!=='')throw new Error('Invalid CSV: quote inside an unquoted field.');quoted=true;}
    else if (c===',') {row.push(current);current='';closedQuote=false;}
    else if (c==='\n' || c==='\r') {
      if(c==='\r' && input[i+1]==='\n') i++;
      row.push(current);current='';closedQuote=false;
      if(row.some(v=>v.trim()!=='')) lines.push([...row]);
      row.length=0;
    } else current+=c;
  }
  if (quoted) throw new Error('Invalid CSV: unclosed quote.');
  row.push(current);
  if(row.some(v=>v.trim()!=='')) lines.push(row);
  return lines;
}
// Amounts are stored as integer hundredths in either currency. No exchange conversion.
export function toMinor(value, field='Amount') {
  const raw=String(value).trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error(`${field} must be a nonnegative amount with at most 2 decimal places.`);
  const [whole,fraction='']=raw.split('.');
  const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(result)||result>1e14) throw new Error(`${field} is too large.`);
  return result;
}
export function safeAmount(value) {
  if(!Number.isSafeInteger(value)) throw new Error('Amount exceeds the safe accounting limit.');
  return value;
}
export const itemPrice=i=>i.unitPriceMinor ?? Math.round(i.unitPrice*100);
export const itemCost=i=>i.unitCostMinor ?? Math.round(i.unitCost*100);
export const productCost=p=>p.costMinor ?? Math.round(p.cost*100);
export const productPrice=p=>p.priceMinor ?? Math.round(p.price*100);
export function saleNet(sale) {
  if(sale.voidedAt) return {revenueMinor:0,costMinor:0,quantity:0};
  return sale.items.reduce((n,i)=>{
    const qty=i.quantity-(i.returnedQuantity||0);
    n.revenueMinor=safeAmount(n.revenueMinor+qty*itemPrice(i));
    n.costMinor=safeAmount(n.costMinor+qty*itemCost(i));n.quantity+=qty;return n;
  },{revenueMinor:0,costMinor:0,quantity:0});
}
export function reportData(sales,returns=[],from='',to='') {
  const within=at=>{const day=todayLocal(new Date(at));return (!from||day>=from)&&(!to||day<=to);};
  const events=[],returnedSales=new Set(returns.map(r=>r.saleId));
  for(const sale of sales) {
    if(within(sale.createdAt)) events.push({date:sale.createdAt,saleId:sale.id,kind:'sale',currency:sale.currency||'USD',items:sale.items,sign:1});
    // Version 1 callers can still supply voided sales without return records.
    if(sale.voidedAt&&!returnedSales.has(sale.id)&&within(sale.voidedAt)) events.push({date:sale.voidedAt,saleId:sale.id,kind:'void',currency:sale.currency||'USD',items:sale.items,sign:-1});
  }
  for(const r of returns) if(within(r.createdAt)) events.push({date:r.createdAt,saleId:r.saleId,kind:r.kind,currency:r.currency,items:r.items,sign:-1});
  const days=new Map(),products=new Map();let revenueMinor=0,costMinor=0;
  for(const event of events) {
    const day=todayLocal(new Date(event.date));
    const bucket=days.get(day)||{day,revenueMinor:0,costMinor:0,quantity:0};
    event.revenueMinor=0;event.costMinor=0;
    for(const i of event.items) {
      const qty=event.sign*i.quantity,r=safeAmount(qty*itemPrice(i)),c=safeAmount(qty*itemCost(i));
      revenueMinor=safeAmount(revenueMinor+r);costMinor=safeAmount(costMinor+c);
      event.revenueMinor=safeAmount(event.revenueMinor+r);event.costMinor=safeAmount(event.costMinor+c);
      bucket.revenueMinor=safeAmount(bucket.revenueMinor+r);bucket.costMinor=safeAmount(bucket.costMinor+c);bucket.quantity+=qty;
      const product=products.get(i.productId)||{id:i.productId,name:i.name,quantity:0,revenueMinor:0};
      product.quantity+=qty;product.revenueMinor=safeAmount(product.revenueMinor+r);products.set(i.productId,product);
    }
    days.set(day,bucket);
  }
  return {revenueMinor,costMinor,profitMinor:safeAmount(revenueMinor-costMinor),events,
    transactions:events.filter(e=>e.kind==='sale').length,
    days:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day)),
    products:[...products.values()].sort((a,b)=>b.quantity-a.quantity)};
}
export function computeMetrics(products, sales, movements = [], returns=[]) {
  const activeProducts=products.filter(p=>p.status!=='archived');
  const start=todayLocal();
  // Legacy simple fixtures and old callers remain supported.
  const simple=sales.some(s=>!s.items);
  const active=sales.filter(s=>!s.voidedAt);
  const all=simple?null:reportData(sales,returns);
  const today=simple?null:reportData(sales,returns,start,start);
  return {
    products:activeProducts.length,inStock:activeProducts.filter(p=>stockStatus(p)==='ok').length,
    low:activeProducts.filter(p=>stockStatus(p)==='low').length,out:activeProducts.filter(p=>stockStatus(p)==='out').length,
    units:activeProducts.reduce((a,p)=>a+p.quantity,0),
    inventoryCost:products.reduce((a,p)=>safeAmount(a+p.quantity*productCost(p)),0)/100,
    inventoryRetail:products.reduce((a,p)=>safeAmount(a+p.quantity*productPrice(p)),0)/100,
    revenue:all?all.revenueMinor/100:active.reduce((a,s)=>a+s.total,0),
    profit:all?all.profitMinor/100:active.reduce((a,s)=>a+s.total-s.cost,0),
    todayRevenue:today?today.revenueMinor/100:active.filter(s=>todayLocal(new Date(s.createdAt))===start).reduce((a,s)=>a+s.total,0),
    todayProfit:today?today.profitMinor/100:active.filter(s=>todayLocal(new Date(s.createdAt))===start).reduce((a,s)=>a+s.total-s.cost,0),
    transactions:active.length,movements:movements.length
  };
}
export function downloadFile(content, name, mime='application/octet-stream') {
  const blob=content instanceof Blob ? content : new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
