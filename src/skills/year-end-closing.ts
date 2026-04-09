import { SkillDefinition } from "./types.js";

export const yearEndClosingSkill: SkillDefinition = {
  id: "year-end-closing",
  title: "Årsoppgjør",
  description: "Guide for year-end closing procedures following Norwegian accounting law",
  triggers: ["årsoppgjør", "year end", "årsregnskap", "årsavslutning", "annual accounts", "year-end closing"],
  requiredTools: ["get_balance_sheet", "search_accounts", "search_vouchers", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Årsoppgjør (Year-End Closing)

### Norsk regnskapslov / Norwegian GAAP Context
All Norwegian companies must prepare annual accounts (årsregnskap) consisting of:
- Resultatregnskap (income statement)
- Balanse (balance sheet)
- Noter (notes to the accounts)
- Kontantstrømoppstilling (cash flow statement — required for larger companies)

Key deadlines:
- Årsregnskap must be approved by styret (board) within 6 months after year-end
- Filed with Brønnøysundregistrene (Regnskapsregisteret)
- Skattemelding (tax return) due May 31

### Year-End Checklist (Typical Steps)

**Phase 1 — Reconciliation (Avstemming)**

Step 1: Bank reconciliation
- Compare bank balance per 31.12 with account 1920
- Call \`get_balance_sheet\` with dateTo: "[next-year]-01-01", accountNumberFrom: "1920", accountNumberTo: "1920"
- Any difference must be investigated and corrected

Step 2: Customer receivables (Kundefordringer)
- Review account 1500 balance
- Check for doubtful receivables (tap på fordringer)
- Write off uncollectible amounts to account 7700

Step 3: Supplier payables (Leverandørgjeld)
- Review account 2400 balance
- Verify outstanding invoices match actual liabilities

Step 4: VAT reconciliation (MVA-avstemming)
- Verify accounts 2700 (utgående) and 2710 (inngående) match MVA returns filed
- Any difference indicates missing or incorrect postings

**Phase 2 — Adjustments (Periodiseringer)**

Step 5: Accruals (Periodiseringer)
- Prepaid expenses (forskuddsbetalte kostnader) → account 1700
- Accrued income (opptjent, ikke fakturert) → account 1580
- Accrued expenses (påløpte kostnader) → account 2960

Step 6: Depreciation (Avskrivninger)
- Post annual depreciation on fixed assets
- Account 1200 Maskiner → 7000 Avskrivninger
- Follow saldoavskrivning (declining balance) or lineær (straight-line) method

Step 7: Inventory valuation (Varelager)
- If applicable, adjust account 1400 to match physical inventory count
- Write down to lowest of cost and net realizable value (laveste verdis prinsipp)

**Phase 3 — Tax Provisions**

Step 8: Calculate tax
- Norwegian corporate tax rate: 22%
- Betalbar skatt (tax payable) → account 2500
- Utsatt skatt (deferred tax) → account 2560

**Phase 4 — Close Result**

Step 9: Transfer result to equity
- Net profit/loss is transferred from result accounts (3xxx-8xxx) to equity (2050 Annen egenkapital)
- This is typically done as a closing voucher

**Phase 5 — Review**

Step 10: Final balance sheet review
- Call \`get_balance_sheet\` for the full year
- Verify assets = liabilities + equity
- Review for unusual balances or missing entries

### Important Notes
- This is a complex process — for most SMBs, an accountant (regnskapsfører) handles the årsoppgjør
- This skill provides guidance, but professional judgment is required for tax calculations and valuations
- Tripletex has built-in year-end closing features that may handle some of these steps automatically

### Validation Checklist
- [ ] All bank accounts reconciled per 31.12
- [ ] Customer and supplier balances verified
- [ ] MVA accounts reconciled with filed returns
- [ ] Depreciation posted
- [ ] Accruals and prepayments adjusted
- [ ] Tax provision calculated and posted
- [ ] Result transferred to equity
- [ ] Balance sheet balances (assets = liabilities + equity)`,
      },
    },
  ],
};
