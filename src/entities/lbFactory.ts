import { BigDecimal, HandlerContext } from 'generated';
import { zeroAddress } from 'viem';
import { createWritableCopy } from '../utils/copy';
import { LB_FACTORY_ADDRESS } from '../utils/constants';
import { getFactoryPk } from '../utils/helper';

export async function loadLBFactory(context: HandlerContext, chainId: number) {
  const lbFactoryPk = getFactoryPk(chainId, LB_FACTORY_ADDRESS[chainId]);
  const lbFactoryEntity = await context.LBFactory.get(lbFactoryPk);
  if (lbFactoryEntity) {
    return createWritableCopy(lbFactoryEntity);
  }

  const feeRecipient = zeroAddress as `0x${string}`;
  const newLbFactoryEntity = {
    id: lbFactoryPk,
    address: LB_FACTORY_ADDRESS[chainId],
    chainId: chainId,
    feeRecipient,
    pairCount: BigInt(0),
    volumeUSD: new BigDecimal(0),
    totalValueLockedUSD: new BigDecimal(0),
  };

  context.LBFactory.set(newLbFactoryEntity);

  return newLbFactoryEntity;
}
