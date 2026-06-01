export function canManageTrip(role?: string | null) {
  return role === 'OWNER' || role === 'ADMIN';
}
