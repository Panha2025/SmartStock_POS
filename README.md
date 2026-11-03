# SmartStock POS

Offline-first inventory and point-of-sale software for small shops, with a responsive blue-and-white interface in English and Khmer. Business records stay in IndexedDB in the visitor's browser. No login, cloud database, external API, runtime CDN, or subscription is required.

Source repository: https://github.com/Panha2025/SmartStock_POS

## Run locally — Mac, Windows or VS Code

Install **Node.js 20 or newer** (Node.js 24 is used for development). Clone or download this repository, then open its folder in VS Code. Choose **Terminal → New Terminal** and run:

```sh
git clone https://github.com/Panha2025/SmartStock_POS.git
cd SmartStock_POS
npm start
```

If the project is already open, run only `npm start` in its folder. Open **http://127.0.0.1:4173/**. There are no runtime dependencies, so `npm install` is unnecessary for daily use. Keep the terminal running when using the local server.

- **Mac:** Terminal commands above, or double-click `RUN_ON_MAC.command`. If necessary, right-click → Open. `chmod +x RUN_ON_MAC.command` makes the launcher executable.
- **Windows:** Use PowerShell or VS Code's terminal, or double-click `RUN_ON_WINDOWS.bat`.
- Do not double-click `index.html`: browsers block the ES modules on `file://`. The page displays startup instructions in that case.
- If port 4173 is already occupied, stop the other server or use the existing one. Changing port, hostname, browser, or profile creates a different storage location. `localhost` and `127.0.0.1` are different origins.

## Working features

| Area | Behavior |
| --- | --- |
| Products | Add, edit, details, supplier, description, SKU uniqueness, categories, archive/reactivate, guarded deletion, search, category/stock filters, four sort orders, 25-row pagination, CSV import/export |
| Inventory | Opening stock, restock, positive/negative adjustments with a required reason, customizable low/out-of-stock indicators, complete paginated movement history |
| POS | Multi-item cart, quantity entry and controls, customer and notes, confirmation, atomic stock deduction, historical price/cost/currency snapshots, receipt details and print layout |
| Returns | Partial/full returns and voids, original-price refunds, transactional stock restoration, no repeated restoration of returned units |
| Dashboard | Active products, available/low/out-of-stock counts, active units, today's and lifetime net revenue, estimated gross profit, inventory value, recent stock activity, working quick actions |
| Reports | Today, current week/month, rolling periods, all-time/custom dates, net revenue, cost of goods sold, gross profit, daily chart/table, best sellers, stock warnings, valuation and CSV exports |
| Backup | Version 2 JSON export, validated version 1/2 restoration, summary and explicit confirmation, pre-replacement backup export, atomic rollback on failure |
| Settings | Shop name/details, USD/KHR, English/Khmer, default threshold, comfortable/compact spacing, storage estimates/persistence request, backup access, strongly confirmed clear-all |
| Offline | Manifest/icons, install prompt when supported, cached static shell, offline read/write/navigation, updates without database deletion |

The original Add Product bug was caused by a hidden input named `id` shadowing the form's `id` property. Submission now uses `getAttribute('id')`; real-browser regression tests verify saving and persistence after reload. Demo insertion and hardcoded dashboard statistics are absent.

## Day-to-day use

1. In **Settings**, select USD or KHR before adding inventory, and enter your shop details.
2. **Add Product** requires a name, cost, selling price and nonnegative whole stock quantity. Optional SKU must be unique, including archived products. Set each product's warning threshold as needed.
3. In **Sales**, add items, set quantities, enter optional customer/notes and confirm. Availability and prices are checked again inside the database transaction. A failed checkout makes no partial stock changes.
4. **Restock** adds received stock; **Stock correction** or **Remove Stock** corrects quantities. Every change needs a reason.
5. Use the return icon in sales history for partial/full returns. Void cancels the remaining unreturned quantities. Receipt details show original total, refunds and net revenue.
6. Archive products with history. Permanent deletion is allowed only for unused products with zero stock and no movements or sales.
7. Export a backup regularly and verify that the file is saved outside the browser.

## Money and reporting rules

- Canonical amounts are **safe integer hundredths** (`priceMinor`, `costMinor`, `totalMinor`, etc.). Both USD and KHR allow at most two decimal places. No exchange-rate conversion occurs.
- Currency is locked once products or sales exist. To operate another currency, use a separate browser profile/origin or back up and explicitly clear the shop first.
- Each sale embeds immutable product name/SKU and selling-price/purchase-cost snapshots. Later product edits do not alter historical profit.
- Sales count on their sale date. Refunds and voids subtract revenue and cost **on their processing date**, using original item prices. A later period can therefore show negative net revenue. Lifetime totals net out returned/voided quantities.
- Gross profit excludes rent, tax, discounts, payment fees and other operating expenses. This is an inventory/POS tool, not full accounting software.
- Inventory valuation uses current product costs and includes archived stock; headline product/unit counts use active inventory. “In Stock” means above the warning threshold; low/out-of-stock groups are separate.
- Reports use the browser's local calendar/timezone. Weeks start Monday. Charts group all selected activity days into at most 30 bars; the daily table shows the latest 31 activity days. Selected-period CSV includes every activity day. Sales-history CSV contains lifetime sales with current refund status.

## Backup and restore

Choose **Backup → Backup Now** to create `SmartStock_Backup_YYYY-MM-DD.json`. Check Downloads and retain a copy on a separate drive/device. The last export time records export initiation; browsers do not confirm that a file was retained safely. Backups are **manual**, not automatic or cloud-synced.

A backup contains metadata, schema version and all eight stores: products, sales (including embedded sale items), returns, stock movements (including restocks), categories, suppliers, settings and duplicate-operation records.

To restore:

1. Open Backup and select a JSON file (50 MB maximum).
2. SmartStock checks format/version, field types, dates, unique identifiers/SKUs, monetary totals, product/sale/return relationships, returned quantities and stock balances.
3. Review the summary and replacement warning. Cancel leaves current records alone.
4. Confirm **Replace & restore**. A pre-replacement JSON export is initiated first. Keep that file too; browser download permissions must allow it.
5. All tables are replaced in one transaction. Validation errors or write failures leave the existing database unchanged.

**Clear all data** requires typing `DELETE ALL DATA` and also initiates a pre-replacement export. Closing tabs and reopening does not erase records; clearing site data can. Persistent-storage permission can reduce eviction but cannot prevent device loss, malware or deliberate deletion.

### Existing version 1 data

The database remains named `smartstock-local-v1`; its IndexedDB schema upgrades to version **2** without dropping stores. Existing fields and histories are retained. Old releases allowed deletion of sold products: migration recovers archived product identities and a balancing movement while keeping their deleted stock at zero, so subsequent returns are possible.

Version 1 did not store currency per sale. Its existing shop currency is assigned to legacy sales; if currencies were previously mixed, review those records before relying on reports. Existing decimal money is rounded to integer hundredths for new calculations; original legacy decimal fields remain in backups. Make a backup before upgrades and review migrated balances.

### CSV products

Use **Download CSV Template**. Required headers are `name`, `price`, `quantity`; supported headers are:

```csv
name,sku,category,cost,price,quantity,lowStockAt,description,supplier,status
USB Cable,USB-001,Cables,1.50,3.00,50,5,Braided cable,Local supplier,active
```

Imports add products, do not overwrite matching SKUs, and validate the entire batch before writing. Limits: 5 MB and 25,000 products. Duplicate/unknown headers, malformed quotation, invalid quantities/prices and duplicate SKUs reject the entire import. Exported text that could be a spreadsheet formula receives an apostrophe prefix; keep JSON backups for exact recovery rather than CSV.

## Architecture and privacy

Native HTML/CSS/ES modules; no framework migration or production dependencies.

```text
index.html + styles.css + JavaScript modules
                   |
          transactional IndexedDB
                   |
       explicit JSON / CSV downloads
```

- `js/app.js`: screens, event handling, focus management, forms and exports.
- `js/db.js`: database upgrade, transactional business commands, duplicate-operation IDs, tab notifications, backup/restore.
- `js/schema.js`: version conversion and backup integrity validation.
- `js/utils.js`: integer amounts, reports, CSV and rendering helpers.
- `js/i18n.js`: English/Khmer interface labels.
- `js/bootstrap.js`: clear instructions for unsupported direct file opening.
- `sw.js`, `manifest.webmanifest`, `assets/`: cached app shell and PWA metadata.
- `server.mjs`: loopback-only development server with an explicit public-asset allowlist and CSP.
- `tests/`: database/migration/utility tests and real Playwright browser workflows.

Sales, returns and stock changes update related records in one transaction. IndexedDB serializes competing writes between tabs; persisted operation IDs prevent duplicate commands. Product revision checks reject stale edits. BroadcastChannel refreshes other tabs while preserving open form input.

User text is escaped before HTML insertion. JSON and CSV are validated. Only listed application assets enter the service-worker cache. Business records never become source files or public cached assets. The app makes no analytics or business-data network requests. Local storage is not encryption: malware, unsafe extensions or device access can still compromise records.

## Offline use and updates

Load from localhost/loopback or HTTPS while connected until **Offline Ready** appears. Then core inventory, sales, reports and navigation work without network access. Install via the browser or **Install app** when offered. Initial loading and the initial cache fill need the application server.

Service-worker updates wait until old tabs close, preventing old/new modules from mixing. Close all SmartStock tabs and reopen when notified. Releases must update the cache version in `sw.js` whenever cached assets change. Database upgrades preserve records and never use cache deletion to remove inventory.

## GitHub Pages compatibility

All assets, manifest URLs and service-worker registration are relative. Hash navigation works beneath **`/SmartStock_POS/`**; the test server exposes that path for automated offline verification.

The expected future URL is https://panha2025.github.io/SmartStock_POS/. **This task prepares compatibility and pushes source; it does not enable or deploy GitHub Pages.** No deployment workflow is included. Moving from localhost to that origin requires an explicit backup/restore; records do not move automatically.

## Development and tests

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:browser
# or: npm run test:all
```

On Linux, Playwright may need `npx playwright install --with-deps chromium`. An installed Chrome can be used with `PW_CHANNEL=chrome npx playwright test` on Mac/Linux (PowerShell: `$env:PW_CHANNEL='chrome'; npx playwright test`).

`npm run check` checks syntax and runs Node tests with `fake-indexeddb`, including transaction rollback, concurrent operations, returns, currency rules, backup integrity and legacy migration. Playwright uses fresh browser contexts and a separate port (4174); destructive tests never access a genuine user profile. Browser tests cover the five-product acceptance workflow, both languages, mobile/tablet layouts, CSV with 1,001 products, printing CSS, multi-tab races and offline GitHub Pages paths. Reports, downloaded test backups and traces remain ignored by Git.

See [the development report](docs/DEVELOPMENT_REPORT.md) for executed results and verification boundaries.

## Limitations and future improvements

- No cross-device sync, accounts, product photos, tax/discount engine, receipt printer integration or automatic backups.
- Browser/profile/origin storage is independent. Private browsing, quotas, storage eviction and deleted site data can affect persistence. Keep external backups.
- Stock is whole units. Costs are current purchase costs captured at sale time, not FIFO or weighted-average costing. Returned goods are assumed resellable; record a reasoned stock adjustment for damaged returns.
- The interface uses Khmer-compatible system fonts; some technical validation and browser-permission messages remain English. Review translations with a native shop user before a broad rollout.
- Tables paginate, but reports and search currently read a consistent full database snapshot. A 1,001-product browser case is verified; very large multi-year ledgers need profiling and indexed queries.
- Automated verification targets Chromium. Physical printer output, OS-level installation, Firefox, Safari and Edge still need device-specific acceptance checks.
- A license has not been selected for this publication. No new license grant is made; the pre-existing local license reference is not published without approval.

Potential future work: broader browser/device QA, indexed date queries, configurable receipt paper sizes, audited price changes, purchase orders and native review of every Khmer diagnostic message. Cloud sync and pictures remain outside this version's scope.
