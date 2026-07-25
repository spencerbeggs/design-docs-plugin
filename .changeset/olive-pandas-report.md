---
"design-docs": patch
---

## Bug Fixes

`design-validate` now reports the true number of hard-wrapped lines in a document. The detector capped its counter at five warnings per file and stopped counting there, so a document hard-wrapped end to end was indistinguishable from one with five bad lines — a 533-line doc that needed reflowing throughout reported the same "5" as a doc needing five edits, and readers scoped their fix to the five lines shown. Line-level detail is still capped at five to keep the report readable, but the count is now uncapped and a trailing `N hard-wrapped lines total, first 5 shown` summary fires whenever the cap is exceeded. The aggregate `**Warnings:**` tally reflects the true total as well, since the caller folds the same counter into it.

This also resolves the companion report that wrapped list-item continuations were never flagged. They were in fact detected all along — the detector's block-marker heuristic treats an indented continuation under a list item exactly like a wrapped paragraph, while correctly skipping nested list items, fenced code, tables, and block quotes. What actually happened is that paragraph-level wraps earlier in the file exhausted the five-warning budget before any list-item wrap could print, so the list warnings were starved rather than missing. Making the total visible surfaces them.
