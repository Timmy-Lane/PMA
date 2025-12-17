import { pgTable, text, boolean, doublePrecision, timestamp, bigint } from 'drizzle-orm/pg-core'

export const events = pgTable('events', {
   id: text('id').primaryKey(),
   slug: text('slug').notNull(),
   title: text('title').notNull(),
   active: boolean('active').notNull(),
   liquidity: doublePrecision('liquidity').notNull(),
   volume: doublePrecision('volume').notNull(),
   endDate: timestamp('end_date', { withTimezone: true }).notNull(),
})

export const markets = pgTable('markets', {
   id: text('id').primaryKey(),
   slug: text('slug').notNull(),
   eventId: text('event_id').references(() => events.id),
   question: text('question').notNull(),
   yesTokenId: text('yes_token_id').notNull(),
   noTokenId: text('no_token_id').notNull(),
   yesPrice: doublePrecision('yes_price').notNull(),
   noPrice: doublePrecision('no_price').notNull(),
   endDate: timestamp('end_date', { withTimezone: true }),
   bestBid: doublePrecision('best_bid'),
   bestAsk: doublePrecision('best_ask'),
})

export const userTrades = pgTable('user_trades', {
   id: text('id').primaryKey(),
   userName: text('user_name').notNull(),
   userAddress: text('user_address').notNull(),
   eventTitle: text('event_title').notNull(),
   eventId: text('event_id').notNull(),
   outcome: text('outcome').notNull(),
   side: text('side').notNull(),
   size: doublePrecision('size').notNull(),
   price: doublePrecision('price').notNull(),
   revenue: doublePrecision('revenue').notNull(),
   timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
   txHash: text('tx_hash').notNull(),
})

export const userActivity = pgTable('user_activity', {
   id: text('id').primaryKey(),
   userName: text('user_name').notNull(),
   userAddress: text('user_address').notNull(),
   eventTitle: text('event_title').notNull(),
   eventId: text('event_id').notNull(),
   outcome: text('outcome').notNull(),
   side: text('side').notNull(),
   size: doublePrecision('size').notNull(),
   usdcSize: doublePrecision('usdc_size').notNull(),
   price: doublePrecision('price').notNull(),
   timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
   txHash: text('tx_hash').notNull(),
})

export const userPositions = pgTable('user_positions', {
   id: text('id').primaryKey(),
   userName: text('user_name').notNull(),
   userAddress: text('user_address').notNull(),
   eventTitle: text('event_title').notNull(),
   eventId: text('event_id').notNull(),
   outcome: text('outcome').notNull(),
   shares: doublePrecision('shares').notNull(),
   averageEntryPrice: doublePrecision('average_entry_price').notNull(),
   currentPrice: doublePrecision('current_price').notNull(),
   unrealizedPnl: doublePrecision('unrealized_pnl').notNull(),
   timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
})

export const userTradeHistory = pgTable('user_trade_history', {
   id: text('id').primaryKey(),
   userAddress: text('user_address').notNull(),
   eventTitle: text('event_title').notNull(),
   eventId: text('event_id').notNull(),
   outcome: text('outcome').notNull(),
   oppositeOutcome: text('opposite_outcome').notNull(),
   avgEntryPrice: doublePrecision('avg_entry_price').notNull(),
   totalBought: doublePrecision('total_bought').notNull(),
   realizedPnl: doublePrecision('realized_pnl').notNull(),
   closePrice: doublePrecision('close_price').notNull(),
   timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
   endDate: timestamp('end_date', { withTimezone: true }).notNull(),
   icon: text('icon'),
})
