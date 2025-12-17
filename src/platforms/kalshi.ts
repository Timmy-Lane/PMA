import { BookLevel, EventInfo, MarketInfo } from '../types'

export class Kalshi {
   constructor() {}

   public getEvents = async (limit?: number) => {
      const url = `https://api.elections.kalshi.com/trade-api/v2/events?limit=${limit}&status=open`
      const resp = await fetch(url)
      if (!resp.ok) {
         console.warn(`Kalshi GetEvents fail: HTTP ${resp.status}`)
         return null
      }
      const json = await resp.json()
      const data = json.data ?? json
      return data
   }
}
