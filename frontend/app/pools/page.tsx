import { redirect } from 'next/navigation'

// "Pools" was a mock surface that overlapped Funds; it's been retired. Anyone who
// still has the link bookmarked lands on the real Funds list.
export default function PoolsPage() {
  redirect('/funds')
}
