/**
 * Home's first-visit pop-ups: the "new look" note shows once to existing
 * users, and never pops up on another page if Home is left before it is ready.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useWelcomeTour } from '@hooks/useWelcomeTour';
import { Alert } from '@lib/alert';
import { shouldShowTour, shouldShowWhatsNew, markWhatsNewSeen } from '@utils/tour';

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({ t: (key: string): string => key }),
}));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('@utils/tour', () => ({
  shouldShowTour: jest.fn(),
  markTourSeen: jest.fn(),
  shouldShowWhatsNew: jest.fn(),
  markWhatsNewSeen: jest.fn(),
}));

const mockShouldShowTour = shouldShowTour as jest.Mock;
const mockShouldShowWhatsNew = shouldShowWhatsNew as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockShouldShowTour.mockResolvedValue(false);
  mockShouldShowWhatsNew.mockResolvedValue(true);
});

describe('useWelcomeTour', () => {
  it('shows the "new look" note to an existing user and marks it seen', async () => {
    renderHook(() => useWelcomeTour());
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe('dashboard.whats_new_title');
    expect(markWhatsNewSeen).toHaveBeenCalledTimes(1);
  });

  it('shows the tour, not the note, to a brand-new account', async () => {
    mockShouldShowTour.mockResolvedValue(true);
    const { result } = renderHook(() => useWelcomeTour());
    await waitFor(() => expect(result.current.showTour).toBe(true));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does not pop the note up elsewhere when Home is left before it is ready', async () => {
    let finishCheck: (show: boolean) => void = () => undefined;
    mockShouldShowWhatsNew.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishCheck = resolve;
      })
    );
    const { unmount } = renderHook(() => useWelcomeTour());
    await waitFor(() => expect(shouldShowWhatsNew).toHaveBeenCalled());
    unmount();
    finishCheck(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(markWhatsNewSeen).not.toHaveBeenCalled();
  });

  it('never shows the note after Home has been left while saving "seen"', async () => {
    let finishSave: () => void = () => undefined;
    (markWhatsNewSeen as jest.Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      })
    );
    const { unmount } = renderHook(() => useWelcomeTour());
    await waitFor(() => expect(markWhatsNewSeen).toHaveBeenCalled());
    const shownBeforeLeaving = (Alert.alert as jest.Mock).mock.calls.length;
    unmount();
    finishSave();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((Alert.alert as jest.Mock).mock.calls.length).toBe(shownBeforeLeaving);
  });
});
