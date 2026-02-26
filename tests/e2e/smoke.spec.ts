import { test, expect } from '@playwright/test';

test('login page loads successfully', async ({ page }) => {
  await page.goto('/login');
  
  // Check for title
  await expect(page).toHaveTitle(/JRMD Studio/);
  
  // Check for email and password inputs (these might be inside a tab, so we check if they are attached)
  // Since there are two forms (login and signup), getting by label might return multiple elements if not scoped.
  // But initially the "Login" tab is active.
  
  // Let's target the login form specifically if possible, or just check generic elements.
  // The label is "Email" and "Password"
  
  // Check for Login button
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  
  // Check for tabs
  await expect(page.getByRole('tab', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sign Up' })).toBeVisible();
});
