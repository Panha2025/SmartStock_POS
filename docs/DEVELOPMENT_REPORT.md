# SmartStock POS 2.0 — development and verification

Work date: **3 November 2026** (Asia/Phnom_Penh).

## Delivered behavior

The native HTML/CSS/JavaScript project remains buildless and offline-first. Its blue-and-white layout is retained. Inventory, transactions, returns, settings and all recovery records remain local in IndexedDB.

- Fixed Add Product and reload persistence. A hidden form input named `id` shadowed `form.id`, bypassing the old handler and causing native form navigation. Handlers now read the actual ID attribute, block duplicate submissions, show persistent form errors, and have real-browser regression coverage.
- Added product supplier/details, archive/reactivate, safe deletion restrictions, all requested filters/sorts, and paginated product, POS, sales and movement views.
- Added reasoned stock corrections, atomic sales/returns, partial/full returns, guarded voiding, duplicate-operation records, cross-tab write serialization and revision-based stale-edit rejection.
- Implemented integer money snapshots and currency locking. Reports use sale-date revenue and processing-date refunds/voids, with consistent net revenue, cost and gross profit.
- Completed dashboard totals, report periods/custom dates, real-data charts, stock warning exports, receipts, customer details and transaction search.
- Added complete versioned backup, relationship/arithmetic/stock-balance validation, preview/confirmation, pre-replacement export, transactional restore, strong clear-all confirmation and storage controls.
- Preserved the existing database name and added in-place schema 2 migration. Legacy sold products that were deleted are reconstructed as archived identities so returns can preserve relationships.
- Expanded English/Khmer labels, accessible modal focus behavior, mobile/tablet layouts, compact appearance and shop receipt details.
- Restricted the local server and offline cache to public application assets. Added clear `file://` startup instructions, safe service-worker update waiting, and relative GitHub Pages paths.

## Main files

| Files | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `js/app.js` | Working screens, forms, responsive UI, safe rendering and actions |
| `js/db.js`, `js/schema.js`, `js/utils.js` | Transactions, migration, integer money, reporting, CSV and backup validation |
| `js/i18n.js`, `js/bootstrap.js` | Language labels and direct-file startup guidance |
| `sw.js`, `manifest.webmanifest`, `assets/` | Offline shell and existing PWA icons |
| `server.mjs`, platform launchers | Loopback server and local startup |
| `package.json`, lockfile, Playwright config, `tests/` | Reproducible development dependencies and verification |
| `.github/workflows/test.yml` | Read-only CI that tests pushes/PRs; no deployment |
| `.gitignore`, README, this report, START-HERE | Publication exclusions and usage/maintenance documentation |

No cloud backend, authentication service, image storage or mandatory online API was introduced. Dexie and framework migration were unnecessary.

## Executed tests

The original suite passed **13 tests** before modifications but did not submit a real browser form. A new Chromium test reproduced Add Product failing before the fix and passing afterward.

Current validation:

- **28 Node tests passed** with `npm run check`, including all JavaScript syntax checks. Tests cover products, duplicate SKUs, stock/returns/voids, money snapshots, concurrent transactions, duplicate commands, currency rules, reports, migration, backup validation/rollback, CSV and escaping.
- **12 Playwright scenarios passed in one final suite** in isolated Chromium contexts, including the real-browser version 1 migration scenario. No failed scenarios remain.
- `bash -n RUN_ON_MAC.command` passed.
- Desktop and Khmer mobile screenshots were generated for visual review; physical printing was not tested. The receipt print callback and print CSS were exercised, with an isolated test PDF generated.

Browser scenarios:

1. Add Product through the actual form, inventory display and reload persistence.
2. Five products, edit, multi-item sale, restock, dashboard/report calculations, export, and restore into a separate empty browser context.
3. Search, category/stock filters, sorting, product details, archive/reactivate and guarded deletion.
4. Partial return, receipt refund details, history search, and void of remaining units.
5. CSV template/import/export, atomic duplicate rejection and pagination/search over 1,001 products.
6. Two tabs competing for stock and rejection of stale product edits.
7. Settings, KHR, Khmer, modal keyboard navigation, mobile menu and clear-all confirmation.
8. Offline application load, product creation, checkout and reports beneath `/SmartStock_POS/`; private server paths return 404.
9. Escaped user text and invalid backup rejection without record loss.
10. Full-return action, repeated submit/click protection, receipt print callback and print layout.
11. Every route at 390px and 768px without document overflow; invalid/valid manual stock adjustment.
12. Actual browser version 1 IndexedDB upgrade preserves inventory and exports a valid version 2 backup.

All destructive scenarios used synthetic data in fresh contexts; genuine browser records were not inspected, replaced or uploaded. Earlier failing assertions were corrected and rerun. Test traces/downloads and screenshot artifacts are excluded from Git.

## Numerical acceptance evidence

The five-product browser workflow starts with 88 units and purchase-cost value 222 USD. After changing the cable selling price to 6 USD, selling five cables plus two chargers yields:

- Net revenue: **46 USD**.
- Cost of goods sold: **18 USD**.
- Estimated gross profit: **28 USD**.
- Cable stock: **45**; charger stock: **18**.

Restocking 20 earphones yields **101 total active units**, **32 earphones**, and **264 USD inventory purchase-cost value**. Reload and isolated backup restoration preserve those records.

## Source publication

Target: **Panha2025/SmartStock_POS**, branch **main**. Authentication and the empty repository were verified before initialization. No force push, history replacement, visibility change or new repository is required. Public-source exclusions cover credentials, browser records/backups, local tooling state, test artifacts and the existing unapproved local license reference. GitHub Pages is prepared but not enabled or deployed.

The final chat handoff provides the actual commit SHA and verified remote status. CI tests source only and has no Pages deployment permission.

## Remaining verification and limitations

- Chromium is the tested browser. Firefox, Safari, Edge, physical receipt printers and OS-level installation still require device-specific checks.
- Some technical validation/browser-permission messages remain English. Primary navigation, forms, reports and important recovery warnings support Khmer with compatible system fonts; native-language review is recommended.
- No automatic backups, multiple-device sync, tax/discount processing, fractional stock, image support or full accounting ledger is included.
- Legacy data never recorded transaction currencies; migration uses the existing shop currency. Review any historically mixed-currency records. Canonical legacy money rounds to hundredths while preserving original decimal fields in exported records.
- Reports and search read full snapshots. Rendering was tested with 1,001 products, not an arbitrarily large multi-year ledger.
- Local storage can be cleared or lost; exporting a backup does not prove it was retained on disk. Keep and test external backups.
- A public license has not been approved. The existing local `LICENSE` remains untouched and ignored; package metadata is `UNLICENSED`.

## Local use

Run `npm start` from this folder and open **http://127.0.0.1:4173/**. No install step is needed for runtime. Developers use `npm ci`, `npx playwright install chromium`, then `npm run test:all`. Select currency before entering inventory. Use **Backup → Backup Now**, verify the download, and keep copies outside the browser.
