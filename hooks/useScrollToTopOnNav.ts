import { useCallback, useEffect, useRef } from 'react';
import { onScrollToTop } from '@utils/scrollToTop';

interface OffsetList {
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
}
interface Scroller {
  scrollTo: (params: { x?: number; y?: number; animated?: boolean }) => void;
}
interface SectionScroller {
  getScrollResponder: () => Scroller | null | undefined;
}
type ScrollLike = OffsetList | Scroller | SectionScroller;

/**
 * Returns a ref callback for the page's list or scroll view. Whenever the person taps
 * their way to this page (bottom menu, More menu, a Home tile — even the page
 * they're already on), it glides back to the top, like a phone's own apps.
 */
export function useScrollToTopOnNav(tab: string): (node: ScrollLike | null) => void {
  const ref = useRef<ScrollLike | null>(null);
  useEffect(
    () =>
      onScrollToTop((target) => {
        if (target !== tab) return;
        const list = ref.current;
        if (!list) return;
        if ('scrollToOffset' in list) list.scrollToOffset({ offset: 0, animated: true });
        else if ('scrollTo' in list) list.scrollTo({ y: 0, animated: true });
        else list.getScrollResponder()?.scrollTo({ y: 0, animated: true });
      }),
    [tab]
  );
  return useCallback((node: ScrollLike | null): void => {
    ref.current = node;
  }, []);
}
