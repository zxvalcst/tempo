/**
 * Time zone list for the onboarding and settings selects. The browser's own
 * zone is included first, and Asia/Jakarta is always present because it is the
 * schema default.
 */
export function timeZoneOptions(): string[] {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const supported = Intl.supportedValuesOf("timeZone");

  return [...new Set(["Asia/Jakarta", detected, ...supported])].sort();
}
