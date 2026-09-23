const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();

/**
 * Returns the public URL Supabase should use after email verification or a
 * password reset. VITE_SITE_URL takes priority so links are never sent to a
 * developer's localhost server.
 */
export const getAuthRedirectUrl = (path: string) => {
  const baseUrl = configuredSiteUrl || window.location.origin;
  return new URL(path, baseUrl).toString();
};
