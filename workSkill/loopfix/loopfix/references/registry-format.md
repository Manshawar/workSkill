# Registry Format (`browser/index.yaml`)

Catalog for **selection**. LLM reads this — not every Probe.

## Path

`.loopfix/browser/index.yaml`

## Schema

```yaml
version: 1

flows:
  user-create:
    description: Create user end-to-end
    path: probes/user/create-user.yaml
    tags: [user, crud]
    status: draft          # mirror probe status when possible

  order-create:
    description: Create order end-to-end
    path: probes/order/create-order.yaml
    tags: [order]
    status: verified
```

## Runtime selection

```
LLM reads index.yaml
 → picks flow id
 → loads only that Probe path
 → expands Action `use:` refs
 → agent-browser
 → Evidence
```

**Forbidden:** load all `probes/**/*.yaml` into context to "let the model assemble steps".

## Maintenance

- New Flow Probe → add index entry in same Step 3
- Status promote → update index `status`
- Deprecated → set `status: deprecated` (or remove)
