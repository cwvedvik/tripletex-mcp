#!/usr/bin/env node
/**
 * Tripletex MCP Server — thin proxy over Tripletex API v2 (see docs/PRD-Tripletex-MCP-Rebuild.md).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TripletexApiError, TripletexClient } from "./tripletex-client.js";
import {
  buildOrderBody,
  transformVoucherPosting,
  type OrderLineInput,
} from "./tripletex-transform.js";
import { registerSkills } from "./skills/registry.js";

const client = new TripletexClient();
const server = new McpServer({
  name: "tripletex",
  version: "2.0.0",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function formatTripletexError(e: TripletexApiError): string {
  let parsed: unknown = e.bodyText;
  try {
    parsed = JSON.parse(e.bodyText) as unknown;
  } catch {
    /* keep raw string */
  }
  return JSON.stringify(
    { httpStatus: e.status, tripletexResponse: parsed },
    null,
    2
  );
}

async function run<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  } catch (e) {
    if (e instanceof TripletexApiError) {
      return {
        content: [{ type: "text" as const, text: formatTripletexError(e) }],
      };
    }
    throw e;
  }
}

function optionalParams(
  obj: Record<string, string | number | boolean | undefined | null>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = typeof v === "boolean" ? String(v) : String(v);
  }
  return out;
}

/** Tripletex invoice/order list responses often use `value.id`. */
function readValueId(data: unknown): number | undefined {
  if (data && typeof data === "object" && "value" in data) {
    const v = (data as { value?: { id?: number } }).value;
    return v?.id;
  }
  return undefined;
}

const postalAddressSchema = z
  .object({
    addressLine1: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.object({ id: z.number() }).optional(),
  })
  .optional();

const orderLineSchema: z.ZodType<OrderLineInput> = z.object({
  description: z.string().optional(),
  count: z.number().optional(),
  unitPriceExcludingVatCurrency: z.number().optional(),
  unitPriceIncludingVatCurrency: z.number().optional(),
  vatTypeId: z.number().optional(),
  productId: z.number().optional(),
  discount: z.number().optional(),
});

// ===========================================================================
// INVOICES & ORDERS
// ===========================================================================

server.tool(
  "create_order",
  "Create an order in Tripletex. Use invoice_order to convert to invoice. Order line fields match Tripletex (count, unitPriceExcludingVatCurrency or unitPriceIncludingVatCurrency per isPrioritizeAmountsIncludingVat).",
  {
    customerId: z.number().describe("Customer ID → customer.id"),
    orderDate: z.string().describe("YYYY-MM-DD"),
    deliveryDate: z.string().describe("YYYY-MM-DD"),
    orderLines: z.array(orderLineSchema).optional(),
    isPrioritizeAmountsIncludingVat: z.boolean().optional(),
    currencyId: z.number().optional(),
    ourReference: z.string().optional(),
    yourReference: z.string().optional(),
    invoiceComment: z.string().optional(),
    receiverEmail: z.string().optional(),
    invoicesDueIn: z.number().optional(),
  },
  async (args) =>
    run(() => client.post("/order", buildOrderBody(args)))
);

server.tool(
  "invoice_order",
  "Convert an order to an invoice. Omit sendToCustomer to use Tripletex default (typically send).",
  {
    orderId: z.number(),
    invoiceDate: z.string().describe("YYYY-MM-DD"),
    sendToCustomer: z.boolean().optional(),
  },
  async ({ orderId, invoiceDate, sendToCustomer }) =>
    run(() => {
      const params = optionalParams({
        invoiceDate,
        ...(sendToCustomer !== undefined ? { sendToCustomer } : {}),
      });
      return client.put(`/order/${orderId}/:invoice`, {}, params);
    })
);

server.tool(
  "create_invoice",
  "Create order then invoice in one flow. orderLines use Tripletex field names (count, unitPriceExcludingVatCurrency, etc.).",
  {
    customerId: z.number(),
    invoiceDate: z.string().describe("YYYY-MM-DD"),
    orderLines: z.array(orderLineSchema),
    isPrioritizeAmountsIncludingVat: z.boolean().optional(),
    currencyId: z.number().optional(),
    ourReference: z.string().optional(),
    invoiceComment: z.string().optional(),
    sendToCustomer: z.boolean().optional(),
  },
  async (args) =>
    run(async () => {
      const orderBody = buildOrderBody({
        customerId: args.customerId,
        orderDate: args.invoiceDate,
        deliveryDate: args.invoiceDate,
        orderLines: args.orderLines,
        isPrioritizeAmountsIncludingVat: args.isPrioritizeAmountsIncludingVat,
        currencyId: args.currencyId,
        ourReference: args.ourReference,
        invoiceComment: args.invoiceComment,
      });
      const orderResult = await client.post("/order", orderBody);
      const orderId = readValueId(orderResult);
      if (orderId === undefined) {
        throw new Error(
          "create_invoice: order created but no value.id in response:\n" +
            formatResult(orderResult)
        );
      }
      const params = optionalParams({
        invoiceDate: args.invoiceDate,
        ...(args.sendToCustomer !== undefined
          ? { sendToCustomer: args.sendToCustomer }
          : {}),
      });
      return client.put(`/order/${orderId}/:invoice`, {}, params);
    })
);

server.tool(
  "get_invoice",
  "Get invoice by ID. Optional fields for Tripletex expansion e.g. *,orders(*),orderLines(*)",
  {
    id: z.number(),
    fields: z.string().optional(),
  },
  async ({ id, fields }) =>
    run(() => {
      const params = optionalParams({ fields });
      return client.get(`/invoice/${id}`, params);
    })
);

server.tool(
  "search_invoices",
  "Search outgoing invoices by date range (required) and optional filters.",
  {
    invoiceDateFrom: z.string().describe("YYYY-MM-DD"),
    invoiceDateTo: z.string().describe("YYYY-MM-DD"),
    customerId: z.number().optional(),
    isCredited: z.boolean().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        invoiceDateFrom: args.invoiceDateFrom,
        invoiceDateTo: args.invoiceDateTo,
        customerId: args.customerId,
        isCredited: args.isCredited,
        from: args.from,
        count: args.count ?? 25,
      });
      return client.get("/invoice", params);
    })
);

server.tool(
  "search_supplier_invoices",
  "Search incoming supplier invoices (required date range).",
  {
    invoiceDateFrom: z.string().describe("YYYY-MM-DD"),
    invoiceDateTo: z.string().describe("YYYY-MM-DD"),
    supplierId: z.number().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        invoiceDateFrom: args.invoiceDateFrom,
        invoiceDateTo: args.invoiceDateTo,
        supplierId: args.supplierId,
        from: args.from,
        count: args.count ?? 25,
      });
      return client.get("/supplierInvoice", params);
    })
);

// ===========================================================================
// CUSTOMERS & SUPPLIERS & PRODUCTS
// ===========================================================================

server.tool(
  "search_customers",
  "Search customers (query maps to Tripletex name filter).",
  {
    query: z.string().optional(),
    customerNumber: z.string().optional(),
    email: z.string().optional(),
    isActive: z.boolean().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        name: args.query,
        customerNumber: args.customerNumber,
        email: args.email,
        isActive: args.isActive,
        from: args.from,
        count: args.count ?? 25,
      });
      return client.get("/customer", params);
    })
);

const createCustomerSchema = z.object({
  name: z.string(),
  organizationNumber: z.string().optional(),
  email: z.string().optional(),
  invoiceEmail: z.string().optional(),
  phoneNumber: z.string().optional(),
  phoneNumberMobile: z.string().optional(),
  invoiceSendMethod: z.string().optional(),
  language: z.string().optional(),
  currencyId: z.number().optional(),
  postalAddress: postalAddressSchema,
});

function buildCustomerBody(
  input: z.infer<typeof createCustomerSchema>
): Record<string, unknown> {
  const body: Record<string, unknown> = { name: input.name };
  if (input.organizationNumber !== undefined)
    body.organizationNumber = input.organizationNumber;
  if (input.email !== undefined) body.email = input.email;
  if (input.invoiceEmail !== undefined) body.invoiceEmail = input.invoiceEmail;
  if (input.phoneNumber !== undefined) body.phoneNumber = input.phoneNumber;
  if (input.phoneNumberMobile !== undefined)
    body.phoneNumberMobile = input.phoneNumberMobile;
  if (input.invoiceSendMethod !== undefined)
    body.invoiceSendMethod = input.invoiceSendMethod;
  if (input.language !== undefined) body.language = input.language;
  if (input.currencyId !== undefined)
    body.currency = { id: input.currencyId };
  if (input.postalAddress !== undefined)
    body.postalAddress = input.postalAddress;
  return body;
}

server.tool(
  "create_customer",
  "Create customer. currencyId → currency.id",
  createCustomerSchema.shape,
  async (input) =>
    run(() =>
      client.post("/customer", buildCustomerBody(createCustomerSchema.parse(input)))
    )
);

server.tool(
  "update_customer",
  "Update customer by id (same optional fields as create).",
  {
    id: z.number(),
    name: z.string().optional(),
    organizationNumber: z.string().optional(),
    email: z.string().optional(),
    invoiceEmail: z.string().optional(),
    phoneNumber: z.string().optional(),
    phoneNumberMobile: z.string().optional(),
    invoiceSendMethod: z.string().optional(),
    language: z.string().optional(),
    currencyId: z.number().optional(),
    postalAddress: postalAddressSchema,
  },
  async ({ id, ...rest }) =>
    run(() => {
      const body: Record<string, unknown> = {};
      if (rest.name !== undefined) body.name = rest.name;
      if (rest.organizationNumber !== undefined)
        body.organizationNumber = rest.organizationNumber;
      if (rest.email !== undefined) body.email = rest.email;
      if (rest.invoiceEmail !== undefined) body.invoiceEmail = rest.invoiceEmail;
      if (rest.phoneNumber !== undefined) body.phoneNumber = rest.phoneNumber;
      if (rest.phoneNumberMobile !== undefined)
        body.phoneNumberMobile = rest.phoneNumberMobile;
      if (rest.invoiceSendMethod !== undefined)
        body.invoiceSendMethod = rest.invoiceSendMethod;
      if (rest.language !== undefined) body.language = rest.language;
      if (rest.currencyId !== undefined) body.currency = { id: rest.currencyId };
      if (rest.postalAddress !== undefined)
        body.postalAddress = rest.postalAddress;
      return client.put(`/customer/${id}`, body);
    })
);

server.tool(
  "search_products",
  "Search products (query → name filter).",
  {
    query: z.string().optional(),
    number: z.string().optional(),
    isInactive: z.boolean().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        name: args.query,
        number: args.number,
        isInactive: args.isInactive,
        from: args.from,
        count: args.count ?? 25,
      });
      return client.get("/product", params);
    })
);

server.tool(
  "create_product",
  "Create product. vatTypeId / currencyId expanded to nested ids.",
  {
    name: z.string(),
    number: z.string().optional(),
    priceExcludingVatCurrency: z.number().optional(),
    priceIncludingVatCurrency: z.number().optional(),
    vatTypeId: z.number().optional(),
    currencyId: z.number().optional(),
    description: z.string().optional(),
    isInactive: z.boolean().optional(),
  },
  async (args) =>
    run(() => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.number !== undefined) body.number = args.number;
      if (args.priceExcludingVatCurrency !== undefined)
        body.priceExcludingVatCurrency = args.priceExcludingVatCurrency;
      if (args.priceIncludingVatCurrency !== undefined)
        body.priceIncludingVatCurrency = args.priceIncludingVatCurrency;
      if (args.vatTypeId !== undefined) body.vatType = { id: args.vatTypeId };
      if (args.currencyId !== undefined) body.currency = { id: args.currencyId };
      if (args.description !== undefined) body.description = args.description;
      if (args.isInactive !== undefined) body.isInactive = args.isInactive;
      return client.post("/product", body);
    })
);

server.tool(
  "search_suppliers",
  "Search suppliers (query → name).",
  {
    query: z.string().optional(),
    organizationNumber: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        name: args.query,
        organizationNumber: args.organizationNumber,
        from: args.from,
        count: args.count ?? 25,
      });
      return client.get("/supplier", params);
    })
);

server.tool(
  "create_supplier",
  "Create supplier. Optional bankAccountNumber (Tripletex field name).",
  {
    name: z.string(),
    organizationNumber: z.string().optional(),
    email: z.string().optional(),
    postalAddress: postalAddressSchema,
    bankAccountNumber: z.string().optional(),
  },
  async (args) =>
    run(() => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.organizationNumber !== undefined)
        body.organizationNumber = args.organizationNumber;
      if (args.email !== undefined) body.email = args.email;
      if (args.postalAddress !== undefined)
        body.postalAddress = args.postalAddress;
      if (args.bankAccountNumber !== undefined)
        body.bankAccountNumber = args.bankAccountNumber;
      return client.post("/supplier", body);
    })
);

// ===========================================================================
// LEDGER
// ===========================================================================

server.tool(
  "search_accounts",
  "Search chart of accounts (query → name; optional numberFrom/numberTo).",
  {
    query: z.string().optional(),
    numberFrom: z.string().optional(),
    numberTo: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        name: args.query,
        numberFrom: args.numberFrom,
        numberTo: args.numberTo,
        from: args.from,
        count: args.count ?? 50,
      });
      return client.get("/ledger/account", params);
    })
);

server.tool(
  "search_vat_types",
  "List VAT types (query → name filter if supported by API).",
  {
    query: z.string().optional(),
  },
  async ({ query }) =>
    run(() => {
      const params = optionalParams({ name: query });
      return client.get("/ledger/vatType", params);
    })
);

server.tool(
  "create_voucher",
  "Create accounting voucher. Each posting needs accountId, amountGross, date (Tripletex posting DTO).",
  {
    date: z.string().describe("Voucher date YYYY-MM-DD"),
    description: z.string().optional(),
    postings: z.array(
      z.object({
        accountId: z.number(),
        amountGross: z.number(),
        amountGrossCurrency: z.number().optional(),
        date: z.string().describe("Posting date YYYY-MM-DD"),
        vatTypeId: z.number().optional(),
        row: z.number().optional(),
      })
    ),
  },
  async ({ date, description, postings }) =>
    run(() =>
      client.post("/ledger/voucher", {
        date,
        ...(description !== undefined ? { description } : {}),
        postings: postings.map(transformVoucherPosting),
      })
    )
);

server.tool(
  "search_vouchers",
  "Search vouchers by date range.",
  {
    dateFrom: z.string(),
    dateTo: z.string(),
    numberFrom: z.string().optional(),
    numberTo: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        numberFrom: args.numberFrom,
        numberTo: args.numberTo,
        from: args.from,
        count: args.count ?? 25,
      });
      return client.get("/ledger/voucher", params);
    })
);

server.tool(
  "get_voucher",
  "Get voucher by ID; optional fields for expansion.",
  {
    id: z.number(),
    fields: z.string().optional(),
  },
  async ({ id, fields }) =>
    run(() => {
      const params = optionalParams({ fields });
      return client.get(`/ledger/voucher/${id}`, params);
    })
);

// ===========================================================================
// BALANCE SHEET
// ===========================================================================

server.tool(
  "get_balance_sheet",
  "Balance sheet for period; optional account range and filters per Tripletex API.",
  {
    dateFrom: z.string(),
    dateTo: z.string(),
    accountNumberFrom: z.number().optional(),
    accountNumberTo: z.number().optional(),
    customerId: z.number().optional(),
    employeeId: z.number().optional(),
    departmentId: z.number().optional(),
    projectId: z.number().optional(),
    includeSubProjects: z.boolean().optional(),
    activeAccountsWithoutMovements: z.boolean().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        accountNumberFrom: args.accountNumberFrom,
        accountNumberTo: args.accountNumberTo,
        customerId: args.customerId,
        employeeId: args.employeeId,
        departmentId: args.departmentId,
        projectId: args.projectId,
        includeSubProjects: args.includeSubProjects,
        activeAccountsWithoutMovements: args.activeAccountsWithoutMovements,
        from: args.from,
        count: args.count ?? 1000,
      });
      return client.get("/balanceSheet", params);
    })
);

// ===========================================================================
// TIME & EMPLOYEES
// ===========================================================================

server.tool(
  "search_projects",
  "Search projects (query → name).",
  {
    query: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, from, count }) =>
    run(() => {
      const params = optionalParams({
        name: query,
        from,
        count: count ?? 25,
      });
      return client.get("/project", params);
    })
);

server.tool(
  "search_activities",
  "Search activities (query → name).",
  {
    query: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, from, count }) =>
    run(() => {
      const params = optionalParams({
        name: query,
        from,
        count: count ?? 50,
      });
      return client.get("/activity", params);
    })
);

server.tool(
  "search_time_entries",
  "Search timesheet entries in date range.",
  {
    dateFrom: z.string(),
    dateTo: z.string(),
    employeeId: z.number().optional(),
    projectId: z.number().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async (args) =>
    run(() => {
      const params = optionalParams({
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        employeeId: args.employeeId,
        projectId: args.projectId,
        from: args.from,
        count: args.count ?? 50,
      });
      return client.get("/timesheet/entry", params);
    })
);

server.tool(
  "create_time_entry",
  "Log hours. employeeId required per PRD (explicit employee).",
  {
    employeeId: z.number(),
    projectId: z.number(),
    activityId: z.number(),
    date: z.string(),
    hours: z.number(),
    comment: z.string().optional(),
  },
  async ({ employeeId, projectId, activityId, date, hours, comment }) =>
    run(() => {
      const body: Record<string, unknown> = {
        employee: { id: employeeId },
        project: { id: projectId },
        activity: { id: activityId },
        date,
        hours,
      };
      if (comment !== undefined) body.comment = comment;
      return client.post("/timesheet/entry", body);
    })
);

server.tool(
  "search_employees",
  "Search employees; query is sent as firstName filter (see Tripletex /employee OpenAPI for more filters).",
  {
    query: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, from, count }) =>
    run(() => {
      const params = optionalParams({
        firstName: query,
        from,
        count: count ?? 25,
      });
      return client.get("/employee", params);
    })
);

// ===========================================================================
// UTILITY
// ===========================================================================

server.tool(
  "whoami",
  "Authenticated session / company info.",
  {},
  async () => run(() => client.get("/token/session/>whoAmI"))
);

// ===========================================================================
// SKILLS (MCP Prompts + Resource)
// ===========================================================================

registerSkills(server);

// ===========================================================================
// START
// ===========================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tripletex MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
