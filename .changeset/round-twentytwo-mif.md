---
"agentmove-cli": minor
---

Memory interchange via MIF v2: `export --mif <file>` writes the memory layer
as a vendor-neutral MIF document, and `import <client> --mif <file>` imports
memories from a MIF document instead of a bundle. Non-portable MIF fields
(embeddings, knowledge-graph data) are dropped with warnings; non-MIF input
is a data error (exit 3).
