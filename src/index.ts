#!/usr/bin/env node
/**
 * Tripletex MCP Server
 *
 * Provides AI assistants with access to Tripletex accounting features:
 * - Time tracking (log hours, projects, activities)
 * - Invoices (search, create, send)
 * - Customers & suppliers (search, create, update)
 * - Accounting (vouchers, chart of accounts, balance sheet)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TripletexClient } from "./tripletex-client.js";

const client = new TripletexClient();
const server = new McpServer({
  name: "tripletex",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function optionalParams(obj: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

// ===========================================================================
// TIME TRACKING
// ===========================================================================

server.tool(
  "search_projects",
  "Search for projects in Tripletex",
  {
    query: z.string().optional().describe("Free-text search on project name/number"),
    from: z.number().optional().describe("Pagination start index (0-based)"),
    count: z.number().optional().describe("Max results to return (default 25)"),
  },
  async ({ query, from, count }) => {
    const params = optionalParams({
      name: query,
      from: from?.toString(),
      count: (count ?? 25).toString(),
    });
    const data = await client.get("/project", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "search_activities",
  "Search for activities (used when logging hours)",
  {
    query: z.string().optional().describe("Activity name filter"),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, from, count }) => {
    const params = optionalParams({
      name: query,
      from: from?.toString(),
      count: (count ?? 50).toString(),
    });
    const data = await client.get("/activity", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "search_time_entries",
  "Search time entries (timesheets) within a date range",
  {
    dateFrom: z.string().describe("Start date YYYY-MM-DD"),
    dateTo: z.string().describe("End date YYYY-MM-DD"),
    employeeId: z.string().optional().describe("Filter by employee ID"),
    projectId: z.string().optional().describe("Filter by project ID"),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ dateFrom, dateTo, employeeId, projectId, from, count }) => {
    const params = optionalParams({
      dateFrom,
      dateTo,
      employeeId,
      projectId,
      from: from?.toString(),
      count: (count ?? 50).toString(),
    });
    const data = await client.get("/timesheet/entry", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "create_time_entry",
  "Log hours in Tripletex",
  {
    activityId: z.number().describe("Activity ID"),
    projectId: z.number().describe("Project ID"),
    date: z.string().describe("Date YYYY-MM-DD"),
    hours: z.number().describe("Number of hours"),
    comment: z.string().optional().describe("Optional comment"),
    employeeId: z.number().optional().describe("Employee ID (defaults to token owner)"),
  },
  async ({ activityId, projectId, date, hours, comment, employeeId }) => {
    const body: Record<string, unknown> = {
      activity: { id: activityId },
      project: { id: projectId },
      date,
      hours,
    };
    if (comment) body.comment = comment;
    if (employeeId) body.employee = { id: employeeId };
    const data = await client.post("/timesheet/entry", body);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

// ===========================================================================
// INVOICES
// ===========================================================================

server.tool(
  "search_invoices",
  "Search outgoing invoices",
  {
    invoiceDateFrom: z.string().optional().describe("From date YYYY-MM-DD"),
    invoiceDateTo: z.string().optional().describe("To date YYYY-MM-DD"),
    customerId: z.string().optional().describe("Customer ID"),
    isCredited: z.string().optional().describe("Filter credited invoices (true/false)"),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ invoiceDateFrom, invoiceDateTo, customerId, isCredited, from, count }) => {
    const params = optionalParams({
      invoiceDateFrom,
      invoiceDateTo,
      customerId,
      isCredited,
      from: from?.toString(),
      count: (count ?? 25).toString(),
    });
    const data = await client.get("/invoice", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "get_invoice",
  "Get a single invoice by ID",
  {
    id: z.number().describe("Invoice ID"),
  },
  async ({ id }) => {
    const data = await client.get(`/invoice/${id}`);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "create_invoice",
  "Create a new outgoing invoice",
  {
    customerId: z.number().describe("Customer ID"),
    invoiceDate: z.string().describe("Invoice date YYYY-MM-DD"),
    dueDate: z.string().describe("Due date YYYY-MM-DD"),
    lines: z
      .array(
        z.object({
          description: z.string(),
          quantity: z.number(),
          unitPriceExclVat: z.number(),
          vatTypeId: z.number().optional(),
        })
      )
      .describe("Invoice line items"),
    ourReference: z.string().optional(),
  },
  async ({ customerId, invoiceDate, dueDate, lines, ourReference }) => {
    const body: Record<string, unknown> = {
      customer: { id: customerId },
      invoiceDate,
      dueDate,
      orders: [],
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceExclVat: l.unitPriceExclVat,
        ...(l.vatTypeId ? { vatType: { id: l.vatTypeId } } : {}),
      })),
    };
    if (ourReference) body.ourReference = ourReference;
    const data = await client.post("/invoice", body);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "search_supplier_invoices",
  "Search incoming supplier invoices",
  {
    invoiceDateFrom: z.string().optional(),
    invoiceDateTo: z.string().optional(),
    supplierId: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ invoiceDateFrom, invoiceDateTo, supplierId, from, count }) => {
    const params = optionalParams({
      invoiceDateFrom,
      invoiceDateTo,
      supplierId,
      from: from?.toString(),
      count: (count ?? 25).toString(),
    });
    const data = await client.get("/supplierInvoice", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

// ===========================================================================
// CUSTOMERS & SUPPLIERS
// ===========================================================================

server.tool(
  "search_customers",
  "Search for customers in Tripletex",
  {
    query: z.string().optional().describe("Search by name"),
    customerNumber: z.string().optional(),
    email: z.string().optional(),
    isActive: z.string().optional().describe("true/false"),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, customerNumber, email, isActive, from, count }) => {
    const params = optionalParams({
      name: query,
      customerNumber,
      email,
      isActive,
      from: from?.toString(),
      count: (count ?? 25).toString(),
    });
    const data = await client.get("/customer", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "create_customer",
  "Create a new customer",
  {
    name: z.string().describe("Customer name"),
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
    organizationNumber: z.string().optional().describe("Org number (Norwegian)"),
    postalAddress: z
      .object({
        addressLine1: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        country: z.object({ id: z.number() }).optional(),
      })
      .optional(),
  },
  async ({ name, email, phoneNumber, organizationNumber, postalAddress }) => {
    const body: Record<string, unknown> = { name };
    if (email) body.email = email;
    if (phoneNumber) body.phoneNumber = phoneNumber;
    if (organizationNumber) body.organizationNumber = organizationNumber;
    if (postalAddress) body.postalAddress = postalAddress;
    const data = await client.post("/customer", body);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "search_suppliers",
  "Search for suppliers in Tripletex",
  {
    query: z.string().optional().describe("Search by name"),
    organizationNumber: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, organizationNumber, from, count }) => {
    const params = optionalParams({
      name: query,
      organizationNumber,
      from: from?.toString(),
      count: (count ?? 25).toString(),
    });
    const data = await client.get("/supplier", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "create_supplier",
  "Create a new supplier",
  {
    name: z.string().describe("Supplier name"),
    email: z.string().optional(),
    organizationNumber: z.string().optional(),
    bankAccount: z.string().optional().describe("Bank account number"),
  },
  async ({ name, email, organizationNumber, bankAccount }) => {
    const body: Record<string, unknown> = { name };
    if (email) body.email = email;
    if (organizationNumber) body.organizationNumber = organizationNumber;
    if (bankAccount) body.bankAccountNumber = bankAccount;
    const data = await client.post("/supplier", body);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

// ===========================================================================
// ACCOUNTING
// ===========================================================================

server.tool(
  "search_accounts",
  "Search chart of accounts (kontoplan)",
  {
    query: z.string().optional().describe("Search by account name"),
    numberFrom: z.string().optional().describe("Account number range start"),
    numberTo: z.string().optional().describe("Account number range end"),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, numberFrom, numberTo, from, count }) => {
    const params = optionalParams({
      name: query,
      numberFrom,
      numberTo,
      from: from?.toString(),
      count: (count ?? 50).toString(),
    });
    const data = await client.get("/ledger/account", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "search_vouchers",
  "Search accounting vouchers (bilag)",
  {
    dateFrom: z.string().describe("From date YYYY-MM-DD"),
    dateTo: z.string().describe("To date YYYY-MM-DD"),
    numberFrom: z.string().optional(),
    numberTo: z.string().optional(),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ dateFrom, dateTo, numberFrom, numberTo, from, count }) => {
    const params = optionalParams({
      dateFrom,
      dateTo,
      numberFrom,
      numberTo,
      from: from?.toString(),
      count: (count ?? 25).toString(),
    });
    const data = await client.get("/ledger/voucher", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "get_voucher",
  "Get a single voucher by ID with postings",
  {
    id: z.number().describe("Voucher ID"),
  },
  async ({ id }) => {
    const data = await client.get(`/ledger/voucher/${id}`);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "create_voucher",
  "Create an accounting voucher (bilag) with postings",
  {
    date: z.string().describe("Voucher date YYYY-MM-DD"),
    description: z.string().describe("Voucher description"),
    postings: z
      .array(
        z.object({
          accountId: z.number().describe("Ledger account ID"),
          amount: z.number().describe("Amount (positive = debit, negative = credit)"),
          description: z.string().optional(),
        })
      )
      .describe("Debit/credit postings (must balance to 0)"),
  },
  async ({ date, description, postings }) => {
    const body = {
      date,
      description,
      postings: postings.map((p) => ({
        account: { id: p.accountId },
        amount: p.amount,
        description: p.description,
      })),
    };
    const data = await client.post("/ledger/voucher", body);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

// ===========================================================================
// BALANCE SHEET
// ===========================================================================

server.tool(
  "get_balance_sheet",
  "Get the balance sheet (saldobalanse) for a given period and optional filters",
  {
    dateFrom: z.string().describe("Start date YYYY-MM-DD (inclusive)"),
    dateTo: z.string().describe("End date YYYY-MM-DD (exclusive)"),
    accountNumberFrom: z.string().optional().describe("Account number range start"),
    accountNumberTo: z.string().optional().describe("Account number range end"),
    customerId: z.number().optional().describe("Filter by customer ID"),
    employeeId: z.number().optional().describe("Filter by employee ID"),
    departmentId: z.number().optional().describe("Filter by department ID"),
    projectId: z.number().optional().describe("Filter by project ID"),
    includeSubProjects: z.boolean().optional().describe("Include sub-projects"),
    activeAccountsWithoutMovements: z.boolean().optional().describe("Include active accounts without movements"),
    from: z.number().optional().describe("Pagination start index (0-based)"),
    count: z.number().optional().describe("Max results to return (default 1000)"),
  },
  async ({
    dateFrom,
    dateTo,
    accountNumberFrom,
    accountNumberTo,
    customerId,
    employeeId,
    departmentId,
    projectId,
    includeSubProjects,
    activeAccountsWithoutMovements,
    from,
    count,
  }) => {
    const params = optionalParams({
      dateFrom,
      dateTo,
      accountNumberFrom,
      accountNumberTo,
      customerId: customerId?.toString(),
      employeeId: employeeId?.toString(),
      departmentId: departmentId?.toString(),
      projectId: projectId?.toString(),
      includeSubProjects: includeSubProjects?.toString(),
      activeAccountsWithoutMovements: activeAccountsWithoutMovements?.toString(),
      from: from?.toString(),
      count: (count ?? 1000).toString(),
    });
    const data = await client.get("/balanceSheet", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

// ===========================================================================
// UTILITY
// ===========================================================================

server.tool(
  "whoami",
  "Get info about the current authenticated user/company",
  {},
  async () => {
    const data = await client.get("/token/session/>whoAmI");
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

server.tool(
  "search_employees",
  "Search employees in the company",
  {
    query: z.string().optional().describe("Search by name"),
    from: z.number().optional(),
    count: z.number().optional(),
  },
  async ({ query, from, count }) => {
    const params = optionalParams({
      firstName: query,
      from: from?.toString(),
      count: (count ?? 25).toString(),
    });
    const data = await client.get("/employee", params);
    return { content: [{ type: "text" as const, text: formatResult(data) }] };
  }
);

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
