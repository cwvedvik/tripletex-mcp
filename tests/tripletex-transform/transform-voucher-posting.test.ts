import { describe, it, expect } from 'vitest';
import { transformVoucherPosting } from '../../src/tripletex-transform.js';
import type { VoucherPostingInput } from '../../src/tripletex-transform.js';

describe('transformVoucherPosting', () => {
  describe('happy path', () => {
    it('maps minimal valid input to account wrapper, amountGross, and date', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 1250.5,
        date: '2026-04-23',
      };
      const out = transformVoucherPosting(input);
      expect(out).toEqual({
        account: { id: 1500 },
        amountGross: 1250.5,
        date: '2026-04-23',
      });
    });

    it('maps a full input with all 11 fields populated', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 2500,
        amountGrossCurrency: 250,
        date: '2026-04-23',
        vatTypeId: 3,
        row: 2,
        description: 'Consulting fee',
        supplierId: 42,
        customerId: 99,
        projectId: 7,
        departmentId: 11,
        termOfPayment: '2026-05-23',
        invoiceNumber: 'INV-2026-0001',
      };
      const out = transformVoucherPosting(input);
      expect(out).toEqual({
        account: { id: 1500 },
        amountGross: 2500,
        amountGrossCurrency: 250,
        date: '2026-04-23',
        vatType: { id: 3 },
        row: 2,
        description: 'Consulting fee',
        supplier: { id: 42 },
        customer: { id: 99 },
        project: { id: 7 },
        department: { id: 11 },
        termOfPayment: '2026-05-23',
        invoiceNumber: 'INV-2026-0001',
      });
    });
  });

  describe('required-field wrapping', () => {
    it('wraps accountId into account: { id } on every call', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 100,
        date: '2026-04-23',
      };
      const out = transformVoucherPosting(input);
      expect(out.account).toEqual({ id: 1500 });
    });
  });

  describe('optional field matrix', () => {
    const base: VoucherPostingInput = {
      accountId: 1500,
      amountGross: 100,
      date: '2026-04-23',
    };

    describe('amountGrossCurrency', () => {
      it('includes amountGrossCurrency when defined', () => {
        const input: VoucherPostingInput = { ...base, amountGrossCurrency: 80 };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('amountGrossCurrency', 80);
      });

      it('omits amountGrossCurrency when undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('amountGrossCurrency');
      });
    });

    describe('vatTypeId', () => {
      it('wraps vatTypeId as vatType: { id } when defined', () => {
        const input: VoucherPostingInput = { ...base, vatTypeId: 3 };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('vatType');
        expect(out.vatType).toEqual({ id: 3 });
      });

      it('omits vatType when vatTypeId is undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('vatType');
      });
    });

    describe('row', () => {
      it('includes row when defined', () => {
        const input: VoucherPostingInput = { ...base, row: 5 };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('row', 5);
      });

      it('omits row when undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('row');
      });
    });

    describe('description', () => {
      it('includes description when defined', () => {
        const input: VoucherPostingInput = { ...base, description: 'Hello' };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('description', 'Hello');
      });

      it('omits description when undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('description');
      });
    });

    describe('supplierId', () => {
      it('wraps supplierId as supplier: { id } when defined', () => {
        const input: VoucherPostingInput = { ...base, supplierId: 42 };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('supplier');
        expect(out.supplier).toEqual({ id: 42 });
      });

      it('omits supplier when supplierId is undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('supplier');
      });
    });

    describe('customerId', () => {
      it('wraps customerId as customer: { id } when defined', () => {
        const input: VoucherPostingInput = { ...base, customerId: 99 };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('customer');
        expect(out.customer).toEqual({ id: 99 });
      });

      it('omits customer when customerId is undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('customer');
      });
    });

    describe('projectId', () => {
      it('wraps projectId as project: { id } when defined', () => {
        const input: VoucherPostingInput = { ...base, projectId: 7 };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('project');
        expect(out.project).toEqual({ id: 7 });
      });

      it('omits project when projectId is undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('project');
      });
    });

    describe('departmentId', () => {
      it('wraps departmentId as department: { id } when defined', () => {
        const input: VoucherPostingInput = { ...base, departmentId: 11 };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('department');
        expect(out.department).toEqual({ id: 11 });
      });

      it('omits department when departmentId is undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('department');
      });
    });

    describe('termOfPayment', () => {
      it('includes termOfPayment when defined', () => {
        const input: VoucherPostingInput = {
          ...base,
          termOfPayment: '2026-05-23',
        };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('termOfPayment', '2026-05-23');
      });

      it('omits termOfPayment when undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('termOfPayment');
      });
    });

    describe('invoiceNumber', () => {
      it('includes invoiceNumber when defined', () => {
        const input: VoucherPostingInput = {
          ...base,
          invoiceNumber: 'INV-2026-0001',
        };
        const out = transformVoucherPosting(input);
        expect(out).toHaveProperty('invoiceNumber', 'INV-2026-0001');
      });

      it('omits invoiceNumber when undefined', () => {
        const out = transformVoucherPosting(base);
        expect(out).not.toHaveProperty('invoiceNumber');
      });
    });
  });

  describe('edge cases', () => {
    it('preserves amountGross of 0', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 0,
        date: '2026-04-23',
      };
      const out = transformVoucherPosting(input);
      expect(out).toHaveProperty('amountGross', 0);
    });

    it('preserves a negative amountGross for credit-style postings', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: -1000,
        date: '2026-04-23',
      };
      const out = transformVoucherPosting(input);
      expect(out).toHaveProperty('amountGross', -1000);
    });

    it('includes amountGrossCurrency when value is 0 (not treated as missing)', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 100,
        amountGrossCurrency: 0,
        date: '2026-04-23',
      };
      const out = transformVoucherPosting(input);
      expect(out).toHaveProperty('amountGrossCurrency', 0);
    });

    it('includes row when value is 0 (valid — not filtered out as falsy)', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 100,
        date: '2026-04-23',
        row: 0,
      };
      const out = transformVoucherPosting(input);
      expect(out).toHaveProperty('row', 0);
    });

    it('handles large numeric IDs without loss', () => {
      const input: VoucherPostingInput = {
        accountId: 9_999_999_999,
        amountGross: 100,
        date: '2026-04-23',
        supplierId: 9_007_199_254_740_991,
        customerId: 1_234_567_890,
        projectId: 2_147_483_647,
        departmentId: 9_876_543_210,
      };
      const out = transformVoucherPosting(input);
      expect(out.account).toEqual({ id: 9_999_999_999 });
      expect(out.supplier).toEqual({ id: 9_007_199_254_740_991 });
      expect(out.customer).toEqual({ id: 1_234_567_890 });
      expect(out.project).toEqual({ id: 2_147_483_647 });
      expect(out.department).toEqual({ id: 9_876_543_210 });
    });

    it('includes empty-string description when defined', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 100,
        date: '2026-04-23',
        description: '',
      };
      const out = transformVoucherPosting(input);
      expect(out).toHaveProperty('description', '');
    });

    it('wraps all reference IDs of 0 as { id: 0 } rather than omitting them', () => {
      const input: VoucherPostingInput = {
        accountId: 0,
        amountGross: 100,
        date: '2026-04-23',
        vatTypeId: 0,
        supplierId: 0,
        customerId: 0,
        projectId: 0,
        departmentId: 0,
      };
      const out = transformVoucherPosting(input);
      expect(out.account).toEqual({ id: 0 });
      expect(out.vatType).toEqual({ id: 0 });
      expect(out.supplier).toEqual({ id: 0 });
      expect(out.customer).toEqual({ id: 0 });
      expect(out.project).toEqual({ id: 0 });
      expect(out.department).toEqual({ id: 0 });
    });
  });

  describe('invariants', () => {
    it('returns a new object (not the same reference as input)', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 100,
        date: '2026-04-23',
      };
      const out = transformVoucherPosting(input);
      expect(out).not.toBe(input as unknown as Record<string, unknown>);
    });

    it('does not mutate the input object', () => {
      const input: VoucherPostingInput = {
        accountId: 1500,
        amountGross: 100,
        amountGrossCurrency: 80,
        date: '2026-04-23',
        vatTypeId: 3,
        row: 2,
        description: 'original',
        supplierId: 42,
        customerId: 99,
        projectId: 7,
        departmentId: 11,
        termOfPayment: '2026-05-23',
        invoiceNumber: 'INV-1',
      };
      const snapshot: VoucherPostingInput = { ...input };
      transformVoucherPosting(input);
      expect(input).toEqual(snapshot);
    });
  });
});
