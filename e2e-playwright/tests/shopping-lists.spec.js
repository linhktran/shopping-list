const { test, expect } = require("@playwright/test");

test("Main page has expected title and paragraph.", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Shared shopping lists");
    await expect(page.locator("p")).toHaveText("Lists");
});

test("Can create a list.", async ({ page }) => {
    await page.goto("/lists");
    const listName = `My list: ${Math.random()}`;
    await page.locator("input[type=text]").type(listName);
    await page.getByRole('button', {name: 'Create list!'}).click();
    await expect(page.locator(`a >> text='${listName}'`)).toHaveText(listName);
});

test("Can open a list page.", async ({ page }) => {
    await page.goto("/lists");
    const listName = `My list: ${Math.random()}`;
    await page.locator("input[type=text]").type(listName);
    await page.getByRole('button', {name: 'Create list!'}).click();
    await page.locator(`a >> text='${listName}'`).click();
    await expect(page.locator("h1")).toHaveText(listName);
});

test("Can add an item to a list.", async ({ page }) => {
    await page.goto("/lists");
    const listName = `My list: ${Math.random()}`;
    await page.locator("input[type=text]").type(listName);
    await page.getByRole('button', {name: 'Create list!'}).click();
    await page.locator(`a >> text='${listName}'`).click();
    const itemName = `My item: ${Math.random()}`;
    await page.locator("input[type=text]").type(itemName);
    await page.getByRole('button', {name: 'Add item'}).click();
    await expect(page.getByText(`${itemName}`)).toBeVisible();
});

test("Can mark an item as collected in a list.", async ({ page }) => {
    await page.goto("/lists");
    const listName = `My list: ${Math.random()}`;
    await page.locator("input[type=text]").type(listName);
    await page.getByRole('button', {name: 'Create list!'}).click();
    await page.locator(`a >> text='${listName}'`).click();
    const itemName = `My item: ${Math.random()}`;
    await page.locator("input[type=text]").type(itemName);
    await page.getByRole('button', {name: 'Add item'}).click();
    await page.getByRole('button', {name: 'Mark collected!'}).click();
    await expect(page.locator("del")).toHaveText(`${itemName}`);
});

test("Can deactivate a list.", async ({ page }) => {
    await page.goto("/lists");
    const listName = `My list: ${Math.random()}`;
    await page.locator("input[type=text]").type(listName);
    await page.getByRole('button', {name: 'Create list!'}).click();
    await page.getByRole('listitem').filter({ hasText: `${listName}` }).getByRole('button', { name: 'Deactivate list!' }).click();
    await expect(page.getByText(`${listName}`)).not.toBeVisible();
});