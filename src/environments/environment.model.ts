export interface AppEnvironment {
  production: boolean;
  useEmulators: boolean;
  firebase: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    appId: string;
  };
  emulators?: {
    host: string;
    authPort: number;
    firestorePort: number;
  };
}
