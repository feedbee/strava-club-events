# Synthetic provider model examples

These JSON files contain synthetic replacements for previously observed Strava resource shapes. They are not live API responses, actual people, real locations or executable routes. IDs have been replaced consistently across related models; large IDs use strings. Personal strings, timestamps and URLs are synthetic; coordinates are neutral and polylines empty.

Examples include resource states not fetched by the application. See [model coverage](../api-model-coverage.md) for the actual cache and public DTO contract.

The model-fetching script always saves synthetic files here. Do not replace them with unfiltered authenticated responses. Unknown fields are excluded by its sanitizer. Historical Git versions are not rewritten by this change.
