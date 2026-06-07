import { CollectionChannel, TransferChannel } from './moolre.client'

/**
 * Shared Moolre request formatting — the network→channel maps, payer normalization, and
 * amount string. Previously duplicated across the deposits/contributions/payouts/fundraisers
 * services; centralized here so the channel codes can't drift between payment legs.
 */

/** Moolre wants the number without a leading '+' (e.g. +233241234567 → 233241234567). */
export function toMoolrePayer(phone: string): string {
  return phone.replace(/^\+/, '')
}

/** Pesewas → Moolre's major-unit amount string, e.g. 50000 → "500.00". */
export function ghs(pesewas: number): string {
  return (pesewas / 100).toFixed(2)
}

/** MoMo COLLECTION channel for a payer's network (MTN 13 / Telecel 6 / AirtelTigo 7; defaults MTN). */
export function collectionChannelFor(network: string | null | undefined): CollectionChannel {
  if (network === 'Telecel') return CollectionChannel.Telecel
  if (network === 'AirtelTigo') return CollectionChannel.AirtelTigo
  return CollectionChannel.MTN
}

/** MoMo TRANSFER/payout channel for a payee's network (MTN 1 / Telecel 6 / AirtelTigo 7; defaults MTN).
 *  Bank transfers use TransferChannel.Bank directly at the call site. */
export function transferChannelFor(network: string | null | undefined): TransferChannel {
  if (network === 'Telecel') return TransferChannel.Telecel
  if (network === 'AirtelTigo') return TransferChannel.AirtelTigo
  return TransferChannel.MTN
}
