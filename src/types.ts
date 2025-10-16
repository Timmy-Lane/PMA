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
