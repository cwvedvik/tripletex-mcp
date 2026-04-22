import { describe, it, expect } from 'vitest';
import { transformOrderLine } from '../../src/tripletex-transform.js';
import type { OrderLineInput } from '../../src/tripletex-transform.js';

describe('transformOrderLine', () => {
  describe('happy path', () => {
    it('returns an empty object when given an empty input', () => {
      const input: OrderLineInput = {};
      expect(transformOrderLine(input)).toEqual({});
    });

    it('includes only the single provided field (description)', () => {
      const input: OrderLineInput = { description: 'Consulting hours' };
      expect(transformOrderLine(input)).toEqual({ description: 'Consulting hours' });
    });

    it('maps all 7 input fields when all are present', () => {
      const input: OrderLineInput = {
        description: 'Line A',
        count: 2,
        unitPriceExcludingVatCurrency: 100,
        unitPriceIncludingVatCurrency: 125,
        vatTypeId: 3,
        productId: 42,
        discount: 10,
      };
      expect(transformOrderLine(input)).toEqual({
        description: 'Line A',
        count: 2,
        unitPriceExcludingVatCurrency: 100,
        unitPriceIncludingVatCurrency: 125,
        vatType: { id: 3 },
        product: { id: 42 },
        discount: 10,
      });
    });
  });

  describe('optional-field matrix', () => {
    it('includes description when defined and omits it when undefined', () => {
      const withField: OrderLineInput = { description: 'hello' };
      const withoutField: OrderLineInput = {};
      const outWith = transformOrderLine(withField);
      const outWithout = transformOrderLine(withoutField);
      expect(outWith).toEqual({ description: 'hello' });
      expect('description' in outWith).toBe(true);
      expect('description' in outWithout).toBe(false);
    });

    it('includes count when defined and omits it when undefined', () => {
      const withField: OrderLineInput = { count: 5 };
      const withoutField: OrderLineInput = {};
      const outWith = transformOrderLine(withField);
      const outWithout = transformOrderLine(withoutField);
      expect(outWith).toEqual({ count: 5 });
      expect('count' in outWith).toBe(true);
      expect('count' in outWithout).toBe(false);
    });

    it('includes unitPriceExcludingVatCurrency when defined and omits it when undefined', () => {
      const withField: OrderLineInput = { unitPriceExcludingVatCurrency: 99.5 };
      const withoutField: OrderLineInput = {};
      const outWith = transformOrderLine(withField);
      const outWithout = transformOrderLine(withoutField);
      expect(outWith).toEqual({ unitPriceExcludingVatCurrency: 99.5 });
      expect('unitPriceExcludingVatCurrency' in outWith).toBe(true);
      expect('unitPriceExcludingVatCurrency' in outWithout).toBe(false);
    });

    it('includes unitPriceIncludingVatCurrency when defined and omits it when undefined', () => {
      const withField: OrderLineInput = { unitPriceIncludingVatCurrency: 124.38 };
      const withoutField: OrderLineInput = {};
      const outWith = transformOrderLine(withField);
      const outWithout = transformOrderLine(withoutField);
      expect(outWith).toEqual({ unitPriceIncludingVatCurrency: 124.38 });
      expect('unitPriceIncludingVatCurrency' in outWith).toBe(true);
      expect('unitPriceIncludingVatCurrency' in outWithout).toBe(false);
    });

    it('includes vatType (wrapped from vatTypeId) when defined and omits it when undefined', () => {
      const withField: OrderLineInput = { vatTypeId: 7 };
      const withoutField: OrderLineInput = {};
      const outWith = transformOrderLine(withField);
      const outWithout = transformOrderLine(withoutField);
      expect(outWith).toEqual({ vatType: { id: 7 } });
      expect('vatType' in outWith).toBe(true);
      expect('vatTypeId' in outWith).toBe(false);
      expect('vatType' in outWithout).toBe(false);
    });

    it('includes product (wrapped from productId) when defined and omits it when undefined', () => {
      const withField: OrderLineInput = { productId: 17 };
      const withoutField: OrderLineInput = {};
      const outWith = transformOrderLine(withField);
      const outWithout = transformOrderLine(withoutField);
      expect(outWith).toEqual({ product: { id: 17 } });
      expect('product' in outWith).toBe(true);
      expect('productId' in outWith).toBe(false);
      expect('product' in outWithout).toBe(false);
    });

    it('includes discount when defined and omits it when undefined', () => {
      const withField: OrderLineInput = { discount: 15 };
      const withoutField: OrderLineInput = {};
      const outWith = transformOrderLine(withField);
      const outWithout = transformOrderLine(withoutField);
      expect(outWith).toEqual({ discount: 15 });
      expect('discount' in outWith).toBe(true);
      expect('discount' in outWithout).toBe(false);
    });
  });

  describe('reference wrapping', () => {
    it('wraps vatTypeId as { vatType: { id: <number> } } rather than a bare number', () => {
      const input: OrderLineInput = { vatTypeId: 123 };
      const result = transformOrderLine(input);
      expect(result).toEqual({ vatType: { id: 123 } });
      expect(result.vatType).toEqual({ id: 123 });
      expect(typeof result.vatType).toBe('object');
    });

    it('wraps productId as { product: { id: <number> } } rather than a bare number', () => {
      const input: OrderLineInput = { productId: 456 };
      const result = transformOrderLine(input);
      expect(result).toEqual({ product: { id: 456 } });
      expect(result.product).toEqual({ id: 456 });
      expect(typeof result.product).toBe('object');
    });
  });

  describe('edge cases', () => {
    it('includes count: 0 in output (0 is not undefined)', () => {
      const input: OrderLineInput = { count: 0 };
      const result = transformOrderLine(input);
      expect(result).toEqual({ count: 0 });
      expect('count' in result).toBe(true);
    });

    it('preserves a negative discount value', () => {
      const input: OrderLineInput = { discount: -25 };
      const result = transformOrderLine(input);
      expect(result).toEqual({ discount: -25 });
    });

    it('includes a price of 0 in output', () => {
      const input: OrderLineInput = {
        unitPriceExcludingVatCurrency: 0,
        unitPriceIncludingVatCurrency: 0,
      };
      const result = transformOrderLine(input);
      expect(result).toEqual({
        unitPriceExcludingVatCurrency: 0,
        unitPriceIncludingVatCurrency: 0,
      });
    });

    it('wraps vatTypeId: 0 as { vatType: { id: 0 } }', () => {
      const input: OrderLineInput = { vatTypeId: 0 };
      const result = transformOrderLine(input);
      expect(result).toEqual({ vatType: { id: 0 } });
    });

    it('handles huge numeric IDs without loss for vatTypeId and productId', () => {
      const input: OrderLineInput = {
        vatTypeId: Number.MAX_SAFE_INTEGER,
        productId: 9_999_999_999_999,
      };
      const result = transformOrderLine(input);
      expect(result).toEqual({
        vatType: { id: Number.MAX_SAFE_INTEGER },
        product: { id: 9_999_999_999_999 },
      });
    });

    it('treats explicit undefined fields as absent', () => {
      const input: OrderLineInput = {
        description: undefined,
        count: undefined,
        unitPriceExcludingVatCurrency: undefined,
        unitPriceIncludingVatCurrency: undefined,
        vatTypeId: undefined,
        productId: undefined,
        discount: undefined,
      };
      expect(transformOrderLine(input)).toEqual({});
    });
  });

  describe('invariants', () => {
    it('returns a new object (not the same reference as the input)', () => {
      const input: OrderLineInput = { description: 'same?' };
      const result = transformOrderLine(input);
      expect(result).not.toBe(input as unknown as Record<string, unknown>);
    });

    it('does not mutate the input object', () => {
      const input: OrderLineInput = {
        description: 'unchanged',
        count: 3,
        unitPriceExcludingVatCurrency: 50,
        unitPriceIncludingVatCurrency: 62.5,
        vatTypeId: 1,
        productId: 2,
        discount: 5,
      };
      const snapshot: OrderLineInput = {
        description: 'unchanged',
        count: 3,
        unitPriceExcludingVatCurrency: 50,
        unitPriceIncludingVatCurrency: 62.5,
        vatTypeId: 1,
        productId: 2,
        discount: 5,
      };
      transformOrderLine(input);
      expect(input).toEqual(snapshot);
    });
  });
});
