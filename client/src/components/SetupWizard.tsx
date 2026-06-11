/**
 * SetupWizard — Adaptive step wizard for restaurant setup.
 *
 * Phase 2: localStorage-backed progress with 4 states per step
 * (Not Started / In Progress / Completed / Skipped).
 * Dismissible and resumable across sessions.
 *
 * Usage:
 *   <SetupWizard
 *     restaurantId={user.restaurantId}
 *     restaurantType="FULL_SERVICE"
 *     onComplete={handleComplete}
 *     onDismiss={handleDismiss}
 *   />
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  SETUP_WIZARD_STEPS,
  RESTAURANT_TYPE_CONFIG,
  loadSetupProgress,
  saveSetupProgress,
  computeSetupProgress,
} from '../config/restaurantTypes'
import type { RestaurantType, SetupProgress, StepStatus } from '../config/restaurantTypes'
import Card from './Card'
import Button from './Button'
import { cn } from '../lib/utils'

interface SetupWizardProps {
  restaurantId: string
  restaurantType: RestaurantType
  onComplete?: () => void
  onDismiss?: () => void
  /** Optional step content overrides — keyed by step id */
  children?: Record<string, React.ReactNode>
}

const STATUS_STYLES: Record<StepStatus, { badge: string; connector: string; circle: string }> = {
  not_started: {
    badge: 'text-slate-400',
    connector: 'bg-slate-200',
    circle: 'bg-slate-200 text-slate-500',
  },
  in_progress: {
    badge: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
    connector: 'bg-brand-300',
    circle: 'bg-brand-500 text-white',
  },
  completed: {
    badge: 'text-brand-600',
    connector: 'bg-brand-500',
    circle: 'bg-brand-500 text-white',
  },
  skipped: {
    badge: 'text-amber-600',
    connector: 'bg-amber-300',
    circle: 'bg-amber-500 text-white',
  },
}

const STATUS_LABEL: Record<StepStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
}

const SetupWizard: React.FC<SetupWizardProps> = ({
  restaurantId,
  restaurantType,
  onComplete,
  onDismiss,
  children,
}) => {
  const steps = SETUP_WIZARD_STEPS[restaurantType] || []
  const totalSteps = steps.length
  const typeInfo = RESTAURANT_TYPE_CONFIG[restaurantType]

  // ── State ──
  const [progress, setProgress] = useState<SetupProgress>(() =>
    loadSetupProgress(restaurantId),
  )
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    // Resume from first not-started-or-skipped step, or start at 0
    const saved = loadSetupProgress(restaurantId)
    for (let i = 0; i < steps.length; i++) {
      const s = saved.steps[steps[i].id]
      if (s !== 'completed' && s !== 'skipped') return i
    }
    return steps.length - 1
  })

  const percent = useMemo(() => computeSetupProgress(progress, totalSteps), [progress, totalSteps])

  // Auto-save whenever progress or index changes
  useEffect(() => {
    saveSetupProgress(restaurantId, progress)
  }, [restaurantId, progress])

  // ── Persist helpers ──
  const setStepStatus = useCallback(
    (stepId: string, status: StepStatus) => {
      setProgress((prev) => {
        const next = {
          ...prev,
          steps: { ...prev.steps, [stepId]: status },
          dismissed: false,
        }
        return next
      })
    },
    [],
  )

  // ── Actions ──
  const currentStepId = steps[currentIndex]?.id

  const advance = useCallback(() => {
    if (!currentStepId) return
    setStepStatus(currentStepId, 'completed')

    if (currentIndex >= totalSteps - 1) {
      // All steps done — fire onComplete if everything resolved
      onComplete?.()
    } else {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      // Mark next step as in_progress
      const nextId = steps[nextIdx]?.id
      if (nextId) {
        setProgress((prev) => ({
          ...prev,
          steps: { ...prev.steps, [nextId]: 'in_progress' },
          dismissed: false,
        }))
      }
    }
  }, [currentStepId, currentIndex, totalSteps, steps, setStepStatus, onComplete])

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1
      setCurrentIndex(prevIdx)
      const prevId = steps[prevIdx]?.id
      if (prevId) {
        setProgress((prev) => ({
          ...prev,
          steps: { ...prev.steps, [prevId]: 'in_progress' },
          dismissed: false,
        }))
      }
    }
  }, [currentIndex, steps])

  const skipStep = useCallback(() => {
    if (!currentStepId) return
    setStepStatus(currentStepId, 'skipped')

    if (currentIndex >= totalSteps - 1) {
      onComplete?.()
    } else {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      const nextId = steps[nextIdx]?.id
      if (nextId) {
        setProgress((prev) => ({
          ...prev,
          steps: { ...prev.steps, [nextId]: 'in_progress' },
          dismissed: false,
        }))
      }
    }
  }, [currentStepId, currentIndex, totalSteps, steps, setStepStatus, onComplete])

  const jumpToStep = useCallback(
    (index: number) => {
      const targetId = steps[index]?.id
      if (!targetId) return
      const status = progress.steps[targetId]
      // Can jump to completed, skipped, or the current/index 0
      if (status === 'completed' || status === 'skipped' || index === 0 || index === currentIndex) {
        setCurrentIndex(index)
        setProgress((prev) => ({
          ...prev,
          steps: { ...prev.steps, [targetId]: 'in_progress' },
        }))
      }
    },
    [steps, progress.steps, currentIndex],
  )

  const handleDismiss = useCallback(() => {
    setProgress((prev) => {
      const next = { ...prev, dismissed: true, lastUpdated: new Date().toISOString() }
      saveSetupProgress(restaurantId, next)
      return next
    })
    onDismiss?.()
  }, [restaurantId, onDismiss])

  // ── Mark first step as in_progress on mount if not set ──
  useEffect(() => {
    if (steps.length > 0) {
      const firstId = steps[0].id
      if (!progress.steps[firstId]) {
        setStepStatus(firstId, 'in_progress')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Edge: no steps ──
  if (steps.length === 0) {
    return (
      <Card padding="lg">
        <div className="text-center py-8">
          <p className="text-slate-500">
            No setup steps defined for {typeInfo?.label || restaurantType}.
          </p>
          {onDismiss && (
            <Button variant="ghost" className="mt-4" onClick={handleDismiss}>
              Skip setup
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const allDone = percent >= 100

  return (
    <Card padding="lg" className="max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {typeInfo?.icon} {typeInfo?.label} Setup
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {allDone
              ? 'Setup complete! All steps are done.'
              : 'Complete these steps to get started'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDismiss} leftIcon={<XMarkIcon className="w-4 h-4" />}>
          Close
        </Button>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>Setup progress</span>
          <span className="font-semibold text-slate-700">{percent}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              percent >= 100 ? 'bg-emerald-500' : 'bg-brand-500',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* ── Step indicators ── */}
      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          const status: StepStatus = progress.steps[step.id] || 'not_started'
          const isCurrent = i === currentIndex
          const styles = STATUS_STYLES[status]

          return (
            <React.Fragment key={step.id}>
              {i > 0 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 min-w-[16px] rounded-full transition-colors',
                    styles.connector,
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => jumpToStep(i)}
                title={`${step.label} — ${STATUS_LABEL[status]}`}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                  isCurrent
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                    : styles.badge,
                  isCurrent || status === 'completed' || status === 'skipped' || i === 0
                    ? 'cursor-pointer hover:bg-slate-50'
                    : 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                    styles.circle,
                  )}
                >
                  {status === 'completed' ? (
                    <CheckIcon className="w-3 h-3" />
                  ) : status === 'skipped' ? (
                    <span>!</span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="hidden sm:inline whitespace-nowrap">
                  {step.label}
                </span>
              </button>
            </React.Fragment>
          )
        })}
      </div>

      {/* ── Step content ── */}
      <div className="min-h-[180px]">
        {steps[currentIndex] && children?.[steps[currentIndex].id] ? (
          children[steps[currentIndex].id]
        ) : steps[currentIndex]?.placeholder ? (
          /* Placeholder for features not yet built */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
              <span className="text-2xl">🚧</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {steps[currentIndex].label}
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              {steps[currentIndex].description}
            </p>
            <div className="mt-4 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              This feature is coming soon. You can skip this step for now.
            </div>
            <div className="flex items-center gap-3 mt-5">
              <Button variant="secondary" size="sm" onClick={skipStep}>
                Skip for now
              </Button>
              <Button variant="primary" size="sm" onClick={advance}>
                Mark as Completed
              </Button>
            </div>
          </div>
        ) : (
          /* Default step placeholder — navigates to actual page */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-4xl mb-3">{typeInfo?.icon}</p>
            <h3 className="text-lg font-semibold text-gray-900">
              {steps[currentIndex].label}
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {steps[currentIndex].description}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Navigate to the relevant page to complete this step, then mark it done here.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <Button variant="secondary" size="sm" onClick={skipStep}>
                Skip
              </Button>
              <Button variant="primary" size="sm" onClick={advance}>
                Mark as Completed
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Done state ── */}
      {allDone && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
          <CheckIcon className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-semibold text-emerald-800">Setup Complete!</h3>
          <p className="text-sm text-emerald-600 mt-0.5">
            Your restaurant is fully configured. You can close this wizard.
          </p>
        </div>
      )}

      {/* ── Navigation footer ── */}
      {!allDone && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ChevronLeftIcon className="w-4 h-4" />}
            onClick={goBack}
            disabled={currentIndex === 0}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            {currentIndex < totalSteps - 1 && (
              <Button variant="ghost" size="sm" onClick={skipStep}>
                Skip
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              rightIcon={currentIndex < totalSteps - 1 ? <ChevronRightIcon className="w-4 h-4" /> : undefined}
              onClick={advance}
            >
              {currentIndex >= totalSteps - 1 ? 'Finish Setup' : 'Next'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default SetupWizard