# Step 7: external images and authentication loss

Historical report: this describes the state at the end of step 7. See [audit progress](audit-progress.md) for the current implementation and remaining work.

Every logo insertion point—calendar, list, card and filter—validates an absolute HTTPS URL without userinfo. URLs are escaped when inserted into HTML. Invalid URLs use the existing fallback without an image. Profile avatar URLs are also validated; a hardcoded photo of a real external profile was removed from the HTML.

On a current 401, the interface clears events, clubs, metadata, profile, tooltip and list; destroys the calendar instance; hides navigation; and displays login. Pending loads are invalidated. Selected clubs and sports are removed from saved preferences. The client no longer attempts to delete an HttpOnly cookie through document.cookie; the server retains control of it. Server-side invalidation and safe logout remain the next item at this point.

Initial profile loading is now awaited before loading events; /me errors reach the handler instead of becoming unhandled rejections. Reload errors distinguish 401 from a temporary API failure. A stale 401 still cannot clear the results of the current successful request.

Verification: both new tests reproduced the original bugs before the fixes. Full suite: 66/66. Chrome checked authentication loss during filter changes and initial /me loading; private content disappears and no uncaught page errors occur. These checks use fixture API responses, not a live Strava OAuth session. CSP and CSRF protection were not added in this step.
