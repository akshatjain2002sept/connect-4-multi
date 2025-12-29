const BOARD_ROWS = 6
const BOARD_COLS = 7

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

  return (
    <div className="relative w-full max-w-[min(100%,400px)] mx-auto">
      {/* Column hover indicators - hidden on touch devices */}
      <div className="hidden sm:flex justify-center mb-2">
        {Array.from({ length: BOARD_COLS }).map((_, col) => (
          <div
            key={col}
            className={`w-12 h-10 md:w-14 md:h-12 flex items-center justify-center transition-opacity ${
              isMyTurn && canDropInColumn(col) && !disabled
                ? 'opacity-100 cursor-pointer'
                : 'opacity-0'
            }`}
            onClick={() => handleColumnClick(col)}
          >
            <div
              className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${
                myPlayerNumber === 1
                  ? 'bg-red-400/50'
                  : myPlayerNumber === 2
                  ? 'bg-yellow-400/50'
                  : ''
              }`}
            />
          </div>
        ))}
      </div>

      {/* Game board - "Digital Plastic" aesthetic */}
      <div
        className="bg-gradient-to-b from-blue-600 to-blue-700 p-2 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl shadow-2xl"
        style={{
          boxShadow:
            '0 20px 40px rgba(0, 0, 0, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          className="grid gap-1 sm:gap-1.5 md:gap-2"
          style={{
            gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${BOARD_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: BOARD_ROWS }).map((_, row) =>
            Array.from({ length: BOARD_COLS }).map((_, col) => {
              const cellValue = getCellValue(row, col)
              const isWinning = isWinningCell(row, col)
              const isLast = isLastMoveCell(row, col)
              const canDrop = isMyTurn && canDropInColumn(col) && !disabled

              return (
                <button
                  key={`${row}-${col}`}
                  className={`
                    aspect-square w-full min-w-[44px] max-w-[52px] rounded-full
                    flex items-center justify-center
                    transition-all duration-150 touch-manipulation
                    ${canDrop ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}
                  `}
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 100%)',
                    boxShadow: 'inset 0 3px 6px rgba(0, 0, 0, 0.4)',
                  }}
                  onClick={() => handleColumnClick(col)}
                  disabled={!canDrop}
                >
                  {cellValue !== '0' && (
                    <div
                      className={`
                        w-[85%] h-[85%] rounded-full
                        transition-all duration-200
                        ${isLast ? 'animate-drop' : ''}
                        ${isWinning ? 'animate-pulse-glow ring-4 ring-white ring-opacity-75' : ''}
                        ${isLast && !isWinning ? 'ring-2 ring-white ring-opacity-50' : ''}
                      `}
                      style={
                        cellValue === '1'
                          ? {
                              background:
                                'linear-gradient(145deg, #ff6b6b 0%, #ee5a5a 50%, #cc4444 100%)',
                              boxShadow:
                                '0 4px 8px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.4), inset 0 -2px 4px rgba(0, 0, 0, 0.2)',
                            }
                          : {
                              background:
                                'linear-gradient(145deg, #ffd93d 0%, #f5c800 50%, #d4a900 100%)',
                              boxShadow:
                                '0 4px 8px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.4), inset 0 -2px 4px rgba(0, 0, 0, 0.2)',
                            }
                      }
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Turn indicator */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
          <div
            className={`w-4 h-4 rounded-full ${
              currentTurn === 1 ? 'bg-red-500' : 'bg-yellow-400'
            }`}
          />
          <span className="text-white font-medium">
            {isMyTurn ? "Your turn" : "Opponent's turn"}
          </span>
        </div>
      </div>
    </div>
  )
}
