// src/tokenDetails.ts
import { createPublicClient, http, hexToString, erc20Abi } from 'viem';
import { mainnet } from 'viem/chains';
import { experimental_createEffect, S } from 'envio';
import lbPairAbi from '../../abis/LBPair.json';
import { getClient } from '../utils/client';

// Use Sury library to define the schema
const lbPairMetadataSchema = S.schema({
  baseFactor: S.bigint,
  filterPeriod: S.bigint,
  decayPeriod: S.bigint,
  reductionFactor: S.bigint,
  variableFeeControl: S.bigint,
  protocolShare: S.bigint,
  maxVolatilityAccumulator: S.bigint,
  activeId: S.bigint,
});

export const getLBPairMetadata = experimental_createEffect(
  {
    name: 'getLBPairMetadata',
    input: {
      lbPairAddress: S.string,
      chainId: S.number,
    },
    output: lbPairMetadataSchema,
    // Enable caching to avoid duplicated calls
    cache: true,
  },
  async ({ input, context }) => {
    const { lbPairAddress, chainId } = input;

    // Prepare contract instances for different token standard variations
    const lbPair = {
      address: lbPairAddress as `0x${string}`,
      abi: lbPairAbi,
    };
    let results: [bigint, [bigint, bigint, bigint, bigint, bigint, bigint, bigint]];
    try {
      // Try standard ERC20 interface first (most common)
      results = (await getClient(chainId).multicall({
        allowFailure: false,
        contracts: [
          {
            ...lbPair,
            functionName: 'getActiveId',
          },
          {
            ...lbPair,
            functionName: 'getStaticFeeParameters',
          },
        ],
      })) as [bigint, [bigint, bigint, bigint, bigint, bigint, bigint, bigint]];
    } catch (error) {
      context.log.error(`Error fetching token metadata for ${lbPairAddress}: ${error}`);
      throw error;
    }

    const [
      activeId,
      [baseFactor, filterPeriod, decayPeriod, reductionFactor, variableFeeControl, protocolShare, maxVolatilityAccumulator],
    ] = results;

    return {
      baseFactor,
      filterPeriod,
      decayPeriod,
      reductionFactor,
      variableFeeControl,
      protocolShare,
      maxVolatilityAccumulator,
      activeId,
    };
  }
);
