export interface BackLinkProps {
  // What the button used to say it goes to — kept so existing screens compile.
  label: string;
}

// The on-screen "‹ Back" button has been removed app-wide: people go back with
// the edge swipe (iOS) / system back gesture, which is unchanged. Screens still
// place <BackLink /> in their headers, so it simply renders nothing now.
export const BackLink: React.FC<BackLinkProps> = () => null;
