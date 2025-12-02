import { zeroAddress } from 'viem';

// Memecore Testnet (Insectarium) - chainId: 43522
export const WNATIVE_ADDRESS: Record<number, string> = {
  [43522]: '0x653e645e3d81a72e71328Bc01A04002945E3ef7A',
};

export const USDT_ADDRESS: Record<number, string> = {
  [43522]: zeroAddress,
};

export const LB_FACTORY_ADDRESS: Record<number, string> = {
  [43522]: '0xcC8721b893166a7d222c9e88d3D581fE37B94D81',
};

// Native price is hardcoded (1 MEME = $1), no oracle needed
