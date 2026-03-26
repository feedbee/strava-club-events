import { getAllUserClubsEvents } from '../services/strava.service.js';

const CLUBS_FILTER_LIMIT = 10;

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

    // Parse optional ?clubs=id1,id2,... filter
    let filterClubIds;
    if (req.query.clubs) {
      const parts = req.query.clubs.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.some(id => !/^\d+$/.test(id))) {
        return res.status(400).json({ error: 'Invalid clubs parameter: IDs must be numeric' });
      }
      if (parts.length > CLUBS_FILTER_LIMIT) {
        return res.status(400).json({ error: `clubs filter accepts at most ${CLUBS_FILTER_LIMIT} IDs` });
      }
      filterClubIds = parts;
    }

    // Parse optional ?sportTypes=cycling,running filter
    let filterSportTypes;
    if (req.query.sportTypes) {
      const parts = req.query.sportTypes.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (parts.length > 0) filterSportTypes = parts;
    }

    // Get all events across all clubs with route request limiting
    const { events, clubs, meta } = await getAllUserClubsEvents(token, userId, { filterClubIds, filterSportTypes });

    res.json({ events, clubs, meta });
  } catch (error) {
    console.error('Error in getEvents:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export { getEvents };
