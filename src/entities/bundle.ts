import { BigDecimal, handlerContext } from 'generated';
import { getNativePriceInUSD } from '../effect/oracle';
import { getBundlePk } from '../utils/helper';

export async function loadBundle(context: handlerContext, chainId: number) {
  const bundlePk = getBundlePk(chainId);
  let bundleEntity = await context.Bundle.get(bundlePk);
  if (bundleEntity) {
    return bundleEntity;
  }

  try {
    const nativePrice = await context.effect(getNativePriceInUSD, { chainId, blockNumber: 0 });
    bundleEntity = {
      id: bundlePk,
      chainId,
      nativePriceUSD: new BigDecimal(nativePrice.nativePrice),
      lastUpdatedBlock: 0,
      lastUpdatedTimestamp: 0,
    };
    context.Bundle.set(bundleEntity);
    return bundleEntity;
  } catch (error) {
    context.log.error('Failed to load bundle', { error });
    throw error;
  }
}
