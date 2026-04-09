import { SkillDefinition } from "./types.js";

export const timeToInvoiceSkill: SkillDefinition = {
  id: "time-to-invoice",
  title: "Timer til faktura",
  description: "Workflow for converting logged time entries into an outgoing invoice",
  triggers: ["timer til faktura", "fakturere timer", "time tracking invoice", "timeføring faktura", "fakturering av timer"],
  requiredTools: ["search_projects", "search_time_entries", "search_customers", "create_invoice", "search_vat_types"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Timer til faktura (Time Entries to Invoice)

### Context
Common workflow for consultancies and service companies: log hours on a project, then periodically invoice the customer for the hours worked. This skill chains time tracking lookup with invoice creation.

### Steps

**Step 1 — Identify the project**
Call \`search_projects\` with the project name or ask the user.
Note the project ID and any customer association.

**Step 2 — Fetch time entries**
Call \`search_time_entries\` with:
- dateFrom: start of billing period (YYYY-MM-DD)
- dateTo: end of billing period (YYYY-MM-DD)
- projectId: from step 1
Results include: date, hours, employee name, activity, comment.

**Step 3 — Summarize for user**
Present a summary before creating the invoice:
- Total hours per employee/activity
- Date range covered
- Suggested hourly rate (ask user if not known)
- Calculated total excl. VAT

Ask: "Skal jeg lage en faktura basert på disse timene?"

**Step 4 — Find the customer**
Call \`search_customers\` to find the project's customer.
If the project metadata includes a customer, use that. Otherwise ask the user.

**Step 5 — Determine VAT**
Consulting services are normally 25% MVA (standard rate).
Call \`search_vat_types\` if needed to confirm vatTypeId.

**Step 6 — Create the invoice**
Call \`create_invoice\` with:
- customerId: from step 4
- invoiceDate: today or as specified
- dueDate: per agreement (typically 14 or 30 days)
- lines: group time entries into meaningful line items:
  - Option A: One line per employee: "Konsulenttimer [name] - [hours] timer x [rate]"
  - Option B: One line per activity: "Utvikling - [hours] timer x [rate]"
  - Option C: Single line: "Konsulenttimer [period] - [total hours] timer x [rate]"
  - Let the user choose the grouping
- Each line needs: description, quantity (hours), unitPriceExclVat (hourly rate), vatTypeId

**Step 7 — Confirm**
Show the created invoice: number, customer, line items, total excl. VAT, MVA, total incl. VAT.

### Tips
- If hours vary by rate (e.g., senior vs junior), create separate lines
- Round hours to nearest 0.5 if company policy requires it
- Include the period in the invoice description for traceability
- If some hours are already invoiced, make sure not to double-bill

### Validation Checklist
- [ ] Time period doesn't overlap with previously invoiced periods
- [ ] Hourly rate is confirmed by user
- [ ] All time entries in the period are accounted for
- [ ] VAT rate is correct (25% for consulting services)
- [ ] Invoice lines clearly describe the work performed`,
      },
    },
  ],
};
