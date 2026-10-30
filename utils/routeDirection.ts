// The pages visited in this session, oldest first. Landing on one already in
// the trail means we went back to it (and everything after it is dropped).
let trail: string[] = [];

/** Whether arriving at `pathname` is going forward or back to an earlier page. */
export function directionTo(pathname: string): 'forward' | 'back' {
  const seenAt = trail.lastIndexOf(pathname);
  if (seenAt >= 0 && seenAt < trail.length - 1) {
    trail = trail.slice(0, seenAt + 1);
    return 'back';
  }
  if (seenAt < 0) trail = [...trail, pathname];
  return 'forward';
}

/** Test seam: forget the pages visited. */
export function resetRouteTrail(): void {
  trail = [];
}
