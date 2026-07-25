---
"design-docs": patch
---

## Performance

`design-link` classifies references in a single `awk` pass instead of forking per reference. The checker was subprocess-bound: it forked a `grep` per reference to test node-set membership, a subshell per path resolution, and re-parsed a target document's heading slugs once per anchor link pointing at it — upwards of 1,600 process spawns on a 22-document corpus, scaling with reference count rather than corpus size. A link checker only catches link rot if people are willing to run it, and at roughly 45 seconds it had stopped being something anyone ran casually.

Collection now extracts raw reference records only, and one `awk` invocation classifies the whole corpus — path resolution, node membership, and the heading-anchor pipeline included, with heading slugs memoized per target file. Associative arrays are available inside the awk program regardless of the bash 3.2 constraint that governs shipped scripts. A synthetic 22-document corpus went from 29.6s to 2.0s, with byte-identical output. Detection semantics and report format are unchanged.

The node list is passed to `awk` as a file argument rather than through `-v`, because the BWK awk that ships as `/usr/bin/awk` on macOS rejects a `-v` value containing a newline — which would have silently classified zero references on a stock Mac.
