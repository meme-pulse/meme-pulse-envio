import { BigDecimal, LBPair } from 'generated';
import { loadLbPair, loadLbPairOrNull } from './entities/lbPair';
import {
  decodeAmounts,
  formatTokenAmountByDecimals,
  getTrackedLiquidityUSD,
  getTrackedVolumeUSD,
  updateNativeInUsdPricing,
  updateTokensPriceUSD,
} from './utils/pricing';
import { loadLBFactory } from './entities/lbFactory';
import { loadToken } from './entities/token';
import { loadBin, trackBin } from './entities/bin';
import { zeroAddress } from 'viem';
import {
  loadLBPairDayData,
  loadLBPairHourData,
  loadTokenDayData,
  loadTokenHourData,
  loadMemePulseDayData,
  loadMemePulseHourData,
} from './entities/intervalData';
import { addLiquidityPosition, removeLiquidityPosition } from './entities/liquidityPositions';
import { updateUserAccruedFeesDataBothTokens } from './entities/userFeesData';
import { getLBPairParameterSetPk, getAddressFromPk } from './utils/helper';

LBPair.Swap.handler(async ({ event, context }) => {
  const lbPairEntity = await loadLbPair(context, event.chainId, event.srcAddress);
  await updateNativeInUsdPricing(context, event.chainId, event.block.number, event.block.timestamp);
  await updateTokensPriceUSD(context, event.chainId, lbPairEntity, event.params.id.toString());

  const [tokenX, tokenY] = await Promise.all([
    loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenX_id)),
    loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenY_id)),
  ]);
  const tokenIn = tokenX;
  const tokenOut = tokenY;
  const [amountXIn, amountYIn] = decodeAmounts(event.params.amountsIn);
  const fmtAmountXIn = formatTokenAmountByDecimals(amountXIn.toString(), tokenIn.decimals.toString());
  const fmtAmountYIn = formatTokenAmountByDecimals(amountYIn.toString(), tokenOut.decimals.toString());
  const [amountXOut, amountYOut] = decodeAmounts(event.params.amountsOut);
  const fmtAmountXOut = formatTokenAmountByDecimals(amountXOut.toString(), tokenIn.decimals.toString());
  const fmtAmountYOut = formatTokenAmountByDecimals(amountYOut.toString(), tokenOut.decimals.toString());
  const totalFees = decodeAmounts(event.params.totalFees);
  const totalFeesX = formatTokenAmountByDecimals(totalFees[0].toString(), tokenIn.decimals.toString());
  const totalFeesY = formatTokenAmountByDecimals(totalFees[1].toString(), tokenOut.decimals.toString());
  const feesUSD = new BigDecimal(totalFeesX)
    .multipliedBy(tokenIn.priceUSD)
    .plus(new BigDecimal(totalFeesY).multipliedBy(tokenOut.priceUSD));

  const amountXTotal = new BigDecimal(fmtAmountXIn).plus(new BigDecimal(fmtAmountXOut));
  const amountYTotal = new BigDecimal(fmtAmountYIn).plus(new BigDecimal(fmtAmountYOut));

  const trackedVolumeUSD = getTrackedVolumeUSD(amountXTotal.toString(), tokenIn, amountYTotal.toString(), tokenOut);

  const binEntity = await trackBin(
    context,
    event.chainId,
    lbPairEntity,
    event.params.id.toString(),
    fmtAmountXIn,
    fmtAmountXOut,
    fmtAmountYIn,
    fmtAmountYOut,
    '0',
    '0'
  );

  lbPairEntity.activeId = event.params.id;
  lbPairEntity.txCount = lbPairEntity.txCount + 1n;
  lbPairEntity.reserveX = new BigDecimal(lbPairEntity.reserveX.toString()).plus(fmtAmountXIn).minus(fmtAmountXOut);
  lbPairEntity.reserveY = new BigDecimal(lbPairEntity.reserveY.toString()).plus(fmtAmountYIn).minus(fmtAmountYOut);
  const oldTotalValueLockedUSD = lbPairEntity.totalValueLockedUSD;
  lbPairEntity.totalValueLockedUSD = lbPairEntity.reserveX
    .times(lbPairEntity.tokenXPriceUSD)
    .plus(lbPairEntity.reserveY.times(lbPairEntity.tokenYPriceUSD));
  lbPairEntity.tokenXPrice = binEntity.priceX;
  lbPairEntity.tokenYPrice = binEntity.priceY;
  lbPairEntity.volumeTokenX = new BigDecimal(lbPairEntity.volumeTokenX.toString()).plus(amountXTotal);
  lbPairEntity.volumeTokenY = new BigDecimal(lbPairEntity.volumeTokenY.toString()).plus(amountYTotal);
  lbPairEntity.volumeUSD = new BigDecimal(lbPairEntity.volumeUSD.toString()).plus(trackedVolumeUSD);
  lbPairEntity.feesTokenX = new BigDecimal(lbPairEntity.feesTokenX.toString()).plus(totalFeesX);
  lbPairEntity.feesTokenY = new BigDecimal(lbPairEntity.feesTokenY.toString()).plus(totalFeesY);
  lbPairEntity.feesUSD = new BigDecimal(lbPairEntity.feesUSD.toString()).plus(feesUSD);
  lbPairEntity.tokenXPriceUSD = tokenX.priceUSD;
  lbPairEntity.tokenYPriceUSD = tokenY.priceUSD;

  context.LBPair.set(lbPairEntity);

  const [lbPairFeeParams, lbPairHourDataEntity, lbPairDayDataEntity, lbFactory, memePulseHourData, memePulseDayData] = await Promise.all([
    context.LBPairParameterSet.getOrThrow(getLBPairParameterSetPk(event.chainId, event.srcAddress), 'LBPairParameterSet not found'),
    loadLBPairHourData(context, event.chainId, event.block.timestamp, lbPairEntity, true),
    loadLBPairDayData(context, event.chainId, event.block.timestamp, lbPairEntity, true),
    loadLBFactory(context, event.chainId),
    loadMemePulseHourData(context, event.chainId, event.block.timestamp, true),
    loadMemePulseDayData(context, event.chainId, event.block.timestamp, true),
  ]);

  // const lbPairHourDataEntity = await loadLBPairHourData(context, event.block.timestamp, lbPairEntity, true);
  lbPairHourDataEntity.volumeTokenX = new BigDecimal(lbPairHourDataEntity.volumeTokenX).plus(amountXTotal);
  lbPairHourDataEntity.volumeTokenY = new BigDecimal(lbPairHourDataEntity.volumeTokenY).plus(amountYTotal);
  lbPairHourDataEntity.volumeUSD = new BigDecimal(lbPairHourDataEntity.volumeUSD).plus(trackedVolumeUSD);
  lbPairHourDataEntity.feesUSD = new BigDecimal(lbPairHourDataEntity.feesUSD).plus(feesUSD);
  context.LBPairHourData.set(lbPairHourDataEntity);

  // const lbPairDayDataEntity = await loadLBPairDayData(context, event.block.timestamp, lbPairEntity, true);
  lbPairDayDataEntity.volumeTokenX = new BigDecimal(lbPairDayDataEntity.volumeTokenX).plus(amountXTotal);
  lbPairDayDataEntity.volumeTokenY = new BigDecimal(lbPairDayDataEntity.volumeTokenY).plus(amountYTotal);
  lbPairDayDataEntity.volumeUSD = new BigDecimal(lbPairDayDataEntity.volumeUSD).plus(trackedVolumeUSD);
  lbPairDayDataEntity.feesUSD = new BigDecimal(lbPairDayDataEntity.feesUSD).plus(feesUSD);
  context.LBPairDayData.set(lbPairDayDataEntity);

  // const lbFactory = await loadLBFactory(context);
  lbFactory.volumeUSD = new BigDecimal(lbFactory.volumeUSD).plus(trackedVolumeUSD);
  lbFactory.totalValueLockedUSD = lbFactory.totalValueLockedUSD.minus(oldTotalValueLockedUSD).plus(lbPairEntity.totalValueLockedUSD);
  context.LBFactory.set(lbFactory);

  // MemePulse DEX Hour/Day Data
  memePulseHourData.volumeUSD = new BigDecimal(memePulseHourData.volumeUSD).plus(trackedVolumeUSD);
  memePulseHourData.feesUSD = new BigDecimal(memePulseHourData.feesUSD).plus(feesUSD);
  context.LBHourData.set(memePulseHourData);

  memePulseDayData.volumeUSD = new BigDecimal(memePulseDayData.volumeUSD).plus(trackedVolumeUSD);
  memePulseDayData.feesUSD = new BigDecimal(memePulseDayData.feesUSD).plus(feesUSD);
  context.LBDayData.set(memePulseDayData);

  await updateUserAccruedFeesDataBothTokens(
    context,
    event.chainId,
    lbPairEntity,
    binEntity,
    totalFeesX,
    totalFeesY,
    feesUSD.toString(),
    lbPairFeeParams.protocolShare.toString(),
    event.block.timestamp
  );
});

LBPair.CompositionFees.handler(async ({ event, context }) => {
  const lbPairEntity = await loadLbPair(context, event.chainId, event.srcAddress);

  const tokenX = await loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenX_id));
  const tokenY = await loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenY_id));
  const tokenIn = tokenX;
  const tokenOut = tokenY;
  const totalFees = decodeAmounts(event.params.totalFees);
  const totalFeesX = formatTokenAmountByDecimals(totalFees[0].toString(), tokenIn.decimals.toString());
  const totalFeesY = formatTokenAmountByDecimals(totalFees[1].toString(), tokenOut.decimals.toString());
  const feesUSD = new BigDecimal(totalFeesX)
    .multipliedBy(tokenIn.priceUSD)
    .plus(new BigDecimal(totalFeesY).multipliedBy(tokenOut.priceUSD));

  const binEntity = await trackBin(context, event.chainId, lbPairEntity, event.params.id.toString(), '0', '0', '0', '0', '0', '0');
  const lbPairFeeParamsPk = getLBPairParameterSetPk(event.chainId, event.srcAddress);
  const lbPairFeeParams = await context.LBPairParameterSet.getOrThrow(lbPairFeeParamsPk, 'LBPairParameterSet not found');

  await updateUserAccruedFeesDataBothTokens(
    context,
    event.chainId,
    lbPairEntity,
    binEntity,
    totalFeesX,
    totalFeesY,
    feesUSD.toString(),
    lbPairFeeParams.protocolShare.toString(),
    event.block.timestamp
  );
});
LBPair.DepositedToBins.handler(async ({ event, context }) => {
  const lbPairEntity = await loadLbPair(context, event.chainId, event.srcAddress);
  const lbFactoryEntity = await loadLBFactory(context, event.chainId);
  await updateNativeInUsdPricing(context, event.chainId, event.block.number, event.block.timestamp);
  await updateTokensPriceUSD(context, event.chainId, lbPairEntity);

  const tokenX = await loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenX_id));
  const tokenY = await loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenY_id));

  let totalAmountX = new BigDecimal(0);
  let totalAmountY = new BigDecimal(0);

  for (let i = 0; i < event.params.ids.length; i++) {
    const bidId = event.params.ids[i];

    const amounts = decodeAmounts(event.params.amounts[i]);
    const amountX = formatTokenAmountByDecimals(amounts[0], tokenX.decimals.toString());
    const amountY = formatTokenAmountByDecimals(amounts[1], tokenY.decimals.toString());

    totalAmountX = totalAmountX.plus(amountX);
    totalAmountY = totalAmountY.plus(amountY);

    await trackBin(
      context,
      event.chainId,
      lbPairEntity,
      bidId.toString(),
      amountX, // amountXIn
      '0',
      amountY, // amountYIn
      '0',
      '0',
      '0'
    );
  }

  lbFactoryEntity.totalValueLockedUSD = lbFactoryEntity.totalValueLockedUSD.minus(lbPairEntity.totalValueLockedUSD);

  lbPairEntity.txCount = lbPairEntity.txCount + 1n;
  lbPairEntity.reserveX = new BigDecimal(lbPairEntity.reserveX).plus(totalAmountX);
  lbPairEntity.reserveY = new BigDecimal(lbPairEntity.reserveY).plus(totalAmountY);
  lbPairEntity.totalValueLockedUSD = lbPairEntity.reserveX
    .times(lbPairEntity.tokenXPriceUSD)
    .plus(lbPairEntity.reserveY.times(lbPairEntity.tokenYPriceUSD));
  // liquidityProviderCount는 TransferBatch 핸들러의 addLiquidityPosition에서 관리
  context.LBPair.set(lbPairEntity);

  lbFactoryEntity.totalValueLockedUSD = lbFactoryEntity.totalValueLockedUSD.plus(lbPairEntity.totalValueLockedUSD);
  context.LBFactory.set(lbFactoryEntity);

  await loadLBPairHourData(context, event.chainId, event.block.timestamp, lbPairEntity, true);
  await loadLBPairDayData(context, event.chainId, event.block.timestamp, lbPairEntity, true);
  await loadMemePulseHourData(context, event.chainId, event.block.timestamp, true);
  await loadMemePulseDayData(context, event.chainId, event.block.timestamp, true);

  await loadTokenHourData(context, event.chainId, event.block.timestamp, tokenX, true);
  await loadTokenDayData(context, event.chainId, event.block.timestamp, tokenX, true);
  await loadTokenDayData(context, event.chainId, event.block.timestamp, tokenY, true);
});

LBPair.WithdrawnFromBins.handler(async ({ event, context }) => {
  let lbPairEntity = await loadLbPair(context, event.chainId, event.srcAddress);
  let lbFactoryEntity = await loadLBFactory(context, event.chainId);

  await updateNativeInUsdPricing(context, event.chainId, event.block.number, event.block.timestamp);

  const tokenX = await loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenX_id));
  const tokenY = await loadToken(context, event.chainId, getAddressFromPk(lbPairEntity.tokenY_id));

  let totalAmountX = new BigDecimal(0);
  let totalAmountY = new BigDecimal(0);
  for (let i = 0; i < event.params.ids.length; i++) {
    const bidId = event.params.ids[i];

    const amounts = decodeAmounts(event.params.amounts[i]);
    const amountX = formatTokenAmountByDecimals(amounts[0], tokenX.decimals.toString());
    const amountY = formatTokenAmountByDecimals(amounts[1], tokenY.decimals.toString());

    totalAmountX = totalAmountX.plus(amountX);
    totalAmountY = totalAmountY.plus(amountY);

    await trackBin(context, event.chainId, lbPairEntity, bidId.toString(), '0', amountX, '0', amountY, '0', '0');
  }

  lbFactoryEntity.totalValueLockedUSD = lbFactoryEntity.totalValueLockedUSD.minus(lbPairEntity.totalValueLockedUSD);

  // LBPair
  lbPairEntity.txCount = lbPairEntity.txCount + 1n;
  lbPairEntity.reserveX = new BigDecimal(lbPairEntity.reserveX).minus(totalAmountX);
  lbPairEntity.reserveY = new BigDecimal(lbPairEntity.reserveY).minus(totalAmountY);

  lbPairEntity.totalValueLockedUSD = lbPairEntity.reserveX
    .times(lbPairEntity.tokenXPriceUSD)
    .plus(lbPairEntity.reserveY.times(lbPairEntity.tokenYPriceUSD));

  context.LBPair.set(lbPairEntity);

  // LBFactory
  lbFactoryEntity.totalValueLockedUSD = lbFactoryEntity.totalValueLockedUSD.plus(lbPairEntity.totalValueLockedUSD);
  context.LBFactory.set(lbFactoryEntity);

  await loadLBPairHourData(context, event.chainId, event.block.timestamp, lbPairEntity, true);
  await loadLBPairDayData(context, event.chainId, event.block.timestamp, lbPairEntity, true);
  await loadMemePulseHourData(context, event.chainId, event.block.timestamp, true);
  await loadMemePulseDayData(context, event.chainId, event.block.timestamp, true);

  await loadTokenHourData(context, event.chainId, event.block.timestamp, tokenX, true);
  await loadTokenDayData(context, event.chainId, event.block.timestamp, tokenX, true);
  await loadTokenDayData(context, event.chainId, event.block.timestamp, tokenY, true);
});

LBPair.CollectedProtocolFees.handler(async ({ event, context }) => {
  let lbPairEntity = await loadLbPair(context, event.chainId, event.srcAddress);

  await updateNativeInUsdPricing(context, event.chainId, event.block.number, event.block.timestamp);
});

LBPair.TransferBatch.handler(async ({ event, context }) => {
  let lbPairEntity = await loadLbPair(context, event.chainId, event.srcAddress);

  lbPairEntity.txCount = lbPairEntity.txCount + 1n;
  context.LBPair.set(lbPairEntity);

  await loadMemePulseHourData(context, event.chainId, event.block.timestamp, true);
  await loadMemePulseDayData(context, event.chainId, event.block.timestamp, true);
  await loadLBPairHourData(context, event.chainId, event.block.timestamp, lbPairEntity, true);
  await loadLBPairDayData(context, event.chainId, event.block.timestamp, lbPairEntity, true);

  // const transaction = await loadTransaction(context, event);

  for (let i = 0; i < event.params.amounts.length; i++) {
    await removeLiquidityPosition(
      context,
      event.chainId,
      event.srcAddress,
      event.params.from,
      event.params.ids[i]!.toString(),
      event.params.amounts[i]!.toString(),
      event.block
    );

    await addLiquidityPosition(
      context,
      event.chainId,
      event.srcAddress,
      event.params.to,
      event.params.ids[i]!.toString(),
      event.params.amounts[i]!.toString(),
      event.block
    );
    const isMint = event.params.from === zeroAddress;
    const isBurn = event.params.to === zeroAddress;

    // mint: increase bin totalSupply
    if (isMint) {
      await trackBin(
        context,
        event.chainId,
        lbPairEntity,
        event.params.ids[i]!.toString(),
        '0',
        '0',
        '0',
        '0',
        event.params.amounts[i]!.toString(), // minted
        '0'
      );
    }

    // burn: decrease bin totalSupply
    if (isBurn) {
      await trackBin(
        context,
        event.chainId,
        lbPairEntity,
        event.params.ids[i]!.toString(),
        '0',
        '0',
        '0',
        '0',
        '0',
        event.params.amounts[i]!.toString() // burned
      );
    }
  }
});

LBPair.StaticFeeParametersSet.handler(async ({ event, context }) => {
  const lbPairEntity = await loadLbPairOrNull(context, event.chainId, event.srcAddress);

  // Skip if LBPair doesn't exist yet (happens when event is in same block as LBPairCreated)
  // LBPairCreated handler already sets baseFeePct from metadata
  if (!lbPairEntity) {
    return;
  }

  const baseFee = new BigDecimal(lbPairEntity.binStep.toString())
    .multipliedBy(new BigDecimal(event.params.baseFactor.toString()))
    .div(new BigDecimal(1e6));
  context.LBPair.set({
    ...lbPairEntity,
    baseFeePct: baseFee,
  });
  const lbPairFeeParamsPk = getLBPairParameterSetPk(event.chainId, event.srcAddress);
  context.LBPairParameterSet.set({
    id: lbPairFeeParamsPk,
    address: event.srcAddress,
    chainId: event.chainId,
    sender: event.params.sender,
    lbPair_id: lbPairEntity.id,
    baseFactor: Number(event.params.baseFactor.toString()),
    filterPeriod: Number(event.params.filterPeriod.toString()),
    decayPeriod: Number(event.params.decayPeriod.toString()),
    reductionFactor: Number(event.params.reductionFactor.toString()),
    variableFeeControl: Number(event.params.variableFeeControl),
    protocolShare: Number(event.params.protocolShare),
    protocolSharePct: Number(event.params.protocolShare),
    maxVolatilityAccumulator: Number(event.params.maxVolatilityAccumulator),
  });
});
