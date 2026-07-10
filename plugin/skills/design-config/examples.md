# Common Use Cases

## Initialize New Project

```bash
/design-docs:design-config init \
  --name=my-project \
  --type=monorepo \
  --maintainer="Your Name"
```

## Add Package to Monorepo

```bash
/design-docs:design-config add-module my-package \
  --path=packages/my-package \
  --categories=architecture,performance
```

## Update Quality Standards Example

```bash
/design-docs:design-config update-quality \
  --designDocs.requireTOC=false \
  --context.rootMaxWords=2500
```

## Enable New Skills

```bash
/design-docs:design-config enable-skill design-prune design-export
```

## Validate After Manual Edit

```bash
/design-docs:design-config validate
```
