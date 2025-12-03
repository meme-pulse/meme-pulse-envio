import { zeroAddress } from 'viem';

// Memecore Testnet (Insectarium) - chainId: 43522
export const WNATIVE_ADDRESS: Record<number, string> = {
  [43522]: '0x653e645e3d81a72e71328Bc01A04002945E3ef7A',
};

export const USDT_ADDRESS: Record<number, string> = {
  [43522]: zeroAddress,
};

export const LB_FACTORY_ADDRESS: Record<number, string> = {
  [43522]: '0x1B279B36995A5AfBB75d82187F0025Ffef4572ED',
};

// Native price is hardcoded (1 MEME = $1), no oracle needed
