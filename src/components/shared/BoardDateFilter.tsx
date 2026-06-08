import { useState } from 'react'
import {
  boardRangeLabel,
  type BoardDatePreset,
  type BoardDateRange,
} from '../../utils/boardDateRange'

interface BoardDateFilterProps {
  value: BoardDateRange
  onChange: (range: BoardDateRange) => void
  onPreset: (preset: BoardDatePreset) => void
  onCustom: (from: string, to: string) => void
  size?: 'sm' | 'md'
}

const PRESETS: { label: string; value: BoardDatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
]

export function BoardDateFilter({
  value,
  onPreset,
  onCustom,
  size = 'sm',
}: BoardDateFilterProps) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <div className="flex flex-wrap items-center gap-1">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onPreset(p.value)}
          className={`rounded font-medium transition-colors ${pad} ${
            value.preset === p.value
              ? 'bg-[#00A86B] text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`rounded bg-slate-100 font-medium text-slate-500 hover:bg-slate-200 ${pad}`}
        >
          {value.preset === 'custom' ? boardRangeLabel(value) : 'Custom'}
        </button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <label className="mb-1 block text-xs text-slate-500">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
            <label className="mb-1 block text-xs text-slate-500">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (from && to) {
                  onCustom(from, to)
                  setOpen(false)
                }
              }}
              className="w-full rounded bg-[#00A86B] py-1.5 text-sm font-medium text-white"
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
