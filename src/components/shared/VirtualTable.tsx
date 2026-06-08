import { memo, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualTableProps<T> {
  rows: T[]
  rowHeight?: number
  minRowsForVirtual?: number
  maxHeight?: number
  className?: string
  header: ReactNode
  footer?: ReactNode
  renderRow: (row: T, index: number) => ReactNode
  getRowKey: (row: T, index: number) => string | number
}

function VirtualTableInner<T>({
  rows,
  rowHeight = 44,
  minRowsForVirtual = 50,
  maxHeight = 480,
  className = 'w-full text-sm',
  header,
  footer,
  renderRow,
  getRowKey,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const useVirtual = rows.length > minRowsForVirtual

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  if (!useVirtual) {
    return (
      <table className={className}>
        <thead>{header}</thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="border-t border-slate-100">
              {renderRow(row, index)}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    )
  }

  return (
    <div>
      <table className={className}>
        <thead>{header}</thead>
      </table>
      <div ref={parentRef} style={{ maxHeight, overflow: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <div
                key={getRowKey(row, virtualRow.index)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <table className={className}>
                  <tbody>
                    <tr className="border-t border-slate-100">{renderRow(row, virtualRow.index)}</tr>
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </div>
      {footer ? (
        <table className={className}>
          {footer}
        </table>
      ) : null}
    </div>
  )
}

export const VirtualTable = memo(VirtualTableInner) as typeof VirtualTableInner
