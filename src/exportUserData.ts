import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import ExcelJS from 'exceljs'
import { Poly } from '../src/platforms/poly'
import {
   UserActivity,
   UserPositions,
   UserTrade,
   UserTradeHistory,
} from '../src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const exportUserData = async (userAddress: string) => {
   const poly = new Poly()

   const [trades, activity, openPositions, closedPositions] = await Promise.all(
      [
         poly.getUserTrades(userAddress),
         poly.getUserActivity(userAddress),
         poly.getUserPositions(userAddress),
         poly.getUserTradeHistory(userAddress),
      ],
   )

   const tradesData: UserTrade[] = trades ?? []
   const activityData: UserActivity[] = activity ?? []
   const openPositionsData: UserPositions[] = openPositions ?? []
   const closedPositionsData: UserTradeHistory[] = sortClosedPositions(
      closedPositions ?? [],
   )

   await ensureDataDir()

   await Promise.all([
      writeWorkbook({
         userAddress,
         closedPositions: closedPositionsData,
         openPositions: openPositionsData,
         trades: tradesData,
      }),
      writeJson({
         userAddress,
         closedPositions: closedPositionsData,
         openPositions: openPositionsData,
         trades: tradesData,
         activity: activityData,
      }),
   ])
}

const ensureDataDir = async () => {
   await fs.mkdir(__dirname, { recursive: true })
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

const writeWorkbook = async ({
   userAddress,
   closedPositions,
   openPositions,
   trades,
}: {
   userAddress: string
   closedPositions: UserTradeHistory[]
   openPositions: UserPositions[]
   trades: UserTrade[]
}) => {
   const workbook = new ExcelJS.Workbook()

   const closedSheet = workbook.addWorksheet('ClosedPositions')
   closedSheet.columns = [
      { header: 'endDate', key: 'endDate', width: 22 },
      { header: 'eventTitle', key: 'eventTitle', width: 30 },
      { header: 'eventId', key: 'eventId', width: 24 },
      { header: 'outcome', key: 'outcome', width: 16 },
      { header: 'avgEntryPrice', key: 'avgEntryPrice', width: 16 },
      { header: 'totalBought', key: 'totalBought', width: 14 },
      { header: 'closePrice', key: 'closePrice', width: 14 },
      { header: 'realizedPnl', key: 'realizedPnl', width: 14 },
      { header: 'roiPct', key: 'roiPct', width: 12 },
      { header: 'result', key: 'result', width: 10 },
      { header: 'userAddress', key: 'userAddress', width: 46 },
   ]

   closedPositions.forEach((position) => {
      const roiPct = computeRoi(position)
      const result = position.realizedPnl > 0 ? 'WIN' : 'LOSE'
      closedSheet.addRow({
         ...position,
         roiPct,
         result,
         userAddress,
      })
   })

   const openSheet = workbook.addWorksheet('OpenPositions')
   openSheet.columns = [
      { header: 'timestamp', key: 'timestamp', width: 20 },
      { header: 'eventTitle', key: 'eventTitle', width: 30 },
      { header: 'eventId', key: 'eventId', width: 24 },
      { header: 'outcome', key: 'outcome', width: 16 },
      { header: 'shares', key: 'shares', width: 14 },
      { header: 'averageEntryPrice', key: 'averageEntryPrice', width: 18 },
      { header: 'currentPrice', key: 'currentPrice', width: 14 },
      { header: 'unrealizedPnl', key: 'unrealizedPnl', width: 16 },
      { header: 'userAddress', key: 'userAddress', width: 46 },
   ]

   openPositions.forEach((position) => {
      openSheet.addRow({ ...position, userAddress })
   })

   const tradesSheet = workbook.addWorksheet('Trades')
   tradesSheet.columns = [
      { header: 'timestamp', key: 'timestamp', width: 20 },
      { header: 'eventTitle', key: 'eventTitle', width: 30 },
      { header: 'eventId', key: 'eventId', width: 24 },
      { header: 'outcome', key: 'outcome', width: 16 },
      { header: 'side', key: 'side', width: 10 },
      { header: 'size', key: 'size', width: 12 },
      { header: 'price', key: 'price', width: 12 },
      { header: 'revenue', key: 'revenue', width: 16 },
      { header: 'txHash', key: 'txHash', width: 50 },
      { header: 'userAddress', key: 'userAddress', width: 46 },
   ]

   trades.forEach((trade) => {
      tradesSheet.addRow({ ...trade, userAddress })
   })

   const xlsxPath = path.join(__dirname, `${userAddress}.xlsx`)
   await workbook.xlsx.writeFile(xlsxPath)
}

const writeJson = async ({
   userAddress,
   closedPositions,
   openPositions,
   trades,
   activity,
}: {
   userAddress: string
   closedPositions: UserTradeHistory[]
   openPositions: UserPositions[]
   trades: UserTrade[]
   activity: UserActivity[]
}) => {
   const payload = {
      userAddress,
      generatedAt: new Date().toISOString(),
      closedPositions,
      openPositions,
      trades,
      activity,
   }

   const jsonPath = path.join(__dirname, `${userAddress}.json`)
   await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8')
}

const computeRoi = (position: UserTradeHistory) => {
   const basis = position.avgEntryPrice * position.totalBought
   if (basis === 0) return 0
   return position.realizedPnl / basis
}

const isDirectExecution = () => {
   const executedPath = process.argv[1]
   if (!executedPath) return false
   return path.resolve(executedPath) === __filename
}

if (isDirectExecution()) {
   const userAddress = process.argv[2]
   if (!userAddress) {
      console.error('Usage: ts-node exportUserData.ts <userAddress>')
      process.exit(1)
   }

   exportUserData(userAddress).catch((err) => {
      console.error('Failed to export user data:', err)
      process.exit(1)
   })
}
