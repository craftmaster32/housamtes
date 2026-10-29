/**
 * Every corner cameo of Mate reacts to a tap — including the sleeping one.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MateCameoPose, type CameoPose } from '@components/shared/MateCameoPose';

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({ t: (key: string): string => key }),
}));
jest.mock('@hooks/useHandFont', () => ({ useHandFont: (): object => ({}) }));
jest.mock('@hooks/useReduceMotion', () => ({ useReduceMotion: (): boolean => true }));

describe('MateCameoPose', () => {
  it.each<CameoPose>(['hold', 'fallen', 'sleeping', 'peek', 'upside'])(
    'tapping Mate in the %s pose reacts',
    (pose): void => {
      const onTap = jest.fn();
      render(<MateCameoPose pose={pose} prop="broom" size={60} onTap={onTap} />);
      fireEvent.press(screen.getByTestId('mate'));
      expect(onTap).toHaveBeenCalledTimes(1);
    }
  );
});
