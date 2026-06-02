import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { CheckCircle2, AlertCircle, Clock, TrendingUp, Users } from 'lucide-react'

export default function SusuFundPage() {
  const fund = {
    name: 'Kumasi Traders',
    type: 'Susu',
    totalMembers: 10,
    monthlyAmount: 500,
    currentCycle: 3,
    totalCycles: 10,
    nextPayout: 'Kofi Boateng',
    userPayoutCycle: 7,
    isPaid: false,
  }

  const members = [
    { name: 'Akosua Frimpong', status: 'paid', date: '28 May' },
    { name: 'Kofi Boateng', status: 'paid', date: '27 May' },
    { name: 'Ama Asante', status: 'paid', date: '26 May' },
    { name: 'Kwame Mensah', status: 'paid', date: '25 May' },
    { name: 'Esi Owusu', status: 'paid', date: '24 May' },
    { name: 'Yaw Amponsah', status: 'paid', date: '23 May' },
    { name: 'Abena Boakye', status: 'paid', date: '22 May' },
    { name: 'David Asare', status: 'pending', dueIn: '2 days' },
    { name: 'Grace Opoku', status: 'pending', dueIn: '3 days' },
    { name: 'Isaac Mensah', status: 'overdue', dueDays: '1 day ago' },
  ]

  const payoutOrder = [
    { cycle: 1, member: 'Akosua Frimpong', amount: 5000, status: 'completed' },
    { cycle: 2, member: 'Kofi Boateng', amount: 5000, status: 'completed' },
    { cycle: 3, member: 'Ama Asante', amount: 5000, status: 'current' },
    { cycle: 4, member: 'Kwame Mensah', amount: 5000, status: 'upcoming' },
    { cycle: 5, member: 'Esi Owusu', amount: 5000, status: 'upcoming' },
    { cycle: 6, member: 'Yaw Amponsah', amount: 5000, status: 'upcoming' },
    { cycle: 7, member: 'You (Abena Korang)', amount: 5000, status: 'upcoming' },
    { cycle: 8, member: 'David Asare', amount: 5000, status: 'upcoming' },
    { cycle: 9, member: 'Grace Opoku', amount: 5000, status: 'upcoming' },
    { cycle: 10, member: 'Isaac Mensah', amount: 5000, status: 'upcoming' },
  ]

  return (
    <AppShell currentPage="funds">
      <div className="max-w-4xl space-y-6">
        {/* Hero Summary */}
        <div className="cp-card p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{fund.name}</h1>
            <div className="flex items-center gap-2">
              <span className="inline-block text-sm font-medium bg-primary/10 text-primary rounded-full px-3 py-1">
                {fund.type}
              </span>
              <span className="text-sm text-secondary">{fund.totalMembers} members</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Cycle Progress</p>
              <p className="text-2xl font-bold text-foreground mt-2">
                {fund.currentCycle}/{fund.totalCycles}
              </p>
            </div>
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Monthly</p>
              <p className="text-2xl font-bold text-primary mt-2">GHS {fund.monthlyAmount}</p>
            </div>
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Next Payout</p>
              <p className="text-sm font-semibold text-foreground mt-2">{fund.nextPayout}</p>
            </div>
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Your Payout</p>
              <p className="text-sm font-semibold text-foreground mt-2">Cycle {fund.userPayoutCycle}</p>
            </div>
          </div>

          {/* Circular Progress */}
          <div className="flex items-center justify-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#E7E3DC"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#1D9E75"
                  strokeWidth="8"
                  strokeDasharray={`${(fund.currentCycle / fund.totalCycles) * 339.29} 339.29`}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{Math.round((fund.currentCycle / fund.totalCycles) * 100)}%</p>
                  <p className="text-xs text-secondary">Complete</p>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="space-y-2">
              {!fund.isPaid ? (
                <Link
                  href="/pay"
                  className="block w-48 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-colors text-center"
                >
                  Pay this month
                </Link>
              ) : (
                <div className="w-48 py-3 bg-primary/10 text-primary rounded-full font-medium text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Paid GHS 500
                </div>
              )}
              <p className="text-xs text-secondary text-center">Due in 2 days</p>
            </div>
          </div>
        </div>

        {/* This Cycle Card */}
        <div className="cp-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">This cycle ({fund.currentCycle} of {fund.totalCycles})</h2>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-secondary">8 of 10 paid</p>
              <p className="text-sm text-secondary">80%</p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '80%' }} />
            </div>
          </div>

          {/* Member List */}
          <div className="space-y-2 mt-4">
            <p className="text-sm font-medium text-foreground">Member status</p>
            <div className="grid gap-2">
              {members.map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {member.status === 'paid' && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                    {member.status === 'pending' && (
                      <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    )}
                    {member.status === 'overdue' && (
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      <p className="text-xs text-secondary">
                        {member.status === 'paid' && `Paid · ${member.date}`}
                        {member.status === 'pending' && `Pending · due in ${member.dueIn}`}
                        {member.status === 'overdue' && `Overdue · ${member.dueDays}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-secondary flex-shrink-0 ml-2">
                    {member.status === 'paid' && 'Paid'}
                    {member.status === 'pending' && 'Pending'}
                    {member.status === 'overdue' && 'Overdue'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payout Order Timeline */}
        <div className="cp-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Payout order</h2>
          
          <div className="space-y-3">
            {payoutOrder.map((payout) => (
              <div
                key={payout.cycle}
                className={`flex items-center gap-4 rounded-lg border p-4 ${
                  payout.status === 'current'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{
                    backgroundColor:
                      payout.status === 'completed'
                        ? '#E7E3DC'
                        : payout.status === 'current'
                        ? '#1D9E75'
                        : '#F5F3ED',
                    color:
                      payout.status === 'completed'
                        ? '#78716C'
                        : payout.status === 'current'
                        ? '#FFFFFF'
                        : '#1C1917',
                  }}
                >
                  {payout.cycle}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{payout.member}</p>
                  <p className="text-xs text-secondary">GHS {payout.amount.toLocaleString()}</p>
                </div>

                <div className="flex-shrink-0">
                  {payout.status === 'completed' && (
                    <span className="text-xs font-medium text-secondary">Completed</span>
                  )}
                  {payout.status === 'current' && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                      Current
                    </span>
                  )}
                  {payout.status === 'upcoming' && payout.member === 'You (Abena Korang)' && (
                    <span className="text-xs font-medium text-primary">Your turn</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
