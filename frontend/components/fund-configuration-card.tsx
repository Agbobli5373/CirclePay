import { Share2, CheckCircle2, Edit2 } from 'lucide-react'
import { Badge } from './ui/badge'

interface FundConfigProps {
  config: {
    fundType: 'Susu' | 'Medical'
    beneficiary?: string
    location?: string
    target: number
    payoutMethod: string
    shareableLink: boolean
  }
}

export function FundConfigurationCard({ config }: FundConfigProps) {
  const isMedical = config.fundType === 'Medical'

  return (
    <div className="cp-card p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-foreground mb-2">Configuration</h3>
      </div>

      {/* Config Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-3">
          <div>
            <p className="text-xs text-secondary font-medium uppercase tracking-wide">Fund Type</p>
            <p className="text-sm font-semibold text-foreground mt-1">{config.fundType}</p>
          </div>

          {isMedical && config.beneficiary && (
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Beneficiary</p>
              <p className="text-sm font-semibold text-foreground mt-1">{config.beneficiary}</p>
            </div>
          )}

          {isMedical && config.location && (
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Hospital</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm font-semibold text-foreground">{config.location}</p>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Verified
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          <div>
            <p className="text-xs text-secondary font-medium uppercase tracking-wide">Target Amount</p>
            <p className="text-sm font-semibold text-foreground mt-1">GHS {config.target.toLocaleString()}</p>
          </div>

          <div>
            <p className="text-xs text-secondary font-medium uppercase tracking-wide">Payout Method</p>
            <p className="text-sm font-semibold text-foreground mt-1">{config.payoutMethod}</p>
          </div>

          {config.shareableLink && (
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Shareable</p>
              <p className="text-sm font-semibold text-primary mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Yes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">
          <Edit2 className="h-4 w-4" />
          Edit details
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Create this fund
        </button>
      </div>
    </div>
  )
}
