import { render, screen } from '@testing-library/react-native';
import { PenCount } from '@components/shared/tabbar/PenCount';

jest.mock('@stores/languageStore', () => ({
  useLanguageStore: (sel: (s: unknown) => unknown): unknown => sel({ language: 'en' }),
}));

describe('PenCount', () => {
  it('writes the number of new things', () => {
    render(<PenCount count={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('caps big counts at 9+', () => {
    render(<PenCount count={14} />);
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('shows nothing when there is nothing new', () => {
    render(<PenCount count={0} />);
    expect(screen.toJSON()).toBeNull();
  });
});
