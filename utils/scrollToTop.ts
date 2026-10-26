// A tiny signal: "the person just tapped their way to this page — show its top".
// navigateToBase sends it with the page's tab name; each main page listens with
// useScrollToTopOnNav. Pages opened fresh start at the top anyway; this is for
// a page that's already open (tapping its tab again, or going back to it).
type Listener = (tab: string) => void;

const listeners = new Set<Listener>();

export function requestScrollToTop(tab: string): void {
  listeners.forEach((listener) => listener(tab));
}

export function onScrollToTop(listener: Listener): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}
