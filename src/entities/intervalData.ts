// MemePulse DEX Indexer - Interval Data Entities

import { BigDecimal, HandlerContext } from 'generated';
import { loadLbPair } from './lbPair';
import { loadLBFactory } from './lbFactory';
import { loadToken } from './token';
import { createWritableCopy } from '../utils/copy';
import {
  getTokenHourDataPk,
  getLBPairDayDataPk,
  getLiquidityBookAMMHourDataPk,
  getLiquidityBookAMMDayDataPk,
  getTokenDayDataPk,
  getLBPairHourDataPk,
} from '../utils/helper';

export async function loadMemePulseHourData(context: HandlerContext, chainId: number, timestamp: number, update: boolean) {
  const SECONDS_IN_HOUR = 60 * 60;
  const hourId = Math.floor(timestamp / SECONDS_IN_HOUR);
  const hourStartTimestamp = hourId * SECONDS_IN_HOUR;
  const hourPk = getLiquidityBookAMMHourDataPk(chainId, hourId);

  const lbFactory = await loadLBFactory(context, chainId);
  const memePulseHourDataEntity = createWritableCopy(
    await context.LBHourData.getOrCreate({
      id: hourPk,
      chainId: chainId,
      date: hourStartTimestamp,
      factory_id: lbFactory.id,
      totalValueLockedUSD: lbFactory.totalValueLockedUSD,
      txCount: 0n,
      volumeUSD: new BigDecimal(0),
      volumeNative: new BigDecimal(0),
      feesUSD: new BigDecimal(0),
      totalValueLockedNative: new BigDecimal(0),
      untrackedVolumeUSD: new BigDecimal(0),
    })
  );

  if (update) {
    memePulseHourDataEntity.totalValueLockedUSD = lbFactory.totalValueLockedUSD;
    memePulseHourDataEntity.txCount = memePulseHourDataEntity.txCount + 1n;
    context.LBHourData.set(memePulseHourDataEntity);
  }

  return memePulseHourDataEntity;
}

export async function loadMemePulseDayData(context: HandlerContext, chainId: number, timestamp: number, update: boolean) {
  const SECONDS_IN_DAY = 60 * 60 * 24;
  const dayId = Math.floor(timestamp / SECONDS_IN_DAY);
  const dayStartTimestamp = dayId * SECONDS_IN_DAY;
  const dayPk = getLiquidityBookAMMDayDataPk(chainId, dayId);
  const lbFactory = await loadLBFactory(context, chainId);
  const memePulseDayDataEntity = createWritableCopy(
    await context.LBDayData.getOrCreate({
      id: dayPk,
      chainId: chainId,
      date: dayStartTimestamp,
      factory_id: lbFactory.id,
      totalValueLockedUSD: lbFactory.totalValueLockedUSD,
      txCount: 0n,
      volumeUSD: new BigDecimal(0),
      volumeNative: new BigDecimal(0),
      feesUSD: new BigDecimal(0),
      totalValueLockedNative: new BigDecimal(0),
      untrackedVolumeUSD: new BigDecimal(0),
    })
  );

  if (update) {
    memePulseDayDataEntity.totalValueLockedUSD = lbFactory.totalValueLockedUSD;
    memePulseDayDataEntity.txCount = memePulseDayDataEntity.txCount + 1n;
    context.LBDayData.set(memePulseDayDataEntity);
  }

  return memePulseDayDataEntity;
}

export async function loadTokenHourData(
  context: HandlerContext,
  chainId: number,
  timestamp: number,
  token: Awaited<ReturnType<typeof loadToken>>,
  update: boolean
) {
  const SECONDS_IN_HOUR = 60 * 60;
  const hourId = Math.floor(timestamp / SECONDS_IN_HOUR);
  const hourStartTimestamp = hourId * SECONDS_IN_HOUR;
  const hourPk = getTokenHourDataPk(chainId, token.address, hourId);
  const tokenPrice = token.priceUSD;

  const tokenHourDataEntity = createWritableCopy(
    await context.TokenHourData.getOrCreate({
      chainId: chainId,
      id: hourPk,
      date: hourStartTimestamp,
      token_id: token.id,
      volume: new BigDecimal(0),
      volumeNative: new BigDecimal(0),
      volumeUSD: new BigDecimal(0),
      txCount: 0n,
      totalValueLocked: new BigDecimal(0),
      totalValueLockedNative: new BigDecimal(0),
      totalValueLockedUSD: new BigDecimal(0),
      priceUSD: tokenPrice,
      feesUSD: new BigDecimal(0),
      closePriceUSD: tokenPrice,
      highPriceUSD: tokenPrice,
      lowPriceUSD: tokenPrice,
      openPriceUSD: tokenPrice,
    })
  );

  if (update) {
    tokenHourDataEntity.txCount = tokenHourDataEntity.txCount + 1n;
    tokenHourDataEntity.totalValueLockedNative = token.derivedNative;
    tokenHourDataEntity.totalValueLockedUSD = token.priceUSD;

    // 가격이 0이 아닌 경우에만 OHLC 업데이트
    if (!new BigDecimal(tokenPrice).isZero()) {
      tokenHourDataEntity.priceUSD = tokenPrice;
      tokenHourDataEntity.closePriceUSD = tokenPrice;

      // high: 현재 가격이 더 높으면 업데이트
      tokenHourDataEntity.highPriceUSD = new BigDecimal(tokenHourDataEntity.highPriceUSD).gt(tokenPrice)
        ? tokenHourDataEntity.highPriceUSD
        : tokenPrice;

      // low: 기존 값이 0이거나 현재 가격이 더 낮으면 업데이트
      const currentLow = new BigDecimal(tokenHourDataEntity.lowPriceUSD);
      if (currentLow.isZero() || currentLow.gt(tokenPrice)) {
        tokenHourDataEntity.lowPriceUSD = tokenPrice;
      }

      // open: 기존 값이 0이면 현재 가격으로 설정
      if (new BigDecimal(tokenHourDataEntity.openPriceUSD).isZero()) {
        tokenHourDataEntity.openPriceUSD = tokenPrice;
      }
    }

    context.TokenHourData.set(tokenHourDataEntity);
  }

  return tokenHourDataEntity;
}

export async function loadTokenDayData(
  context: HandlerContext,
  chainId: number,
  timestamp: number,
  token: Awaited<ReturnType<typeof loadToken>>,
  update: boolean
) {
  const SECONDS_IN_DAY = 60 * 60 * 24;
  const dayId = Math.floor(timestamp / SECONDS_IN_DAY);
  const dayStartTimestamp = dayId * SECONDS_IN_DAY;

  const id = getTokenDayDataPk(chainId, token.address, dayId);

  const tokenPrice = token.priceUSD;

  let tokenDayDataEntity = createWritableCopy(
    await context.TokenDayData.getOrCreate({
      id: id,
      chainId: chainId,
      date: dayStartTimestamp,
      token_id: token.id,
      volume: new BigDecimal(0),
      volumeNative: new BigDecimal(0),
      volumeUSD: new BigDecimal(0),
      txCount: 0n,
      totalValueLocked: new BigDecimal(0),
      totalValueLockedNative: new BigDecimal(0),
      totalValueLockedUSD: new BigDecimal(0),
      priceUSD: tokenPrice,
      feesUSD: new BigDecimal(0),
      openPriceUSD: tokenPrice,
      highPriceUSD: tokenPrice,
      lowPriceUSD: tokenPrice,
      closePriceUSD: tokenPrice,
    })
  );

  if (update) {
    tokenDayDataEntity.txCount = tokenDayDataEntity.txCount + 1n;
    tokenDayDataEntity.totalValueLockedNative = token.derivedNative;
    tokenDayDataEntity.totalValueLockedUSD = token.priceUSD;

    // 가격이 0이 아닌 경우에만 OHLC 업데이트
    if (!new BigDecimal(tokenPrice).isZero()) {
      tokenDayDataEntity.priceUSD = tokenPrice;
      tokenDayDataEntity.closePriceUSD = tokenPrice;

      // high: 현재 가격이 더 높으면 업데이트
      tokenDayDataEntity.highPriceUSD = new BigDecimal(tokenDayDataEntity.highPriceUSD).gt(tokenPrice)
        ? tokenDayDataEntity.highPriceUSD
        : tokenPrice;

      // low: 기존 값이 0이거나 현재 가격이 더 낮으면 업데이트
      const currentLow = new BigDecimal(tokenDayDataEntity.lowPriceUSD);
      if (currentLow.isZero() || currentLow.gt(tokenPrice)) {
        tokenDayDataEntity.lowPriceUSD = tokenPrice;
      }

      // open: 기존 값이 0이면 현재 가격으로 설정
      if (new BigDecimal(tokenDayDataEntity.openPriceUSD).isZero()) {
        tokenDayDataEntity.openPriceUSD = tokenPrice;
      }
    }

    context.TokenDayData.set(tokenDayDataEntity);
  }

  return tokenDayDataEntity;
}

export async function loadLBPairHourData(
  context: HandlerContext,
  chainId: number,
  timestamp: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  update: boolean
) {
  const SECONDS_IN_HOUR = 60 * 60;
  const hourId = Math.floor(timestamp / SECONDS_IN_HOUR);
  const hourStartTimestamp = hourId * SECONDS_IN_HOUR;

  const id = getLBPairHourDataPk(chainId, lbPair.id, hourId);

  const lbPairHourDataEntity = createWritableCopy(
    await context.LBPairHourData.getOrCreate({
      chainId: chainId,
      id: id,
      date: hourStartTimestamp,
      lbPair_id: lbPair.id,
      tokenX_id: lbPair.tokenX_id,
      tokenY_id: lbPair.tokenY_id,
      reserveX: lbPair.reserveX,
      reserveY: lbPair.reserveY,
      totalValueLockedUSD: lbPair.totalValueLockedUSD,
      volumeTokenX: new BigDecimal(0),
      volumeTokenY: new BigDecimal(0),
      volumeUSD: new BigDecimal(0),
      untrackedVolumeUSD: new BigDecimal(0),
      txCount: 0n,
      feesUSD: new BigDecimal(0),
    })
  );

  if (update) {
    lbPairHourDataEntity.reserveX = lbPair.reserveX;
    lbPairHourDataEntity.reserveY = lbPair.reserveY;
    lbPairHourDataEntity.totalValueLockedUSD = lbPair.totalValueLockedUSD;
    lbPairHourDataEntity.txCount = lbPairHourDataEntity.txCount + 1n;
    context.LBPairHourData.set({
      ...lbPairHourDataEntity,
    });
  }

  return lbPairHourDataEntity;
}

export async function loadLBPairDayData(
  context: HandlerContext,
  chainId: number,
  timestamp: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  update: boolean
) {
  const SECONDS_IN_DAY = 60 * 60 * 24;
  const dayId = Math.floor(timestamp / SECONDS_IN_DAY);
  const dayStartTimestamp = dayId * SECONDS_IN_DAY;

  const id = getLBPairDayDataPk(chainId, lbPair.id, dayId);

  const lbPairDayDataEntity = createWritableCopy(
    await context.LBPairDayData.getOrCreate({
      chainId: chainId,
      id: id,
      date: dayStartTimestamp,
      lbPair_id: lbPair.id,
      tokenX_id: lbPair.tokenX_id,
      tokenY_id: lbPair.tokenY_id,
      reserveX: lbPair.reserveX,
      reserveY: lbPair.reserveY,
      totalValueLockedUSD: lbPair.totalValueLockedUSD,
      txCount: 0n,
      feesUSD: new BigDecimal(0),
      untrackedVolumeUSD: new BigDecimal(0),
      volumeTokenX: new BigDecimal(0),
      volumeTokenY: new BigDecimal(0),
      volumeUSD: new BigDecimal(0),
    })
  );

  if (update) {
    lbPairDayDataEntity.reserveX = lbPair.reserveX;
    lbPairDayDataEntity.reserveY = lbPair.reserveY;
    lbPairDayDataEntity.totalValueLockedUSD = lbPair.totalValueLockedUSD;
    lbPairDayDataEntity.txCount = lbPairDayDataEntity.txCount + 1n;
    context.LBPairDayData.set(lbPairDayDataEntity);
  }
  return lbPairDayDataEntity;
}
