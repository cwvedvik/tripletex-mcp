import { SkillDefinition } from "./types.js";

export const travelExpenseSkill: SkillDefinition = {
  id: "travel-expense",
  title: "Reiseregning",
  description: "Guide for registering travel expenses with Norwegian per diem and mileage rules",
  triggers: ["reiseregning", "travel expense", "diett", "per diem", "reise", "kjøregodtgjørelse", "mileage"],
  requiredTools: ["search_employees", "search_accounts", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Reiseregning (Travel Expense)

### Norwegian Travel Expense Rules (Statens satser 2026)
Norwegian tax-free allowances for business travel (diett/kostgodtgjørelse):

**Per diem (diett) — domestic travel:**
- Over 6 hours: NOK 200 (dagsats)
- Over 12 hours: NOK 400
- Overnight (24+ hours): NOK 607 per day
- Rates are reduced if meals are provided by employer/client

**Per diem — international travel:**
- Varies by country, published annually by Skatteetaten

**Mileage allowance (kjøregodtgjørelse):**
- Private car used for business: NOK 3.50 per km
- Tax-free up to Skatteetaten limits

**Night allowance (nattillegg):**
- When not provided accommodation: NOK 435 per night

### Key Accounts
- 7100 Bilkostnader / kjøregodtgjørelse (mileage)
- 7130 Reisekostnader (travel costs)
- 7140 Diettkostnader (per diem)
- 7150 Hotellkostnader (accommodation, if not per diem)
- 2920 Reiseforskudd (travel advance, if applicable)
- 1920 Bank (reimbursement payment)

### Steps

**Step 1 — Gather travel details**
Ask the user:
- Who traveled? (employee name/ID)
- Destination (domestic/international)
- Departure date and time
- Return date and time
- Purpose of travel
- Transportation method (own car, public transit, flight)
- Accommodation (hotel, private, provided by host)
- Meals provided by others?

**Step 2 — Calculate allowances**

For per diem:
- Count hours of travel to determine rate
- Reduce for meals provided (breakfast: -20%, lunch: -30%, dinner: -50%)

For mileage:
- Total km driven × NOK 3.50/km
- Note: keep a driving log (kjørebok) for documentation

For actual expenses:
- Sum receipts for hotel, transport, etc.
- These are reimbursed at actual cost (not per diem)

**Step 3 — Look up account IDs**
Call \`search_accounts\` for the relevant cost accounts (7100, 7130, 7140).
Call \`search_employees\` to verify the employee.

**Step 4 — Post the voucher**
Call \`create_voucher\` with:
- date: travel completion date or reimbursement date
- description: "Reiseregning - [employee name] - [destination] [dates]"

Example: 2-day domestic trip, own car 300 km, per diem with hotel:
| Account | Amount | Description |
|---------|--------|-------------|
| 7140 Diett | +1,214 | Per diem 2 days × 607 |
| 7100 Kjøregodtgjørelse | +1,050 | 300 km × 3.50 |
| 7150 Hotell | +1,200 | 1 night hotel |
| 1920 Bank | -3,464 | Reimbursement to employee |

**Step 5 — Confirm**
Show the travel expense breakdown and total reimbursement amount.

### Tax Implications
- Per diem within Skatteetaten rates: tax-free for the employee
- Amounts above rates: taxable as income (must be reported on A-melding)
- Mileage within rates: tax-free
- Actual expense reimbursements: tax-free (receipts required)

### Documentation Requirements
- Travel expenses must have supporting documentation (receipts, travel log)
- Per diem requires: dates, times, destination, purpose
- Mileage requires: date, from/to, km driven, purpose

### Validation Checklist
- [ ] Travel dates and purpose documented
- [ ] Per diem rates match current Statens satser
- [ ] Mileage calculated correctly
- [ ] Meal reductions applied where applicable
- [ ] Voucher postings balance to 0
- [ ] Employee identified correctly`,
      },
    },
  ],
};
