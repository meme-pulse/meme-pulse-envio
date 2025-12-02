export function createWritableCopy<T>(entity: Readonly<T>): T {
  const writableCopy: T = { ...entity };

  return writableCopy;
}
