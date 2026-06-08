import { memo, useState } from 'react'
import {
  useCohortBuilder,
  PRESET_COHORTS,
  INACTIVE_PRESETS,
  type CohortFilters,
} from '../../hooks/useCohortBuilder'
import { useDashboardContext } from '../../context/DashboardContext'
import { L1_TAGS } from '../../utils/taxonomy'
import { CohortResultsPanel } from './CohortResultsPanel'
import type { DistanceBand } from '../../api/types'

const DISTANCE_BANDS: DistanceBand[] = ['0-5km', '5-10km', '10-15km', '15-20km', '20km+', 'unknown']

export const CohortBuilder = memo(function CohortBuilder() {
  const { filteredOrders, productTagsMap } = useDashboardContext()
  const {
    draftFilters,
    setDraftFilters,
    applyFilters,
    applyPreset,
    saveCohort,
    savedCohorts,
    analysis,
    loading,
    appliedFilters,
  } = useCohortBuilder(filteredOrders, productTagsMap)

  const [saveName, setSaveName] = useState('')

  return (
    <div className="flex min-h-[640px] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 rounded-card border border-kiddo-border bg-white p-4 lg:w-[320px]">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Preset cohorts</h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(PRESET_COHORTS).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => applyPreset(PRESET_COHORTS[label])}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-sm font-semibold">Inactive quick filters</h3>
          <div className="flex flex-wrap gap-1.5">
            {INACTIVE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const next = { ...draftFilters, inactiveDaysMin: p.days, minOrders: p.days >= 13 ? 2 : draftFilters.minOrders }
                  setDraftFilters(next)
                }}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-900"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <FilterForm filters={draftFilters} setFilters={setDraftFilters} />

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={applyFilters}
            className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
          >
            Apply filters
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Cohort name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="flex-1 rounded border border-kiddo-border px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={!saveName.trim()}
              onClick={() => {
                saveCohort(saveName.trim())
                setSaveName('')
              }}
              className="rounded-md border border-kiddo-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        {savedCohorts.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Saved cohorts</h3>
            <ul className="space-y-1">
              {savedCohorts.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => applyPreset(s.filters)}
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-[var(--accent)] hover:bg-[var(--accent-light)]"
                  >
                    {s.name} →
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        {!appliedFilters ? (
          <div className="flex h-full min-h-[400px] items-center justify-center rounded-card border border-kiddo-border bg-white p-8 text-center text-sm text-slate-500">
            Select a preset or configure filters, then click <strong>Apply filters</strong> to analyse a cohort.
          </div>
        ) : (
          <CohortResultsPanel
            analysis={
              analysis ?? {
                customers: [],
                cohortOrders: [],
                summary: { customers: 0, orders: 0, gmv: 0, gmvShare: 0 },
                behaviour: {
                  repeatRate: 0,
                  avgOrdersPerCustomer: 0,
                  avgSpend: 0,
                  aov: 0,
                  avgItemsPerOrder: 0,
                  avgDaysBetweenOrders: 0,
                  appPct: 0,
                  websitePct: 0,
                  avgDistanceKm: 0,
                },
                aovTrend: [],
                firstOrder: {
                  l1Donut: [],
                  l2Bars: [],
                  aovHistogram: [],
                  channelDonut: [],
                  hourBars: [],
                  dowBars: [],
                },
                frequency: {
                  histogram: [],
                  daysBetweenHistogram: [],
                  avgDaysToSecond: 0,
                  pctSecondWithin7d: 0,
                  pctSecondWithin30d: 0,
                },
                churn: { avgDaysSinceLast: 0, buckets: [], churnRiskPct: 0 },
                categoryEvolution: [],
              }
            }
            loading={loading}
          />
        )}
      </div>
    </div>
  )
})

function FilterForm({
  filters,
  setFilters,
}: {
  filters: CohortFilters
  setFilters: React.Dispatch<React.SetStateAction<CohortFilters>>
}) {
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <h3 className="text-sm font-semibold">Filter form</h3>

      <label className="block text-xs text-slate-500">
        Inactive for (days or more)
        <input
          type="range"
          min={0}
          max={90}
          value={filters.inactiveDaysMin ?? 0}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              inactiveDaysMin: Number(e.target.value) || null,
            }))
          }
          className="mt-1 w-full"
        />
        <input
          type="number"
          min={0}
          value={filters.inactiveDaysMin ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              inactiveDaysMin: e.target.value ? Number(e.target.value) : null,
            }))
          }
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          placeholder="Days inactive"
        />
      </label>

      <NumberField label="Min orders" value={filters.minOrders} onChange={(v) => setFilters((f) => ({ ...f, minOrders: v }))} />
      <NumberField label="Max orders" value={filters.maxOrders} onChange={(v) => setFilters((f) => ({ ...f, maxOrders: v }))} />
      <NumberField label="Min spend ₹" value={filters.minSpend} onChange={(v) => setFilters((f) => ({ ...f, minSpend: v }))} />
      <NumberField label="Max spend ₹" value={filters.maxSpend} onChange={(v) => setFilters((f) => ({ ...f, maxSpend: v }))} />

      <SelectField
        label="Channel"
        value={filters.channel}
        onChange={(v) => setFilters((f) => ({ ...f, channel: v as CohortFilters['channel'] }))}
        options={[
          { label: 'All', value: 'all' },
          { label: 'App', value: 'app' },
          { label: 'Website', value: 'website' },
        ]}
      />

      <SelectField
        label="Category mode"
        value={filters.categoryMode}
        onChange={(v) => setFilters((f) => ({ ...f, categoryMode: v as CohortFilters['categoryMode'] }))}
        options={[
          { label: 'Any', value: 'any' },
          { label: 'Only these', value: 'only' },
          { label: 'Contains', value: 'contains' },
          { label: 'Excludes', value: 'excludes' },
        ]}
      />

      <div>
        <p className="text-xs text-slate-500">L1 categories</p>
        <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
          {L1_TAGS.map((cat) => (
            <label key={cat} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.selectedL1.includes(cat)}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    selectedL1: e.target.checked
                      ? [...f.selectedL1, cat]
                      : f.selectedL1.filter((c) => c !== cat),
                  }))
                }
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500">Distance bands</p>
        <div className="mt-1 space-y-1">
          {DISTANCE_BANDS.map((band) => (
            <label key={band} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.distanceBands.includes(band)}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    distanceBands: e.target.checked
                      ? [...f.distanceBands, band]
                      : f.distanceBands.filter((b) => b !== band),
                  }))
                }
              />
              {band}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        type="number"
        className="mt-1 w-full rounded border px-2 py-1 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <select
        className="mt-1 w-full rounded border px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
