import { useState } from 'react'
import { BoardFrame, CellHole } from './game'
import { layout } from '../styles/gameTokens'

const BOARD_ROWS = layout.boardRows
const BOARD_COLS = layout.boardCols

interface GameBoardProps {
  board: string
  currentTurn: 1 | 2
  isMyTurn: boolean
  myPlayerNumber: 1 | 2 | null
  onColumnClick?: (column: number) => void
  disabled?: boolean
  lastMove?: { row: number; column: number } | null
  winningCells?: { row: number; column: number }[]
}

export function GameBoard({
  board,
  currentTurn,
  isMyTurn,
  myPlayerNumber,
  onColumnClick,
  disabled = false,
  lastMove,
  winningCells = [],
}: GameBoardProps) {
  const [hoverColumn, setHoverColumn] = useState<number | null>(null)

  const getCellValue = (row: number, col: number): '0' | '1' | '2' => {
    const index = row * BOARD_COLS + col
    return board[index] as '0' | '1' | '2'
  }

  const isWinningCell = (row: number, col: number): boolean => {
    return winningCells.some((cell) => cell.row === row && cell.column === col)
  }

  const isLastMoveCell = (row: number, col: number): boolean => {
    return lastMove?.row === row && lastMove?.column === col
  }

  const canDropInColumn = (col: number): boolean => {
    return board[col] === '0' // Top row of column is empty
  }

  const handleColumnClick = (col: number) => {
    if (disabled || !isMyTurn || !canDropInColumn(col)) return
    onColumnClick?.(col)
  }

  const handleColumnHover = (col: number | null) => {
    if (disabled || !isMyTurn) {
      setHoverColumn(null)
      return
    }
    setHoverColumn(col)
  }

  // Find the row where a chip would land in a column
  const getPreviewRow = (col: number): number | null => {
    for (let row = BOARD_ROWS - 1; row >= 0; row--) {
      if (getCellValue(row, col) === '0') {
        return row
      }
    }
    return null
  }

  const previewColor = myPlayerNumber === 1 ? 'red' : myPlayerNumber === 2 ? 'yellow' : undefined

  return (
    <div className="relative w-full">
      <BoardFrame>
        {/*
          Grid with viewport-aware cell sizing for screen dominance.
          Uses CSS clamp() to scale cells based on available space.
          Target: ~65-70vh board height on desktop.
        */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${BOARD_ROWS}, 1fr)`,
            // Responsive gap: smaller on mobile, larger on desktop
            gap: 'clamp(4px, 1vw, 10px)',
          }}
          onMouseLeave={() => handleColumnHover(null)}
        >
          {Array.from({ length: BOARD_ROWS }).map((_, row) =>
            Array.from({ length: BOARD_COLS }).map((_, col) => {
              const cellValue = getCellValue(row, col)
              const isWinning = isWinningCell(row, col)
              const isLast = isLastMoveCell(row, col)
              const canDrop = isMyTurn && canDropInColumn(col) && !disabled

              // Show preview in the landing row of hovered column
              const previewRow = hoverColumn === col ? getPreviewRow(col) : null
              const showPreview = previewRow === row && canDrop

              return (
                <div
                  key={`${row}-${col}`}
                  className="aspect-square"
                  style={{
                    // Viewport-based cell sizing for screen dominance
                    // clamp(min, preferred, max) - scales with viewport
                    width: 'clamp(40px, 10vw, 80px)',
                    height: 'clamp(40px, 10vw, 80px)',
                  }}
                  onMouseEnter={() => handleColumnHover(col)}
                  onClick={() => handleColumnClick(col)}
                >
                  <CellHole
                    value={cellValue}
                    isWinning={isWinning}
                    isLastMove={isLast}
                    isPreview={showPreview}
                    previewColor={previewColor}
                    canInteract={canDrop}
                    onClick={() => handleColumnClick(col)}
                  />
                </div>
              )
            })
          )}
        </div>
      </BoardFrame>
    </div>
  )
}
