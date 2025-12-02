import { handlerContext } from 'generated';
import { createWritableCopy } from '../utils/copy';
import { getUserPk } from '../utils/helper';

export async function loadUser(context: handlerContext, chainId: number, address: string) {
  const userPk = getUserPk(chainId, address);
  const user = await context.User.get(userPk);
  if (user) {
    return createWritableCopy(user);
  }

  const userEntity = {
    id: userPk,
    chainId,
    address,
    lbTokenApprovals: [],
  };

  context.User.set(userEntity);

  return userEntity;
}
