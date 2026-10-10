import type { AuthUser } from "../types";

export const needsProfileSetup = (user: AuthUser): boolean =>
  user.id !== "local-demo-user" &&
  (!user.firstName?.trim() || !user.lastName?.trim());
