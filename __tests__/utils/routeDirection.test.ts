import { directionTo, resetRouteTrail } from '@utils/routeDirection';

describe('directionTo', () => {
  beforeEach(resetRouteTrail);

  it('treats new pages as going forward', () => {
    expect(directionTo('/welcome')).toBe('forward');
    expect(directionTo('/login')).toBe('forward');
  });

  it('treats a page visited earlier as going back', () => {
    directionTo('/welcome');
    directionTo('/login');
    expect(directionTo('/welcome')).toBe('back');
  });

  it('forgets the pages after the one you went back to', () => {
    directionTo('/dashboard');
    directionTo('/bills');
    directionTo('/bills/1');
    expect(directionTo('/dashboard')).toBe('back');
    // Bills was dropped from the trail, so opening it again is forward.
    expect(directionTo('/bills')).toBe('forward');
  });
});
