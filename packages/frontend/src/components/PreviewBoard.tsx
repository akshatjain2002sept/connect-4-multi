import { useMemo } from 'react'

const BOARD_ROWS = 6
const BOARD_COLS = 7

// Predefined "interesting" board states that look good visually
const PREVIEW_PATTERNS = [
  // Pattern 1: Diagonal battle
  '0000000' +
  '0000000' +
  '0000200' +
  '0001100' +
  '0012210' +
  '0121120',
  // Pattern 2: Center focus
  '0000000' +
  '0000000' +
  '0001000' +
  '0012000' +
  '0121000' +
  '1212100',
  // Pattern 3: Scattered
  '0000000' +
  '0000000' +
  '0000000' +
  '0010020' +
  '0120110' +
  '2112212',
]

interface PreviewBoardProps {
  className?: string
}

export function PreviewBoard({ className = '' }: PreviewBoardProps) {
  // Pick a random pattern on mount
  const board = useMemo(() => {
    const pattern = PREVIEW_PATTERNS[Math.floor(Math.random() * PREVIEW_PATTERNS.length)]
    return pattern
  }, [])

  const getCellValue = (row: number, col: number): '0' | '1' | '2' => {
    const index = row * BOARD_COLS + col
    return board[index] as '0' | '1' | '2'
  }

  return (
    <div className={`relative ${className}`}>
      {/* Board frame with "Digital Plastic" aesthetic */}
      <div
        className="bg-gradient-to-b from-blue-500 to-blue-600 p-2 sm:p-3 rounded-2xl sm:rounded-3xl"
        style={{
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
        }}
      >
        {/* Inner board with subtle glow */}
        <div
          className="grid gap-1 sm:gap-1.5 p-1 sm:p-2 rounded-xl sm:rounded-2xl"
          style={{
            gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
            background: 'linear-gradient(180deg, rgba(30, 64, 175, 0.3) 0%, rgba(30, 58, 138, 0.5) 100%)',
          }}
        >
          {Array.from({ length: BOARD_ROWS }).map((_, row) =>
            Array.from({ length: BOARD_COLS }).map((_, col) => {
              const cellValue = getCellValue(row, col)
              const delay = (row * BOARD_COLS + col) * 0.02

              return (
                <div
                  key={`${row}-${col}`}
                  className="aspect-square rounded-full flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.35) 100%)',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  {cellValue !== '0' && (
                    <div
                      className="w-[82%] h-[82%] rounded-full transition-all duration-500"
                      style={{
                        animationDelay: `${delay}s`,
                        ...(cellValue === '1'
                          ? {
                              background:
                                'linear-gradient(145deg, #fca5a5 0%, #ef4444 40%, #dc2626 100%)',
                              boxShadow:
                                '0 4px 12px rgba(239, 68, 68, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)',
                            }
                          : {
                              background:
                                'linear-gradient(145deg, #fde047 0%, #eab308 40%, #ca8a04 100%)',
                              boxShadow:
                                '0 4px 12px rgba(234, 179, 8, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)',
                            }),
                      }}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Subtle ambient glow behind the board */}
      <div
        className="absolute inset-0 -z-10 blur-3xl opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.5) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}
