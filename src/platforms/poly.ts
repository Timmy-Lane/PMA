import { ClobClient, Side, ApiKeyCreds } from '@polymarket/clob-client'
import { Wallet } from 'ethers'
import {
   BookLevel,
   EventInfo,
   MarketInfo,
   UserTrade,
   UserActivity,
   UserPositions,
   UserTradeHistory,
} from '../types'

const privateKey = process.env.PRIVATE_KEY!
const clobHost = 'https://clob.polymarket.com'
const gammaBase = 'https://gamma-api.polymarket.com'
const crypto_tag = 21
const dataHost = 'https://data-api.polymarket.com'

export class Poly {
   private client?: ClobClient
   private initPromise?: Promise<void>

   private async initTrade() {
      if (this.client) return
      const key = privateKey
      if (!key) throw new Error('There is no private key')

      if (!this.initPromise) {
         this.initPromise = (async () => {
            const signer = new Wallet(key)
            const base = new ClobClient(clobHost, 137, signer)
            const creds: ApiKeyCreds = await base.createOrDeriveApiKey()
            this.client = new ClobClient(clobHost, 137, signer, creds)
         })()
      }
      await this.initPromise
   }

   public getEvents = async (limit?: number) => {
      const url = `${gammaBase}/events?tag_id=${crypto_tag}?limit=${limit}?closed=false`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`Poly GetEvents fail: HTTP ${resp.status}`)
         return null
      }
      const json = await resp.json()
      const data = json.data ?? json
      return data
   }

   public getMarketBySlug = async (
      slug: string,
   ): Promise<MarketInfo | null> => {
      const url = `${gammaBase}/markets/slug/${encodeURIComponent(slug)}`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`getMarketbySlug fail: HTTP ${resp.status}`)
         return null
      }
      const json = await resp.json()
      const market = json.data ?? json

      const m = market.markets?.[0]
      if (!m) return null

      const [yesPrice, noPrice] = JSON.parse(m.outcomePrices).map(Number)
      const [yesTokenId, noTokenId] = JSON.parse(m.clobTokenIds)

      return {
         id: m.id,
         slug: m.slug,
         question: m.question,
         yesTokenId,
         noTokenId,
         yesPrice,
         noPrice,
      }
   }

   public getEventBySlug = async (slug: string): Promise<EventInfo | null> => {
      const url = `${gammaBase}/events/slug/${encodeURIComponent(slug)}`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`getEventbySlug fail: HTTP ${resp.status}`)
         return null
      }
      const data = await resp.json()
      return data
   }

   public getMarketData = (eventData: EventInfo): MarketInfo[] | null => {
      if (!eventData || !Array.isArray(eventData.markets)) return null
      const markets: MarketInfo[] = eventData.markets
      return markets
   }

   public getTokenIdsFromMarket = (m: any) => {
      const ids = JSON.parse(m.clobTokenIds)

      return { yesTokenId: ids[0] ?? null, noTokenId: ids[1] ?? null }
   }

   public getOrderbook = async (
      tokenID: string,
   ): Promise<{
      bids: BookLevel[]
      asks: BookLevel[]
   } | null> => {
      const url = `${gammaBase}/book?token_id=${tokenID}`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`GetOrderbook fail: HTTP ${resp.status}`)
         return null
      }
      const j = await resp.json()
      const raw = j.data ?? j

      const toLevels = (arr: any[] = []): BookLevel[] =>
         arr.map((x) => ({ price: Number(x[0]), size: Number(x[1]) }))

      const bids = toLevels(raw.bids ?? []).sort((a, b) => b.price - a.price)
      const asks = toLevels(raw.asks ?? []).sort((a, b) => a.price - b.price)

      return { bids, asks }
   }

   public bestBidAsk = (book: { bids: BookLevel[]; asks: BookLevel[] }) => {
      const bestBid = book.bids[0]
      const bestAsk = book.asks[0]
      return { bestBid, bestAsk }
   }

   public getMidPrice = (book: { bids: BookLevel[]; asks: BookLevel[] }) => {
      const { bestBid, bestAsk } = this.bestBidAsk(book)
      if (!bestBid || !bestAsk) return null
      return (bestBid.price + bestAsk.price) / 2
   }

   public executableAvg = (levels: BookLevel[], qty: number): number => {
      let left = qty,
         cost = 0
      for (const { price, size } of levels) {
         if (left <= 0) break
         const take = Math.min(left, size)
         cost += take * price
         left -= take
      }
      return left > 0 ? Infinity : cost / qty // Infinity = not enough liquidity
   }

   public makeBet = async (
      tokenID: string,
      price: number,
      size: number,
      side: Side,
   ): Promise<any> => {
      await this.initTrade()
      const orderArgs = {
         tokenID,
         price,
         size,
         side,
         negrisk: false,
      }
      const resp = await this.client!.createAndPostOrder(orderArgs)
      return resp
   }

   public cancelOrder = async (orderID: string) => {
      await this.initTrade()
      const resp = await this.client!.cancelOrder({ orderID })
      return resp
   }

   public getActiveOrders = async () => {
      await this.initTrade()
      const resp = await this.client!.getOpenOrders()
      return resp
   }

   public getUserTrades = async (
      user: string,
      limit: number = 100,
   ): Promise<UserTrade[] | null> => {
      const url = `${dataHost}/trades?limit=${limit}&takerOnly=true&user=${user}`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`getUserTrades fail: HTTP ${resp.status}`)
         return null
      }
      const raw = await resp.json()
      const formatted: UserTrade[] = raw.map((t: any) => {
         const revenue =
            t.side === 'SELL' ? t.size * t.price : -(t.size * t.price)

         return {
            userName: t.name,
            userAddress: t.proxyWallet,
            eventTitle: t.title,
            eventId: t.slug, // ? conditionId
            outcome: t.outcome,
            side: t.side,
            size: t.size,
            price: t.price,
            revenue,
            timestamp: t.timestamp,
            txHash: t.transactionHash,
         }
      })
      return formatted
   }

   public getUserActivity = async (
      user: string,
      limit: number = 100,
   ): Promise<UserActivity[] | null> => {
      const url = `${dataHost}/activity?limit=${limit}&user=${user}`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`getUserActivity fail: HTTP ${resp.status}`)
         return null
      }
      const raw = await resp.json()
      const formatted: UserActivity[] = raw
         .filter((t: any) => t.type === 'TRADE')
         .map((t: any) => ({
            userName: t.name,
            userAddress: t.proxyWallet,
            eventTitle: t.title,
            eventId: t.slug,
            outcome: t.outcome,
            side: t.side,
            size: t.size,
            usdcSize: t.usdcSize,
            price: t.price,
            timestamp: t.timestamp,
            txHash: t.transactionHash,
         }))

      return formatted
   }

   public getUserPositions = async (
      user: string,
      limit: number = 100,
   ): Promise<UserPositions[] | null> => {
      const url = `${dataHost}/positions?limit=${limit}&user=${user}&sortBy=CURRENT&sortDirection=DESC`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`getUserPositions fail: HTTP ${resp.status}`)
         return null
      }
      const raw = await resp.json()
      const formatted: UserPositions[] = raw.map((t: any) => ({
         userName: t.name,
         userAddress: t.proxyWallet,
         eventTitle: t.title,
         eventId: t.slug,
         outcome: t.outcome,
         shares: t.currentShares,
         averageEntryPrice: t.avgPrice,
         currentPrice: t.price,
         unrealizedPnl: t.unrealizedPnl,
         timestamp: t.timestamp,
      }))
      return formatted
   }

   public getUserTradeHistory = async (
      user: string,
      limit: number = 100,
   ): Promise<UserTradeHistory[] | null> => {
      const url = `${dataHost}/closed-positions?limit=${limit}&user=${user}&sortBy=TIMESTAMP&sortDirection=DESC`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`getUserTradeHistory fail: HTTP ${resp.status}`)
         return null
      }
      const raw = await resp.json()
      const formatted: UserTradeHistory[] = raw.map((t: any) => ({
         userAddress: t.proxyWallet,
         eventTitle: t.title,
         eventId: t.slug,
         outcome: t.outcome,
         oppositeOutcome: t.oppositeOutcome,
         avgEntryPrice: t.avgPrice,
         totalBought: t.totalBought,
         realizedPnl: t.realizedPnl,
         closePrice: t.curPrice,
         timestamp: t.timestamp,
         endDate: t.endDate,
         icon: t.icon,
      }))
      return formatted
   }
}
