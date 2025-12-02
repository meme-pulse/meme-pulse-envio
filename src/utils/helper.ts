// Primary Key Generator
export const getBundlePk = (chainId: number) => {
  return chainId.toString().concat(':').concat('1');
};
export const getFactoryPk = (chainId: number, factoryAddress: string) => {
  return chainId.toString().concat(':').concat(factoryAddress);
};
export const getLbPairPk = (chainId: number, lbPairAddress: string) => {
  return chainId.toString().concat(':').concat(lbPairAddress);
};
export const getLBPairParameterSetPk = (chainId: number, lbPairAddress: string) => {
  return chainId.toString().concat(':').concat(lbPairAddress);
};
export const getTokenPk = (chainId: number, tokenAddress: string) => {
  return chainId.toString().concat(':').concat(tokenAddress);
};
export const getUserPk = (chainId: number, userId: string) => {
  return chainId.toString().concat(':').concat(userId);
};
export const getBinPk = (chainId: number, lbPairAddress: string, binId: string) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('#').concat(binId);
};
export const getLiquidityBookAMMHourDataPk = (chainId: number, hourId: number) => {
  return chainId.toString().concat(':').concat(hourId.toString());
};
export const getLiquidityBookAMMDayDataPk = (chainId: number, dayId: number) => {
  return chainId.toString().concat(':').concat(dayId.toString());
};
export const getTokenHourDataPk = (chainId: number, tokenAddress: string, hourId: number) => {
  return chainId.toString().concat(':').concat(tokenAddress).concat(':').concat(hourId.toString());
};
export const getTokenDayDataPk = (chainId: number, tokenAddress: string, dayId: number) => {
  return chainId.toString().concat(':').concat(tokenAddress).concat(':').concat(dayId.toString());
};
export const getLBPairHourDataPk = (chainId: number, lbPairAddress: string, hourId: number) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('-').concat(hourId.toString());
};
export const getLBPairDayDataPk = (chainId: number, lbPairAddress: string, dayId: number) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('-').concat(dayId.toString());
};
export const getUserLiquidityPositionPk = (chainId: number, lbPairAddress: string, userId: string) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('-').concat(userId);
};
export const getUserBinLiquidityPk = (chainId: number, lbPairAddress: string, userId: string, binId: string) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('-').concat(userId).concat('-').concat(binId);
};

// User Fees Data Pk

export const getUserFeesPerBinDataPk = (chainId: number, lbPairAddress: string, userId: string, binId: string) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('-').concat(userId).concat('-').concat(binId);
};

export const getUserFeesHourDataPk = (chainId: number, lbPairAddress: string, userId: string, hourId: number) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('-').concat(userId).concat('-').concat(hourId.toString());
};
export const getUserFeesDayDataPk = (chainId: number, lbPairAddress: string, userId: string, dayId: number) => {
  return chainId.toString().concat(':').concat(lbPairAddress).concat('-').concat(userId).concat('-').concat(dayId.toString());
};

// Statistic Data Pk
export const getUserTokenDayDataPk = (chainId: number, userId: string, tokenAddress: string, dayId: number) => {
  return chainId.toString().concat(':').concat(userId).concat('#').concat(tokenAddress).concat('#').concat(dayId.toString());
};
