const virtualListThreshold = 40;

export function shouldVirtualizeRunList(count: number): boolean {
  return count > virtualListThreshold;
}
