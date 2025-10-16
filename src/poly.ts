import {
  ClobClient,
  OrderType,
  Side,
  ApiKeyCreds,
} from "@polymarket/clob-client";
import { Wallet } from "ethers";
import "dotenv/config";

const privateKey = process.env.PRIVATE_KEY!;
const clobHost = "https://clob.polymarket.com";

export class Poly {
  gammaBase = "https://gamma-api.polymarket.com";
  constructor(public signer: Wallet, public client: ClobClient) {}

  static async create() {
    const signer = new Wallet(privateKey);

    const base = new ClobClient(clobHost, 137, signer);
    const creds: ApiKeyCreds = await base.createOrDeriveApiKey();
    const client = new ClobClient(clobHost, 137, signer, creds);

    return new Poly(signer, client);
  }

  public getMarketsBySlug = async (slug: string) => {
    const url = `${this.gammaBase}/markets/slug/${encodeURIComponent(slug)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`getMarketbySlug fail: HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    return data;
  };

  public getEventBySlug = async (slug: string) => {
    const url = `${this.gammaBase}/events/slug/${encodeURIComponent(slug)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`getEventbySlug fail: HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    return data;
  };

  public makeBet = async (
    tokenID: string,
    price: number,
    size: number,
    side: Side
  ) => {
    const orderArgs = {
      tokenID,
      price,
      size,
      side,
    };
    const resp = await this.client.createAndPostOrder(orderArgs);
    console.log("Order Result: ", resp);
    return resp;
  };
}
