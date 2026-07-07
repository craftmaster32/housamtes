import { passwordVisibilityIconProps } from '../../utils/passwordVisibilityIcon';

describe('passwordVisibilityIconProps', () => {
  it('shows the "eye" icon and show label when the password is hidden', () => {
    const onToggle = jest.fn();
    const props = passwordVisibilityIconProps(false, onToggle, 'Show password', 'Hide password');

    expect(props.icon).toBe('eye');
    expect(props.accessibilityLabel).toBe('Show password');
    expect(props.accessibilityState).toEqual({ checked: false });
  });

  it('shows the "eye-off" icon and hide label when the password is visible', () => {
    const onToggle = jest.fn();
    const props = passwordVisibilityIconProps(true, onToggle, 'Show password', 'Hide password');

    expect(props.icon).toBe('eye-off');
    expect(props.accessibilityLabel).toBe('Hide password');
    expect(props.accessibilityState).toEqual({ checked: true });
  });

  it('wires onPress to the provided toggle callback', () => {
    const onToggle = jest.fn();
    const props = passwordVisibilityIconProps(false, onToggle, 'Show password', 'Hide password');

    props.onPress?.({} as never);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('marks the icon as an accessible toggle button', () => {
    const props = passwordVisibilityIconProps(false, jest.fn(), 'Show password', 'Hide password');

    expect(props.accessible).toBe(true);
    expect(props.accessibilityRole).toBe('togglebutton');
  });
});
