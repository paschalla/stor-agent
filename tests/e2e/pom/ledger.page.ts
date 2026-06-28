import { Page, expect } from '@playwright/test';

export class LedgerPage {
  constructor(public readonly page: Page) {}

  async goto() {
    await this.page.goto('/ledger');
  }

  async expectTransactionEntry(itemId: string, type: 'inbound' | 'outbound') {
    const transaction = this.page.getByTestId(`transaction-${itemId}`);
    await expect(transaction).toBeVisible();
    
    if (type === 'inbound') {
      await expect(transaction.getByTestId('icon-up-arrow')).toBeVisible();
    } else {
      await expect(transaction.getByTestId('icon-down-arrow')).toBeVisible();
    }
  }

  async expectTransactionHistoryCount(minCount: number) {
    const transactions = this.page.getByTestId(/transaction-.*/);
    await expect(transactions.locator('nth=0')).toBeVisible();
    const count = await transactions.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }
}
