import { loadLbPair, loadLbPairOrNull } from './lbPair';
import { loadUser } from './user';
import { Address, zeroAddress } from 'viem';
import { loadBin } from './bin';
import { getUserBinLiquidity, removeUserBinLiquidity } from './userBinLiquidity';
import { BigDecimal, Block_t, handlerContext } from 'generated';
import { createWritableCopy } from '../utils/copy';
import { getUserFeesPerBinDataPk, getUserLiquidityPositionPk } from '../utils/helper';

export async function getLiquidityPosition(
  context: handlerContext,
  chainId: number,
  lbPair: Awaited<ReturnType<typeof loadLbPair>>,
  user: Awaited<ReturnType<typeof loadUser>>,
  block: Block_t
) {
  const id = getUserLiquidityPositionPk(chainId, lbPair.id, user.id);
  const liquidityPositionEntity = await context.LiquidityPosition.get(id);
  if (liquidityPositionEntity) {
    return createWritableCopy(liquidityPositionEntity);
  }

  const newLiquidityPositionEntity = {
    id,
    chainId: chainId,
    user_id: user.id,
    lbPair_id: lbPair.id,
    binsCount: 0n,
    block: block.number,
    timestamp: block.timestamp,
  };
  context.LiquidityPosition.set(newLiquidityPositionEntity);

  return newLiquidityPositionEntity;
}

export async function addLiquidityPosition(
  context: handlerContext,
  chainId: number,
  lbPairAddr: string,
  userAddr: string,
  binId: string,
  liquidity: string,
  block: Block_t
) {
  if (new BigDecimal(liquidity).lte(1e18)) {
    return null;
  }

  // skip if 'userAddr' is zero address (mint transaction)
  if (userAddr === zeroAddress) {
    return null;
  }

  // skip if 'userAddr' is an LBPair address
  const tryLBPair = await loadLbPairOrNull(context, chainId, userAddr);

  if (tryLBPair) {
    return null;
  }

  const lbPairEntity = await loadLbPairOrNull(context, chainId, lbPairAddr);

  if (!lbPairEntity) {
    return null;
  }

  const userEntity = await loadUser(context, chainId, userAddr);

  const binEntity = await loadBin(context, chainId, lbPairEntity, binId);

  let liquidityPositionEntity = await getLiquidityPosition(context, chainId, lbPairEntity, userEntity, block);

  let userBinLiquidityEntity = await getUserBinLiquidity(
    context,
    chainId,
    liquidityPositionEntity.id,
    lbPairEntity,
    userEntity,
    binId,
    block
  );

  if (userBinLiquidityEntity.liquidity === 0n) {
    // add user to list of bin's liquidity providers
    let liquidityProviders = binEntity.liquidityProviders;
    liquidityProviders.push(userEntity.id);
    binEntity.liquidityProviders = liquidityProviders;
    binEntity.liquidityProviderCount = binEntity.liquidityProviderCount + 1n;
    context.Bin.set(binEntity);

    // increase count of bins user has liquidity
    liquidityPositionEntity.binsCount = liquidityPositionEntity.binsCount + 1n;

    // increase LBPair liquidityProviderCount if user now has one bin with liquidity
    if (liquidityPositionEntity.binsCount === 1n) {
      lbPairEntity.liquidityProviderCount = lbPairEntity.liquidityProviderCount + 1n;
      context.LBPair.set(lbPairEntity);
    }
  }

  // update liquidity
  userBinLiquidityEntity.liquidity = userBinLiquidityEntity.liquidity + BigInt(liquidity);

  // update block and timestamp
  liquidityPositionEntity.block = block.number;
  liquidityPositionEntity.timestamp = block.timestamp;
  context.LiquidityPosition.set(liquidityPositionEntity);
  userBinLiquidityEntity.block = block.number;
  userBinLiquidityEntity.timestamp = block.timestamp;
  context.UserBinLiquidity.set(userBinLiquidityEntity);

  return liquidityPositionEntity;
}

export async function removeLiquidityPosition(
  context: handlerContext,
  chainId: number,
  lbPairAddr: string,
  userAddr: string,
  binId: string,
  liquidity: string,
  block: Block_t
) {
  // skip if 'userAddr' is zero address (burn transaction)
  if (userAddr === zeroAddress) {
    return null;
  }

  // skip if 'userAddr' is an LBPair address
  const tryLBPair = await loadLbPairOrNull(context, chainId, userAddr);

  if (tryLBPair) {
    return null;
  }

  const lbPairEntity = await loadLbPairOrNull(context, chainId, lbPairAddr);

  if (!lbPairEntity) {
    return null;
  }

  const userEntity = await loadUser(context, chainId, userAddr);

  const binEntity = await loadBin(context, chainId, lbPairEntity, binId);

  let liquidityPositionEntity = await getLiquidityPosition(context, chainId, lbPairEntity, userEntity, block);

  let userBinLiquidityEntity = await getUserBinLiquidity(
    context,
    chainId,
    liquidityPositionEntity.id,
    lbPairEntity,
    userEntity,
    binId,
    block
  );

  // update liquidity
  userBinLiquidityEntity.liquidity = userBinLiquidityEntity.liquidity - BigInt(liquidity);

  if (userBinLiquidityEntity.liquidity <= 1e18) {
    userBinLiquidityEntity.liquidity = 0n;

    // remove user from list of bin's liquidity providers
    let liquidityProviders = binEntity.liquidityProviders;
    let idxToRemove = liquidityProviders.indexOf(userEntity.id);
    if (idxToRemove > -1) {
      liquidityProviders.splice(idxToRemove, 1);
      binEntity.liquidityProviders = liquidityProviders;
      binEntity.liquidityProviderCount = binEntity.liquidityProviderCount - 1n;
      context.Bin.set(binEntity);
    }

    // decrease count of bins with user's liquidityPosition
    liquidityPositionEntity.binsCount = liquidityPositionEntity.binsCount - 1n;

    // decrease LBPair liquidityProviderCount if user no longer has bins with liquidity
    if (liquidityPositionEntity.binsCount === 0n) {
      lbPairEntity.liquidityProviderCount = lbPairEntity.liquidityProviderCount - 1n;
      context.LBPair.set(lbPairEntity);
    }
  }

  // update block and timestamp
  liquidityPositionEntity.block = block.number;
  liquidityPositionEntity.timestamp = block.timestamp;
  context.LiquidityPosition.set(liquidityPositionEntity);

  if (userBinLiquidityEntity.liquidity === 0n) {
    await removeUserBinLiquidity(context, chainId, userBinLiquidityEntity.id);
  } else {
    userBinLiquidityEntity.block = block.number;
    userBinLiquidityEntity.timestamp = block.timestamp;
    context.UserBinLiquidity.set(userBinLiquidityEntity);
  }

  // reset when removing liquidity
  const userFeesPerBinDataId = getUserFeesPerBinDataPk(chainId, lbPairEntity.id, userEntity.id, binId);

  context.UserFeesPerBinData.deleteUnsafe(userFeesPerBinDataId);

  return liquidityPositionEntity;
}
