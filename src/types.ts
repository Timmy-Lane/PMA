export type BookLevel = { price: number; size: number };
export interface OrderBookSummary {
  market: string;
  asset_id: string;
  bids: BookLevel[];
  asks: BookLevel[];
  timestamp: number;
  tick_size: string;
  min_order_size: string;
  neg_risk: boolean;
}

export interface EventInfo {
  id: string;
  slug: string;
  title: string;
  active: boolean;
  liquidity: number;
  volume: number;
  endDate: string;
  markets: MarketInfo[];
}

export interface MarketInfo {
  id: string;
  slug: string;
  question: string;
  yesTokenId: string;
  noTokenId: string;
  yesPrice: number;
  noPrice: number;
  endDate?: string | null;
  bestBid?: number;
  bestAsk?: number;
}

export interface UserTrade{
  userName: string;
  userAddress: string;
  eventTitle: string;
  eventId: string;
  outcome: string;
  side: 'BUY' | 'SELL'
  size: number;
  price: number;
  revenue: number;
  timestamp: number;
  txHash: string;
}

export interface userActivity{
  
}