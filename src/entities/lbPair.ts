import { handlerContext } from 'generated';
import { createWritableCopy } from '../utils/copy';
import { getLbPairPk } from '../utils/helper';
export async function loadLbPair(context: handlerContext, chainId: number, id: string) {
  const lbPairPk = getLbPairPk(chainId, id);
  const lbPairEntity = await context.LBPair.getOrThrow(lbPairPk, 'LBPair not found');
  return createWritableCopy(lbPairEntity);
}

export async function loadLbPairOrNull(context: handlerContext, chainId: number, id: string) {
  const lbPairPk = getLbPairPk(chainId, id);
  const lbPairEntity = await context.LBPair.get(lbPairPk);
  if (!lbPairEntity) {
    return null;
  }
  return createWritableCopy(lbPairEntity);
}
