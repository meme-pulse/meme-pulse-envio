import { Block_t, handlerContext } from 'generated';
import { loadLbPair } from './lbPair';
import { loadUser } from './user';
import { createWritableCopy } from '../utils/copy';
import { getBinPk, getUserBinLiquidityPk } from '../utils/helper';

export async function getUserBinLiquidity(
  context: handlerContext,
  chainId: number,
  liquidityPositionsId: string,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  user: Awaited<ReturnType<typeof loadUser>>,
  binId: string,
  block: Block_t
) {
  const id = getUserBinLiquidityPk(chainId, lbPair.id, user.id, binId);
  const lbPairBinId = getBinPk(chainId, lbPair.id, binId);

  const userBinLiquidityEntity = await context.UserBinLiquidity.getOrCreate({
    id: id,
    chainId: chainId,
    lbPair_id: lbPair.id,
    user_id: user.id,
    binId: BigInt(binId),
    lbPairBinId_id: lbPairBinId,
    liquidityPosition_id: liquidityPositionsId,
    liquidity: 0n,
    block: block.number,
    timestamp: block.timestamp,
  });

  return createWritableCopy(userBinLiquidityEntity);
}

export async function removeUserBinLiquidity(context: handlerContext, chainId: number, id: string) {
  context.UserBinLiquidity.deleteUnsafe(id);
}
