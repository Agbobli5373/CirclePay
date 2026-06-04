import { LedgerService, PostingInput } from './ledger.service'
import { assertBalanced, isBalanced } from '@circlepay/shared'
import { LedgerTxKind } from '@prisma/client'

/**
 * Ledger invariant tests (property-style).
 * These run without a DB — they test the pure logic from @circlepay/shared
 * and the LedgerService interface contract.
 *
 * Integration tests (with Prisma) are added in E4 when the first real transaction posts.
 */
describe('LedgerService — balanced-posting invariants', () => {
  describe('assertBalanced', () => {
    it('accepts postings that sum to zero', () => {
      const postings: PostingInput[] = [
        { accountId: 'moolre_float', amount: 500_00 },
        { accountId: 'fund_pot', amount: -500_00 },
      ]
      expect(() => assertBalanced(postings)).not.toThrow()
    })

    it('rejects postings that do not sum to zero', () => {
      const postings: PostingInput[] = [
        { accountId: 'moolre_float', amount: 500_00 },
        { accountId: 'fund_pot', amount: -400_00 },
      ]
      expect(() => assertBalanced(postings)).toThrow()
    })

    it('rejects fewer than 2 postings', () => {
      expect(() => assertBalanced([{ accountId: 'a', amount: 0 }])).toThrow()
    })
  })

  describe('isBalanced', () => {
    it('returns true for a balanced three-leg contribution', () => {
      // moolre_float += amount + platformFee - moolreFee
      // fund_pot     -= amount
      // platform_fee -= platformFee
      // moolre_fee   += moolreFee
      const amount = 50000       // GHS 500 in pesewas
      const platformFee = 500    // GHS 5
      const moolreFee = 100      // GHS 1

      const postings: PostingInput[] = [
        { accountId: 'moolre_float', amount: amount + platformFee - moolreFee },
        { accountId: 'fund_pot', amount: -amount },
        { accountId: 'platform_fee', amount: -platformFee },
        { accountId: 'moolre_fee', amount: moolreFee },
      ]
      expect(isBalanced(postings)).toBe(true)
    })

    it('returns true for a balanced payout', () => {
      const amount = 500000   // GHS 5,000 pot
      const moolreFee = 100

      const postings: PostingInput[] = [
        { accountId: 'fund_pot', amount: amount },
        { accountId: 'moolre_float', amount: -(amount + moolreFee) },
        { accountId: 'moolre_fee', amount: moolreFee },
      ]
      expect(isBalanced(postings)).toBe(true)
    })
  })

  describe('LedgerService.post contract', () => {
    it('throws before calling the DB when postings are unbalanced', async () => {
      // Stub the db so we can confirm no DB call is made on bad input.
      const db = { $transaction: jest.fn(), ledgerTransaction: { create: jest.fn() }, posting: { aggregate: jest.fn() }, ledgerAccount: { upsert: jest.fn() } }
      const service = new LedgerService(db as never)

      await expect(
        service.post({
          kind: LedgerTxKind.contribution,
          postings: [
            { accountId: 'moolre_float', amount: 1000 },
            { accountId: 'fund_pot', amount: -999 }, // off by 1
          ],
        }),
      ).rejects.toThrow()

      expect(db.$transaction).not.toHaveBeenCalled()
    })
  })
})
