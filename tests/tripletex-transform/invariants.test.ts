import { describe, it, expect } from 'vitest';
import {
  transformOrderLine,
  buildOrderBody,
  transformVoucherPosting,
  buildSupplierInvoiceVoucherBody,
  wrapPostingsForSupplierInvoiceUpdate,
} from '../../src/tripletex-transform.js';
import type {
  OrderLineInput,
  CreateOrderInput,
  VoucherPostingInput,
  SupplierInvoiceLineInput,
  BuildSupplierInvoiceVoucherInput,
  SupplierInvoicePostingUpdateInput,
} from '../../src/tripletex-transform.js';

/**
 * Cross-cutting property/invariant tests for src/tripletex-transform.ts.
 *
 * Per-function behavioural tests live in sibling files. This file protects
 * the structural contract shared across transforms: balancing, row numbering,
 * no-mutation, and entity-reference wrapping ({ id: N } shape).
 */

type Posting = {
  row: number;
  amountGross: number;
  amountGrossCurrency: number;
  account: { id: number };
  vatType?: { id: number };
  project?: { id: number };
  department?: { id: number };
  supplier?: { id: number };
  date: string;
  description: string;
  termOfPayment?: string;
};

type VoucherBody = {
  date: string;
  description: string;
  postings: Posting[];
  vendorInvoiceNumber?: string;
  voucherType?: { id: number };
};

const baseVoucherInput: BuildSupplierInvoiceVoucherInput = {
  invoiceDate: '2026-04-01',
  description: 'Invoice #INV-1',
  supplierId: 10,
  supplierAccountId: 2400,
  costAccountId: 6000,
  vatTypeId: 3,
  amountExVat: 100,
  vatAmount: 25,
};

function castBody(body: Record<string, unknown>): VoucherBody {
  return body as unknown as VoucherBody;
}

describe('tripletex-transform invariants', () => {
  describe('buildSupplierInvoiceVoucherBody balancing invariant', () => {
    const singleDefault: BuildSupplierInvoiceVoucherInput = { ...baseVoucherInput };

    const twoLines: BuildSupplierInvoiceVoucherInput = {
      ...baseVoucherInput,
      lines: [
        { costAccountId: 6000, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
        { costAccountId: 6100, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
      ],
    };

    const threeLines: BuildSupplierInvoiceVoucherInput = {
      ...baseVoucherInput,
      lines: [
        { costAccountId: 6000, amountExVat: 33.33, vatAmount: 8.33, vatTypeId: 3 },
        { costAccountId: 6100, amountExVat: 66.67, vatAmount: 16.67, vatTypeId: 3 },
        { costAccountId: 6200, amountExVat: 10, vatAmount: 2.5, vatTypeId: 3 },
      ],
    };

    const allZeroAmounts: BuildSupplierInvoiceVoucherInput = {
      ...baseVoucherInput,
      amountExVat: 0,
      vatAmount: 0,
      lines: [
        { costAccountId: 6000, amountExVat: 0, vatAmount: 0, vatTypeId: 3 },
        { costAccountId: 6100, amountExVat: 0, vatAmount: 0, vatTypeId: 3 },
      ],
    };

    const negativeAmounts: BuildSupplierInvoiceVoucherInput = {
      ...baseVoucherInput,
      lines: [
        { costAccountId: 6000, amountExVat: -100, vatAmount: -25, vatTypeId: 3 },
        { costAccountId: 6100, amountExVat: 50, vatAmount: 12.5, vatTypeId: 3 },
      ],
    };

    const withProjectAndDepartment: BuildSupplierInvoiceVoucherInput = {
      ...baseVoucherInput,
      projectId: 77,
      departmentId: 88,
      lines: [
        {
          costAccountId: 6000,
          amountExVat: 100,
          vatAmount: 25,
          vatTypeId: 3,
          projectId: 77,
          departmentId: 88,
        },
        {
          costAccountId: 6100,
          amountExVat: 200,
          vatAmount: 50,
          vatTypeId: 3,
          projectId: 77,
          departmentId: 88,
        },
      ],
    };

    const withoutProjectOrDepartment: BuildSupplierInvoiceVoucherInput = {
      ...baseVoucherInput,
      lines: [
        { costAccountId: 6000, amountExVat: 100, vatAmount: 25, vatTypeId: 3 },
        { costAccountId: 6100, amountExVat: 200, vatAmount: 50, vatTypeId: 3 },
      ],
    };

    const cases: ReadonlyArray<{ name: string; input: BuildSupplierInvoiceVoucherInput }> = [
      { name: 'single-line default (no explicit lines)', input: singleDefault },
      { name: '2-line', input: twoLines },
      { name: '3-line', input: threeLines },
      { name: 'all-zero amounts', input: allZeroAmounts },
      { name: 'negative amounts', input: negativeAmounts },
      { name: 'with projectId and departmentId', input: withProjectAndDepartment },
      { name: 'without projectId or departmentId', input: withoutProjectOrDepartment },
    ];

    it.each(cases)('postings sum to zero for $name', ({ input }) => {
      const body = castBody(buildSupplierInvoiceVoucherBody(input));
      const sumGross = body.postings.reduce((acc, p) => acc + p.amountGross, 0);
      const sumGrossCurrency = body.postings.reduce(
        (acc, p) => acc + p.amountGrossCurrency,
        0
      );
      expect(sumGross).toBe(0);
      expect(sumGrossCurrency).toBe(0);
    });
  });

  describe('buildSupplierInvoiceVoucherBody row-numbering invariant', () => {
    const rowCases: ReadonlyArray<{ n: number }> = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 5 }];

    it.each(rowCases)('produces rows 1..N+1 for N=$n debit lines', ({ n }) => {
      const lines: SupplierInvoiceLineInput[] = Array.from({ length: n }, (_, i) => ({
        costAccountId: 6000 + i,
        amountExVat: 10,
        vatAmount: 2.5,
        vatTypeId: 3,
      }));
      const input: BuildSupplierInvoiceVoucherInput = { ...baseVoucherInput, lines };
      const body = castBody(buildSupplierInvoiceVoucherBody(input));

      const expectedRows = Array.from({ length: n + 1 }, (_, i) => i + 1);
      const actualRows = body.postings.map((p) => p.row);
      expect(actualRows).toEqual(expectedRows);
      expect(body.postings).toHaveLength(n + 1);
    });
  });

  describe('no-mutation invariant across all transforms', () => {
    type TransformCase = {
      name: string;
      run: () => { before: string; after: string; input: object; output: object };
    };

    const cases: ReadonlyArray<TransformCase> = [
      {
        name: 'transformOrderLine',
        run: () => {
          const input: OrderLineInput = {
            description: 'Line',
            count: 2,
            unitPriceExcludingVatCurrency: 100,
            unitPriceIncludingVatCurrency: 125,
            vatTypeId: 3,
            productId: 42,
            discount: 10,
          };
          const before = JSON.stringify(input);
          const output = transformOrderLine(input);
          const after = JSON.stringify(input);
          return { before, after, input, output };
        },
      },
      {
        name: 'buildOrderBody',
        run: () => {
          const input: CreateOrderInput = {
            customerId: 7,
            orderDate: '2026-04-01',
            deliveryDate: '2026-04-15',
            currencyId: 1,
            ourReference: 'OUR',
            yourReference: 'YOUR',
            invoiceComment: 'comment',
            receiverEmail: 'x@example.com',
            invoicesDueIn: 14,
            isPrioritizeAmountsIncludingVat: true,
            orderLines: [
              { description: 'L1', count: 1, vatTypeId: 3, productId: 42 },
              { description: 'L2', count: 2, vatTypeId: 3 },
            ],
          };
          const before = JSON.stringify(input);
          const output = buildOrderBody(input);
          const after = JSON.stringify(input);
          return { before, after, input, output };
        },
      },
      {
        name: 'transformVoucherPosting',
        run: () => {
          const input: VoucherPostingInput = {
            accountId: 6000,
            amountGross: 125,
            amountGrossCurrency: 125,
            date: '2026-04-01',
            vatTypeId: 3,
            row: 1,
            description: 'desc',
            supplierId: 10,
            customerId: 11,
            projectId: 77,
            departmentId: 88,
            termOfPayment: '2026-04-30',
            invoiceNumber: 'INV-1',
          };
          const before = JSON.stringify(input);
          const output = transformVoucherPosting(input);
          const after = JSON.stringify(input);
          return { before, after, input, output };
        },
      },
      {
        name: 'buildSupplierInvoiceVoucherBody',
        run: () => {
          const input: BuildSupplierInvoiceVoucherInput = {
            ...baseVoucherInput,
            invoiceNumber: 'INV-1',
            dueDate: '2026-04-30',
            kid: '12345',
            voucherTypeId: 1,
            projectId: 77,
            departmentId: 88,
            lines: [
              {
                costAccountId: 6000,
                amountExVat: 100,
                vatAmount: 25,
                vatTypeId: 3,
                description: 'line',
                projectId: 77,
                departmentId: 88,
              },
            ],
          };
          const before = JSON.stringify(input);
          const output = buildSupplierInvoiceVoucherBody(input);
          const after = JSON.stringify(input);
          return { before, after, input, output };
        },
      },
      {
        name: 'wrapPostingsForSupplierInvoiceUpdate',
        run: () => {
          const items: SupplierInvoicePostingUpdateInput[] = [
            {
              id: 1,
              row: 1,
              accountId: 6000,
              amountGross: 100,
              amountGrossCurrency: 100,
              date: '2026-04-01',
              vatTypeId: 3,
              description: 'desc',
              supplierId: 10,
              customerId: 11,
              projectId: 77,
              departmentId: 88,
            },
          ];
          const before = JSON.stringify(items);
          const output = wrapPostingsForSupplierInvoiceUpdate('2026-04-01', items);
          const after = JSON.stringify(items);
          return { before, after, input: items, output };
        },
      },
    ];

    it.each(cases)('$name does not mutate input and returns a fresh object', ({ run }) => {
      const { before, after, input, output } = run();
      expect(after).toBe(before);
      expect(output).not.toBe(input);
    });
  });

  describe('reference-wrapping shape invariant', () => {
    it('transformOrderLine wraps vatTypeId and productId as { id }', () => {
      const input: OrderLineInput = { vatTypeId: 3, productId: 42 };
      const out = transformOrderLine(input) as {
        vatType: { id: number };
        product: { id: number };
      };
      expect(out.vatType).toEqual({ id: 3 });
      expect(out.product).toEqual({ id: 42 });
      expect(typeof out.vatType).toBe('object');
      expect(typeof out.product).toBe('object');
    });

    it('buildOrderBody wraps customerId and currencyId as { id }', () => {
      const input: CreateOrderInput = {
        customerId: 7,
        orderDate: '2026-04-01',
        deliveryDate: '2026-04-15',
        currencyId: 1,
      };
      const out = buildOrderBody(input) as {
        customer: { id: number };
        currency: { id: number };
      };
      expect(out.customer).toEqual({ id: 7 });
      expect(out.currency).toEqual({ id: 1 });
    });

    it('transformVoucherPosting wraps all *Id entity references as { id }', () => {
      const input: VoucherPostingInput = {
        accountId: 6000,
        amountGross: 100,
        date: '2026-04-01',
        vatTypeId: 3,
        supplierId: 10,
        customerId: 11,
        projectId: 77,
        departmentId: 88,
      };
      const out = transformVoucherPosting(input) as {
        account: { id: number };
        vatType: { id: number };
        supplier: { id: number };
        customer: { id: number };
        project: { id: number };
        department: { id: number };
      };
      expect(out.account).toEqual({ id: 6000 });
      expect(out.vatType).toEqual({ id: 3 });
      expect(out.supplier).toEqual({ id: 10 });
      expect(out.customer).toEqual({ id: 11 });
      expect(out.project).toEqual({ id: 77 });
      expect(out.department).toEqual({ id: 88 });
    });

    it('wrapPostingsForSupplierInvoiceUpdate wraps all *Id entity references on item.posting', () => {
      const items: SupplierInvoicePostingUpdateInput[] = [
        {
          row: 1,
          accountId: 6000,
          amountGross: 100,
          vatTypeId: 3,
          supplierId: 10,
          customerId: 11,
          projectId: 77,
          departmentId: 88,
        },
      ];
      const result = wrapPostingsForSupplierInvoiceUpdate('2026-04-01', items) as Array<{
        posting: {
          account: { id: number };
          vatType: { id: number };
          supplier: { id: number };
          customer: { id: number };
          project: { id: number };
          department: { id: number };
        };
      }>;
      const first = result[0];
      if (first === undefined) {
        throw new Error('expected at least one wrapped posting');
      }
      const posting = first.posting;
      expect(posting.account).toEqual({ id: 6000 });
      expect(posting.vatType).toEqual({ id: 3 });
      expect(posting.supplier).toEqual({ id: 10 });
      expect(posting.customer).toEqual({ id: 11 });
      expect(posting.project).toEqual({ id: 77 });
      expect(posting.department).toEqual({ id: 88 });
    });

    it('buildSupplierInvoiceVoucherBody wraps all per-posting *Id refs as { id }', () => {
      const input: BuildSupplierInvoiceVoucherInput = {
        ...baseVoucherInput,
        lines: [
          {
            costAccountId: 6000,
            amountExVat: 100,
            vatAmount: 25,
            vatTypeId: 3,
            projectId: 77,
            departmentId: 88,
          },
        ],
      };
      const body = castBody(buildSupplierInvoiceVoucherBody(input));
      const debit = body.postings[0];
      const credit = body.postings[1];
      if (debit === undefined || credit === undefined) {
        throw new Error('expected debit and credit postings');
      }

      // Debit row: costAccountId -> account.id, vatTypeId -> vatType.id,
      // projectId -> project.id, departmentId -> department.id.
      expect(debit.account).toEqual({ id: 6000 });
      expect(debit.vatType).toEqual({ id: 3 });
      expect(debit.project).toEqual({ id: 77 });
      expect(debit.department).toEqual({ id: 88 });

      // Credit row: supplierAccountId -> account.id, supplierId -> supplier.id.
      expect(credit.account).toEqual({ id: baseVoucherInput.supplierAccountId });
      expect(credit.supplier).toEqual({ id: baseVoucherInput.supplierId });
    });
  });
});
