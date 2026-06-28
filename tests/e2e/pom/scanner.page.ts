import { Page, expect } from '@playwright/test';

export class ScannerPage {
  constructor(public readonly page: Page) {}

  async goto() {
    await this.page.goto('/scanner');
  }

  async simulateCameraScan(mockData: string) {
    // In a real environment, we might use Playwright to upload a file or mock the navigator.mediaDevices
    const input = this.page.getByTestId('mock-scan-input');
    await input.evaluate((node, data) => { (node as HTMLInputElement).value = data; }, mockData);
    const trigger = this.page.getByTestId('mock-scan-trigger');
    await trigger.evaluate(node => (node as HTMLButtonElement).click());
  }

  async expectMultimodalInputVisible() {
    const inputBar = this.page.getByTestId('multimodal-input-bar');
    await expect(inputBar).toBeVisible();
  }

  async submitMultimodalInput(text: string) {
    await this.page.getByTestId('multimodal-text-input').fill(text);
    await this.page.getByTestId('multimodal-submit-btn').click();
  }

  async expectItemInReviewQueue(itemId: string) {
    const queueItem = this.page.getByTestId(`review-item-${itemId}`);
    await expect(queueItem).toBeVisible();
  }

  async confirmReviewItem(itemId: string) {
    const confirmBtn = this.page.getByTestId(`confirm-item-${itemId}`);
    await confirmBtn.click();
  }
}
