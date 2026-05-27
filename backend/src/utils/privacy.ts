/**
 * Returns the first name of a user, for public/forum display.
 * Falls back to "Citizen" if the name is empty or only whitespace.
 */
export function firstNameOnly(fullName: string | undefined | null): string {
  if (!fullName) return 'Citizen';
  const first = fullName.trim().split(/\s+/)[0];
  return first || 'Citizen';
}

/**
 * Strips a user object down to what's safe for public/forum display.
 */
export function publicUser(user: { _id: any; name?: string; role?: string } | null | undefined) {
  if (!user) return null;
  return {
    _id: user._id.toString(),
    displayName: firstNameOnly(user.name),
    role: user.role,
  };
}
