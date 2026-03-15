import { getLimits } from '../services/strava.service.js';

/**
 * Returns the current application limits (no authentication required)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getLimitsHandler(req, res) {
  res.json(getLimits());
}

export { getLimitsHandler };
