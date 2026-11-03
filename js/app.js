import {openDatabase,getSnapshot,onDatabaseChange,saveSettings,saveProduct,archiveProduct,deleteProduct,adjustStock,createSale,voidSale,returnSale,exportBackup,restoreBackup,validateBackup,clearAllData,importProducts} from './db.js';
import {money,escapeHTML as e,todayLocal,dateOnly,localDate,stockStatus,computeMetrics,downloadFile,asCSV,parseCSV,asInteger,uid,saleNet,reportData,productPrice} from './utils.js';
import {t} from './i18n.js';
import {settingsFrom} from './schema.js';

const $=id=>document.getElementById(id);
const ICONS={
 box:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 2h3l3.5 13.5a2 2 0 0 0 2 1.5H20l2-12H5"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14-5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14 5l3-3"/><path d="M21 20v-5h-5"/>',
 chart:'<rect x="3" y="12" width="3" height="9" rx="1"/><rect x="10.5" y="7" width="3" height="14" rx="1"/><rect x="18" y="3" width="3" height="18" rx="1"/>',
 database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
 settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.7 2.9-1.7-.7a8 8 0 0 1-2 1.2l-.3 1.9h-3.4l-.3-1.9a8 8 0 0 1-2-1.2l-1.7.7-1.7-2.9 1.4-1.1a8 8 0 0 1 0-2.4L6.1 11l1.7-2.9 1.7.7a8 8 0 0 1 2-1.2l.3-1.9h3.4l.3 1.9a8 8 0 0 1 2 1.2l1.7-.7 1.7 2.9-1.4 1.1a8 8 0 0 1 0 2.9Z" transform="translate(-1 -2)"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 4h.01"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 3h11"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 upload:'<path d="M12 17V5m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 pencil:'<path d="m4 16 11-11 4 4L8 20H4v-4ZM13 7l4 4"/>',
 trash:'<path d="M4 7h16M10 4h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
 chevron:'<path d="m7 10 5 5 5-5"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 close:'<path d="M5 5 19 19M19 5 5 19"/>',
 receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
 print:'<path d="M6 9V3h12v6M6 18H4V9h16v9h-2M6 15h12v6H6v-6Z"/>',
 file:'<path d="M5 3h10l4 4v14H5V3ZM15 3v5h4M8 12h8m-8 4h8"/>',
 shield:'<path d="m12 2 9 4v6c0 6-4 9-9 11-5-2-9-5-9-11V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 filter:'<path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z"/>',
 return:'<path d="M9 14 4 9l5-5M4 9h10a6 6 0 1 1 0 12h-2"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 lock:'<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
 sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
 smartphone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
 zap:'<path d="m13 2-9 12h7l-1 8 10-12h-7V2Z"/>'
};
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.box}</svg>`;
const state={page:'dashboard',products:[],sales:[],movements:[],returns:[],productPage:1,salePage:1,historyPage:1,posPage:1,archived:false,historySearch:'',historyStatus:'all',historyFrom:'',historyTo:'',saleNote:'',customer:'',reportFrom:'',reportTo:'',settings:{shopName:'My Shop',currency:'USD',language:'en',defaultLowStock:5},search:'',category:'all',sort:'name',filter:'all',cart:[],saleSearch:'',reportPeriod:'30',stockFilter:'all',modal:null};
const tx=key=>t(key,state.settings.language);
const fmt=n=>money(n,state.settings.currency);
const yesNoStatus=p=>{
  const st=stockStatus(p), key=st==='ok'?'inStockStatus':st==='low'?'lowStockStatus':'outOfStock';
  return `<span class="status status-${st}"><span class="status-dot"></span>${tx(key)}</span>`;
};
const thumb=p=>`<div class="product-avatar ${stockStatus(p)==='out'?'muted':''}" aria-hidden="true">${icon('box',20)}</div>`;
const sortedProducts=arr=>[...arr].sort((a,b)=>{
  if(state.sort==='quantity')return a.quantity-b.quantity;
  if(state.sort==='price')return b.priceMinor-a.priceMinor;
  if(state.sort==='recent')return b.updatedAt.localeCompare(a.updatedAt);
  return a.name.localeCompare(b.name);
});
const matchingProducts=()=>{
  const q=state.search.trim().toLowerCase();
  return sortedProducts(state.products.filter(p=>{
    if((p.status==='archived')!==state.archived)return false;
    if(state.category!=='all'&&p.category!==state.category)return false;
    if(state.filter!=='all'&&stockStatus(p)!==state.filter)return false;
    return !q || `${p.name} ${p.sku} ${p.category} ${p.description}`.toLowerCase().includes(q);
  }));
};
const sortedMovements=()=>[...state.movements].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
const sortedSales=()=>[...state.sales].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
const categoryOptions=()=>[...new Set(state.products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b));
const titleBar=(title,description,buttons='')=>`<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${buttons}</div></div>`;
const actionBtn=(action,label,ico='plus',cls='btn-primary',attr='')=>`<button class="btn ${cls}" data-action="${action}" ${attr}>${icon(ico,19)}<span>${label}</span></button>`;
const noData=(ico,headline,desc,btn='')=>`<div class="empty-state">${icon(ico,34)}<h3>${headline}</h3><p>${desc}</p>${btn}</div>`;
function statCard(title,value,ico,shade,caption='') {return `<div class="stat-card ${shade}"><div class="stat-head"><div class="stat-icon">${icon(ico,24)}</div><span>${title}</span></div><div class="stat-value">${value}</div>${caption?`<div class="stat-caption">${caption}</div>`:''}</div>`;}
function productRows(products,limit=25) {
  const display=products.slice(0,limit);
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>${tx('productName')}</th><th>${tx('category')}</th><th>${tx('purchaseCost')}</th><th>${tx('sellingPrice')}</th><th>${tx('stock')}</th><th>${tx('status')}</th><th class="actions-col">${tx('actions')}</th></tr></thead><tbody>${display.map(p=>`<tr><td><div class="product-name">${thumb(p)}<div><button class="text-button product-detail" data-action="product-details" data-id="${e(p.id)}">${e(p.name)}</button><small>${e(p.sku||'—')}</small></div></div></td><td><span class="category-chip">${e(p.category)}</span></td><td>${fmt(p.costMinor/100)}</td><td class="price-cell">${fmt(p.priceMinor/100)}</td><td><strong>${p.quantity.toLocaleString()}</strong></td><td>${yesNoStatus(p)}</td><td><div class="row-actions"><button class="icon-btn" title="${tx(p.status==='archived'?'reactivate':'archive')}" aria-label="${tx(p.status==='archived'?'reactivate':'archive')} ${e(p.name)}" data-action="archive-product" data-id="${e(p.id)}">${icon('database',17)}</button><button class="icon-btn" title="${tx('edit')}" aria-label="Edit ${e(p.name)}" data-action="edit-product" data-id="${e(p.id)}">${icon('pencil',17)}</button><button class="icon-btn" title="${tx('restock')}" aria-label="Adjust ${e(p.name)} stock" data-action="stock-product" data-id="${e(p.id)}">${icon('refresh',17)}</button><button class="icon-btn danger-ghost" title="${tx('delete')}" aria-label="Delete ${e(p.name)}" data-action="delete-product" data-id="${e(p.id)}">${icon('trash',17)}</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function recentActivities(limit=6) {
  const movements=sortedMovements().slice(0,limit);
  if(!movements.length)return `<div class="muted center pad-lg">${tx('emptyMovements')}</div>`;
  return `<div class="activity-list">${movements.map(m=>{
    const positive=m.delta>0,ico=m.type==='sale'?'cart':m.type==='return'?'return':positive?'box':'refresh';
    const verb=tx(({sale:'sold',return:'returned',initial:'initial',import:'import',adjustment:'adjusted',restock:'restocked'})[m.type]||'adjusted');
    return `<div class="activity-row"><span class="activity-icon ${positive?'green':'blue'}">${icon(ico,18)}</span><div class="activity-text"><strong>${verb} ${Math.abs(m.delta)} × ${e(m.productName)}</strong><small>${localDate(m.createdAt)}</small></div></div>`;
  }).join('')}</div>`;
}
function recentBusinessRecords() {
  const sales=sortedSales().slice(0,4);
  const group=(type,title)=>{const rows=sortedMovements().filter(m=>m.type===type).slice(0,4);return `<section class="panel"><h2>${tx(title)}</h2>${rows.length?rows.map(m=>`<div class="activity-row"><div class="activity-text"><strong>${m.delta>0?'+':''}${m.delta} × ${e(m.productName)}</strong><small>${localDate(m.createdAt)} · ${e(m.note)}</small></div></div>`).join(''):`<p class="small-muted">${tx('emptyMovements')}</p>`}</section>`;};
  return `<div class="recent-business-grid"><section class="panel"><h2>${tx('recentSales')}</h2>${sales.length?sales.map(s=>`<div class="activity-row"><div class="activity-text"><button class="text-button" data-action="receipt" data-id="${e(s.id)}">#${e(s.id.slice(0,8))} · ${money(saleNet(s).revenueMinor/100,s.currency)}</button><small>${localDate(s.createdAt)} · ${tx(s.voidedAt?'voided':'completed')}</small></div></div>`).join(''):`<p class="small-muted">${tx('emptySales')}</p>`}</section>${group('restock','recentRestocks')}${group('adjustment','recentAdjustments')}</div>`;
}
function dashboardPage() {
  const metrics=computeMetrics(state.products,state.sales,state.movements,state.returns);
  const products=sortedProducts(state.products.filter(p=>p.status!=='archived'));
  return `${titleBar(tx('myInventory'),tx('subtitle'),`<span class="device-pill">${icon('lock',15)} ${tx('noSync')}</span>`)}
    <div class="stats-grid">${statCard(tx('totalProducts'),metrics.products,'box','blue')}${statCard(tx('inStock'),metrics.inStock,'check','green')}${statCard(tx('lowStock'),metrics.low,'alert','amber')}${statCard(tx('todaysSales'),fmt(metrics.todayRevenue),'chart','purple')}</div>
    <div class="summary-strips dashboard-summary">${[[tx('units'),metrics.units],[tx('outOfStock'),metrics.out],[tx('totalRevenue'),fmt(metrics.revenue)],[tx('grossProfit'),fmt(metrics.profit)],[tx('inventoryValue'),fmt(metrics.inventoryCost)]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
    <div class="quick-actions">${actionBtn('add-product',tx('addProduct'),'plus','btn-primary btn-wide')}${actionBtn('nav-sales',tx('recordSale'),'cart','btn-soft btn-wide')}${actionBtn('nav-restock',tx('restockAction'),'refresh','btn-soft btn-wide')}</div>
    ${state.products.length===0?`<div class="welcome-card"><div class="welcome-graphic">${icon('sparkles',36)}</div><div><h2>${tx('startHere')}</h2><p>${tx('startDesc')}</p><div class="welcome-actions">${actionBtn('add-product',tx('addProduct'))}</div></div></div>`:''}
    <div class="dashboard-layout"><section class="panel products-panel"><div class="panel-heading"><h2>${tx('products')}</h2><button class="text-button" data-action="nav-products">${tx('viewAll')} ${icon('arrow',16)}</button></div>
       ${products.length?productRows(products,7):noData('box',tx('noProducts'),tx('getStarted'))}</section>
      <div class="side-stack"><section class="panel recent-panel"><div class="panel-heading"><h2>${icon('clock',21)} ${tx('recentActivity')}</h2></div>${recentActivities(6)}</section>
      <section class="panel backup-mini"><div class="backup-mini-head"><span class="backup-icon">${icon('database',24)}</span><div><h2>${tx('backupRestore')}</h2><p>${tx('storageReminder')}</p></div></div>${actionBtn('download-backup',tx('backupNow'),'download','btn-primary full')}${actionBtn('nav-backup',tx('restoreFromBackup'),'upload','btn-outline full')}</section></div></div>${recentBusinessRecords()}`;
}
function filterToolbar() {
  return `<div class="toolbar"><label class="search-field">${icon('search',18)}<input id="product-search" autocomplete="off" placeholder="${tx('search')}" value="${e(state.search)}" aria-label="${tx('search')}"/></label>
  <select id="product-category" aria-label="Category filter"><option value="all">${tx('allCategories')}</option>${categoryOptions().map(cat=>`<option value="${e(cat)}" ${state.category===cat?'selected':''}>${e(cat)}</option>`).join('')}</select>
  <select id="product-filter" aria-label="Stock status filter">${[['all',tx('allStock')],['ok',tx('inStockStatus')],['low',tx('lowStockStatus')],['out',tx('outOfStock')]].map(([val,label])=>`<option value="${val}" ${state.filter===val?'selected':''}>${label}</option>`).join('')}</select>
  <select id="product-sort" aria-label="Sort products">${[['name',tx('sortName')],['recent',tx('sortRecent')],['quantity',tx('sortQuantity')],['price',tx('sortPrice')]].map(([val,label])=>`<option value="${val}" ${state.sort===val?'selected':''}>${label}</option>`).join('')}</select></div>`;
}
function productsPage() {
  const rows=matchingProducts();
  return `${titleBar(tx('products'),`${state.products.length} ${tx('records')} · ${tx('storageReminder')}`,`${actionBtn('csv-products',tx('exportProducts'),'download','btn-outline')}${actionBtn('import-csv',tx('importCSV'),'upload','btn-outline')}${actionBtn('add-product',tx('addProduct'))}`)}
    <section class="panel"><div class="panel-heading stacked-mobile"><div><h2>${tx('inventory')}</h2><p class="small-muted">${rows.length} ${tx('records')} ${state.search?'• filtered':''}</p></div></div>${filterToolbar()}<label class="archive-toggle"><input type="checkbox" id="archived-filter" ${state.archived?'checked':''}> ${tx('showArchived')}</label>
    ${rows.length?productRows(paged(rows,'productPage'))+pagination(rows,'productPage'):noData('search',tx('noResults'),state.products.length?tx('tryFilter'):tx('getStarted'),state.products.length?'':actionBtn('add-product',tx('addProduct')))}</section>`;
}
function paged(rows,key,size=25) {state[key]=Math.min(Math.max(1,state[key]),Math.max(1,Math.ceil(rows.length/size)));return rows.slice((state[key]-1)*size,state[key]*size);}
function pagination(rows,key,size=25) {
  const pages=Math.max(1,Math.ceil(rows.length/size));if(pages===1)return '';
  return `<div class="pagination"><button class="btn btn-outline btn-small" data-action="page-prev" data-id="${key}" ${state[key]<=1?'disabled':''}>${tx('previous')}</button><span>${state[key]} / ${pages} · ${rows.length} ${tx('records')}</span><button class="btn btn-outline btn-small" data-action="page-next" data-id="${key}" ${state[key]>=pages?'disabled':''}>${tx('next')}</button></div>`;
}
function productDetails(id) {
  const p=state.products.find(p=>p.id===id);if(!p)return;
  showModal(p.name,`<dl class="details">${[[tx('sku'),p.sku],[tx('category'),p.category],[tx('supplier'),p.supplier],[tx('purchaseCost'),fmt(p.costMinor/100)],[tx('sellingPrice'),fmt(p.priceMinor/100)],[tx('stock'),p.quantity],[tx('lowStockAt'),p.lowStockAt],[tx('status'),tx(p.status)],[tx('created'),localDate(p.createdAt)],[tx('updated'),localDate(p.updatedAt)],[tx('description'),p.description]].map(([k,v])=>`<dt>${k}</dt><dd>${e(v??'—')}</dd>`).join('')}</dl>`);
}
function returnModal(id) {
  const sale=state.sales.find(s=>s.id===id);if(!sale)return;
  showModal(tx('returnSale'),`<form id="return-form" class="modal-form" data-sale-id="${e(id)}" data-operation-id="${uid()}"><p>${tx('returnHelp')}</p>${sale.items.filter(i=>i.quantity>i.returnedQuantity).map((i,index)=>`<label class="field-label">${e(i.name)} (${i.quantity-i.returnedQuantity} ${tx('available')})<input name="return-${index}" data-return-id="${e(i.productId)}" type="number" min="0" step="1" max="${i.quantity-i.returnedQuantity}" value="0" required></label>`).join('')}<label class="field-label">${tx('reason')}<textarea name="reason" maxlength="400" required></textarea></label><div class="modal-buttons">${actionBtn('return-all',tx('returnAll'),'return','btn-outline')}<button type="submit" class="btn btn-primary">${tx('confirmReturn')}</button></div></form>`);
}
function salesPage() {
  const avail=state.products.filter(p=>p.status!=='archived'&&p.quantity>0&&`${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(state.saleSearch.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  const cartDetails=state.cart.map(c=>({...c,product:state.products.find(p=>p.id===c.productId)})).filter(c=>c.product);
  const total=cartDetails.reduce((sum,c)=>sum+c.quantity*productPrice(c.product),0)/100;
  const query=state.historySearch.toLowerCase();
  const sales=sortedSales().filter(s=>(!query||`${s.id} ${s.customer} ${s.note} ${s.items.map(i=>i.name+' '+i.sku).join(' ')}`.toLowerCase().includes(query))&&(!state.historyFrom||todayLocal(new Date(s.createdAt))>=state.historyFrom)&&(!state.historyTo||todayLocal(new Date(s.createdAt))<=state.historyTo)&&(state.historyStatus==='all'||(state.historyStatus==='voided'?!!s.voidedAt:state.historyStatus==='returned'?s.items.some(i=>i.returnedQuantity>0):!s.voidedAt&&!s.items.some(i=>i.returnedQuantity>0))));
  return `${titleBar(tx('sales'),tx('recordSale'))}
  <div class="sales-layout"><section class="panel"><div class="panel-heading"><h2>${tx('selectProduct')}</h2></div>
  <label class="search-field full">${icon('search',18)}<input id="sale-search" aria-label="${tx('search')}" placeholder="${tx('search')}" value="${e(state.saleSearch)}" autocomplete="off"></label>
  <div class="sale-product-list">${avail.length?paged(avail,'posPage').map(p=>{
    const qty=state.cart.find(c=>c.productId===p.id)?.quantity||0;
    return `<div class="sale-product"><div class="product-name">${thumb(p)}<div><strong>${e(p.name)}</strong><small>${p.quantity} ${tx('available')} · ${e(p.sku||p.category)}</small></div></div><div class="sale-product-end"><strong>${fmt(p.priceMinor/100)}</strong><button class="btn btn-outline btn-small" ${qty>=p.quantity?'disabled':''} data-action="add-cart" data-id="${e(p.id)}">${icon('plus',15)} ${tx('addToCart')}</button></div></div>`;
  }).join(''):noData('search',tx('noResults'),tx('getStarted'))}</div>${pagination(avail,'posPage')}</section>
  <section class="panel cart-panel"><div class="panel-heading"><h2>${icon('cart',20)} ${tx('cart')}</h2></div>
  ${cartDetails.length?`<div class="cart-rows">${cartDetails.map(c=>`<div class="cart-row"><div><strong>${e(c.product.name)}</strong><small>${fmt(c.product.priceMinor/100)} / ${tx('units')}</small></div><div class="quantity-controls"><button data-action="cart-decrease" data-id="${e(c.productId)}" aria-label="Decrease ${e(c.product.name)}">−</button><input class="cart-quantity" type="number" min="1" max="${c.product.quantity}" step="1" value="${c.quantity}" data-cart-id="${e(c.productId)}" aria-label="${tx('quantity')} ${e(c.product.name)}"><button data-action="cart-increase" data-id="${e(c.productId)}" ${c.quantity>=c.product.quantity?'disabled':''} aria-label="Increase ${e(c.product.name)}">+</button></div><strong>${fmt(c.quantity*c.product.priceMinor/100)}</strong><button class="icon-btn danger-ghost" data-action="cart-remove" data-id="${e(c.productId)}" aria-label="Remove ${e(c.product.name)}">${icon('close',16)}</button></div>`).join('')}</div>
  <label class="field-label">${tx('customer')}<input id="sale-customer" maxlength="120" value="${e(state.customer)}"></label><label class="field-label">${tx('saleNote')}<textarea id="sale-note" rows="2" maxlength="400">${e(state.saleNote)}</textarea></label><div class="cart-total"><span>${tx('total')}</span><strong>${fmt(total)}</strong></div>${actionBtn('checkout',tx('checkout'),'check','btn-primary full')}`:noData('cart',tx('emptyCart'),tx('selectProduct'))}</section></div>
  <section class="panel"><div class="panel-heading"><h2>${tx('salesHistory')}</h2><span class="count-pill">${sales.length}</span></div>
  <div class="toolbar"><input id="history-search" aria-label="${tx('searchSales')}" placeholder="${tx('searchSales')}" value="${e(state.historySearch)}"><select id="history-status" aria-label="${tx('status')}">${['all','completed','returned','voided'].map(v=>`<option value="${v}" ${state.historyStatus===v?'selected':''}>${tx(v)}</option>`).join('')}</select><label>${tx('from')}<input type="date" id="history-from" value="${e(state.historyFrom)}"></label><label>${tx('to')}<input type="date" id="history-to" value="${e(state.historyTo)}"></label></div>
  ${sales.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>${tx('date')}</th><th>${tx('product')}</th><th>${tx('customer')}</th><th>${tx('netRevenue')}</th><th>${tx('status')}</th><th>${tx('actions')}</th></tr></thead><tbody>${paged(sales,'salePage').map(s=>`<tr><td><small>#${e(s.id.slice(0,8))}</small><br>${localDate(s.createdAt)}</td><td>${s.items.map(i=>`${e(i.name)} ×${i.quantity}`).join('<br>')}</td><td>${e(s.customer||'—')}</td><td><strong>${money(saleNet(s).revenueMinor/100,s.currency)}</strong></td><td>${tx(s.voidedAt?'voided':s.items.some(i=>i.returnedQuantity)?'returned':'completed')}</td><td><div class="row-actions"><button class="icon-btn" data-action="receipt" data-id="${e(s.id)}" aria-label="${tx('receipt')} ${e(s.id.slice(0,8))}">${icon('receipt',18)}</button>${!s.voidedAt&&saleNet(s).quantity?`<button class="icon-btn" data-action="return-sale" data-id="${e(s.id)}" aria-label="${tx('returnSale')} ${e(s.id.slice(0,8))}">${icon('return',18)}</button><button class="icon-btn danger-ghost" data-action="void-sale" data-id="${e(s.id)}" aria-label="${tx('voidSale')} ${e(s.id.slice(0,8))}">${icon('close',18)}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>${pagination(sales,'salePage')}`:noData('receipt',tx('emptySales'),tx('searchSales'))}</section>`;
}
function restockPage() {
  const movements=sortedMovements();
  return `${titleBar(tx('restock'),tx('recentMovements'))}
  <div class="restock-layout"><section class="panel"><div class="panel-heading"><h2>${tx('addStock')} / ${tx('removeStock')}</h2></div>
  <form id="stock-form" class="vertical-form"><label class="field-label">${tx('selectProduct')} *<select name="productId" required id="stock-select"><option value="">— ${tx('selectProduct')} —</option>${state.products.filter(p=>p.status!=='archived').sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${e(p.id)}" ${state.stockSelected===p.id?'selected':''}>${e(p.name)} (${p.quantity} ${tx('available')})</option>`).join('')}</select></label>
  <label class="field-label">${tx('type')}<select name="direction"><option value="add">+ ${tx('addStock')}</option><option value="adjust-add">+ ${tx('adjustment')}</option><option value="remove">− ${tx('removeStock')}</option></select></label>
  <label class="field-label">${tx('quantity')} *<input type="number" name="amount" min="1" max="1000000000" step="1" value="1" required></label>
  <label class="field-label">${tx('reason')}<textarea name="note" required maxlength="400" rows="3" placeholder="New delivery, damaged goods, stock count correction..."></textarea></label><button class="btn btn-primary full" type="submit">${icon('check',19)} ${tx('save')}</button></form></section>
  <section class="panel"><div class="panel-heading"><h2>${tx('recentMovements')}</h2><span class="count-pill">${movements.length}</span></div>
  ${movements.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>${tx('date')}</th><th>${tx('product')}</th><th>${tx('type')}</th><th>${tx('change')}</th></tr></thead><tbody>${paged(movements,'historyPage').map(m=>`<tr><td>${localDate(m.createdAt)}</td><td><strong>${e(m.productName)}</strong><small class="cell-small">${e(m.note||'')}</small></td><td><span class="category-chip">${e(tx(m.type))}</span></td><td class="${m.delta>0?'positive':'negative'}"><strong>${m.delta>0?'+':''}${m.delta}</strong></td></tr>`).join('')}</tbody></table></div>${pagination(movements,'historyPage')}`:noData('refresh',tx('emptyMovements'),tx('restockAction'))}</section></div>`;
}
function reportRange() {
  const end=new Date(),start=new Date(end);start.setHours(0,0,0,0);
  if(state.reportPeriod==='custom')return [state.reportFrom,state.reportTo];
  if(state.reportPeriod==='all')return ['',todayLocal(end)];
  if(state.reportPeriod==='month')start.setDate(1);
  else if(state.reportPeriod==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
  else start.setDate(start.getDate()-Number(state.reportPeriod)+1);
  return [todayLocal(start),todayLocal(end)];
}
function currentReport() {const [from,to]=reportRange();return reportData(state.sales,state.returns,from,to);}
function reportPage() {
  const [from,to]=reportRange(),r=currentReport(),m=computeMetrics(state.products,state.sales,state.movements,state.returns);
  const invalid=from&&to&&from>to;
  const top=r.products.filter(p=>p.quantity>0).slice(0,10),maxTop=Math.max(1,...top.map(p=>p.quantity));
  // At most 30 chart buckets, without discarding any events in the chosen period.
  const buckets=[];const size=Math.max(1,Math.ceil(r.days.length/30));
  for(let i=0;i<r.days.length;i+=size){const days=r.days.slice(i,i+size);buckets.push({day:days[0].day,revenueMinor:days.reduce((n,d)=>n+d.revenueMinor,0),profitMinor:days.reduce((n,d)=>n+d.revenueMinor-d.costMinor,0)});}
  const max=Math.max(1,...buckets.flatMap(d=>[Math.abs(d.revenueMinor),Math.abs(d.profitMinor)]));
  const atRisk=state.products.filter(p=>p.status!=='archived'&&stockStatus(p)!=='ok');
  return `${titleBar(tx('reportsOverview'),tx('accountingPolicy'))}
  <div class="toolbar"><label>${tx('customRange')}<select id="report-period">${[['1','today'],['week','week'],['month','month'],['7','days7'],['30','days30'],['90','days90'],['all','allTime'],['custom','custom']].map(([v,k])=>`<option value="${v}" ${state.reportPeriod===v?'selected':''}>${tx(k)}</option>`).join('')}</select></label>${state.reportPeriod==='custom'?`<label>${tx('from')}<input id="report-from" type="date" value="${e(from)}"></label><label>${tx('to')}<input id="report-to" type="date" value="${e(to)}"></label>`:''}</div>
  ${invalid?`<p role="alert" class="notice notice-amber">${tx('invalidRange')}</p>`:''}
  <div class="stats-grid">${statCard(tx('netRevenue'),fmt(r.revenueMinor/100),'wallet','blue')}${statCard(tx('grossProfit'),fmt(r.profitMinor/100),'chart','green')}${statCard(tx('cogs'),fmt(r.costMinor/100),'receipt','purple')}${statCard(tx('inventoryValue'),fmt(m.inventoryCost),'box','amber')}</div>
  <div class="report-grid"><section class="panel"><div class="panel-heading"><h2>${tx('revenueProfit')}</h2></div><p class="small-muted">${tx('chartLegend')}</p>${buckets.length?`<div class="bar-chart" role="img" aria-label="${tx('revenueProfit')}">${buckets.map(b=>`<div class="bar-col" title="${e(b.day)}: ${fmt(b.revenueMinor/100)} / ${fmt(b.profitMinor/100)}"><div class="bar-pair"><span class="bar ${b.revenueMinor<0?'negative-bar':''}" style="height:${Math.abs(b.revenueMinor)/max*100}%"></span><span class="bar profit-bar ${b.profitMinor<0?'negative-bar':''}" style="height:${Math.abs(b.profitMinor)/max*100}%"></span></div><small>${e(b.day.slice(5))}</small></div>`).join('')}</div>`:noData('chart',tx('emptySales'),tx('recordSale'))}</section>
  <section class="panel"><div class="panel-heading"><h2>${tx('topProducts')}</h2></div>${top.length?top.map(p=>`<div class="top-product"><strong>${e(p.name)}</strong><span>${p.quantity} ${tx('units')} · ${fmt(p.revenueMinor/100)}</span><progress max="${maxTop}" value="${p.quantity}" aria-label="${e(p.name)}"></progress></div>`).join(''):noData('chart',tx('emptySales'),tx('recordSale'))}</section></div>
  <section class="panel"><h2>${tx('salesTrend')}</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>${tx('date')}</th><th>${tx('netRevenue')}</th><th>${tx('cogs')}</th><th>${tx('grossProfit')}</th></tr></thead><tbody>${r.days.slice(-31).map(d=>`<tr><td>${e(d.day)}</td><td>${fmt(d.revenueMinor/100)}</td><td>${fmt(d.costMinor/100)}</td><td>${fmt((d.revenueMinor-d.costMinor)/100)}</td></tr>`).join('')}</tbody></table></div><p class="small-muted">${tx('reportTableNote')}</p></section>
  <section class="panel"><h2>${tx('inventory')}</h2><div class="summary-strips"><div><span>${tx('totalProducts')}</span><strong>${m.products}</strong></div><div><span>${tx('units')}</span><strong>${m.units}</strong></div><div><span>${tx('lowStock')}</span><strong>${m.low}</strong></div><div><span>${tx('outOfStock')}</span><strong>${m.out}</strong></div><div><span>${tx('inventoryValue')}</span><strong>${fmt(m.inventoryCost)}</strong></div></div><p class="small-muted">${tx('valuationNote')}</p><div class="button-row">${actionBtn('report-low',tx('lowStock'),'alert','btn-outline')}${actionBtn('report-out',tx('outOfStock'),'alert','btn-outline')}${actionBtn('csv-risk',tx('exportRisk'),'download','btn-outline')}</div><p>${atRisk.length} ${tx('stockWarnings')}</p></section>
  <section class="panel"><h2>${tx('exportReports')}</h2><div class="button-row">${actionBtn('csv-report',tx('exportPeriod'),'download','btn-primary')}${actionBtn('csv-products',tx('exportProducts'),'download','btn-outline')}${actionBtn('csv-sales',tx('exportSales'),'download','btn-outline')}${actionBtn('csv-movements',tx('exportStock'),'download','btn-outline')}</div><p class="small-muted">${tx('profitNote')}</p></section>`;
}
function backupPage() {
  return `${titleBar(tx('backupRestore'),tx('backupAdvice'))}
  <div class="backup-grid"><section class="panel feature-panel"><span class="feature-icon blue-bg">${icon('download',29)}</span><h2>${tx('backupNow')}</h2><p>${tx('howBackupWorks')}</p>${actionBtn('download-backup',tx('backupNow'),'download','btn-primary full')}
  <p class="small-muted">${tx('lastBackup')}: ${state.settings.lastBackupAt?localDate(state.settings.lastBackupAt):tx('never')}</p></section>
  <section class="panel feature-panel"><span class="feature-icon amber-bg">${icon('upload',29)}</span><h2>${tx('restoreFromBackup')}</h2><p>${tx('restoreWarning')}</p>${actionBtn('restore-picker',tx('chooseBackup'),'upload','btn-outline full')}<p class="small-muted">${tx('backupVersions')}</p></section></div>
  <section class="panel"><div class="panel-heading"><h2>${icon('shield',20)} ${tx('storage')}</h2></div><div class="storage-info" id="storage-info">${tx('storageChecking')}</div><div class="button-row">${actionBtn('persist-storage',tx('requestPersistence'),'shield','btn-outline')}${actionBtn('csv-products',tx('exportProducts'),'file','btn-outline')}${actionBtn('import-csv',tx('importCSV'),'upload','btn-outline')}</div><div class="notice notice-amber">${icon('alert',20)} <p>${tx('storageWarning')}</p></div></section>
  <section class="panel"><div class="panel-heading"><h2>${tx('csvImport')}</h2></div><p>${tx('importHelp')}</p><div class="button-row">${actionBtn('download-template',tx('downloadTemplate'),'download','btn-outline')}${actionBtn('import-csv',tx('importCSV'),'upload','btn-outline')}</div><p class="small-muted">${tx('csvReplaceNote')}</p></section>`;
}
function settingsPage() {
  return `${titleBar(tx('settings'),tx('shopSettings'))}
   <section class="panel settings-panel"><div class="panel-heading"><h2>${tx('shopSettings')}</h2></div>
   <form id="settings-form" class="vertical-form"><label class="field-label">${tx('shopName')}<input name="shopName" required maxlength="70" value="${e(state.settings.shopName)}"></label>
   <label class="field-label">${tx('shopDetails')}<textarea name="shopDetails" maxlength="400">${e(state.settings.shopDetails||'')}</textarea></label><label class="field-label">${tx('appearance')}<select name="appearance"><option value="comfortable">${tx('comfortable')}</option><option value="compact" ${state.settings.appearance==='compact'?'selected':''}>${tx('compact')}</option></select></label>
   <label class="field-label">${tx('currency')}<select name="currency"><option value="USD" ${state.settings.currency==='USD'?'selected':''}>USD — US Dollar ($)</option><option value="KHR" ${state.settings.currency==='KHR'?'selected':''}>KHR — Cambodian Riel (៛)</option></select></label>
   <label class="field-label">${tx('language')}<select name="language"><option value="en" ${state.settings.language==='en'?'selected':''}>English</option><option value="km" ${state.settings.language==='km'?'selected':''}>ភាសាខ្មែរ</option></select></label>
   <label class="field-label">${tx('defaultLowStock')}<input name="defaultLowStock" type="number" min="0" max="1000000" step="1" value="${state.settings.defaultLowStock}"></label>
   <div class="notice notice-amber">${icon('info',19)} <p>${tx('currencyPolicy')}</p></div>
   <button class="btn btn-primary" type="submit">${icon('check',19)} ${tx('saveSettings')}</button></form></section><section class="panel settings-panel"><h2>${tx('backupRestore')}</h2><div id="storage-info"></div><div class="button-row">${actionBtn('download-backup',tx('backupNow'),'download','btn-primary')}${actionBtn('nav-backup',tx('restoreFromBackup'),'upload','btn-outline')}${actionBtn('persist-storage',tx('requestPersistence'),'shield','btn-outline')}${actionBtn('clear-data',tx('clearData'),'trash','btn-danger')}</div></section>`;
}
function render() {
  document.body.classList.toggle('compact',state.settings.appearance==='compact');
  document.documentElement.lang=state.settings.language==='km'?'km':'en';
  document.title=`${t(state.page,state.settings.language)} · SmartStock`;
  const routes=['dashboard','products','sales','restock','reports','backup','settings'];
  $('side-nav').innerHTML=routes.map(route=>`<button class="nav-link ${state.page===route?'active':''}" data-action="nav-${route}" ${state.page===route?'aria-current="page"':''}>${icon(route==='products'?'box':route==='sales'?'cart':route==='restock'?'refresh':route==='reports'?'chart':route==='backup'?'database':route,20)}<span>${tx(route)}</span></button>`).join('');
  $('shop-label').textContent=state.settings.shopName;
  $('lang-en').classList.toggle('active',state.settings.language==='en');
  $('lang-km').classList.toggle('active',state.settings.language==='km');
  const pages={dashboard:dashboardPage,products:productsPage,sales:salesPage,restock:restockPage,reports:reportPage,backup:backupPage,settings:settingsPage};
  $('main').innerHTML=(pages[state.page]||dashboardPage)();
  if(['backup','settings'].includes(state.page)) updateStorageInfo();
  $('offline-badge').querySelector('span:last-child').textContent=tx(state.offlineReady?'offlineReady':'offlineNotReady');
  $('side-group-label').textContent=tx('workspace');$('privacy-title').textContent=tx('privateTitle');$('privacy-text').textContent=tx('storageReminder');
}
async function refresh(shouldRender=true) {
  const snapshot=await getSnapshot();
  state.products=snapshot.products;state.sales=snapshot.sales;state.movements=snapshot.movements;state.returns=snapshot.returns;state.settings=settingsFrom(snapshot.settings);
  if(shouldRender)render();
}
function toast(message,type='success') {
  const el=document.createElement('div');el.className=`toast ${type==='error'?'toast-error':''}`;
  el.innerHTML=`${icon(type==='error'?'alert':'check',18)}<span>${e(message)}</span>`;
  while($('toast-stack').children.length>=2)$('toast-stack').firstElementChild.remove();
  $('toast-stack').append(el);setTimeout(()=>el.remove(),4600);
}
async function safely(operation,success='') {
  try{await operation();await refresh();if(success)toast(success);}catch(error){console.error(error);toast(error.message||'Something went wrong.','error');}
}
let modalFocus=null;
function closeModal(){state.modal=null;$('modal-root').innerHTML='';document.body.classList.remove('modal-open');modalFocus?.focus?.();}
function showModal(title,body,footer='') {
  modalFocus=document.activeElement;state.modal=title;
  $('modal-root').innerHTML=`<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="${e(title)}"><div class="modal-header"><h2>${e(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('close',20)}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</section></div>`;
  document.body.classList.add('modal-open');
  $('modal-root').querySelector('input:not([type=hidden]),select,button')?.focus();
}
function field(label,name,value='',extra='') {return `<label class="field-label">${label}<input name="${name}" value="${e(value)}" ${extra}></label>`;}
function productModal(id=null) {
  const p=state.products.find(p=>p.id===id);
  const title=tx(p?'editProduct':'newProduct');
  showModal(title,`<form id="product-form" class="modal-form" data-operation-id="${uid()}"><input type="hidden" name="id" value="${e(p?.id||'')}">
  <input type="hidden" name="expectedRevision" value="${p?.revision||0}"><input type="hidden" name="expectedUpdatedAt" value="${e(p?.updatedAt||'')}">${field(`${tx('productName')} *`,'name',p?.name||'','required maxlength="120" placeholder="e.g. USB Cable"')}
  <div class="form-grid">${field(tx('sku'),'sku',p?.sku||'','maxlength="60" placeholder="e.g. USB-001"')}
  <label class="field-label">${tx('category')}<input name="category" list="category-list" maxlength="60" value="${e(p?.category||'Accessories')}"><datalist id="category-list">${categoryOptions().map(c=>`<option value="${e(c)}">`).join('')}</datalist></label></div>
  <div class="form-grid">${field(`${tx('purchaseCost')} *`,'cost',(p?.costMinor??0)/100,'type="number" step="0.01" min="0" max="1000000000000" required')}${field(`${tx('sellingPrice')} *`,'price',(p?.priceMinor??0)/100,'type="number" step="0.01" min="0" max="1000000000000" required')}</div>
  <div class="form-grid">${field(`${tx('quantity')} *`,'quantity',p?.quantity??0,`type="number" step="1" min="0" max="1000000000" required ${p?'readonly':''}`)}${field(tx('lowStockAt'),'lowStockAt',p?.lowStockAt??state.settings.defaultLowStock,'type="number" step="1" min="0" max="1000000" required')}</div>
  ${p?`<p class="small-muted">${tx('editStockHelp')}</p>`:''}
  ${field(tx('supplier'),'supplier',p?.supplier||'','maxlength="120"')}<label class="field-label">${tx('description')}<textarea name="description" rows="2" maxlength="400">${e(p?.description||'')}</textarea></label>
  <div class="modal-buttons"><button type="button" class="btn btn-outline" data-action="close-modal">${tx('cancel')}</button><button class="btn btn-primary" type="submit">${icon('check',18)} ${tx('saveProduct')}</button></div></form>`);
}
function stockModal(id) {
  const p=state.products.find(p=>p.id===id);if(!p)return;
  showModal(`${tx('restock')}: ${p.name}`,`<form id="stock-modal-form" class="modal-form"><input type="hidden" name="productId" value="${e(p.id)}">
   <p class="current-stock">${tx('stock')}: <strong>${p.quantity}</strong></p><label class="field-label">${tx('type')}<select name="direction"><option value="add">+ ${tx('addStock')}</option><option value="adjust-add">+ ${tx('adjustment')}</option><option value="remove">− ${tx('removeStock')}</option></select></label>
   ${field(`${tx('quantity')} *`,'amount',1,'type="number" step="1" min="1" max="1000000000" required')}
   <label class="field-label">${tx('reason')}<textarea name="note" required rows="2" maxlength="400"></textarea></label>
   <div class="modal-buttons"><button type="button" class="btn btn-outline" data-action="close-modal">${tx('cancel')}</button><button type="submit" class="btn btn-primary">${tx('save')}</button></div></form>`);
}
function confirmModal(title,message,action,label) {
  showModal(title,`<p>${e(message)}</p><div class="modal-buttons"><button class="btn btn-outline" data-action="close-modal">${tx('cancel')}</button><button class="btn btn-danger" data-action="${action.name}" data-id="${e(action.id||'')}">${label||tx('confirm')}</button></div>`);
}
function navigate(page) {
  state.page=page;state.productPage=1;state.posPage=1;state.search='';state.category='all';state.filter='all';state.saleSearch='';
  $('sidebar').classList.remove('open');$('sidebar-backdrop').classList.remove('visible');
  history.replaceState({},'',`#${page}`);render();window.scrollTo({top:0,behavior:'instant'});
}
function rerenderWithFocus(id) {
  const input=$(id),pos=input?.selectionStart??null;
  render();const next=$(id);
  if(next){next.focus();if(pos!==null&&next.setSelectionRange)next.setSelectionRange(pos,pos);}
}
function addToCart(id,delta=1) {
  const p=state.products.find(x=>x.id===id);if(!p||p.status==='archived')return;
  const row=state.cart.find(x=>x.productId===id);
  if(!row&&delta>0&&p.quantity>0)state.cart.push({productId:id,quantity:1});
  else if(row){row.quantity=Math.max(0,Math.min(p.quantity,row.quantity+delta));if(row.quantity===0)state.cart=state.cart.filter(x=>x!==row);}
  render();
}
function receiptModal(id) {
  const s=state.sales.find(x=>x.id===id);if(!s)return;
  const net=saleNet(s),format=n=>money(n/100,s.currency);
  showModal(tx('receipt'),`<div class="receipt-print" id="receipt-content"><div class="receipt-heading"><h2>${e(state.settings.shopName)}</h2><p>${e(state.settings.shopDetails||'')}</p><p>#${e(s.id)}<br>${localDate(s.createdAt)}</p></div><p>${tx('customer')}: ${e(s.customer||'—')}</p><table class="receipt-table"><thead><tr><th>${tx('product')}</th><th>${tx('quantity')}</th><th>${tx('price')}</th><th>${tx('total')}</th></tr></thead><tbody>${s.items.map(i=>`<tr><td>${e(i.name)}</td><td>${i.quantity}<br><small>${tx('returned')}: ${i.returnedQuantity}</small></td><td>${format(i.unitPriceMinor)}</td><td>${format(i.quantity*i.unitPriceMinor)}</td></tr>`).join('')}</tbody></table><p class="receipt-total">${tx('total')}: ${format(s.totalMinor)}</p><p>${tx('refunded')}: ${format(s.totalMinor-net.revenueMinor)}</p><p class="receipt-total">${tx('netRevenue')}: ${format(net.revenueMinor)}</p><strong>${tx(s.voidedAt?'voided':s.items.some(i=>i.returnedQuantity)?'returned':'completed')}</strong><p class="small-muted">${e(s.note)}</p>${state.returns.filter(r=>r.saleId===id).map(r=>`<p class="small-muted">${localDate(r.createdAt)} · ${format(r.totalMinor)} · ${e(r.reason)}</p>`).join('')}</div>`,`<button class="btn btn-outline" data-action="close-modal">${tx('cancel')}</button><button class="btn btn-primary" data-action="print-receipt">${icon('print',18)} ${tx('printReceipt')}</button>`);
}
function exportProductsCSV() {
  downloadFile(asCSV([['name','sku','category','cost','price','quantity','lowStockAt','description','supplier','status'],...state.products.map(p=>[p.name,p.sku,p.category,p.costMinor/100,p.priceMinor/100,p.quantity,p.lowStockAt,p.description,p.supplier,p.status])]),`smartstock-products-${todayLocal()}.csv`,'text/csv;charset=utf-8');
  toast(tx('exportCreated'));
}
function exportSalesCSV() {
  const rows=[['sale_id','date','customer','currency','product','sku','sold_quantity','returned_quantity','unit_price','unit_cost','net_revenue','net_cost','status','note']];
  for(const s of sortedSales())for(const i of s.items)rows.push([s.id,s.createdAt,s.customer,s.currency,i.name,i.sku,i.quantity,i.returnedQuantity,i.unitPriceMinor/100,i.unitCostMinor/100,(s.voidedAt?0:i.quantity-i.returnedQuantity)*i.unitPriceMinor/100,(s.voidedAt?0:i.quantity-i.returnedQuantity)*i.unitCostMinor/100,s.voidedAt?'voided':'completed',s.note]);
  downloadFile(asCSV(rows),`SmartStock_Sales_${todayLocal()}.csv`,'text/csv;charset=utf-8');
}
function exportPeriodCSV() {
  const [from,to]=reportRange();if(from&&to&&from>to)throw new Error(tx('invalidRange'));
  const r=currentReport();
  downloadFile(asCSV([['date','revenue','cost_of_goods_sold','gross_profit','currency'],...r.days.map(d=>[d.day,d.revenueMinor/100,d.costMinor/100,(d.revenueMinor-d.costMinor)/100,state.settings.currency])]),`SmartStock_Report_${from||'all'}_${to||todayLocal()}.csv`,'text/csv;charset=utf-8');
}
function exportMovementsCSV() {
  downloadFile(asCSV([['date','product','product_id','type','quantity_change','note'],...sortedMovements().map(m=>[m.createdAt,m.productName,m.productId,m.type,m.delta,m.note||''])]),`smartstock-stock-history-${todayLocal()}.csv`,'text/csv;charset=utf-8');toast(tx('exportCreated'));
}
async function updateStorageInfo() {
  const el=$('storage-info');if(!el)return;
  if(!navigator.storage?.estimate){el.textContent=tx('storageUnsupported');return;}
  try{
    const info=await navigator.storage.estimate();
    const mb=n=>((n||0)/1024/1024).toFixed(1)+' MB';
    const persistence=navigator.storage.persisted?await navigator.storage.persisted():false;
    if(!el.isConnected)return;
    el.innerHTML=`<div class="storage-row"><span>${tx('storageUsed')}</span><strong>${mb(info.usage)}</strong></div><div class="storage-row"><span>${tx('storageQuota')}</span><strong>${mb(info.quota)}</strong></div><div class="storage-row"><span>${tx('persistentPermission')}</span><strong>${tx(persistence?'granted':'notGranted')}</strong></div>`;
  }catch{el.textContent=tx('storageUnknown');}
}
async function onAction(button,event) {
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='close-modal') {if(event.target.closest('.modal') && event.target.closest('.modal-backdrop')===event.target)return;closeModal();return;}
  if(action?.startsWith('nav-')) {navigate(action.slice(4));return;}
  switch(action) {
    case 'add-product':productModal();break;
    case 'refresh-data':await refresh();break;
    case 'page-prev':state[id]=Math.max(1,state[id]-1);render();break;
    case 'page-next':state[id]++;render();break;
    case 'product-details':productDetails(id);break;
    case 'archive-product':confirmModal(tx('archive'),tx('archiveHelp'),{name:'confirm-archive',id},tx('confirm'));break;
    case 'confirm-archive':{const p=state.products.find(p=>p.id===id);closeModal();await safely(()=>archiveProduct(id,p.status!=='archived'),tx('saved'));break;}
    case 'return-sale':returnModal(id);break;
    case 'return-all':document.querySelectorAll('[data-return-id]').forEach(input=>input.value=input.max);break;
    case 'report-low':navigate('products');state.filter='low';render();break;
    case 'report-out':navigate('products');state.filter='out';render();break;
    case 'csv-report':exportPeriodCSV();break;
    case 'csv-risk':downloadFile(asCSV([['name','sku','quantity','threshold','status'],...state.products.filter(p=>p.status!=='archived'&&stockStatus(p)!=='ok').map(p=>[p.name,p.sku,p.quantity,p.lowStockAt,stockStatus(p)])]),`SmartStock_Stock_Warnings_${todayLocal()}.csv`,'text/csv;charset=utf-8');break;
    case 'edit-product':productModal(id);break;
    case 'stock-product':stockModal(id);break;
    case 'delete-product':confirmModal(tx('deleteProduct'),tx('deleteHelp'),{name:'confirm-delete',id},tx('delete'));break;
    case 'confirm-delete':closeModal();await safely(()=>deleteProduct(id),tx('productDeleted'));break;
    case 'add-cart':addToCart(id);break;
    case 'cart-increase':addToCart(id);break;
    case 'cart-decrease':addToCart(id,-1);break;
    case 'cart-remove':state.cart=state.cart.filter(c=>c.productId!==id);render();break;
    case 'checkout': {
      if(!state.cart.length)return toast(tx('emptyCart'),'error');
      pendingSale={cart:state.cart.map(row=>({...row,expectedPriceMinor:state.products.find(p=>p.id===row.productId)?.priceMinor})),note:state.saleNote,customer:state.customer,operationId:uid()};
      const total=pendingSale.cart.reduce((n,i)=>n+i.quantity*i.expectedPriceMinor,0)/100;
      confirmModal(tx('checkout'),`${tx('confirmSaleHelp')} ${fmt(total)}`,{name:'confirm-checkout'},tx('confirm'));break;
    }
    case 'confirm-checkout': {
      if(!pendingSale||saleBusy)return;saleBusy=true;
      try {const {cart,note,customer,operationId}=pendingSale;const sale=await createSale(cart,note,customer,operationId);pendingSale=null;state.cart=[];state.customer='';state.saleNote='';closeModal();await refresh();toast(`${tx('saleSaved')}: ${money(sale.totalMinor/100,sale.currency)}`);receiptModal(sale.id);}
      catch(error){toast(error.message,'error');await refresh();}finally{saleBusy=false;}break;
    }
    case 'receipt':receiptModal(id);break;
    case 'print-receipt':window.print();break;
    case 'void-sale':confirmModal(tx('voidSale'),tx('voidHelp'),{name:'confirm-void',id},tx('voidSale'));break;
    case 'confirm-void':closeModal();await safely(()=>voidSale(id),tx('saleVoided'));break;
    case 'download-backup': {
      try {
        const backup=await exportBackup();
        downloadFile(JSON.stringify(backup,null,2),`SmartStock_Backup_${todayLocal()}.json`,'application/json');
        await saveSettings({lastBackupAt:backup.exportedAt});await refresh();toast(tx('backupCreated'));
      }catch(err){toast(err.message,'error');}
      break;
    }
    case 'restore-picker':$('restore-file').click();break;
    case 'confirm-restore': {
      if(!pendingBackup)return;
      const snapshot=pendingBackup;pendingBackup=null;closeModal();
      try {await backupBeforeReplacement();await restoreBackup(snapshot);state.cart=[];await refresh();navigate('dashboard');toast(tx('restored'));}catch(error){toast(error.message,'error');}break;
    }
    case 'import-csv':$('csv-file').click();break;
    case 'download-template':downloadFile(asCSV([['name','sku','category','cost','price','quantity','lowStockAt','description','supplier','status'],['Sample Product','SAMPLE-001','Accessories',2,5,10,5,'Optional notes','','active']]),'smartstock-import-template.csv','text/csv;charset=utf-8');break;
    case 'persist-storage':{
      if(!navigator.storage?.persist) {toast('Your browser does not support requesting persistent storage.','error');break;}
      const approved=await navigator.storage.persist();toast(approved?'Persistent storage permission granted.':'Browser did not grant persistent storage. Keep making backups.',approved?'success':'error');updateStorageInfo();break;
    }
    case 'csv-products':exportProductsCSV();break;
    case 'csv-sales':exportSalesCSV();break;
    case 'csv-movements':exportMovementsCSV();break;
    case 'clear-data':showModal(tx('clearData'),`<form id="clear-form" class="modal-form"><p>${tx('clearHelp')}</p><label class="field-label">DELETE ALL DATA<input name="confirmation" required autocomplete="off"></label><button type="submit" class="btn btn-danger">${tx('clearData')}</button></form>`);break;
  }
}
let pendingBackup=null,pendingSale=null,saleBusy=false;
async function backupBeforeReplacement(){const backup=await exportBackup();downloadFile(JSON.stringify(backup,null,2),`SmartStock_Before_Replacement_${todayLocal()}_${Date.now()}.json`,'application/json');}
async function handleForm(form) {
  const values=Object.fromEntries(new FormData(form));
  form.dataset.operationId ||= uid();
  if(form.getAttribute('id')==='product-form') {
    const id=values.id||null;
    await saveProduct(values,id,form.dataset.operationId);
    closeModal();
    await refresh();
    toast(tx(id?'productUpdated':'productAdded'));
  }
  if(form.getAttribute('id')==='stock-form'||form.getAttribute('id')==='stock-modal-form') {
    const delta=asInteger(values.amount,'Quantity')*(values.direction==='remove'?-1:1);
    if(delta===0)throw new Error('Enter a quantity above zero.');
    await adjustStock(values.productId,delta,values.direction==='add'?'restock':'adjustment',values.note,form.dataset.operationId);
    if(form.getAttribute('id')==='stock-modal-form')closeModal();await refresh();toast(tx('stockSaved'));
  }
  if(form.getAttribute('id')==='return-form') {
    const items=[...form.querySelectorAll('[data-return-id]')].map(input=>({productId:input.dataset.returnId,quantity:asInteger(input.value,'Return quantity')})).filter(i=>i.quantity>0);
    await returnSale(form.dataset.saleId,items,values.reason,form.dataset.operationId);closeModal();await refresh();toast(tx('returnSaved'));
  }
  if(form.getAttribute('id')==='clear-form') {
    if(values.confirmation!=='DELETE ALL DATA')throw new Error(tx('clearHelp'));
    await backupBeforeReplacement();await clearAllData(values.confirmation);closeModal();state.cart=[];await refresh();navigate('dashboard');toast(tx('cleared'));
  }
  if(form.getAttribute('id')==='settings-form') {
    const low=asInteger(values.defaultLowStock,'Low-stock threshold',1000000);
    const shopName=String(values.shopName).trim().slice(0,70);
    if(!shopName)throw new Error('Shop name is required.');
    await saveSettings({shopName,shopDetails:values.shopDetails.trim(),appearance:values.appearance,currency:values.currency==='KHR'?'KHR':'USD',language:values.language==='km'?'km':'en',defaultLowStock:low});
    await refresh();toast(tx('settingsSaved'));
  }
}
const busyForms=new WeakSet();
function bindEvents() {
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    if(button.classList.contains('modal-backdrop')&&event.target!==button)return;
    event.preventDefault();
    if(button.disabled)return;button.disabled=true;
    try{await onAction(button,event);}catch(error){console.error(error);toast(error.message||'Action failed.','error');}finally{if(button.isConnected)button.disabled=false;}
  });
  document.addEventListener('submit',async event=>{
    if(!['product-form','stock-form','stock-modal-form','settings-form','return-form','clear-form'].includes(event.target.getAttribute('id')))return;
    event.preventDefault();
    if(busyForms.has(event.target))return;busyForms.add(event.target);
    const submit=event.target.querySelector('button[type=submit]');if(submit){submit.disabled=true;}
    try{event.target.querySelector('.form-error')?.remove();await handleForm(event.target);}catch(error){console.error(error);const message=error.message||'Save failed.';const feedback=document.createElement('p');feedback.className='form-error';feedback.setAttribute('role','alert');feedback.textContent=message;event.target.append(feedback);toast(message,'error');}
    finally{busyForms.delete(event.target);if(submit?.isConnected)submit.disabled=false;}
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='sale-note')state.saleNote=event.target.value;
    if(event.target.id==='sale-customer')state.customer=event.target.value;
    if(event.target.id==='history-search'){state.historySearch=event.target.value;state.salePage=1;rerenderWithFocus('history-search');}
    if(event.target.id==='product-search'){state.search=event.target.value;state.productPage=1;rerenderWithFocus('product-search');}
    if(event.target.id==='sale-search'){state.saleSearch=event.target.value;state.posPage=1;rerenderWithFocus('sale-search');}
  });
  document.addEventListener('change',event=>{
    const v=event.target.value,id=event.target.id;
    if(event.target.dataset.cartId){const row=state.cart.find(i=>i.productId===event.target.dataset.cartId);try{const quantity=asInteger(v,'Quantity');if(quantity<1)throw new Error('Quantity must be positive.');row.quantity=quantity;}catch(error){toast(error.message,'error');}render();}
    if(id==='archived-filter'){state.archived=event.target.checked;state.productPage=1;render();}
    for(const [input,key] of [['history-status','historyStatus'],['history-from','historyFrom'],['history-to','historyTo'],['report-from','reportFrom'],['report-to','reportTo']])if(id===input){state[key]=v;state.salePage=1;render();}
    if(id==='product-category'){state.category=v;state.productPage=1;render();}
    if(id==='product-filter'){state.filter=v;state.productPage=1;render();}
    if(id==='product-sort'){state.sort=v;render();}
    if(id==='report-period'){state.reportPeriod=v;render();}
  });
  $('lang-en').addEventListener('click',()=>safely(()=>saveSettings({language:'en'})));
  $('lang-km').addEventListener('click',()=>safely(()=>saveSettings({language:'km'})));
  $('mobile-menu').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('sidebar-backdrop').classList.toggle('visible');});
  $('sidebar-backdrop').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('sidebar-backdrop').classList.remove('visible');});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeModal();$('sidebar').classList.remove('open');$('sidebar-backdrop').classList.remove('visible');}
    if(event.key==='Tab'&&state.modal){const nodes=[...$('modal-root').querySelectorAll('button:not(:disabled), input:not([type=hidden]):not(:disabled), select, textarea, [tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  });
  $('restore-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>50*1024*1024){toast('Backup file exceeds 50 MB.','error');return;}
    try{
      const backup=JSON.parse(await file.text());
      const data=validateBackup(backup);
      pendingBackup=backup;
      confirmModal(tx('restoreFromBackup'),`${data.products.length} ${tx('products')} · ${data.sales.length} ${tx('sales')} · ${data.returns.length} ${tx('returned')} · ${data.movements.length} ${tx('recentMovements')}. ${tx('restoreWarning')} ${tx('preRestoreBackup')}`,{name:'confirm-restore'},tx('replaceRestore'));
    }catch(error){toast(error.message||'Invalid JSON backup.','error');}
  });
  $('csv-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>5*1024*1024){toast('CSV file is too large (5 MB maximum).','error');return;}
    try{
      const rows=parseCSV(await file.text());if(rows.length<2)throw new Error('CSV must contain a header and at least one product.');
      const keys=rows[0].map(v=>v.trim().toLowerCase());
      const allowed=['name','sku','category','cost','price','quantity','lowstockat','description','supplier','status'];
      if(new Set(keys).size!==keys.length||keys.some(k=>!allowed.includes(k)))throw new Error('CSV has duplicate or unsupported column names.');
      for(const required of ['name','price','quantity']) if(!keys.includes(required))throw new Error(`CSV missing required column: ${required}`);
      const products=rows.slice(1).map((values,i)=>{
        if(values.length!==keys.length)throw new Error(`Row ${i+2} has an incorrect number of columns.`);
        const row=Object.fromEntries(keys.map((key,j)=>[key,values[j]]));
        return {name:row.name,sku:row.sku||'',category:row.category||'Uncategorized',cost:row.cost||0,price:row.price,quantity:row.quantity,lowStockAt:row.lowstockat??state.settings.defaultLowStock,description:row.description||'',supplier:row.supplier||'',status:row.status||'active'};
      });
      const count=await importProducts(products);await refresh();toast(`Imported ${count} products successfully.`);
    }catch(error){console.error(error);toast(error.message,'error');}
  });
  window.addEventListener('hashchange',()=>{const route=location.hash.slice(1);if(['dashboard','products','sales','restock','reports','backup','settings'].includes(route))navigate(route);});
}
async function setupPWA() {
  const badge=$('offline-badge');badge.title=tx('offlineNotReady');badge.querySelector('span:last-child').textContent=tx('offlineNotReady');
  if('serviceWorker' in navigator&&location.protocol!=='file:')try {
    const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    const ready=()=>{state.offlineReady=true;badge.title=tx('offlineReady');badge.querySelector('span:last-child').textContent=tx('offlineReady');};
    if(navigator.serviceWorker.controller)ready();
    navigator.serviceWorker.addEventListener('controllerchange',ready);
    if(registration.waiting)toast(tx('updateAvailable'));
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)toast(tx('updateAvailable'));});});
  }catch(error){badge.title=error.message;}
  let installEvent;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;const button=$('install-app');button.hidden=false;button.textContent=tx('installApp');});
  $('install-app').addEventListener('click',async()=>{if(!installEvent)return;await installEvent.prompt();await installEvent.userChoice;installEvent=null;$('install-app').hidden=true;});
}
async function start() {
  bindEvents();
  try{
    await openDatabase();
    const hash=location.hash.slice(1);
    if(['dashboard','products','sales','restock','reports','backup','settings'].includes(hash))state.page=hash;
    await refresh();setupPWA();
    onDatabaseChange(async()=>{try{if(state.modal||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){await refresh(false);toast(tx('otherTab'));return;}await refresh();}catch(error){toast(error.message,'error');}});
    window.addEventListener('focus',()=>{if(!state.modal&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))refresh().catch(error=>toast(error.message,'error'));});
    window.addEventListener('smartstock-db-blocked',()=>toast(tx('databaseBlocked'),'error'));
  }catch(error){
    $('main').innerHTML=`<div class="panel fatal-error"><h2>Unable to start SmartStock</h2><p>${e(error.message)}</p><p>Try using Chrome, Edge, Firefox, or Safari in a normal (non-private) browser window and enable site storage.</p></div>`;
    toast(error.message,'error');
  }
}
start();
