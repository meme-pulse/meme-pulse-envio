import { BigDecimal, handlerContext } from 'generated';
import { createWritableCopy } from '../utils/copy';
import { getUserTokenDayDataPk } from '../utils/helper';

export async function loadUserTokenDayData(context: handlerContext, chainId: number, userId: string, tokenId: string, timestamp: number) {
  const SECONDS_IN_DAY = 60 * 60 * 24;
  const dayId = Math.floor(timestamp / SECONDS_IN_DAY);
  const dayStartTimestamp = dayId * SECONDS_IN_DAY;

  const id = getUserTokenDayDataPk(chainId, userId, tokenId, dayId);

  let tokenDayDataEntity = await context.UserTokenDayData.getOrCreate({
    id: id,
    chainId: chainId,
    timestamp: dayStartTimestamp,
    user_id: userId,
    token_id: tokenId,
    volumeUSD: new BigDecimal('0'),
    feesEarnedUSD: new BigDecimal('0'),
    feesPaidUSD: new BigDecimal('0'),
  });

  return createWritableCopy(tokenDayDataEntity);
}
