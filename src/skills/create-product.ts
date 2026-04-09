import { SkillDefinition } from "./types.js";

export const createProductSkill: SkillDefinition = {
  id: "create-product",
  title: "Opprett produkt",
  description: "Guide for creating products in Tripletex for use in orders and invoices",
  triggers: ["produkt", "product", "nytt produkt", "opprett produkt", "vare", "tjeneste"],
  requiredTools: ["search_products", "create_product", "search_vat_types"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Opprett produkt (Create Product)

### Context
Products in Tripletex are reusable line items for orders and invoices. A product can represent a physical good (vare) or a service (tjeneste). Creating products avoids re-typing descriptions and prices on every invoice.

### Pre-flight: Search First
ALWAYS search before creating to avoid duplicates.

### Steps

**Step 1 — Search for existing product**
Call \`search_products\` with the product name.
- If found: confirm with user whether to use the existing product or create a new one
- If not found: proceed to creation

**Step 2 — Gather product info**
- name (required) — descriptive product name
- number (optional) — product/article number
- priceExclVat (recommended) — default unit price excluding VAT
- vatTypeId (recommended) — default VAT type for this product
- isActive (default true)

**Step 3 — Determine VAT type**
Call \`search_vat_types\` to find the correct vatTypeId:
- 25% for most goods and services
- 15% for food/beverages
- 12% for transport, hotels, cinema
- 0% for exempt services (health, education, finance)

**Step 4 — Create the product**
Call \`create_product\` with the gathered information.

**Step 5 — Confirm**
Return the product ID and name. The product is now available for use in orders and invoices.

### Tips
- Use consistent naming: "Konsulenttimer - Senior", "Konsulenttimer - Junior"
- Set a default price — it can be overridden per invoice line
- Products with correct VAT types save time when creating invoices

### Validation Checklist
- [ ] Searched for existing product first
- [ ] Product name is descriptive and unique
- [ ] VAT type matches the product category
- [ ] Price is excluding VAT (not including)`,
      },
    },
  ],
};
