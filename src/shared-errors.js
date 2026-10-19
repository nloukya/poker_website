export function sharedReadError(error, status, timedOut = false) {
  if (timedOut)
    return "The shared table took too long to respond. Check your connection and that your Supabase project is active, then try again.";
  const code = error?.code;
  if (
    status === 401 ||
    /api.?key|invalid jwt|jwt expired/i.test(error?.message || "")
  )
    return "Supabase rejected the connection key (HTTP 401). Check the Project URL and publishable key in GitHub repository variables, then rerun Publish soberSem3.";
  if (code === "PGRST205" || code === "42P01")
    return `The shared database table hasn’t been set up (${code}). Run the current setup.sql in the Supabase project connected to this website.`;
  if (code === "42501" || status === 403)
    return "Supabase denied permission to view the table. Run the current setup.sql in the Supabase project connected to this website to enable public viewing.";
  if (code === "PGRST116")
    return "The shared table is empty or hidden by database permissions (PGRST116). Run the current setup.sql in the Supabase project connected to this website.";
  if (status >= 500)
    return `Supabase is temporarily unavailable (HTTP ${status}). Check your project’s status in Supabase, then try again.`;
  return "Can’t reach the shared table. Check your internet connection, Supabase Project URL, and whether the project is active, then try again.";
}
