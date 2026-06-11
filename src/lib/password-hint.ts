/** Keep in sync with backend PASSWORD_MIN_LENGTH / PASSWORD_REQUIRE_COMPLEXITY. */
export const PASSWORD_MIN_LENGTH = 8;

export function passwordHint(): string {
  return `At least ${PASSWORD_MIN_LENGTH} characters.`;
}
