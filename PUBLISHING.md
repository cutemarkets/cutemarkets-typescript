# Publishing `cutemarkets-typescript`

This package is set up for a public npm release. The package name, exports, and `prepublishOnly` script are already wired. The release flow should be:

## 1. Prepare the repo

```bash
npm install
npm run build
npm run check
npm run check:examples
```

## 2. Authenticate to npm

If you are not logged in yet:

```bash
npm login
```

Use the CuteMarkets npm account or the organization account that should own the package.

Verify the active account:

```bash
npm whoami
```

## 3. Dry-run the package

Inspect what will actually be published:

```bash
npm pack --dry-run
```

Check that the tarball contains:

- `dist/`
- `README.md`
- `LICENSE`

It should not include `node_modules/`, temporary build artifacts, or unrelated local files.

## 4. Tag the release

Update `package.json` if the version needs to change. Then create a git tag that matches the package version:

```bash
git tag v0.1.0
```

Push the tag after the repo is pushed:

```bash
git push origin main --tags
```

## 5. Publish

For the first public release:

```bash
npm publish --access public
```

For later releases, the `publishConfig.access` field already keeps the package public:

```bash
npm publish
```

## 6. Verify the published package

After publish:

```bash
npm view cutemarkets-typescript version
```

Then test a clean install from outside the repo:

```bash
mkdir /tmp/cutemarkets-typescript-smoke
cd /tmp/cutemarkets-typescript-smoke
npm init -y
npm install cutemarkets-typescript
```

Smoke test:

```ts
import { CuteMarketsClient } from "cutemarkets-typescript";

const client = new CuteMarketsClient({ apiKey: process.env.CUTEMARKETS_API_KEY });
const status = await client.status();
console.log(status.status);
```

## 7. Update downstream docs

Once the package is live:

- keep `README.md` focused on `npm install cutemarkets-typescript`
- update cookbook docs to prefer the npm install path over GitHub or local installs
- add the npm package link to the org profile and website docs if desired
