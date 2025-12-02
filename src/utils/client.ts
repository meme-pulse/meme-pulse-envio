import { createPublicClient, defineChain, http } from 'viem';

const memecoreTestnet = /*#__PURE__*/ defineChain({
  id: 43522,
  name: 'Memecore Testnet',
  nativeCurrency: { name: 'meme', symbol: 'M', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.insectarium.memecore.net'] },
  },
  blockExplorers: {
    default: {
      name: 'Memecore Explorer',
      url: 'https://insectarium.blockscout.memecore.com/',
    },
  },
  contracts: {
    multicall3: {
      address: '0x709Bf66Fb11942Da03a1f7bF59BFA99293f68dB9',
    },
  },
});

export const getClient = (chainId: number) => {
  if (chainId === 43522) {
    return createPublicClient({
      chain: memecoreTestnet,
      batch: { multicall: true },
      transport: http(memecoreTestnet.rpcUrls.default.http[0], { batch: true }),
    });
  }

  throw new Error(`Unsupported chainId: ${chainId}`);
};
