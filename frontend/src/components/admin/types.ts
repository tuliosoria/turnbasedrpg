export type RunAction = (
  action: (adminToken: string) => Promise<unknown>,
  success?: string,
  refreshAfter?: boolean,
) => Promise<void>;
