import { BigDecimal, handlerContext } from 'generated';
import { loadLbPair } from './lbPair';
import { loadUser } from './user';
import { loadBin } from './bin';
import { createWritableCopy } from '../utils/copy';
import { loadUserTokenDayData } from './userStatistic';
import { getUserFeesHourDataPk, getUserFeesPerBinDataPk, getUserBinLiquidityPk } from '../utils/helper';
import { getUserFeesDayDataPk } from '../utils/helper';

export async function loadUserFeesPerBinData(
  context: handlerContext,
  chainId: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  user: Awaited<ReturnType<typeof loadUser>>,
  bin: Awaited<ReturnType<typeof loadBin>>
) {
  const id = getUserFeesPerBinDataPk(chainId, lbPair.id, user.id, bin.binId.toString());

  const userFeesPerBinDataEntity = await context.UserFeesPerBinData.getOrCreate({
    id: id,
    chainId: chainId,
    user_id: user.id,
    lbPair_id: lbPair.id,
    binId: BigInt(bin.binId),
    accruedFeesX: new BigDecimal('0'),
    accruedFeesY: new BigDecimal('0'),
    priceX: bin.priceX,
    priceY: bin.priceY,
    mostRecentDepositTime: 0,
    timestamp: 0,
  });

  return createWritableCopy(userFeesPerBinDataEntity);
}

export async function loadUserFeesHourData(
  context: handlerContext,
  chainId: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  user: Awaited<ReturnType<typeof loadUser>>,
  timestamp: number
) {
  const SECONDS_IN_HOUR = 60 * 60;
  const hourId = Math.floor(timestamp / SECONDS_IN_HOUR);
  const hourStartTimestamp = hourId * SECONDS_IN_HOUR;

  const id = getUserFeesHourDataPk(chainId, lbPair.id, user.id, hourStartTimestamp);

  const userFeesHourDataEntity = await context.UserFeesHourData.getOrCreate({
    id: id,
    chainId: chainId,
    date: hourStartTimestamp,
    user_id: user.id,
    lbPair_id: lbPair.id,
    accruedFeesX: new BigDecimal('0'),
    accruedFeesY: new BigDecimal('0'),
    accruedFeesUSD: new BigDecimal('0'),
  });

  return createWritableCopy(userFeesHourDataEntity);
}

export async function loadUserFeesDayData(
  context: handlerContext,
  chainId: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  user: Awaited<ReturnType<typeof loadUser>>,
  timestamp: number
) {
  const SECONDS_IN_DAY = 60 * 60 * 24;
  const dayId = Math.floor(timestamp / SECONDS_IN_DAY);
  const dayStartTimestamp = dayId * SECONDS_IN_DAY;

  const id = getUserFeesDayDataPk(chainId, lbPair.id, user.id, dayStartTimestamp);

  let userFeesDayDataEntity = await context.UserFeesDayData.getOrCreate({
    id: id,
    chainId: chainId,
    date: dayStartTimestamp,
    user_id: user.id,
    lbPair_id: lbPair.id,
    accruedFeesX: new BigDecimal('0'),
    accruedFeesY: new BigDecimal('0'),
    accruedFeesUSD: new BigDecimal('0'),
  });

  return createWritableCopy(userFeesDayDataEntity);
}

export async function updateUserAccruedFeesDataBothTokens(
  context: handlerContext,
  chainId: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  bin: Awaited<ReturnType<typeof loadBin>>,
  feesX: string,
  feesY: string,
  feeUSD: string,
  protocolSharePct: string,
  timestamp: number
) {
  const totalSupply = new BigDecimal(bin.totalSupply.toString());
  const liquidityProviders = bin.liquidityProviders;

  for (let i = 0; i < liquidityProviders.length; i++) {
    const userId = liquidityProviders[i]!;
    const userBinLiquidityId = getUserBinLiquidityPk(chainId, lbPair.id, userId, bin.binId.toString());

    const userBinLiquidityEntity = await context.UserBinLiquidity.get(userBinLiquidityId);

    if (!userBinLiquidityEntity) {
      continue;
    }

    // user_id is already a PK (chainId:userAddress format), so we get it directly
    const userEntity = await context.User.get(userBinLiquidityEntity.user_id);
    if (!userEntity) {
      continue;
    }

    const userLiquidity = userBinLiquidityEntity.liquidity;
    if (userLiquidity === 0n) {
      continue;
    }

    const providerFeeX = new BigDecimal(userLiquidity.toString())
      .div(totalSupply)
      .times(feesX)
      .times(new BigDecimal(10000).minus(new BigDecimal(protocolSharePct)).div(10000));
    const providerFeeY = new BigDecimal(userLiquidity.toString())
      .div(totalSupply)
      .times(feesY)
      .times(new BigDecimal(10000).minus(new BigDecimal(protocolSharePct)).div(10000));
    const providerFeeUSD = new BigDecimal(userLiquidity.toString())
      .div(totalSupply)
      .times(feeUSD)
      .times(new BigDecimal(10000).minus(new BigDecimal(protocolSharePct)).div(10000));

    let userFeesHourDataEntity = await loadUserFeesHourData(context, chainId, lbPair, userEntity, timestamp);
    let userFeesDayDataEntity = await loadUserFeesDayData(context, chainId, lbPair, userEntity, timestamp);

    userFeesHourDataEntity.accruedFeesX = new BigDecimal(userFeesHourDataEntity.accruedFeesX.toString()).plus(providerFeeX);
    userFeesHourDataEntity.accruedFeesY = new BigDecimal(userFeesHourDataEntity.accruedFeesY.toString()).plus(providerFeeY);
    userFeesHourDataEntity.accruedFeesUSD = new BigDecimal(userFeesHourDataEntity.accruedFeesUSD.toString()).plus(providerFeeUSD);

    userFeesDayDataEntity.accruedFeesX = new BigDecimal(userFeesDayDataEntity.accruedFeesX.toString()).plus(providerFeeX);
    userFeesDayDataEntity.accruedFeesY = new BigDecimal(userFeesDayDataEntity.accruedFeesY.toString()).plus(providerFeeY);
    userFeesDayDataEntity.accruedFeesUSD = new BigDecimal(userFeesDayDataEntity.accruedFeesUSD.toString()).plus(providerFeeUSD);

    context.UserFeesHourData.set(userFeesHourDataEntity);
    context.UserFeesDayData.set(userFeesDayDataEntity);

    let userFeesPerBinDataEntity = await loadUserFeesPerBinData(context, chainId, lbPair, userEntity, bin);
    userFeesPerBinDataEntity.accruedFeesX = new BigDecimal(userFeesPerBinDataEntity.accruedFeesX.toString()).plus(providerFeeX);
    userFeesPerBinDataEntity.accruedFeesY = new BigDecimal(userFeesPerBinDataEntity.accruedFeesY.toString()).plus(providerFeeY);
    userFeesPerBinDataEntity.timestamp = timestamp;
    context.UserFeesPerBinData.set(userFeesPerBinDataEntity);

    // tokenX fees가 있으면 tokenX에 대한 fees 기록
    if (new BigDecimal(providerFeeX.toString()).gt(0)) {
      const providerFeeXUSD = new BigDecimal(providerFeeX.toString()).times(lbPair.tokenXPriceUSD);
      let userTokenXDayDataEntity = await loadUserTokenDayData(context, chainId, userEntity.id, lbPair.tokenX_id, timestamp);
      userTokenXDayDataEntity.feesEarnedUSD = new BigDecimal(userTokenXDayDataEntity.feesEarnedUSD).plus(providerFeeXUSD);
      context.UserTokenDayData.set(userTokenXDayDataEntity);
    }

    // tokenY fees가 있으면 tokenY에 대한 fees 기록
    if (new BigDecimal(providerFeeY.toString()).gt(0)) {
      const providerFeeYUSD = new BigDecimal(providerFeeY.toString()).times(lbPair.tokenYPriceUSD);
      let userTokenYDayDataEntity = await loadUserTokenDayData(context, chainId, userEntity.id, lbPair.tokenY_id, timestamp);
      userTokenYDayDataEntity.feesEarnedUSD = new BigDecimal(userTokenYDayDataEntity.feesEarnedUSD).plus(providerFeeYUSD);
      context.UserTokenDayData.set(userTokenYDayDataEntity);
    }
  }
}
