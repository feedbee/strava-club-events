export async function readCurrentUser(request = fetch, signal) {
  const response = await request("/me", { credentials: "same-origin", signal });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error(`Unable to load your Strava session (${response.status})`);
  return response.json();
}
