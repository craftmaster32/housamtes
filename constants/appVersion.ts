import Constants from 'expo-constants';

/** The app's version from app.json, e.g. "3.0.0" — shown at the bottom of Settings. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '';
