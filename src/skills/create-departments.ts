import { SkillDefinition } from "./types.js";

export const createDepartmentsSkill: SkillDefinition = {
  id: "create-departments",
  title: "Opprett avdeling",
  description: "Guide for creating departments for organizational structure and cost allocation",
  triggers: ["avdeling", "department", "ny avdeling", "opprett avdeling", "kostnadssted"],
  requiredTools: ["search_accounts"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Opprett avdeling (Create Department)

### Context
Departments in Tripletex serve as:
- Organizational units (e.g., Salg, Utvikling, Administrasjon)
- Cost centers (kostnadssted) for internal accounting
- Required when creating employees (each employee must belong to a department)
- Used for reporting and budgeting per department

### Steps

**Step 1 — Plan the department structure**
Ask the user:
- Department name
- Department number (company convention)
- Is it a sub-department of an existing one?

Common department structures for Norwegian SMBs:
- 10 Administrasjon / Ledelse
- 20 Salg / Marked
- 30 Utvikling / Produksjon
- 40 Økonomi / Regnskap
- 50 Kundeservice / Support

**Step 2 — Create the department**
POST to /department with:
- name (required) — department name
- departmentNumber (recommended) — unique number
- departmentManagerId (optional) — employee ID of the manager

**Step 3 — Verify**
Confirm: department ID, name, and number.
The department is now available for:
- Assigning employees
- Filtering in balance sheet reports
- Cost allocation on vouchers

### Tips
- Keep department numbers consistent (10, 20, 30... allows inserting later)
- Departments appear as filters in most Tripletex reports
- Use the departmentId filter in \`get_balance_sheet\` to see per-department financials

### Validation Checklist
- [ ] Department name is clear and follows company conventions
- [ ] Department number is unique
- [ ] Structure aligns with the company's organizational chart`,
      },
    },
  ],
};
