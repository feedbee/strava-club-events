export class AuthenticationError extends Error {
  constructor(response) {
    super('Authentication required');
    this.name = 'AuthenticationError';
    this.isAuthError = true;
    this.response = response;
  }
}

export class ApiError extends Error {
  constructor(message, response, responseData) {
    super(`API Error (${response.status}): ${message}`);
    this.name = 'ApiError';
    this.response = response;
    this.responseData = responseData;
  }
}

export async function handleApiResponse(resp) {
  if (resp.ok) return resp;

  const error = await resp.json().catch(() => ({}));
  const errorMessage = error.message || error.error || 'An error occurred';

  if (resp.status === 401) {
    throw new AuthenticationError(resp);
  } else {
    throw new ApiError(`API Error (${resp.status}): ${errorMessage}`, resp, error);
  }
}
