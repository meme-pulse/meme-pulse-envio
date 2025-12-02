// src/effect/oracle.ts
import { experimental_createEffect, S } from 'envio';

// Hardcoded native price: 1 MEME = $1
const HARDCODED_NATIVE_PRICE_USD = '1';

// Use Sury library to define the schema
const nativePriceSchema = S.schema({
  nativePrice: S.string,
});

export const getNativePriceInUSD = experimental_createEffect(
  {
    name: 'getNativePriceInUSD',
    input: {
      chainId: S.number,
      blockNumber: S.number,
    },
    output: nativePriceSchema,
    // Enable caching to avoid duplicated calls
    cache: true,
  },
  async ({ input, context }) => {
    // Return hardcoded price (1 MEME = $1)
    // No oracle needed for Memecore testnet
    return {
      nativePrice: HARDCODED_NATIVE_PRICE_USD,
    };
  }
);
