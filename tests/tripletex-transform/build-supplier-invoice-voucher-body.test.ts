import { describe, it, expect } from 'vitest';
import { buildSupplierInvoiceVoucherBody } from '../../src/tripletex-transform.js';
import type {
  BuildSupplierInvoiceVoucherInput,
  SupplierInvoiceLineInput,
} from '../../src/tripletex-transform.js';

/**
 * Baseline input used by most tests. Individual tests override specific fields
 * via the spread operator to minimize repetition while keeping each case clear.
 */
const baseInput: BuildSupplierInvoiceVoucherInput = {
  invoiceDate: '2026-04-23',
  description: 'Invoice April 2026',
  supplierId: 1001,
  supplierAccountId: 2400,
  costAccountId: 6790,
  vatTypeId: 3,
  amountExVat: 1000,
  vatAmount: 250,
};

describe('buildSupplierInvoiceVoucherBody', () => {
  describe('happy path', () => {
    it('produces 1 debit + 1 credit posting for a single synthetic line (no explicit lines)', () => {
      const body = buildSupplierInvoiceVoucherBody(baseInput);
      const postings = body.postings as Record<string, unknown>[];
      expect(postings).toHaveLength(2);
      expect(postings[0]).toEqual({
        row: 1,
        date: '2026-04-23',
        description: 'Invoice April 2026',
        account: { id: 6790 },
        amountGross: 1250,
        amountGrossCurrency: 1250,
        vatType: { id: 3 },
      });
      expect(postings[1]).toEqual({
        row: 2,
        date: '2026-04-23',
        description: 'Invoice April 2026',
        account: { id: 2400 },
        amountGross: -1250,
        amountGrossCurrency: -1250,
        supplier: { id: 1001 },
      });
    });

    it('produces 3 debit + 1 credit posting for three explicit lines', () => {
      const lines: SupplierInvoiceLineInput[] = [
        { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
        { costAccountId: 6800, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
        { costAccountId: 6810, amountExVat: 400, vatAmount: 100, vatTypeId: 3 },
      ];
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect(postings).toHaveLength(4);
      expect((postings[0] as Record<string, unknown>).account).toEqual({ id: 6790 });
      expect((postings[1] as Record<string, unknown>).account).toEqual({ id: 6800 });
      expect((postings[2] as Record<string, unknown>).account).toEqual({ id: 6810 });
      expect((postings[3] as Record<string, unknown>).account).toEqual({ id: 2400 });
    });
  });

  describe('debit-posting logic', () => {
    it('assigns row = i + 1 (1-indexed) and date = input.invoiceDate for each line', () => {
      const lines: SupplierInvoiceLineInput[] = [
        { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
        { costAccountId: 6800, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
      ];
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect(postings[0]).toMatchObject({ row: 1, date: '2026-04-23' });
      expect(postings[1]).toMatchObject({ row: 2, date: '2026-04-23' });
    });

    it('falls back to input.description when line.description is undefined', () => {
      const lines: SupplierInvoiceLineInput[] = [
        { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
      ];
      const input: BuildSupplierInvoiceVoucherInput = {
        ...baseInput,
        description: 'Fallback description',
        lines,
      };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect((postings[0] as Record<string, unknown>).description).toBe('Fallback description');
    });

    it('uses line.description when provided, overriding input.description', () => {
      const lines: SupplierInvoiceLineInput[] = [
        {
          costAccountId: 6790,
          amountExVat: 100,
          vatAmount: 25,
          vatTypeId: 3,
          description: 'Custom line description',
        },
      ];
      const input: BuildSupplierInvoiceVoucherInput = {
        ...baseInput,
        description: 'Top-level description',
        lines,
      };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect((postings[0] as Record<string, unknown>).description).toBe('Custom line description');
    });

    it('sets account, amountGross, amountGrossCurrency, and vatType from the line', () => {
      const lines: SupplierInvoiceLineInput[] = [
        { costAccountId: 6790, amountExVat: 400, vatAmount: 100, vatTypeId: 3 },
      ];
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      const debit = postings[0] as Record<string, unknown>;
      expect(debit.account).toEqual({ id: 6790 });
      expect(debit.amountGross).toBe(500);
      expect(debit.amountGrossCurrency).toBe(500);
      expect(debit.vatType).toEqual({ id: 3 });
    });

    it('includes project and department only when defined on the line', () => {
      const lines: SupplierInvoiceLineInput[] = [
        {
          costAccountId: 6790,
          amountExVat: 100,
          vatAmount: 25,
          vatTypeId: 3,
          projectId: 77,
          departmentId: 88,
        },
        {
          costAccountId: 6800,
          amountExVat: 200,
          vatAmount: 50,
          vatTypeId: 3,
        },
      ];
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      const withBoth = postings[0] as Record<string, unknown>;
      const withNeither = postings[1] as Record<string, unknown>;
      expect(withBoth.project).toEqual({ id: 77 });
      expect(withBoth.department).toEqual({ id: 88 });
      expect(withNeither).not.toHaveProperty('project');
      expect(withNeither).not.toHaveProperty('department');
    });
  });

  describe('credit-posting logic', () => {
    it('sets row = lines.length + 1 for explicit lines', () => {
      const lines: SupplierInvoiceLineInput[] = [
        { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
        { costAccountId: 6800, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
        { costAccountId: 6810, amountExVat: 400, vatAmount: 100, vatTypeId: 3 },
      ];
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      const credit = postings[postings.length - 1] as Record<string, unknown>;
      expect(credit.row).toBe(4);
    });

    it('sets credit amounts to the negative of the total gross across all debits', () => {
      const lines: SupplierInvoiceLineInput[] = [
        { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
        { costAccountId: 6800, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
      ];
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      const credit = postings[postings.length - 1] as Record<string, unknown>;
      expect(credit.amountGross).toBe(-375);
      expect(credit.amountGrossCurrency).toBe(-375);
    });

    it('sets credit account to input.supplierAccountId and supplier to input.supplierId', () => {
      const body = buildSupplierInvoiceVoucherBody(baseInput);
      const postings = body.postings as Record<string, unknown>[];
      const credit = postings[postings.length - 1] as Record<string, unknown>;
      expect(credit.account).toEqual({ id: 2400 });
      expect(credit.supplier).toEqual({ id: 1001 });
    });

    it('includes termOfPayment when dueDate is defined and non-empty, otherwise omits it', () => {
      const withDue = buildSupplierInvoiceVoucherBody({ ...baseInput, dueDate: '2026-05-23' });
      const withEmptyDue = buildSupplierInvoiceVoucherBody({ ...baseInput, dueDate: '' });
      const withoutDue = buildSupplierInvoiceVoucherBody({ ...baseInput });
      const creditWith = (withDue.postings as Record<string, unknown>[])[1] as Record<
        string,
        unknown
      >;
      const creditEmpty = (withEmptyDue.postings as Record<string, unknown>[])[1] as Record<
        string,
        unknown
      >;
      const creditWithout = (withoutDue.postings as Record<string, unknown>[])[1] as Record<
        string,
        unknown
      >;
      expect(creditWith.termOfPayment).toBe('2026-05-23');
      expect(creditEmpty).not.toHaveProperty('termOfPayment');
      expect(creditWithout).not.toHaveProperty('termOfPayment');
    });

    it('appends " — KID: {kid}" to description when kid is non-empty', () => {
      const body = buildSupplierInvoiceVoucherBody({ ...baseInput, kid: '12345678903' });
      const postings = body.postings as Record<string, unknown>[];
      const credit = postings[postings.length - 1] as Record<string, unknown>;
      expect(credit.description).toBe('Invoice April 2026 — KID: 12345678903');
    });

    it('uses only input.description (no trailing separator) when kid is undefined', () => {
      const body = buildSupplierInvoiceVoucherBody({ ...baseInput });
      const postings = body.postings as Record<string, unknown>[];
      const credit = postings[postings.length - 1] as Record<string, unknown>;
      expect(credit.description).toBe('Invoice April 2026');
    });

    it('uses only input.description (no trailing separator) when kid is an empty string', () => {
      const body = buildSupplierInvoiceVoucherBody({ ...baseInput, kid: '' });
      const postings = body.postings as Record<string, unknown>[];
      const credit = postings[postings.length - 1] as Record<string, unknown>;
      expect(credit.description).toBe('Invoice April 2026');
    });
  });

  describe('body top-level', () => {
    it('sets date to input.invoiceDate and description to input.description', () => {
      const body = buildSupplierInvoiceVoucherBody(baseInput);
      expect(body.date).toBe('2026-04-23');
      expect(body.description).toBe('Invoice April 2026');
    });

    it('postings is the concatenation of debit[0..N-1] and credit[N]', () => {
      const lines: SupplierInvoiceLineInput[] = [
        { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
        { costAccountId: 6800, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
      ];
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect(postings).toHaveLength(3);
      // First N postings are debits (positive amounts, cost accounts).
      expect((postings[0] as Record<string, unknown>).account).toEqual({ id: 6790 });
      expect((postings[0] as Record<string, unknown>).amountGross).toBe(125);
      expect((postings[1] as Record<string, unknown>).account).toEqual({ id: 6800 });
      expect((postings[1] as Record<string, unknown>).amountGross).toBe(250);
      // Last posting is the credit (negative amount, supplier account).
      expect((postings[2] as Record<string, unknown>).account).toEqual({ id: 2400 });
      expect((postings[2] as Record<string, unknown>).amountGross).toBe(-375);
      expect((postings[2] as Record<string, unknown>).supplier).toEqual({ id: 1001 });
    });

    it('includes vendorInvoiceNumber when invoiceNumber is defined and non-empty, otherwise omits it', () => {
      const withNum = buildSupplierInvoiceVoucherBody({
        ...baseInput,
        invoiceNumber: 'INV-001',
      });
      const withEmpty = buildSupplierInvoiceVoucherBody({ ...baseInput, invoiceNumber: '' });
      const withoutNum = buildSupplierInvoiceVoucherBody({ ...baseInput });
      expect(withNum.vendorInvoiceNumber).toBe('INV-001');
      expect(withEmpty).not.toHaveProperty('vendorInvoiceNumber');
      expect(withoutNum).not.toHaveProperty('vendorInvoiceNumber');
    });

    it('includes voucherType when voucherTypeId is defined, otherwise omits it', () => {
      const withVt = buildSupplierInvoiceVoucherBody({ ...baseInput, voucherTypeId: 5 });
      const withoutVt = buildSupplierInvoiceVoucherBody({ ...baseInput });
      expect(withVt.voucherType).toEqual({ id: 5 });
      expect(withoutVt).not.toHaveProperty('voucherType');
    });
  });

  describe('balancing invariant (parametric)', () => {
    const cases: Array<{ name: string; input: BuildSupplierInvoiceVoucherInput }> = [
      {
        name: 'single synthetic line',
        input: { ...baseInput, amountExVat: 800, vatAmount: 200 },
      },
      {
        name: 'three explicit lines with mixed amounts',
        input: {
          ...baseInput,
          lines: [
            { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
            { costAccountId: 6800, amountExVat: 333.33, vatAmount: 83.33, vatTypeId: 3 },
            { costAccountId: 6810, amountExVat: 50, vatAmount: 0, vatTypeId: 0 },
          ],
        },
      },
      {
        name: 'mixed amounts including negative',
        input: {
          ...baseInput,
          lines: [
            { costAccountId: 6790, amountExVat: 500, vatAmount: 125, vatTypeId: 3 },
            { costAccountId: 6800, amountExVat: -100, vatAmount: -25, vatTypeId: 3 },
          ],
        },
      },
    ];

    it.each(cases)('sum of amountGross across all postings is 0 ($name)', ({ input }) => {
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      const total = postings.reduce((acc, p) => acc + (p.amountGross as number), 0);
      expect(total).toBe(0);
    });

    it.each(cases)(
      'sum of amountGrossCurrency across all postings is 0 ($name)',
      ({ input }) => {
        const body = buildSupplierInvoiceVoucherBody(input);
        const postings = body.postings as Record<string, unknown>[];
        const total = postings.reduce((acc, p) => acc + (p.amountGrossCurrency as number), 0);
        expect(total).toBe(0);
      },
    );
  });

  describe('row-numbering invariant', () => {
    const nCases: Array<{ n: number; lines: SupplierInvoiceLineInput[] }> = [
      {
        n: 1,
        lines: [{ costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 }],
      },
      {
        n: 2,
        lines: [
          { costAccountId: 6790, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
          { costAccountId: 6800, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
        ],
      },
      {
        n: 4,
        lines: [
          { costAccountId: 6790, amountExVat: 10, vatAmount: 2.5, vatTypeId: 3 },
          { costAccountId: 6791, amountExVat: 20, vatAmount: 5, vatTypeId: 3 },
          { costAccountId: 6792, amountExVat: 30, vatAmount: 7.5, vatTypeId: 3 },
          { costAccountId: 6793, amountExVat: 40, vatAmount: 10, vatTypeId: 3 },
        ],
      },
    ];

    it.each(nCases)('for N=$n explicit lines, rows are exactly [1..N, N+1]', ({ n, lines }) => {
      const input: BuildSupplierInvoiceVoucherInput = { ...baseInput, lines };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      const expected = Array.from({ length: n + 1 }, (_, i) => i + 1);
      const actual = postings.map((p) => p.row as number);
      expect(actual).toEqual(expected);
    });
  });

  describe('edge cases', () => {
    it('generates body with amountGross = 0 on debit and balancing 0 on credit when all amounts are 0', () => {
      const input: BuildSupplierInvoiceVoucherInput = {
        ...baseInput,
        amountExVat: 0,
        vatAmount: 0,
      };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect(postings).toHaveLength(2);
      const debit = postings[0] as Record<string, unknown>;
      const credit = postings[1] as Record<string, unknown>;
      expect(debit.amountGross).toBe(0);
      expect(debit.amountGrossCurrency).toBe(0);
      // Negating a positive zero yields -0 in JS (`-(+0) === -0`). Both represent
      // the same mathematical zero, so we assert numerical equality via `===`
      // rather than `Object.is`, which distinguishes +0 from -0.
      expect((credit.amountGross as number) === 0).toBe(true);
      expect((credit.amountGrossCurrency as number) === 0).toBe(true);
      // Balancing still holds arithmetically.
      expect((debit.amountGross as number) + (credit.amountGross as number)).toBe(0);
    });

    it('supports negative amountExVat/vatAmount (debit may be negative; credit flips sign)', () => {
      const input: BuildSupplierInvoiceVoucherInput = {
        ...baseInput,
        amountExVat: -400,
        vatAmount: -100,
      };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      const debit = postings[0] as Record<string, unknown>;
      const credit = postings[1] as Record<string, unknown>;
      expect(debit.amountGross).toBe(-500);
      expect(debit.amountGrossCurrency).toBe(-500);
      expect(credit.amountGross).toBe(500);
      expect(credit.amountGrossCurrency).toBe(500);
    });

    it('treats empty-string kid as absent (no KID suffix on credit description)', () => {
      const body = buildSupplierInvoiceVoucherBody({ ...baseInput, kid: '' });
      const credit = (body.postings as Record<string, unknown>[])[1] as Record<string, unknown>;
      expect(credit.description).toBe('Invoice April 2026');
      expect(credit.description as string).not.toContain('KID');
      expect(credit.description as string).not.toContain('—');
    });

    it('treats empty-string invoiceNumber as absent (no vendorInvoiceNumber on body)', () => {
      const body = buildSupplierInvoiceVoucherBody({ ...baseInput, invoiceNumber: '' });
      expect(body).not.toHaveProperty('vendorInvoiceNumber');
    });

    it('treats empty-string dueDate as absent (no termOfPayment on credit)', () => {
      const body = buildSupplierInvoiceVoucherBody({ ...baseInput, dueDate: '' });
      const credit = (body.postings as Record<string, unknown>[])[1] as Record<string, unknown>;
      expect(credit).not.toHaveProperty('termOfPayment');
    });
  });

  describe('lines fallback', () => {
    it('uses synthetic single line from input root when lines is undefined', () => {
      const input: BuildSupplierInvoiceVoucherInput = {
        ...baseInput,
        costAccountId: 6790,
        amountExVat: 800,
        vatAmount: 200,
        vatTypeId: 3,
        projectId: 42,
        departmentId: 7,
      };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect(postings).toHaveLength(2);
      const debit = postings[0] as Record<string, unknown>;
      expect(debit).toEqual({
        row: 1,
        date: '2026-04-23',
        description: 'Invoice April 2026',
        account: { id: 6790 },
        amountGross: 1000,
        amountGrossCurrency: 1000,
        vatType: { id: 3 },
        project: { id: 42 },
        department: { id: 7 },
      });
    });

    it('uses synthetic single line when lines is an empty array (empty falls through to fallback)', () => {
      const input: BuildSupplierInvoiceVoucherInput = {
        ...baseInput,
        lines: [],
      };
      const body = buildSupplierInvoiceVoucherBody(input);
      const postings = body.postings as Record<string, unknown>[];
      expect(postings).toHaveLength(2);
      const debit = postings[0] as Record<string, unknown>;
      expect(debit).toEqual({
        row: 1,
        date: '2026-04-23',
        description: 'Invoice April 2026',
        account: { id: 6790 },
        amountGross: 1250,
        amountGrossCurrency: 1250,
        vatType: { id: 3 },
      });
      // Credit row is still lines.length + 1 = 2 (synthetic line counted).
      expect((postings[1] as Record<string, unknown>).row).toBe(2);
    });
  });
});
