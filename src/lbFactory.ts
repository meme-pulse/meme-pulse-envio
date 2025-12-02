import { BigDecimal, LBFactory } from 'generated';
import { getTokenMetadata } from './effect/token';
import { loadToken } from './entities/token';
import { updateNativeInUsdPricing } from './utils/pricing';
import { loadLBFactory } from './entities/lbFactory';
import { getLBPairMetadata } from './effect/lbPair';
import { getFactoryPk, getLbPairPk, getTokenPk } from './utils/helper';

LBFactory.QuoteAssetAdded.handler(async ({ event, context }) => {
  await loadToken(context, event.chainId, event.params.token);
});

LBFactory.FlashLoanFeeSet.handler(async ({ event, context }) => {
  const lbFactoryEntity = await loadLBFactory(context, event.chainId);
});

LBFactory.FeeRecipientSet.handler(async ({ event, context }) => {
  const lbFactoryEntity = await loadLBFactory(context, event.chainId);
  context.LBFactory.set({
    ...lbFactoryEntity,
    feeRecipient: event.params.newRecipient,
  });
});
LBFactory.LBPairCreated.contractRegister(async ({ event, context }) => {
  context.addLBPair(event.params.LBPair);
});

LBFactory.LBPairCreated.handler(async ({ event, context }) => {
  await updateNativeInUsdPricing(context, event.chainId, event.block.number, event.block.timestamp);
  const lbFactoryEntity = await loadLBFactory(context, event.chainId);

  context.LBFactory.set({
    ...lbFactoryEntity,
    pairCount: lbFactoryEntity.pairCount + 1n,
  });

  const tokenXAddress = event.params.tokenX;
  const tokenYAddress = event.params.tokenY;
  const binStep = event.params.binStep;
  const lbPairAddress = event.params.LBPair;

  const tokenX = await loadToken(context, event.chainId, tokenXAddress);
  const tokenY = await loadToken(context, event.chainId, tokenYAddress);

  const lbPairMetadata = await context.effect(getLBPairMetadata, {
    lbPairAddress,
    chainId: event.chainId,
  });

  const baseFactor = lbPairMetadata.baseFactor;
  const activeId = lbPairMetadata.activeId;

  const lbPairPk = getLbPairPk(event.chainId, lbPairAddress);
  const lbFactoryPk = getFactoryPk(event.chainId, event.srcAddress);
  const tokenXPk = getTokenPk(event.chainId, tokenXAddress);
  const tokenYPk = getTokenPk(event.chainId, tokenYAddress);
  context.LBPair.set({
    id: lbPairPk,
    address: lbPairAddress,
    chainId: event.chainId,
    factory_id: lbFactoryPk,
    name: tokenX.symbol.concat('-').concat(tokenY.symbol).concat('-').concat(binStep.toString()),
    tokenX_id: tokenXPk,
    tokenY_id: tokenYPk,
    binStep: binStep,
    activeId: activeId,
    baseFeePct: new BigDecimal(binStep.toString()).multipliedBy(new BigDecimal(baseFactor.toString())).div(new BigDecimal(1e6)),
    reserveX: new BigDecimal(0),
    reserveY: new BigDecimal(0),
    totalValueLockedUSD: new BigDecimal(0),
    tokenXPrice: new BigDecimal(0),
    tokenYPrice: new BigDecimal(0),
    tokenXPriceUSD: tokenX.priceUSD,
    tokenYPriceUSD: tokenY.priceUSD,
    volumeTokenX: new BigDecimal(0),
    volumeTokenY: new BigDecimal(0),
    volumeUSD: new BigDecimal(0),
    txCount: 0n,
    feesTokenX: new BigDecimal(0),
    feesTokenY: new BigDecimal(0),
    feesUSD: new BigDecimal(0),
    liquidityProviderCount: 0n,
    block: event.block.number,
    timestamp: event.block.timestamp,
  });
});
