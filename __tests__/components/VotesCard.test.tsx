/**
 * QA — Home Votes tile quick vote
 *
 * While there's an open vote you haven't answered, the tile shows it with Yes /
 * No boxes you tick in place (no trip to the Votes page). Once every open vote
 * is answered it goes back to the normal glance with the ballot drawing.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { VotesCard } from '@components/dashboard/cards/VotesCard';
import { makeCardStyles } from '@components/dashboard/cards/cardStyles';
import { lightColors } from '@constants/colors';
import { navigateToBase } from '@stores/navigationStore';
import type { Proposal } from '@stores/votingStore';

jest.mock('react-native-svg', () => {
  const Empty = (): null => null;
  return { __esModule: true, default: Empty, Path: Empty, Rect: Empty, Circle: Empty };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: (): null => null }));
jest.mock('@stores/navigationStore', () => ({ navigateToBase: jest.fn() }));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('@lib/i18n', () => ({ isRTL: () => false }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@stores/languageStore', () => ({
  useLanguageStore: (sel: (s: unknown) => unknown) => sel({ language: 'en' }),
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ profile: { id: 'me' } }),
}));

const mockCastVote = jest.fn((): Promise<void> => Promise.resolve());
let mockProposals: Proposal[] = [];
jest.mock('@stores/votingStore', () => ({
  useVotingStore: (sel: (s: unknown) => unknown) =>
    sel({ proposals: mockProposals, castVote: mockCastVote }),
}));

function proposal(overrides: Partial<Proposal>): Proposal {
  return {
    id: 'p1',
    title: 'Get a robot vacuum',
    description: '',
    createdBy: 'maya',
    createdAt: '2026-10-01T00:00:00Z',
    isOpen: true,
    votes: [],
    ...overrides,
  };
}

function renderCard(): void {
  render(<VotesCard styles={makeCardStyles(lightColors)} c={lightColors} compact />);
}

describe('VotesCard quick vote', () => {
  beforeEach(() => jest.clearAllMocks());

  it('votes Yes in place on the first vote you have not answered', () => {
    mockProposals = [
      proposal({ id: 'done', title: 'Already voted', votes: [{ person: 'me', choice: 'no' }] }),
      proposal({ id: 'p1' }),
    ];
    renderCard();
    expect(screen.getByText('Get a robot vacuum')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('voting.yes_label: Get a robot vacuum'));

    expect(mockCastVote).toHaveBeenCalledWith('p1', 'me', 'yes');
    expect(navigateToBase).not.toHaveBeenCalled();
  });

  it('shows no boxes once every open vote is answered', () => {
    mockProposals = [proposal({ votes: [{ person: 'me', choice: 'yes' }] })];
    renderCard();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('still opens the Votes page when the tile itself is tapped', () => {
    mockProposals = [proposal({})];
    renderCard();
    fireEvent.press(screen.getByLabelText('dashboard.votes_label'));
    expect(navigateToBase).toHaveBeenCalledWith('/(tabs)/voting');
  });
});
