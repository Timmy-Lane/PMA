import {
  ClobClient,
  OrderType,
  Side,
  ApiKeyCreds,
} from "@polymarket/clob-client";
import { Wallet } from "ethers";
import "dotenv/config";
import { BookLevel, EventInfo, MarketInfo } from "./types";

const privateKey = process.env.PRIVATE_KEY!;
const clobHost = "https://clob.polymarket.com";
const gammaBase = "https://gamma-api.polymarket.com";

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
    const url = `${gammaBase}/events?limit=${limit}?closed=false`;
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

  public getMarketByID = async (id: string): Promise<MarketInfo | null> => {
    const url = `${gammaBase}/markets/${id}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`getMarketbyID fail: HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    return data;
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

  // public getOrderbook = async (
  //   tokenID: string
  // ): Promise<{
  //   bids: BookLevel[];
  //   asks: BookLevel[];
  //   tickSize?: string;
  //   minOrderSize: string;
  // }> => {
  //   const url = `${this.gammaBase}/book`;
  // };

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
