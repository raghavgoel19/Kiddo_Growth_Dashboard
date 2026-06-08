export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0
  return sum(values) / values.length
}

export type ColumnAggregateType = 'count' | 'currency' | 'aov' | 'percentage' | 'days' | 'orders' | 'text'

export function getColumnAggregate(
  columnType: ColumnAggregateType,
  values: number[]
): { label: string; value: string } {
  switch (columnType) {
    case 'count':
    case 'orders':
      return { label: 'Total', value: sum(values).toLocaleString('en-IN') }
    case 'currency':
      return {
        label: 'Total',
        value: `₹${avg(values).toLocaleString('en-IN')} avg / ₹${sum(values).toLocaleString('en-IN')} total`,
      }
    case 'aov':
      return { label: 'Average', value: `₹${avg(values).toLocaleString('en-IN')}` }
    case 'percentage':
      return { label: 'Average', value: `${avg(values).toFixed(1)}%` }
    case 'days':
      return { label: 'Average', value: `${avg(values).toFixed(1)}d` }
    case 'text':
      return { label: '', value: '' }
    default:
      return { label: 'Total', value: sum(values).toLocaleString('en-IN') }
  }
}

export interface TableSummaryCell {
  type: ColumnAggregateType
  values: number[]
  colSpan?: number
  label?: string
}

interface TableSummaryFooterProps {
  cells: TableSummaryCell[]
  firstCellLabel?: string
}

export function TableSummaryFooter({ cells, firstCellLabel = 'Total / Average' }: TableSummaryFooterProps) {
  return (
    <tfoot>
      <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
        {cells.map((cell, i) => {
          const agg = getColumnAggregate(cell.type, cell.values)
          if (i === 0 && !cell.values.length) {
            return (
              <td key={i} colSpan={cell.colSpan ?? 1} className="px-4 py-3 text-slate-600">
                {firstCellLabel}
              </td>
            )
          }
          return (
            <td key={i} colSpan={cell.colSpan ?? 1} className="px-4 py-3 text-slate-900">
              {cell.label ?? agg.value}
            </td>
          )
        })}
      </tr>
    </tfoot>
  )
}
