import {test, expect} from '@playwright/test';

test('Add Product saves through the real form and persists after reload', async ({page}) => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Add Product',exact:true}).first().click();
  await page.locator('#product-form [name=name]').fill('Browser test cable');
  await page.locator('#product-form [name=sku]').fill('BROWSER-1');
  await page.locator('#product-form [name=cost]').fill('1.25');
  await page.locator('#product-form [name=price]').fill('3.50');
  await page.locator('#product-form [name=quantity]').fill('50');
  await page.getByRole('button',{name:'Save Product',exact:true}).click();
  await expect(page.locator('#modal-root')).toBeEmpty();
  await expect(page.locator('#main')).toContainText('Browser test cable');
  await page.reload();
  await expect(page.locator('#main')).toContainText('Browser test cable');
  expect(errors).toEqual([]);
});
