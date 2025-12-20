import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import ExcelJS from 'exceljs'
import { Poly } from './platforms/poly'
import { UserPositions, UserTrade, UserTradeHistory } from './types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../data')

export type DepthLevel = 'test' | 'light' | 'medium' | 'deep'

const depthLimits: Record<DepthLevel, number> = {
   test: 3,
   light: 100,
   medium: 250,
   deep: 500,
}

export const exportUserData = async (
   userAddress: string,
   depth: DepthLevel = 'light',
) => {
   const limit = resolveDepthLimit(depth)
   const poly = new Poly()

   const [trades, openPositions, closedPositions] = await Promise.all([
      poly.getUserTrades(userAddress, limit),
      poly.getUserPositions(userAddress, limit),
      poly.getUserTradeHistory(userAddress, limit),
   ])

   const tradesData: UserTrade[] = trades ?? []
   const openPositionsData: UserPositions[] = openPositions ?? []
   const closedPositionsData: UserTradeHistory[] = sortClosedPositions(
      closedPositions ?? [],
   )

   const humanView = buildHumanView({
      closedPositions: closedPositionsData,
      openPositions: openPositionsData,
      trades: tradesData,
   })

   const llmView = buildLlmView({
      closedPositions: closedPositionsData,
      openPositions: openPositionsData,
      trades: tradesData,
   })

   await ensureDataDir()

   const [humanXlsxPath, humanJsonPath, llmJsonPath] = await Promise.all([
      writeWorkbook({
         userAddress,
         closedPositions: humanView.closedPositions,
         openPositions: humanView.openPositions,
         trades: humanView.trades,
      }),
      writeHumanJson({
         userAddress,
         humanView,
      }),
      writeLlmJson({
         userAddress,
         llmView,
      }),
   ])

   return {
      closedPositions: closedPositionsData,
      openPositions: openPositionsData,
      trades: tradesData,
      humanXlsxPath,
      humanJsonPath,
      llmJsonPath,
   }
}

const resolveDepthLimit = (depth: DepthLevel) =>
   depthLimits[depth] ?? depthLimits.light

const ensureDataDir = async () => {
   await fs.mkdir(dataDir, { recursive: true })
}

const sortClosedPositions = (
   positions: UserTradeHistory[],
): UserTradeHistory[] => {
   return [...positions].sort((a, b) => {
      const aTime = toSortValue(a)
      const bTime = toSortValue(b)
      return bTime - aTime
   })
}

const toSortValue = (position: UserTradeHistory): number => {
   if (position.endDate) {
      const endDateMs = new Date(position.endDate).getTime()
      if (!Number.isNaN(endDateMs)) return endDateMs
   }
   return position.timestamp ?? 0
}

const computeRoi = (position: UserTradeHistory) => {
   const basis = position.avgEntryPrice * position.totalBought
   if (basis === 0) return 0
   return position.realizedPnl / basis
}

const computeUnrealizedRoi = (position: UserPositions) => {
   const basis = position.averageEntryPrice * position.shares
   if (basis === 0) return 0
   return position.unrealizedPnl / basis
}

const buildHumanView = ({
   closedPositions,
   openPositions,
   trades,
}: {
   closedPositions: UserTradeHistory[]
   openPositions: UserPositions[]
   trades: UserTrade[]
}) => ({
   closedPositions: closedPositions.map(projectClosedPositionHuman),
   openPositions: openPositions.map(projectOpenPositionHuman),
   trades: trades.map(projectTradeHuman),
})

const buildLlmView = ({
   closedPositions,
   openPositions,
   trades,
}: {
   closedPositions: UserTradeHistory[]
   openPositions: UserPositions[]
   trades: UserTrade[]
}) => ({
   closedPositions: closedPositions.map(projectClosedPositionLlm),
   openPositions: openPositions.map(projectOpenPositionLlm),
   trades: trades.map(projectTradeLlm),
})

const projectClosedPositionHuman = (position: UserTradeHistory) => {
   const roi = computeRoi(position)

   return {
      endDate: position.endDate,
      eventTitle: position.eventTitle,
      outcome: position.outcome,
      avgEntryPrice: position.avgEntryPrice,
      totalBought: position.totalBought,
      closePrice: position.closePrice,
      realizedPnl: position.realizedPnl,
      roiPct: Number((roi * 100).toFixed(2)),
      result:
         position.realizedPnl > 0
            ? 'WIN'
            : position.realizedPnl < 0
            ? 'LOSE'
            : 'EVEN',
   }
}

const projectClosedPositionLlm = (position: UserTradeHistory) => {
   const roi = computeRoi(position)

   return {
      eventId: position.eventId,
      market: position.eventTitle,
      outcome: position.outcome,
      entry: position.avgEntryPrice,
      size: position.totalBought,
      exit: position.closePrice,
      pnl: position.realizedPnl,
      roi,
      time: position.timestamp,
      end: position.endDate,
   }
}

const projectOpenPositionHuman = (position: UserPositions) => {
   const unrealizedRoi = computeUnrealizedRoi(position)

   return {
      timestamp: position.timestamp,
      eventTitle: position.eventTitle,
      outcome: position.outcome,
      shares: position.shares,
      averageEntryPrice: position.averageEntryPrice,
      currentPrice: position.currentPrice,
      unrealizedPnl: position.unrealizedPnl,
      unrealizedRoiPct: Number((unrealizedRoi * 100).toFixed(2)),
   }
}

const projectOpenPositionLlm = (position: UserPositions) => {
   const unrealizedRoi = computeUnrealizedRoi(position)

   return {
      eventId: position.eventId,
      market: position.eventTitle,
      outcome: position.outcome,
      size: position.shares,
      entry: position.averageEntryPrice,
      mark: position.currentPrice,
      pnl: position.unrealizedPnl,
      roi: unrealizedRoi,
      time: position.timestamp,
   }
}

const projectTradeHuman = (trade: UserTrade) => ({
   timestamp: trade.timestamp,
   eventTitle: trade.eventTitle,
   outcome: trade.outcome,
   side: trade.side,
   size: trade.size,
   price: trade.price,
   revenue: trade.revenue,
   txHash: trade.txHash,
})

const projectTradeLlm = (trade: UserTrade) => ({
   eventId: trade.eventId,
   market: trade.eventTitle,
   outcome: trade.outcome,
   side: trade.side,
   size: trade.size,
   price: trade.price,
   time: trade.timestamp,
})

const writeWorkbook = async ({
   userAddress,
   closedPositions,
   openPositions,
   trades,
}: {
   userAddress: string
   closedPositions: ReturnType<typeof projectClosedPositionHuman>[]
   openPositions: ReturnType<typeof projectOpenPositionHuman>[]
   trades: ReturnType<typeof projectTradeHuman>[]
}) => {
   const workbook = new ExcelJS.Workbook()

   const closedSheet = workbook.addWorksheet('ClosedPositions')
   closedSheet.columns = [
      { header: 'End Date', key: 'endDate', width: 22 },
      { header: 'Event', key: 'eventTitle', width: 36 },
      { header: 'Outcome', key: 'outcome', width: 16 },
      { header: 'Avg Entry', key: 'avgEntryPrice', width: 12 },
      { header: 'Size', key: 'totalBought', width: 10 },
      { header: 'Exit Price', key: 'closePrice', width: 12 },
      { header: 'PnL', key: 'realizedPnl', width: 12 },
      { header: 'ROI %', key: 'roiPct', width: 10 },
      { header: 'Result', key: 'result', width: 10 },
   ]
   closedSheet.addRows(closedPositions)

   const openSheet = workbook.addWorksheet('OpenPositions')
   openSheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Event', key: 'eventTitle', width: 36 },
      { header: 'Outcome', key: 'outcome', width: 16 },
      { header: 'Shares', key: 'shares', width: 12 },
      { header: 'Avg Entry', key: 'averageEntryPrice', width: 12 },
      { header: 'Mark', key: 'currentPrice', width: 10 },
      { header: 'Unrealized', key: 'unrealizedPnl', width: 12 },
      { header: 'Unrealized ROI %', key: 'unrealizedRoiPct', width: 16 },
   ]
   openSheet.addRows(openPositions)

   const tradesSheet = workbook.addWorksheet('Trades')
   tradesSheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Event', key: 'eventTitle', width: 36 },
      { header: 'Outcome', key: 'outcome', width: 16 },
      { header: 'Side', key: 'side', width: 10 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Revenue', key: 'revenue', width: 14 },
      { header: 'Tx Hash', key: 'txHash', width: 60 },
   ]
   tradesSheet.addRows(trades)

   const xlsxPath = path.join(dataDir, `${userAddress}.human.xlsx`)
   await workbook.xlsx.writeFile(xlsxPath)
   return xlsxPath
}

const writeHumanJson = async ({
   userAddress,
   humanView,
}: {
   userAddress: string
   humanView: ReturnType<typeof buildHumanView>
}) => {
   const payload = {
      userAddress,
      generatedAt: new Date().toISOString(),
      closedPositions: humanView.closedPositions,
      openPositions: humanView.openPositions,
      trades: humanView.trades,
   }

   const jsonPath = path.join(dataDir, `${userAddress}.human.json`)
   await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8')
   return jsonPath
}

const writeLlmJson = async ({
   userAddress,
   llmView,
}: {
   userAddress: string
   llmView: ReturnType<typeof buildLlmView>
}) => {
   const payload = {
      user: userAddress,
      generatedAt: new Date().toISOString(),
      closed: llmView.closedPositions,
      open: llmView.openPositions,
      trades: llmView.trades,
   }

   const jsonPath = path.join(dataDir, `${userAddress}.llm.json`)
   await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8')
   return jsonPath
}
