# shadcn/ui monorepo template

This is a Vite monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
## To-do List

- [ ] Need to test Electron with the parties
- [ ] Need to test self-host version with the parties
    - Need to implement auth with Better Auth for this to work.
- [ ] Need to deploy it and test it.
    - Need to implement auth with Better Auth for this to work.
    - Deploy to Cloudflare Workers so the Hono backend works which will link to a Neon-hosted PostgreSQL database that should work with the `/apps/server`.