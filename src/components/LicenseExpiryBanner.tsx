import { useSetting } from '@/hooks/useSetting'
import { useOwner } from '@/hooks/useOwner'
import { useSubscriptionModal } from '@/hooks/useSubscriptionModal'

// Number of days before expiry to show warning banner
const EXPIRY_WARNING_DAYS = 7

export function LicenseExpiryBanner() {
  const { licenseExpiry } = useSetting()
  const isOwner = useOwner()
  const subscriptionModal = useSubscriptionModal()

  if (!licenseExpiry) return null

  const now = Date.now()
  const expiryMs = licenseExpiry * 1000
  const daysUntilExpiry = Math.ceil((expiryMs - now) / (1000 * 60 * 60 * 24))

  // Don't show if not expiring soon (expired = negative days, so always shows)
  if (daysUntilExpiry > EXPIRY_WARNING_DAYS) return null

  const message =
    daysUntilExpiry < 0
      ? 'Your license has expired.'
      : daysUntilExpiry === 0
      ? 'Your license expires today.'
      : daysUntilExpiry === 1
        ? 'Your license expires tomorrow.'
        : `Your license expires in ${daysUntilExpiry} days.`

  if (isOwner) {
    return (
      <button
        onClick={() => subscriptionModal.open()}
        className="flex h-10 w-full items-center justify-center gap-1.5 bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {message} Click to renew.
      </button>
    )
  }

  return (
    <div className="flex h-10 items-center justify-center bg-primary text-sm font-medium text-primary-foreground">
      {message}
    </div>
  )
}
