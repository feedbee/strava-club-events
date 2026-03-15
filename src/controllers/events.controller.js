import { getAllUserClubsEvents } from '../services/strava.service.js';

/**
 * Fetches and processes events for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getEvents(req, res) {
  try {
    const token = req.token; // Token attached by ensureValidToken middleware

    // Get user ID from the authenticated user
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    const userId = req.user.id;
    
    // Get all events across all clubs with route request limiting
    const { events, meta } = await getAllUserClubsEvents(token, userId);

    res.json({ events, meta });
  } catch (error) {
    console.error('Error in getEvents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch events',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export { getEvents };
