const {test,expect}=require('@playwright/test');
test('login, navigate, safe rendering, product creation and responsive shell',async({page},testInfo)=>{
 const productName='UI regression '+testInfo.project.name;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/admin.html');await page.getByLabel('Admin API key').fill('test-admin-key-'.repeat(3));await page.getByRole('button',{name:'Đăng nhập / Sign in →'}).click();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('.metric')).toHaveCount(4);await page.screenshot({path:testInfo.outputPath('dashboard.png'),fullPage:true});
 await page.getByRole('button',{name:'Sản phẩm',exact:true}).click();await expect(page.locator('#table')).toContainText('<img src=x onerror=alert(1)>');expect(await page.locator('#table img').count()).toBe(0);
 await page.locator('#add').click();await page.getByLabel('Tên / Name').fill(productName);await page.getByLabel('Giá VND / Price').fill('50000');await page.getByRole('button',{name:'Lưu / Save'}).click();await expect(page.locator('#dialog')).not.toBeVisible();await expect(page.locator('#table')).toContainText(productName);
 await page.locator('#search').fill(productName);await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.locator('#lang').selectOption('en');await expect(page.locator('#title')).toHaveText('Products');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.evaluate(()=>localStorage.getItem('bot_admin_key'))).toBeNull();expect(errors).toEqual([]);
});
