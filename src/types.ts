export type BookLevel = { price: number; size: number }
export interface OrderBookSummary {
   market: string
   asset_id: string
   bids: BookLevel[]
   asks: BookLevel[]
   timestamp: number
   tick_size: string
   min_order_size: string
   neg_risk: boolean
}

export interface EventInfo {
   id: string
   slug: string
   title: string
   active: boolean
   liquidity: number
   volume: number
   endDate: string
   markets: MarketInfo[]
}

export interface MarketInfo {
   id: string
   slug: string
   question: string
   yesTokenId: string
   noTokenId: string
   yesPrice: number
   noPrice: number
   endDate?: string | null
   bestBid?: number
   bestAsk?: number
}

export interface UserTrade {
   userName: string
   userAddress: string
   eventTitle: string
   eventId: string
   outcome: string
   side: 'BUY' | 'SELL'
   size: number
   price: number
   revenue: number
   timestamp: number
   txHash: string
}

export interface UserActivity {
   userName: string
   userAddress: string
   eventTitle: string
   eventId: string
   outcome: string
   side: 'BUY' | 'SELL'
   size: number
   usdcSize: number
   price: number
   timestamp: number
   txHash: string
}
export interface UserPositions {
   userName: string
   userAddress: string
   eventTitle: string
   eventId: string
   outcome: string
   shares: number
   averageEntryPrice: number
   currentPrice: number
   unrealizedPnl: number
   timestamp: number
}

export interface UserTradeHistory {
   userAddress: string
   eventTitle: string
   eventId: string
   outcome: string
   oppositeOutcome: string
   avgEntryPrice: number
   totalBought: number
   realizedPnl: number
   closePrice: number
   timestamp: number
   endDate: string
   icon?: string
}
