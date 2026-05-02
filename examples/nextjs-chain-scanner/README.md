# Next.js Chain Scanner Example

This example shows the intended server-side integration shape for the TypeScript SDK inside a Next.js App Router project.

## Files

- `app/page.tsx`: server component that loads a small chain snapshot
- `lib/cutemarkets.ts`: shared client constructor

## Expected Output

The page renders a short table of liquid contracts for one underlying, filtered on spread and ordered by open interest.

## Required Environment Variable

```bash
CUTEMARKETS_API_KEY=cm_...
```
