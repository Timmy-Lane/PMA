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
}
