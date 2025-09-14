import { 
  getUserClubs, 
  getClubEvents 
} from '../services/strava.service.js';

/**
 * Fetches and processes events for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getEvents(req, res) {
  try {
    const token = req.token; // Token attached by ensureValidToken middleware
    const allEvents = [];

    // Get user ID from the authenticated user
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    const userId = req.user.id;
    
    // Get user's clubs
    const clubs = await getUserClubs(token, userId);

    // Get events for each club
    for (const club of clubs) {
      try {
        const clubEvents = await getClubEvents(token, club, userId);
        allEvents.push(...clubEvents);
      } catch (error) {
        console.error(`Error getting events for club ${club.id}:`, error);
        throw error; // Re-throw to be caught by the outer try-catch
      }
    }

    // Sort all events by start date
    allEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    
    res.json(allEvents);
  } catch (error) {
    console.error('Error in getEvents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch events',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export { getEvents };
