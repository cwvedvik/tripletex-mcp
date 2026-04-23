import { describe, it, expect } from 'vitest';
import { wrapPostingsForSupplierInvoiceUpdate } from '../../src/tripletex-transform.js';
import type { SupplierInvoicePostingUpdateInput } from '../../src/tripletex-transform.js';

describe('wrapPostingsForSupplierInvoiceUpdate', () => {
  describe('happy path', () => {
    it('wraps a single item with required fields as a one-element array of { posting: {...} }', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 1000 },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      expect(result).toEqual([
        {
          posting: {
            row: 1,
            account: { id: 1500 },
            amountGross: 1000,
            date: '2026-04-23',
            amountGrossCurrency: 1000,
          },
        },
      ]);
      expect(result.length).toBe(1);
    });

    it('wraps multiple items so each element is { posting: {...} }', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 1000 },
        { row: 2, accountId: 2400, amountGross: -1000 },
        { row: 3, accountId: 3000, amountGross: 250 },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      expect(result).toEqual([
        {
          posting: {
            row: 1,
            account: { id: 1500 },
            amountGross: 1000,
            date: '2026-04-23',
            amountGrossCurrency: 1000,
          },
        },
        {
          posting: {
            row: 2,
            account: { id: 2400 },
            amountGross: -1000,
            date: '2026-04-23',
            amountGrossCurrency: -1000,
          },
        },
        {
          posting: {
            row: 3,
            account: { id: 3000 },
            amountGross: 250,
            date: '2026-04-23',
            amountGrossCurrency: 250,
          },
        },
      ]);
    });
  });

  describe('per-item posting content', () => {
    it('always includes row, account: { id: accountId }, amountGross, and date', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 7, accountId: 1920, amountGross: 500 },
      ];
      const [wrapped] = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      expect(wrapped).toBeDefined();
      const posting = (wrapped as { posting: Record<string, unknown> }).posting;
      expect(posting.row).toBe(7);
      expect(posting.account).toEqual({ id: 1920 });
      expect(posting.amountGross).toBe(500);
      expect(posting.date).toBe('2026-04-23');
    });

    it('uses voucherDate when item.date is undefined and uses item.date when defined (override)', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
        { row: 2, accountId: 1500, amountGross: 200, date: '2026-05-01' },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      const first = (result[0] as { posting: Record<string, unknown> }).posting;
      const second = (result[1] as { posting: Record<string, unknown> }).posting;
      expect(first.date).toBe('2026-04-23');
      expect(second.date).toBe('2026-05-01');
    });

    it('defaults amountGrossCurrency to amountGross when undefined and uses the provided value when defined', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 1000 },
        { row: 2, accountId: 1500, amountGross: 1000, amountGrossCurrency: 95.5 },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      const first = (result[0] as { posting: Record<string, unknown> }).posting;
      const second = (result[1] as { posting: Record<string, unknown> }).posting;
      expect(first.amountGrossCurrency).toBe(1000);
      expect(second.amountGrossCurrency).toBe(95.5);
    });
  });

  describe('optional field matrix', () => {
    it('includes id when defined and omits it when undefined', () => {
      const voucherDate = '2026-04-23';
      const withField: SupplierInvoicePostingUpdateInput[] = [
        { id: 999, row: 1, accountId: 1500, amountGross: 100 },
      ];
      const withoutField: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
      ];
      const resultWith = wrapPostingsForSupplierInvoiceUpdate(voucherDate, withField);
      const resultWithout = wrapPostingsForSupplierInvoiceUpdate(voucherDate, withoutField);
      const postingWith = (resultWith[0] as { posting: Record<string, unknown> }).posting;
      const postingWithout = (resultWithout[0] as { posting: Record<string, unknown> }).posting;
      expect(postingWith.id).toBe(999);
      expect('id' in postingWith).toBe(true);
      expect('id' in postingWithout).toBe(false);
    });

    it('wraps vatTypeId as { vatType: { id: N } } when defined and omits vatType when undefined', () => {
      const voucherDate = '2026-04-23';
      const withField: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100, vatTypeId: 3 },
      ];
      const withoutField: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
      ];
      const postingWith = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withField)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      const postingWithout = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withoutField)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      expect(postingWith.vatType).toEqual({ id: 3 });
      expect('vatType' in postingWith).toBe(true);
      expect('vatTypeId' in postingWith).toBe(false);
      expect('vatType' in postingWithout).toBe(false);
    });

    it('includes description when defined and omits it when undefined', () => {
      const voucherDate = '2026-04-23';
      const withField: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100, description: 'Invoice line' },
      ];
      const withoutField: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
      ];
      const postingWith = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withField)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      const postingWithout = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withoutField)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      expect(postingWith.description).toBe('Invoice line');
      expect('description' in postingWith).toBe(true);
      expect('description' in postingWithout).toBe(false);
    });

    it('wraps supplierId/customerId as { supplier: { id: N } } / { customer: { id: N } } when defined and omits them when undefined', () => {
      const voucherDate = '2026-04-23';
      const withFields: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100, supplierId: 42, customerId: 77 },
      ];
      const withoutFields: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
      ];
      const postingWith = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withFields)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      const postingWithout = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withoutFields)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      expect(postingWith.supplier).toEqual({ id: 42 });
      expect(postingWith.customer).toEqual({ id: 77 });
      expect('supplierId' in postingWith).toBe(false);
      expect('customerId' in postingWith).toBe(false);
      expect('supplier' in postingWithout).toBe(false);
      expect('customer' in postingWithout).toBe(false);
    });

    it('wraps projectId/departmentId as { project: { id: N } } / { department: { id: N } } when defined and omits them when undefined', () => {
      const voucherDate = '2026-04-23';
      const withFields: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100, projectId: 11, departmentId: 22 },
      ];
      const withoutFields: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
      ];
      const postingWith = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withFields)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      const postingWithout = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, withoutFields)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      expect(postingWith.project).toEqual({ id: 11 });
      expect(postingWith.department).toEqual({ id: 22 });
      expect('projectId' in postingWith).toBe(false);
      expect('departmentId' in postingWith).toBe(false);
      expect('project' in postingWithout).toBe(false);
      expect('department' in postingWithout).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns [] for an empty input array', () => {
      const result = wrapPostingsForSupplierInvoiceUpdate('2026-04-23', []);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('includes id: 0 (zero is valid, not filtered)', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { id: 0, row: 1, accountId: 1500, amountGross: 100 },
      ];
      const posting = (wrapPostingsForSupplierInvoiceUpdate(voucherDate, items)[0] as {
        posting: Record<string, unknown>;
      }).posting;
      expect(posting.id).toBe(0);
      expect('id' in posting).toBe(true);
    });

    it('preserves array order so input[i] maps to output[i]', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 10, accountId: 1500, amountGross: 100 },
        { row: 20, accountId: 2500, amountGross: 200 },
        { row: 30, accountId: 3500, amountGross: 300 },
        { row: 40, accountId: 4500, amountGross: 400 },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      expect(result.length).toBe(items.length);
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i] as SupplierInvoicePostingUpdateInput;
        const posting = (result[i] as { posting: Record<string, unknown> }).posting;
        expect(posting.row).toBe(item.row);
        expect(posting.account).toEqual({ id: item.accountId });
        expect(posting.amountGross).toBe(item.amountGross);
      }
    });
  });

  describe('invariants', () => {
    it('output length equals input length', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
        { row: 2, accountId: 1500, amountGross: 200 },
        { row: 3, accountId: 1500, amountGross: 300 },
        { row: 4, accountId: 1500, amountGross: 400 },
        { row: 5, accountId: 1500, amountGross: 500 },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      expect(result.length).toBe(items.length);
    });

    it('each wrapped element has posting as its sole top-level key', () => {
      const voucherDate = '2026-04-23';
      const items: SupplierInvoicePostingUpdateInput[] = [
        { row: 1, accountId: 1500, amountGross: 100 },
        {
          id: 5,
          row: 2,
          accountId: 2500,
          amountGross: 200,
          amountGrossCurrency: 190,
          date: '2026-05-01',
          vatTypeId: 3,
          description: 'desc',
          supplierId: 42,
          customerId: 77,
          projectId: 11,
          departmentId: 22,
        },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate(voucherDate, items);
      for (const element of result) {
        const keys = Object.keys(element);
        expect(keys).toEqual(['posting']);
        expect('posting' in element).toBe(true);
      }
    });
  });
});
