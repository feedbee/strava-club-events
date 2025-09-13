# Strava Club Events Calendar — Technical Specification

*Last Updated: September 13, 2025*

## 1. Overview

### 1.1 Objective
Build a modern web application that provides Strava users with a clean, interactive calendar view of their upcoming club events. The application will authenticate with Strava's OAuth2, fetch group events from all clubs the user has joined, filter events to the next 30 days, and present them in an intuitive calendar interface with enhanced user experience features.

## 2. System Architecture

### 2.1 High-Level Architecture
```
┌─────────────┐     ┌───────────────┐     ┌─────────────┐
│             │     │               │     │             │
│  Frontend   │◄───►│  Backend API  │◄───►│  Strava API │
│  (Browser)  │     │  (Node.js)    │     │             │
└─────────────┘     └───────────────┘     └─────────────┘
```

### 2.2 Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Components**: FullCalendar 6.1.8 (via CDN) with:
  - Month, Week, and Day view support
  - Custom event rendering with club logos
  - Responsive design for all screen sizes
- **Styling**: Custom CSS with Inter font and modern UI components
- **Backend**: Node.js 18+, Express.js
- **Authentication**: OAuth2 with Strava
- **Containerization**: Docker, Docker Compose
- **Development**: VS Code Dev Containers

## 3. User Roles
- **Athlete**: Authenticated Strava user who can view their club events

## 4. User Flows

### 4.1 Authentication Flow
1. **Landing Page**
   - User navigates to `http://localhost:3000`
   - If unauthenticated, displays a clean login page with "Login with Strava" button

2. **OAuth Authorization**
   - User clicks "Login with Strava"
   - App redirects to Strava's OAuth authorization page
   - User reviews permissions and grants access
   - Strava redirects to `/callback?code=...`

3. **Token Exchange**
   - Backend exchanges authorization code for access token
   - Token is stored in server-side session
   - User is redirected to the main calendar view

### 4.2 Calendar Interaction
1. **Initial Load**
   - Frontend fetches events via `GET /events`
   - Shows loading state while fetching
   - Renders events in FullCalendar month view

2. **Event Interaction**
   - **Left Click**: Opens event in Strava (new tab)
   - **Right Click**: Copies event URL to clipboard
   - **Hover**: Displays tooltip with event details

3. **Navigation**
   - Month/Week/Day view toggles
   - Previous/Next navigation
   - "Today" button to return to current date

## 5. Scope

### 5.1 In Scope (MVP)
- **Authentication**
  - OAuth2 with Strava (authorization_code flow)
  - Server-side session management
  - Secure token handling

- **API Endpoints**
  - `GET /login`: Initiate OAuth flow
  - `GET /callback`: Handle OAuth callback
  - `GET /events`: Fetch filtered club events
  - Static file serving for frontend assets

- **Event Management**
  - Fetch events from all user's clubs
  - Filter events: now → now + 30 days
  - Support for recurring events via `upcoming_occurrences`
  - Timezone-aware date handling (UTC)
  - Club logo integration with each event
  - Event grouping by club in calendar views

- **User Interface**
  - Responsive calendar view (FullCalendar 6.1.8)
  - Multiple view options: Month, Week, and Day
  - Club logos displayed next to event titles
  - Event tooltips with details
  - Interactive event actions (open in Strava, copy URL)
  - Loading and error states
  - Intuitive view switching controls

- **Development Experience**
  - Docker and Docker Compose support
  - VS Code Dev Containers configuration
  - Environment-based configuration
  - Comprehensive logging

### 5.2 Out of Scope (Future Enhancements)
- User management and admin interface
- Event creation/editing
- Advanced filtering and search
- Offline support
- Push notifications
- Mobile app version
- Multi-user collaboration features
- Advanced analytics and reporting

## 6. API Specifications

### 6.1 External APIs

#### Strava OAuth2
- **Authorization Endpoint**: `GET https://www.strava.com/oauth/authorize`
  - Parameters:
    - `client_id`: Your application's client ID
    - `redirect_uri`: Callback URL (e.g., `http://localhost:3000/callback`)
    - `response_type`: `code`
    - `scope`: `read,read_all,profile:read_all,activity:read_all,club:read`
    - `approval_prompt`: `auto`

- **Token Endpoint**: `POST https://www.strava.com/oauth/token`
  - Parameters:
    - `client_id`: Your application's client ID
    - `client_secret`: Your application's client secret
    - `code`: Authorization code from redirect
    - `grant_type`: `authorization_code`

#### Strava REST API
- **Get Athlete's Clubs**: `GET /api/v3/athlete/clubs`
  - Returns list of clubs the authenticated athlete is a member of

- **Get Club Group Events**: `GET /api/v3/clubs/{club_id}/group_events`
  - Returns upcoming group events for a specific club
  - Includes recurring events with `upcoming_occurrences`

### 6.2 Application API

#### GET /login
- **Description**: Initiates OAuth flow with Strava
- **Response**: 302 Redirect to Strava OAuth URL

#### GET /callback
- **Description**: Handles OAuth callback
- **Parameters**:
  - `code`: Authorization code from Strava
- **Response**: 302 Redirect to `/`

#### GET /events
- **Description**: Returns filtered club events
- **Authentication**: Requires valid session
- **Response**:
  - 200: JSON array of events
  - 401: Unauthorized (missing/invalid session)
  - 500: Server error

**Example Response:**
```json
[
  {
    "id": "123",
    "title": "Morning Ride",
    "start": "2023-10-15T09:00:00Z",
    "end": "2023-10-15T11:00:00Z",
    "url": "https://www.strava.com/clubs/123/group_events/456",
    "club": {
      "id": 123,
      "name": "Cycling Club"
    },
    "description": "Join us for a morning ride through the hills.",
    "location": "Central Park, NY"
  }
]
```

## 7. Data Models

### 7.1 Session
```typescript
interface Session {
  access_token: string;
  athlete_id: number;
  expires_at: number;
}
```

### 7.2 Event
```typescript
interface Event {
  id: string;
  title: string;
  start: string; // ISO 8601 datetime (UTC)
  end?: string;   // ISO 8601 datetime (UTC), optional
  url: string;    // URL to view event on Strava
  club: {
    id: number;
    name: string;
  };
  description?: string;
  location?: string;
  recurring: boolean;
}
```

## 8. User Interface

### 8.1 Layout
1. **Header**
   - Application title
   - Login/Logout button
   - Current date indicator

2. **Main Content**
   - Calendar view (default: month)
   - Loading indicator during data fetch
   - Empty state when no events

3. **Event Display**
   - Event title
   - Time (formatted in user's locale)
   - Club name
   - Visual indicators for event type

## 9. Configuration

### 9.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLIENT_ID` | Yes | - | Strava API client ID |
| `CLIENT_SECRET` | Yes | - | Strava API client secret |
| `PORT` | No | `3000` | Port for the web server |
| `SESSION_SECRET` | No | `supersecret` | Secret for session encryption |
| `NODE_ENV` | No | `development` | Runtime environment |

### 9.2 OAuth Configuration
- **Redirect URI**: `http://localhost:${PORT}/callback`
- **Scopes**: `read,read_all,profile:read_all,activity:read_all,club:read`
- **Approval Prompt**: `auto`

## 10. Security Considerations

### 10.1 Authentication
- Uses secure, server-side sessions
- Short-lived access tokens (1 hour by default)
- No sensitive data stored in client-side storage

### 10.2 Rate Limiting
- Respects Strava API rate limits
- Implements request queuing to avoid rate limit errors
- Backoff strategy for rate-limited requests

### 10.3 Data Protection
- Environment variables for sensitive configuration
- No persistent storage of user data
- Secure session handling with HTTP-only cookies

## 11. Performance Considerations

### 11.1 Client-Side
- Efficient event rendering with FullCalendar
- Lazy loading of calendar views
- Minimized bundle size (CDN for dependencies)

### 11.2 Server-Side
- Parallel fetching of club events
- Efficient date filtering
- Minimal data transformation

## 12. Error Handling

### 12.1 Authentication Errors
- Invalid or expired tokens
- Missing or invalid session
- OAuth flow failures

### 12.2 API Errors
- Rate limiting
- Network issues
- Invalid responses

### 12.3 User Feedback
- Clear error messages
- Loading states
- Recovery actions

## 13. Browser Support

### 13.1 Supported Browsers
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### 13.2 Responsive Design
- Desktop (≥1024px)
- Tablet (768px - 1023px)
- Mobile (<768px)

## 14. Testing Strategy

### 14.1 Unit Tests
- API endpoint handlers
- Date utilities
- Data transformation functions

### 14.2 Integration Tests
- OAuth flow
- Event fetching and filtering
- Session management

### 14.3 Manual Testing
- Cross-browser testing
- Mobile responsiveness
- Error scenarios

## 15. Deployment

### 15.1 Development
1. Clone repository
2. Create `.env-local` with Strava API credentials
3. Run `docker compose up --build`
4. Access at `http://localhost:3000`

### 15.2 Production
1. Set up production environment variables
2. Configure HTTPS
3. Use a process manager (PM2, systemd)
4. Set up monitoring and logging

## 16. Maintenance

### 16.1 Dependencies
- Regular security updates
- Dependency auditing
- Version pinning

### 16.2 Monitoring
- Error tracking
- Performance monitoring
- Usage analytics

## 17. Development Workflow

### 17.1 Local Development
1. Open in VS Code with Dev Containers extension
2. Start debugging session
3. Make code changes (live reload)
4. Test in browser

### 17.2 Git Workflow
1. Create feature branch
2. Make changes
3. Write tests
4. Submit pull request
5. Code review
6. Merge to main

## 18. Acceptance Criteria

### 18.1 Functional Requirements
- [x] User can authenticate with Strava
- [x] Calendar displays events from all user's clubs
- [x] Events are filtered to next 30 days
- [x] Events are displayed in correct timezone
- [x] Clicking events opens them in Strava
- [x] Right-click copies event URL

### 18.2 Non-Functional Requirements
- [x] Responsive design
- [x] Loading states
- [x] Error handling
- [x] Secure authentication
- [x] Environment-based configuration

## 19. Future Enhancements

### 19.1 High Priority
- [ ] Refresh token rotation
- [ ] Event caching
- [ ] Improved error handling
- [ ] Better mobile experience

### 19.2 Medium Priority
- [ ] Advanced filtering
- [ ] Export to calendar
- [ ] Notifications
- [ ] Dark mode

### 19.3 Low Priority
- [ ] Offline support
- [ ] PWA installation
- [ ] Advanced analytics
- [ ] Multi-language support

## 20. Appendix

### 20.1 Dependencies
- Node.js 18+
- Express.js
- FullCalendar
- Docker

### 20.2 Resources
- [Strava API Documentation](https://developers.strava.com/)
- [FullCalendar Documentation](https://fullcalendar.io/docs)
- [Express.js Guide](https://expressjs.com/)

### 20.3 Changelog

#### v1.0.0 (2025-09-13)
- Initial release
- Basic calendar functionality
- OAuth2 authentication
- Docker support
- Deploy manifests (Dockerfile optimizations, Kubernetes/Compose profiles)
- Tests (unit for server, integration with mocked Strava API)


