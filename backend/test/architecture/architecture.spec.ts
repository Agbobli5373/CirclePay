import 'tsarch/dist/jest'
import * as fs from 'fs'
import * as path from 'path'
import { filesOfProject } from 'tsarch'

/**
 * Architecture rules (ArchUnit-style, via tsarch) enforcing the layering from
 * circlepay-stack/references/backend-conventions.md.
 *
 * tsarch enforces INTERNAL file-to-file dependency rules. External-package purity
 * (e.g. only the prisma module imports `@prisma/client`, shared/domain must not import
 * `@nestjs/*`) is enforced structurally: PrismaClient is imported only in
 * src/prisma/prisma.service.ts, and @circlepay/shared declares zero deps.
 */

// Intended feature module folders under src/ (added across later epics).
const FEATURES = [
  'auth',
  'users',
  'funds',
  'susu',
  'fundraisers',
  'contributions',
  'payouts',
  'trust',
  'notifications',
  'moolre',
  'webhooks',
  'ledger',
]

const srcDir = path.resolve(__dirname, '..', '..', 'src')
const existingFeatures = FEATURES.filter((f) => fs.existsSync(path.join(srcDir, f)))

describe('architecture', () => {
  jest.setTimeout(60000)

  it('has no cyclic dependencies in the source', async () => {
    const rule = filesOfProject().inFolder('src').should().beFreeOfCycles()
    await expect(rule).toPassAsync()
  })

  it('controllers must not depend on the Prisma layer directly (use a service)', async () => {
    const rule = filesOfProject()
      .matchingPattern('.*\\.controller\\.ts')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/prisma')
    await expect(rule).toPassAsync()
  })

  // Cross-feature isolation — only asserts pairs whose folders BOTH exist, so it stays
  // fast and meaningful as modules land. To extend: just create the module folder.
  describe('feature modules are isolated from each other', () => {
    const pairs = existingFeatures.flatMap((a) =>
      existingFeatures.filter((b) => b !== a).map((b) => [a, b] as const),
    )

    if (pairs.length === 0) {
      it('no feature modules yet — rule activates as modules are added', () => {
        expect(existingFeatures).toEqual([])
      })
    }

    for (const [a, b] of pairs) {
      it(`src/${a} should not depend on src/${b}`, async () => {
        const rule = filesOfProject()
          .inFolder(`src/${a}`)
          .shouldNot()
          .dependOnFiles()
          .inFolder(`src/${b}`)
        await expect(rule).toPassAsync()
      })
    }
  })
})
