# Error Handling

## File Not Found

```text
ERROR: CLAUDE.md file not found
- Path: {path}
- Fix: Check file path
```

## Already Split

```text
INFO: CLAUDE.md appears to already be split
- Found child files:
  - CLAUDE.commands.md
  - CLAUDE.architecture.md
- Recommendation: Review existing split or merge first
```

## Under Limit

```text
INFO: CLAUDE.md is under word limit
- Words: 1548 / 2000
- Overage: 0 words
- Recommendation: Split not necessary, consider other optimizations
```

## Too Small to Split

```text
WARNING: File too small for meaningful split
- Words: 624
- Minimum for split: 1600
- Recommendation: File is fine as-is
```
