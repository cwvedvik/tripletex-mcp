import { SkillDefinition } from "./types.js";

export const customerManagementSkill: SkillDefinition = {
  id: "customer-management",
  title: "Kundebehandling (Customer Management)",
  description: "Guide for searching, creating, and updating customers with Norwegian business conventions",
  triggers: ["kunde", "customer", "ny kunde", "opprett kunde", "endre kunde", "kundeoppslag"],
  requiredTools: ["search_customers", "create_customer", "update_customer"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Kundebehandling (Customer Management)

### Critical Rule: ALWAYS Search Before Creating
Duplicate customers cause serious accounting problems:
- Invoices link to the wrong customer record
- Outstanding balances (kundefordringer) become fragmented
- MVA reports can show incorrect data
- Cleanup requires manual correction of all linked transactions

**NEVER create a customer without searching first.**

### Norwegian Business Context
- Organisasjonsnummer (org.nr): 9-digit number assigned by Brønnøysundregistrene
  - Format: XXX XXX XXX (e.g., 912 345 678)
  - All Norwegian businesses have one; required for B2B invoicing
- Enkeltpersonforetak (sole proprietorship) use the owner's fødselsnummer as org.nr
- Foreign companies may not have a Norwegian org.nr

### Steps for Finding a Customer

**Step 1 — Search by name**
Call \`search_customers\` with query = customer name.
- Try partial names if exact match fails (e.g., "Nordvik" instead of "Nordvik Bygg AS")
- Check isActive to avoid matching deactivated customers

**Step 2 — Verify match**
If matches found, compare:
- Name (may differ slightly: "AS" vs "A/S", missing "AS" suffix)
- Organization number (most reliable identifier)
- Email/address for additional confirmation
Present matches to user if ambiguous.

### Steps for Creating a Customer

**Step 1 — Confirm with user**
Always confirm: "Kunden [name] finnes ikke i Tripletex. Skal jeg opprette den?"

**Step 2 — Gather required info**
- name (required) — full legal company name including "AS", "ASA", "ENK" etc.
- organizationNumber (strongly recommended for B2B)
- email (recommended — needed for sending invoices electronically)
- phoneNumber (optional)
- postalAddress (recommended):
  - addressLine1
  - postalCode
  - city
  - country: { id: 161 } for Norway

**Step 3 — Create**
Call \`create_customer\` with the gathered information.
Return the new customer ID to the user.

### Steps for Updating a Customer

**Step 1 — Find the customer first**
Call \`search_customers\` to get the current customer record and ID.

**Step 2 — Update**
Call \`update_customer\` with:
- id: the customer ID
- Only the fields that need changing

### Country IDs (Common)
- 161 = Norway (Norge)
- 164 = Sweden (Sverige)
- 47 = Denmark (Danmark)
- 68 = Finland
- 1 = United Kingdom
- 81 = Germany (Tyskland)

### Validation Checklist
- [ ] Searched for existing customer before creating
- [ ] Organization number format is valid (9 digits for Norwegian companies)
- [ ] Name includes legal suffix (AS, ASA, etc.) where applicable
- [ ] Country ID is correct (161 for Norway)`,
      },
    },
  ],
};
