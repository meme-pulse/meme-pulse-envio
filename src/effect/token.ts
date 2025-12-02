// src/tokenDetails.ts
import { createPublicClient, http, hexToString, erc20Abi } from 'viem';
import { mainnet } from 'viem/chains';
import { experimental_createEffect, S } from 'envio';
import { getClient } from '../utils/client';

// Use Sury library to define the schema
const tokenMetadataSchema = S.schema({
  name: S.string,
  symbol: S.string,
  decimals: S.number,
});

export const getTokenMetadata = experimental_createEffect(
  {
    name: 'getTokenMetadata',
    input: {
      tokenAddress: S.string,
      chainId: S.number,
    },
    output: tokenMetadataSchema,
    // Enable caching to avoid duplicated calls
    cache: true,
  },
  async ({ input, context }) => {
    const { tokenAddress, chainId } = input;

    // Prepare contract instances for different token standard variations
    const erc20 = {
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
    };
    let results: [number, string, string];
    try {
      // Try standard ERC20 interface first (most common)
      results = await getClient(chainId).multicall({
        allowFailure: false,
        contracts: [
          {
            ...erc20,
            functionName: 'decimals',
          },
          {
            ...erc20,
            functionName: 'name',
          },
          {
            ...erc20,
            functionName: 'symbol',
          },
        ],
      });
    } catch (error) {
      context.log.error(`Error fetching token metadata for ${tokenAddress}: ${error}`);
      throw error;
    }

    const [decimals, name, symbol] = results;

    return {
      name,
      symbol,
      decimals,
    };
  }
);
