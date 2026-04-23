import { describe, it, expect } from 'vitest';
import { buildOrderBody } from '../../src/tripletex-transform.js';
import type { CreateOrderInput, OrderLineInput } from '../../src/tripletex-transform.js';

describe('buildOrderBody', () => {
  describe('happy path', () => {
    it('returns a body with exactly 3 root fields plus wrapped customer for minimal input', () => {
      const input: CreateOrderInput = {
        customerId: 42,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
      };
      const result = buildOrderBody(input);
      expect(result).toEqual({
        customer: { id: 42 },
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
      });
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('includes all 11 optional fields when fully populated', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
        orderLines: [{ description: 'Line A', count: 2 }],
        isPrioritizeAmountsIncludingVat: true,
        currencyId: 77,
        ourReference: 'us-ref',
        yourReference: 'your-ref',
        invoiceComment: 'Thanks for your business',
        receiverEmail: 'billing@example.com',
        invoicesDueIn: 30,
      };
      const result = buildOrderBody(input);
      expect(result).toEqual({
        customer: { id: 1 },
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
        orderLines: [{ description: 'Line A', count: 2 }],
        isPrioritizeAmountsIncludingVat: true,
        currency: { id: 77 },
        ourReference: 'us-ref',
        yourReference: 'your-ref',
        invoiceComment: 'Thanks for your business',
        receiverEmail: 'billing@example.com',
        invoicesDueIn: 30,
      });
    });
  });

  describe('required-field wrapping', () => {
    it('always wraps customerId as customer.id', () => {
      const input: CreateOrderInput = {
        customerId: 42,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
      };
      const result = buildOrderBody(input);
      expect(result).toHaveProperty('customer', { id: 42 });
      expect(result).not.toHaveProperty('customerId');
    });

    it('always includes orderDate as a string', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
      };
      const result = buildOrderBody(input);
      expect(result).toHaveProperty('orderDate', '2026-04-23');
      expect(typeof result.orderDate).toBe('string');
    });

    it('always includes deliveryDate as a string', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
      };
      const result = buildOrderBody(input);
      expect(result).toHaveProperty('deliveryDate', '2026-05-01');
      expect(typeof result.deliveryDate).toBe('string');
    });
  });

  describe('orderLines handling', () => {
    it('omits orderLines when undefined', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
      };
      const result = buildOrderBody(input);
      expect(result).not.toHaveProperty('orderLines');
    });

    it('omits orderLines when an empty array', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
        orderLines: [],
      };
      const result = buildOrderBody(input);
      expect(result).not.toHaveProperty('orderLines');
    });

    it('includes a single transformed entry when given a single line', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
        orderLines: [{ description: 'solo', count: 1, vatTypeId: 3 }],
      };
      const result = buildOrderBody(input);
      expect(result.orderLines).toEqual([
        { description: 'solo', count: 1, vatType: { id: 3 } },
      ]);
    });

    it('maps all lines via transformOrderLine for multiple lines', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
        orderLines: [
          { description: 'A', count: 1, productId: 10 },
          { description: 'B', count: 2, vatTypeId: 5 },
          { description: 'C', discount: 10 },
        ],
      };
      const result = buildOrderBody(input);
      expect(result.orderLines).toEqual([
        { description: 'A', count: 1, product: { id: 10 } },
        { description: 'B', count: 2, vatType: { id: 5 } },
        { description: 'C', discount: 10 },
      ]);
    });

    it('preserves the order of input lines in the output', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
        orderLines: [
          { description: 'first' },
          { description: 'second' },
          { description: 'third' },
        ],
      };
      const result = buildOrderBody(input);
      const lines = result.orderLines as Record<string, unknown>[];
      expect(lines.map((l) => l.description)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('optional field matrix', () => {
    const base: CreateOrderInput = {
      customerId: 1,
      orderDate: '2026-04-23',
      deliveryDate: '2026-05-01',
    };

    it('includes isPrioritizeAmountsIncludingVat when defined and omits it when undefined', () => {
      const withField = buildOrderBody({ ...base, isPrioritizeAmountsIncludingVat: true });
      expect(withField).toHaveProperty('isPrioritizeAmountsIncludingVat', true);
      const without = buildOrderBody(base);
      expect(without).not.toHaveProperty('isPrioritizeAmountsIncludingVat');
    });

    it('wraps currencyId as currency.id when defined and omits currency when undefined', () => {
      const withField = buildOrderBody({ ...base, currencyId: 77 });
      expect(withField).toHaveProperty('currency', { id: 77 });
      expect(withField).not.toHaveProperty('currencyId');
      const without = buildOrderBody(base);
      expect(without).not.toHaveProperty('currency');
      expect(without).not.toHaveProperty('currencyId');
    });

    it('includes ourReference when defined and omits it when undefined', () => {
      const withField = buildOrderBody({ ...base, ourReference: 'ref-us' });
      expect(withField).toHaveProperty('ourReference', 'ref-us');
      const without = buildOrderBody(base);
      expect(without).not.toHaveProperty('ourReference');
    });

    it('includes yourReference when defined and omits it when undefined', () => {
      const withField = buildOrderBody({ ...base, yourReference: 'ref-them' });
      expect(withField).toHaveProperty('yourReference', 'ref-them');
      const without = buildOrderBody(base);
      expect(without).not.toHaveProperty('yourReference');
    });

    it('includes invoiceComment when defined and omits it when undefined', () => {
      const withField = buildOrderBody({ ...base, invoiceComment: 'pls pay' });
      expect(withField).toHaveProperty('invoiceComment', 'pls pay');
      const without = buildOrderBody(base);
      expect(without).not.toHaveProperty('invoiceComment');
    });

    it('includes receiverEmail when defined and omits it when undefined', () => {
      const withField = buildOrderBody({ ...base, receiverEmail: 'a@b.c' });
      expect(withField).toHaveProperty('receiverEmail', 'a@b.c');
      const without = buildOrderBody(base);
      expect(without).not.toHaveProperty('receiverEmail');
    });

    it('includes invoicesDueIn when defined and omits it when undefined', () => {
      const withField = buildOrderBody({ ...base, invoicesDueIn: 14 });
      expect(withField).toHaveProperty('invoicesDueIn', 14);
      const without = buildOrderBody(base);
      expect(without).not.toHaveProperty('invoicesDueIn');
    });

    it('treats an empty string on a string-typed optional field as "defined" (since only undefined is filtered)', () => {
      const result = buildOrderBody({ ...base, ourReference: '' });
      expect(result).toHaveProperty('ourReference', '');
    });
  });

  describe('boolean edge cases', () => {
    const base: CreateOrderInput = {
      customerId: 1,
      orderDate: '2026-04-23',
      deliveryDate: '2026-05-01',
    };

    it('includes isPrioritizeAmountsIncludingVat when true', () => {
      const result = buildOrderBody({ ...base, isPrioritizeAmountsIncludingVat: true });
      expect(result).toHaveProperty('isPrioritizeAmountsIncludingVat', true);
    });

    it('includes isPrioritizeAmountsIncludingVat when false (false is defined)', () => {
      const result = buildOrderBody({ ...base, isPrioritizeAmountsIncludingVat: false });
      expect(result).toHaveProperty('isPrioritizeAmountsIncludingVat', false);
    });
  });

  describe('numeric edge cases', () => {
    const base: CreateOrderInput = {
      customerId: 1,
      orderDate: '2026-04-23',
      deliveryDate: '2026-05-01',
    };

    it('wraps currencyId of 0 as { id: 0 } (0 is defined)', () => {
      const result = buildOrderBody({ ...base, currencyId: 0 });
      expect(result).toHaveProperty('currency', { id: 0 });
    });

    it('passes through negative invoicesDueIn unchanged', () => {
      const result = buildOrderBody({ ...base, invoicesDueIn: -30 });
      expect(result).toHaveProperty('invoicesDueIn', -30);
    });

    it('transforms each orderLine independently even when their field sets differ', () => {
      const input: CreateOrderInput = {
        ...base,
        orderLines: [
          { description: 'desc-only' },
          { count: 5, unitPriceExcludingVatCurrency: 100 },
          { productId: 7, vatTypeId: 3, discount: 15 },
          { unitPriceIncludingVatCurrency: 250 },
        ],
      };
      const result = buildOrderBody(input);
      expect(result.orderLines).toEqual([
        { description: 'desc-only' },
        { count: 5, unitPriceExcludingVatCurrency: 100 },
        { product: { id: 7 }, vatType: { id: 3 }, discount: 15 },
        { unitPriceIncludingVatCurrency: 250 },
      ]);
    });
  });

  describe('invariants', () => {
    it('returns a new object distinct from the input', () => {
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
      };
      const result = buildOrderBody(input);
      expect(result).not.toBe(input as unknown as Record<string, unknown>);
    });

    it('does not mutate the input or its orderLines array', () => {
      const originalLines: OrderLineInput[] = [
        { description: 'A', count: 1 },
        { description: 'B', count: 2, vatTypeId: 5 },
      ];
      const linesSnapshot = JSON.parse(JSON.stringify(originalLines)) as OrderLineInput[];
      const input: CreateOrderInput = {
        customerId: 1,
        orderDate: '2026-04-23',
        deliveryDate: '2026-05-01',
        orderLines: originalLines,
        currencyId: 77,
        ourReference: 'r',
      };
      const inputSnapshot = JSON.parse(JSON.stringify(input)) as CreateOrderInput;
      buildOrderBody(input);
      expect(input).toEqual(inputSnapshot);
      expect(originalLines).toEqual(linesSnapshot);
      expect(input.orderLines).toBe(originalLines);
    });
  });
});
