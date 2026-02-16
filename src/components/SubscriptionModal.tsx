import { useState, useCallback, useMemo } from 'react'
import { Users, Calendar, Shield, Mail } from 'lucide-react'
import { useOwner } from '@/hooks/useOwner'
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSetting } from '@/hooks/useSetting'
import { SubscriptionModalContext } from '@/hooks/useSubscriptionModal'
import type { PlanTier } from '@/lib/plan'

const PLAN_LABELS: Record<PlanTier, string> = {
  FREE: 'Free',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

const PLAN_COLORS: Record<PlanTier, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  TEAM: 'bg-blue-100 text-blue-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
}

const PAYMENT_LINKS = {
  monthly: 'https://buy.stripe.com/aFa00ifoZ8hHfEDgeN1Fe02',
  annual: 'https://buy.stripe.com/28E28qfoZ69zcsr2nX1Fe03',
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function isExpired(timestamp: number): boolean {
  return timestamp * 1000 < Date.now()
}

type BillingCycle = 'monthly' | 'annual'

export function SubscriptionModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<string | undefined>()
  const { plan, licenseExpiry, licenseEmail, maxUsers, userCount } = useSetting()
  const isOwner = useOwner()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual')

  const open = useCallback((r?: string) => {
    setReason(r)
    setIsOpen(true)
  }, [])

  const contextValue = useMemo(() => ({ open }), [open])

  const expired = licenseExpiry ? isExpired(licenseExpiry) : false

  return (
    <SubscriptionModalContext.Provider value={contextValue}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subscription</DialogTitle>
            {reason && (
              <DialogDescription>{reason}</DialogDescription>
            )}
          </DialogHeader>
          <DialogPanel>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-600">Plan</span>
                </div>
                <Badge className={PLAN_COLORS[plan]}>{PLAN_LABELS[plan]}</Badge>
              </div>

              {licenseEmail && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-600">Licensee</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{licenseEmail}</span>
                </div>
              )}

              {licenseExpiry && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-600">Expires</span>
                  </div>
                  <span className={`text-sm font-medium ${expired ? 'text-red-600' : 'text-gray-900'}`}>
                    {expired ? 'Expired' : formatDate(licenseExpiry)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-600">Users</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {userCount} / {maxUsers}
                </span>
              </div>

              {isOwner && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-3">Select billing cycle:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        billingCycle === 'monthly'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">Monthly</div>
                      <div className="text-sm text-gray-500">$20/user/month</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('annual')}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        billingCycle === 'annual'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">Annual</span>
                        <span className="text-xs text-green-600 font-medium">Save 20%</span>
                      </div>
                      <div className="text-sm text-gray-500">$16/user/month</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </DialogPanel>
          <DialogFooter variant="bare">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
            {isOwner && (
              <Button onClick={() => window.open(PAYMENT_LINKS[billingCycle], '_blank')}>
                Upgrade
              </Button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </SubscriptionModalContext.Provider>
  )
}
