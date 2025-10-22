import {
  ClobClient,
  OrderType,
  Side,
  ApiKeyCreds,
} from "@polymarket/clob-client";
import { Wallet } from "ethers";
import "dotenv/config";
import { BookLevel, EventInfo, MarketInfo } from "../types";

const privateKey = process.env.PRIVATE_KEY!;
const clobHost = "https://clob.polymarket.com";
const gammaBase = "https://gamma-api.polymarket.com";
const crypto_tag = 21;

export class Poly {
  signer?: Wallet;
  client?: ClobClient;
  constructor() {}

  static async create() {
    const self = new Poly();

    const signer = new Wallet(privateKey);
    const base = new ClobClient(clobHost, 137, signer);
    const creds: ApiKeyCreds = await base.createOrDeriveApiKey();
    const client = new ClobClient(clobHost, 137, signer, creds);

    self.signer = signer;
    self.client = client;

    return self;
  }

  public getEvents = async (limit?: number) => {
    const url = `${gammaBase}/events?tag_id=${crypto_tag}?limit=${limit}?closed=false`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`GetEvents fail: HTTP ${resp.status}`);
      return null;
    }
    const json = await resp.json();
    const data = json.data ?? json;
    return data;
  };

  public getMarketBySlug = async (slug: string): Promise<MarketInfo | null> => {
    const url = `${gammaBase}/markets/slug/${encodeURIComponent(slug)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`getMarketbySlug fail: HTTP ${resp.status}`);
      return null;
    }
    const json = await resp.json();
    const market = json.data ?? json;

    const m = market.markets?.[0];
    if (!m) return null;

    const [yesPrice, noPrice] = JSON.parse(m.outcomePrices).map(Number);
    const [yesTokenId, noTokenId] = JSON.parse(m.clobTokenIds);

    return {
      id: m.id,
      slug: m.slug,
      question: m.question,
      yesTokenId,
      noTokenId,
      yesPrice,
      noPrice,
    };
  };

  public getEventBySlug = async (slug: string): Promise<EventInfo | null> => {
    const url = `${gammaBase}/events/slug/${encodeURIComponent(slug)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`getEventbySlug fail: HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    return data;
  };

  public getMarketData = (eventData: EventInfo): MarketInfo[] | null => {
    if (!eventData || !Array.isArray(eventData.markets)) return null;
    const markets: MarketInfo[] = eventData.markets;
    return markets;
  };

  public getTokenIdsFromMarket = (m: any) => {
    const ids = JSON.parse(m.clobTokenIds);

    return { yesTokenId: ids[0] ?? null, noTokenId: ids[1] ?? null };
  };

  public getOrderbook = async (
    tokenID: string
  ): Promise<{
    bids: BookLevel[];
    asks: BookLevel[];
  } | null> => {
    const url = `${gammaBase}/book?token_id=${tokenID}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`GetOrderbook fail: HTTP ${resp.status}`);
      return null;
    }
    const j = await resp.json();
    const raw = j.data ?? j;

    const toLevels = (arr: any[] = []): BookLevel[] =>
      arr.map((x) => ({ price: Number(x[0]), size: Number(x[1]) }));

    const bids = toLevels(raw.bids ?? []).sort((a, b) => b.price - a.price);
    const asks = toLevels(raw.asks ?? []).sort((a, b) => a.price - b.price);

    return { bids, asks };
  };

  public bestBidAsk = (book: { bids: BookLevel[]; asks: BookLevel[] }) => {
    const bestBid = book.bids[0];
    const bestAsk = book.asks[0];
    return { bestBid, bestAsk };
  };

  public getMidPrice = (book: { bids: BookLevel[]; asks: BookLevel[] }) => {
    const { bestBid, bestAsk } = this.bestBidAsk(book);
    if (!bestBid || !bestAsk) return null;
    return (bestBid.price + bestAsk.price) / 2;
  };

  public executableAvg = (levels: BookLevel[], qty: number): number => {
    let left = qty,
      cost = 0;
    for (const { price, size } of levels) {
      if (left <= 0) break;
      const take = Math.min(left, size);
      cost += take * price;
      left -= take;
    }
    return left > 0 ? Infinity : cost / qty; // Infinity = not enough liquidity
  };

  public makeBet = async (
    tokenID: string,
    price: number,
    size: number,
    side: Side
  ): Promise<any> => {
    if (!this.client) {
      throw new Error("Initialize Create Function!");
    }
    const orderArgs = {
      tokenID,
      price,
      size,
      side,
      negrisk: false,
    };
    const resp = await this.client!.createAndPostOrder(orderArgs);
    console.log("Order Result: ", resp);
    return resp;
  };

  public cancelOrder = async (orderID: string) => {
    if (!this.client) {
      throw new Error("Initialize Create Function!");
    }
    const resp = await this.client!.cancelOrder({ orderID });
    console.log(`Order ${orderID} canceled: ${resp}`);
    return resp;
  };

  public getActiveOrders = async () => {
    if (!this.client) {
      throw new Error("Initialize Create Function!");
    }
    const resp = await this.client!.getOpenOrders();
    console.log(resp);
    return resp;
  };
}
