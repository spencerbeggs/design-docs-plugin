---
"design-docs": patch
---

## Bug Fixes

* `finalize` no longer errors with "Usage credits required for 1M context". Removed the `model: sonnet` override so the user-invoked skill inherits the session model instead of forcing a model switch.
