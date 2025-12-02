import { loadToken } from './token';
import { loadLbPair } from './lbPair';
import { getPriceYOfBin, getPriceYOfBinWithDecimals } from '../utils/pricing';
import { BigDecimal, HandlerContext } from 'generated';
import { createWritableCopy } from '../utils/copy';
import { memoryDecimals } from '../utils/memory';
import { getBinPk } from '../utils/helper';

export async function loadBin(context: HandlerContext, chainId: number, lbPair: Awaited<ReturnType<typeof loadLbPair>>, binId: string) {
  const id = getBinPk(chainId, lbPair.id, binId);
  const binEntity = await context.Bin.get(id);
  if (binEntity) {
    return createWritableCopy(binEntity);
  }

  const priceY = new BigDecimal(
    getPriceYOfBinWithDecimals(
      binId,
      lbPair.binStep.toString(),
      memoryDecimals.get(lbPair.tokenX_id) || 18,
      memoryDecimals.get(lbPair.tokenY_id) || 18
    )
  );

  const newBinEntity = {
    id: id,
    chainId,
    lbPair_id: lbPair.id,
    binId: Number(binId),
    reserveX: new BigDecimal(0),
    reserveY: new BigDecimal(0),
    totalSupply: 0n,
    priceY: priceY,
    priceX: new BigDecimal(1).div(priceY),
    liquidityProviders: [],
    liquidityProviderCount: 0n,
  };

  context.Bin.set(newBinEntity);
  return newBinEntity;
}

export async function trackBin(
  context: HandlerContext,
  chainId: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  binId: string,
  amountXIn: string,
  amountXOut: string,
  amountYIn: string,
  amountYOut: string,
  minted: string,
  burned: string
) {
  const binEntity = await loadBin(context, chainId, lbPair, binId);

  const newBinEntity = {
    ...binEntity,
    totalSupply: binEntity.totalSupply + BigInt(minted) - BigInt(burned),
    reserveX: new BigDecimal(binEntity.reserveX.toString()).plus(amountXIn).minus(amountXOut),
    reserveY: new BigDecimal(binEntity.reserveY.toString()).plus(amountYIn).minus(amountYOut),
  };

  context.Bin.set(newBinEntity);
  return newBinEntity;
}
