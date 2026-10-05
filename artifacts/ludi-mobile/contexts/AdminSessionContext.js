import { createContext, useContext } from 'react';

// Scoped to the guarded native SuperAdmin route, not the authentication flow.
export const AdminSessionContext = createContext(null);

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error('SuperAdmin screens require a verified app session.');
  return session;
}
