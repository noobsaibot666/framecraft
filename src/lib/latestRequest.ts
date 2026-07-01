export function createLatestRequestGuard() {
  let generation = 0;
  return {
    begin: () => ++generation,
    isCurrent: (token: number) => token === generation,
    invalidate: () => { generation += 1; },
  };
}
