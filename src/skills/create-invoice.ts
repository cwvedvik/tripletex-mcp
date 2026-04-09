import { SkillDefinition } from "./types.js";

export const createInvoiceSkill: SkillDefinition = {
  id: "create-invoice",
  title: "Opprett utgående faktura",
  description: "Step-by-step guide for creating an outgoing invoice with correct Norwegian VAT handling",
  triggers: ["faktura", "invoice", "fakturere", "send faktura", "utgående faktura"],
  requiredTools: ["search_customers", "create_customer", "search_vat_types", "create_invoice"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Opprett utgående faktura (Create Outgoing Invoice)

### Norsk regnskapslov / Norwegian GAAP Context
- All invoices MUST include MVA (VAT). Standard rates:
  - 25% — standard rate (most goods and services)
  - 15% — food and beverages (næringsmidler)
  - 12% — transport, cinema, hotels, broadcasting
  - 0% — exempt (e.g., health services, education, financial services)
- B2B invoices require organisasjonsnummer (org.nr) for both seller and buyer
- Invoice must contain: seller name+org.nr, buyer name+org.nr (B2B), invoice date, due date, line items with VAT specified, total amount incl/excl MVA
- Tripletex handles the Order → Invoice flow internally via create_invoice

### Pre-flight Checks
CRITICAL: Always search for the customer BEFORE creating. Duplicate customers cause incorrect invoice linkage and accounting errors.

### Steps

**Step 1 — Find the customer**
Call \`search_customers\` with the customer name.
- If exactly one match: use that customer ID
- If multiple matches: present the list to the user and ask which one
- If no match: ask the user "Kunden finnes ikke i Tripletex. Skal jeg opprette den?" before proceeding to step 2

**Step 2 — Create customer (only if needed)**
Call \`create_customer\` with:
- name (required)
- organizationNumber (required for B2B)
- email, phoneNumber, postalAddress (if available)

**Step 3 — Determine VAT types**
Call \`search_vat_types\` to look up the correct vatTypeId for each line item.
Common Norwegian VAT type IDs in Tripletex:
- vatTypeId 3 = 25% utgående MVA (standard goods/services)
- vatTypeId 31 = 15% utgående MVA (food)
- vatTypeId 33 = 12% utgående MVA (transport/hotel)
- vatTypeId 6 = 0% exempt (fritatt MVA)
If unsure which rate applies, ask the user.

**Step 4 — Create the invoice**
Call \`create_invoice\` with:
- customerId: from step 1 or 2
- invoiceDate: today's date or as specified by user (YYYY-MM-DD)
- dueDate: as specified, or calculate from customer payment terms (typically 14 or 30 days)
- lines: array of line items, each with:
  - description: what was sold/delivered
  - quantity: number of units
  - unitPriceExclVat: price per unit excluding VAT
  - vatTypeId: from step 3
- ourReference: optional, e.g., contact person name

**Step 5 — Confirm to user**
Present the created invoice summary: invoice number, customer, total excl. VAT, VAT amount, total incl. VAT.

### Common Errors & Fixes
- "Bank account required" — Ledger account 1920 needs a bank account number. This is a company setup issue, not something the invoice tool can fix.
- "Customer not found" — The customerId is wrong. Re-search the customer.
- "VAT type not found" — Use search_vat_types to look up valid IDs for the company.

### Validation Checklist
- [ ] Customer exists (searched, not assumed)
- [ ] VAT rate matches the type of goods/services
- [ ] Amounts are positive and reasonable
- [ ] Date format is YYYY-MM-DD
- [ ] Due date is after invoice date`,
      },
    },
  ],
};
