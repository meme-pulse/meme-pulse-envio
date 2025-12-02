/**
 * Returns the price of the bin given its id and bin step
 * (1 + binStep / 10_000) ** (id - 8388608)
 *
 * @param { string } id
 * @param { string } binStep
 */

import { loadBundle } from '../entities/bundle';
import { loadLbPair } from '../entities/lbPair';
import { loadToken } from '../entities/token';
import { WNATIVE_ADDRESS } from './constants';

import { BigDecimal, handlerContext } from 'generated';
import { getNativePriceInUSD } from '../effect/oracle';

export async function getTokensPriceInUSD(
  context: handlerContext,
  chainId: number,
  lbPairEntity: Awaited<ReturnType<typeof loadLbPair>>,
  tokenX: Awaited<ReturnType<typeof loadToken>>,
  tokenY: Awaited<ReturnType<typeof loadToken>>,
  binId?: string
): Promise<[string, string]> {
  const activeBinId = binId ? binId : lbPairEntity.activeId;
  const binStep = lbPairEntity.binStep;

  // tokenYPriceBin = tokenX당 tokenY 가격 (bin 기준)
  const tokenYPriceBin = new BigDecimal(getPriceYOfBin(activeBinId.toString(), binStep.toString(), tokenX, tokenY));

  let tokenXPriceUSD = '0';
  let tokenYPriceUSD = '0';

  // Get native (MEME) price from bundle
  const bundleEntity = await loadBundle(context, chainId);
  const nativePriceUSD = bundleEntity.nativePriceUSD.toString();

  const wnativeAddress = WNATIVE_ADDRESS[chainId];
  const isTokenXNative = tokenX.address.toLowerCase() === wnativeAddress?.toLowerCase();
  const isTokenYNative = tokenY.address.toLowerCase() === wnativeAddress?.toLowerCase();

  if (isTokenXNative) {
    // tokenX가 WNATIVE인 경우: tokenX 가격 설정 후 tokenY 가격 계산
    tokenXPriceUSD = nativePriceUSD;
    // tokenY = tokenX / tokenYPriceBin (tokenYPriceBin이 0이 아닌 경우)
    if (!tokenYPriceBin.isZero()) {
      tokenYPriceUSD = new BigDecimal(tokenXPriceUSD).div(tokenYPriceBin).toString();
    }
  } else if (isTokenYNative) {
    // tokenY가 WNATIVE인 경우: tokenY 가격 설정 후 tokenX 가격 계산
    tokenYPriceUSD = nativePriceUSD;
    // tokenX = tokenY * tokenYPriceBin
    tokenXPriceUSD = tokenYPriceBin.times(new BigDecimal(tokenYPriceUSD)).toString();
  }
  // 둘 다 아닌 경우: 둘 다 0으로 유지 (oracle 없이는 가격 알 수 없음)

  return [tokenXPriceUSD, tokenYPriceUSD];
}

/**
 * Updates native (MEME) price in USD from oracle
 */
export async function updateNativeInUsdPricing(
  context: handlerContext,
  chainId: number,
  blockNumber: number,
  timestamp: number
): Promise<void> {
  try {
    const bundleEntity = await loadBundle(context, chainId);
    const TTL_SECONDS = 15 * 60; // 15분 (900초)
    // timestamp 기반으로 TTL 체크 (정확한 시간 기준)
    if (timestamp - bundleEntity.lastUpdatedTimestamp > TTL_SECONDS) {
      const nativePrice = await context.effect(getNativePriceInUSD, { chainId, blockNumber });
      context.Bundle.set({
        ...bundleEntity,
        nativePriceUSD: new BigDecimal(nativePrice.nativePrice),
        lastUpdatedBlock: blockNumber,
        lastUpdatedTimestamp: timestamp,
      });
    }
  } catch (error) {
    context.log.error('Failed to load bundle', { error });
    throw error;
  }
}

/**
 * Updates tokenX/tokenY priceUSD
 * @param {LBPair} lbPair
 * @param {BigInt | null} binId
 */
export async function updateTokensPriceUSD(
  context: handlerContext,
  chainId: number,
  lbPairEntity: Awaited<ReturnType<typeof loadLbPair>>,
  binId?: string
) {
  const tokenX = await loadToken(context, chainId, lbPairEntity.tokenX_id);
  const tokenY = await loadToken(context, chainId, lbPairEntity.tokenY_id);

  const [tokenXPriceUSD, tokenYPriceUSD] = await getTokensPriceInUSD(context, chainId, lbPairEntity, tokenX, tokenY, binId);

  context.LBPair.set({
    ...lbPairEntity,
    tokenXPriceUSD: new BigDecimal(tokenXPriceUSD),
    tokenYPriceUSD: new BigDecimal(tokenYPriceUSD),
  });

  context.Token.set({
    ...tokenX,
    priceUSD: new BigDecimal(tokenXPriceUSD),
  });

  context.Token.set({
    ...tokenY,
    priceUSD: new BigDecimal(tokenYPriceUSD),
  });
}

/**
 * Returns the liquidity in USD
 * - Liquidity is tracked for all tokens
 *
 * @param tokenXAmount
 * @param tokenX
 * @param tokenYAmount
 * @param tokenY
 * @returns
 */
export async function getTrackedLiquidityUSD(
  tokenXAmount: string,
  tokenXEntity: Awaited<ReturnType<typeof loadToken>>,
  tokenYAmount: string,
  tokenYEntity: Awaited<ReturnType<typeof loadToken>>
): Promise<string> {
  const priceXUSD = tokenXEntity.priceUSD;
  const priceYUSD = tokenYEntity.priceUSD;

  return new BigDecimal(tokenXAmount)
    .times(new BigDecimal(priceXUSD))
    .plus(new BigDecimal(tokenYAmount).times(new BigDecimal(priceYUSD)))
    .toString();
}

/**
 * Returns the volume in USD by taking the average of both amounts
 * - Volume is tracked for all tokens
 *
 * @param tokenXAmount
 * @param tokenX
 * @param tokenYAmount
 * @param tokenY
 * @returns
 */
export function getTrackedVolumeUSD(
  tokenXAmount: string,
  tokenXEntity: Awaited<ReturnType<typeof loadToken>>,
  tokenYAmount: string,
  tokenYEntity: Awaited<ReturnType<typeof loadToken>>
): string {
  const priceXUSD = tokenXEntity.priceUSD;
  const priceYUSD = tokenYEntity.priceUSD;

  return new BigDecimal(tokenXAmount)
    .times(new BigDecimal(priceXUSD))
    .plus(new BigDecimal(tokenYAmount).times(new BigDecimal(priceYUSD)))
    .div(new BigDecimal(2))
    .toString();
}

export function getPriceYOfBin(binId: string, binStep: string, tokenX: any, tokenY: any): string {
  const REAL_SHIFT = 8388608;

  // bpVal = (1 + binStep / 10000)
  const bpVal = 1 + parseFloat(binStep) / 10000;

  // Calculate directly using power operation
  const result = Math.pow(bpVal, parseInt(binId) - REAL_SHIFT);

  // Calculate and return final price
  return (result * Math.pow(10, Number(tokenX.decimals) - Number(tokenY.decimals))).toString();
}

export function getPriceYOfBinWithDecimals(binId: string, binStep: string, tokenXDecimals: number, tokenYDecimals: number): string {
  const REAL_SHIFT = 8388608;

  // bpVal = (1 + binStep / 10000)
  const bpVal = 1 + parseFloat(binStep) / 10000;

  // Calculate directly using power operation
  const result = Math.pow(bpVal, parseInt(binId) - REAL_SHIFT);

  // Calculate and return final price
  return (result * Math.pow(10, tokenXDecimals - tokenYDecimals)).toString();
}

export function formatTokenAmountByDecimals(tokenAmount: string, exchangeDecimals: string): string {
  if (exchangeDecimals === '0') {
    return tokenAmount;
  }
  return new BigDecimal(tokenAmount).div(new BigDecimal(10).pow(new BigDecimal(exchangeDecimals))).toString();
}

// Byte-32 decoding for Liquidity Book AMM (ref: TraderJoe docs)
export function decodeAmounts(amounts: string): [string, string] {
  const amountsBigInt = BigInt(amounts);

  // Read the right 128 bits of the 256 bits
  const amountsX = amountsBigInt & (BigInt(2) ** BigInt(128) - BigInt(1));

  // Read the left 128 bits of the 256 bits
  const amountsY = amountsBigInt >> BigInt(128);

  return [amountsX.toString(), amountsY.toString()];
}
