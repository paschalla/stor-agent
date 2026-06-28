import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(public readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async expectEmptyState() {
    const emptyStateMessage = this.page.getByTestId('empty-state-message');
    await expect(emptyStateMessage).toBeVisible();
    await expect(emptyStateMessage).toContainText('ready to add items', { ignoreCase: true });
  }

  async expectOfflineIndicator() {
    const offlineIcon = this.page.getByTestId('offline-indicator-icon');
    await expect(offlineIcon).toBeVisible();
  }
}
