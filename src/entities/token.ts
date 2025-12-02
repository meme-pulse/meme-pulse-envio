import { HandlerContext, BigDecimal } from 'generated';
import { getTokenMetadata } from '../effect/token';
import { createWritableCopy } from '../utils/copy';
import { memoryDecimals } from '../utils/memory';
import { getTokenPk } from '../utils/helper';

export async function loadToken(context: HandlerContext, chainId: number, tokenAddress: string) {
  // Fetch and store token0 information
  const tokenPk = getTokenPk(chainId, tokenAddress);
  const token = await context.Token.get(tokenPk);
  if (token) {
    // 기존 토큰도 메모리에 decimals 저장 (bin.ts에서 사용)
    if (!memoryDecimals.has(tokenPk)) {
      memoryDecimals.set(tokenPk, Number(token.decimals));
    }
    return createWritableCopy(token);
  }
  try {
    const tokenMetadata = await context.effect(getTokenMetadata, {
      tokenAddress,
      chainId,
    });
    const tokenEntity = {
      id: tokenPk,
      address: tokenAddress,
      chainId,
      name: tokenMetadata.name,
      symbol: tokenMetadata.symbol,
      decimals: BigInt(tokenMetadata.decimals),
      derivedNative: new BigDecimal(0),
      priceUSD: new BigDecimal(0),
    };
    // tokenPk (chainId:address) 형식으로 저장하여 bin.ts와 일관성 유지
    memoryDecimals.set(tokenPk, tokenMetadata.decimals);
    context.Token.set(tokenEntity);
    return tokenEntity;
  } catch (error) {
    context.log.error('Failed to fetch token0 metadata', {
      tokenAddress,
      chainId,
      err: error,
    });
    throw error;
  }
}
