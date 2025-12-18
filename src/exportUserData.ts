import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import ExcelJS from 'exceljs'
import { Poly } from './platforms/poly'
import {
   UserActivity,
   UserPositions,
   UserTrade,
   UserTradeHistory,
} from './types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../data')
const defaultUserAddress = '0xe00740bce98a594e26861838885ab310ec3b548c'

export const exportUserData = async (userAddress: string, limit: number) => {
   const poly = new Poly()

   const [trades, activity, openPositions, closedPositions] = await Promise.all(
      [
         poly.getUserTrades(userAddress, limit),
         poly.getUserActivity(userAddress, limit),
         poly.getUserPositions(userAddress, limit),
         poly.getUserTradeHistory(userAddress, limit),
      ],
   )

   const tradesData: UserTrade[] = trades ?? []
   const activityData: UserActivity[] = activity ?? []
   const openPositionsData: UserPositions[] = openPositions ?? []
   const closedPositionsData: UserTradeHistory[] = sortClosedPositions(
      closedPositions ?? [],
   )

   const humanView = buildHumanView({
      closedPositions: closedPositionsData,
      openPositions: openPositionsData,
      trades: tradesData,
      activity: activityData,
   })

   const llmView = buildLlmView({
      closedPositions: closedPositionsData,
      openPositions: openPositionsData,
      trades: tradesData,
      activity: activityData,
   })

   await ensureDataDir()

   const [xlsxPath, jsonPath] = await Promise.all([
      writeWorkbook({
         userAddress,
         closedPositions: humanView.closedPositions,
         openPositions: humanView.openPositions,
         trades: humanView.trades,
      }),
      writeJson({
         userAddress,
         humanView,
         llmView,
      }),
   ])

   return {
      closedPositions: closedPositionsData,
      openPositions: openPositionsData,
      trades: tradesData,
      activity: activityData,
      xlsxPath,
      jsonPath,
   }
}

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
   activity,
}: {
   closedPositions: UserTradeHistory[]
   openPositions: UserPositions[]
   trades: UserTrade[]
   activity: UserActivity[]
}) => ({
   closedPositions: closedPositions.map(projectClosedPositionHuman),
   openPositions: openPositions.map(projectOpenPositionHuman),
   trades: trades.map(projectTradeHuman),
   activity: activity.map(projectActivityHuman),
})

const buildLlmView = ({
   closedPositions,
   openPositions,
   trades,
   activity,
}: {
   closedPositions: UserTradeHistory[]
   openPositions: UserPositions[]
   trades: UserTrade[]
   activity: UserActivity[]
}) => ({
   closedPositions: closedPositions.map(projectClosedPositionLlm),
   openPositions: openPositions.map(projectOpenPositionLlm),
   trades: trades.map(projectTradeLlm),
   activity: activity.map(projectActivityLlm),
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
      eventTitle: position.eventTitle,
      outcome: position.outcome,
      avgEntryPrice: position.avgEntryPrice,
      totalBought: position.totalBought,
      closePrice: position.closePrice,
      realizedPnl: position.realizedPnl,
      roi,
      timestamp: position.timestamp,
      endDate: position.endDate,
      userAddress: position.userAddress,
      result:
         position.realizedPnl > 0
            ? 'WIN'
            : position.realizedPnl < 0
            ? 'LOSE'
            : 'EVEN',
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
   const basis = position.averageEntryPrice * position.shares
   const markValue = position.currentPrice * position.shares

   return {
      eventId: position.eventId,
      eventTitle: position.eventTitle,
      outcome: position.outcome,
      shares: position.shares,
      averageEntryPrice: position.averageEntryPrice,
      currentPrice: position.currentPrice,
      basis,
      markValue,
      unrealizedPnl: position.unrealizedPnl,
      unrealizedRoi,
      timestamp: position.timestamp,
      userAddress: position.userAddress,
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
   eventTitle: trade.eventTitle,
   outcome: trade.outcome,
   side: trade.side,
   size: trade.size,
   price: trade.price,
   revenue: trade.revenue,
   timestamp: trade.timestamp,
   txHash: trade.txHash,
   userAddress: trade.userAddress,
})

const projectActivityHuman = (activity: UserActivity) => ({
   timestamp: activity.timestamp,
   eventTitle: activity.eventTitle,
   outcome: activity.outcome,
   side: activity.side,
   size: activity.size,
   usdcSize: activity.usdcSize,
   price: activity.price,
   txHash: activity.txHash,
})

const projectActivityLlm = (activity: UserActivity) => ({
   eventId: activity.eventId,
   eventTitle: activity.eventTitle,
   outcome: activity.outcome,
   side: activity.side,
   size: activity.size,
   usdcSize: activity.usdcSize,
   price: activity.price,
   timestamp: activity.timestamp,
   txHash: activity.txHash,
   userAddress: activity.userAddress,
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

   const xlsxPath = path.join(dataDir, `${userAddress}.xlsx`)
   await workbook.xlsx.writeFile(xlsxPath)
   return xlsxPath
}

const writeJson = async ({
   userAddress,
   humanView,
   llmView,
}: {
   userAddress: string
   humanView: ReturnType<typeof buildHumanView>
   llmView: ReturnType<typeof buildLlmView>
}) => {
   const payload = {
      userAddress,
      generatedAt: new Date().toISOString(),
      humanView,
      llmView,
   }

   const jsonPath = path.join(dataDir, `${userAddress}.json`)
   await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8')
   return jsonPath
}

const isDirectExecution = () => {
   const executedPath = process.argv[1]
   if (!executedPath) return false
   return path.resolve(executedPath) === __filename
}

const sumRealizedPnl = (positions: UserTradeHistory[]) =>
   positions.reduce((total, position) => total + position.realizedPnl, 0)

if (isDirectExecution()) {
   const userAddress = process.argv[2] ?? defaultUserAddress

   exportUserData(userAddress, 100)
      .then(({ closedPositions, openPositions, jsonPath, xlsxPath }) => {
         const totalRealizedPnl = sumRealizedPnl(closedPositions)
         console.log('Export complete')
         console.log(`User: ${userAddress}`)
         console.log(
            `Closed positions: ${closedPositions.length}, Open positions: ${openPositions.length}`,
         )
         console.log(`Total realized PnL: ${totalRealizedPnl}`)
         console.log(`JSON written to: ${jsonPath}`)
         console.log(`XLSX written to: ${xlsxPath}`)
      })
      .catch((err) => {
         console.error('Failed to export user data:', err)
         process.exit(1)
      })
}
