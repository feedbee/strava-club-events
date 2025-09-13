/**
 * Parses JSON while preserving large numeric IDs as strings to avoid precision issues
 * @param {string} jsonText - The JSON string to parse
 * @returns {Object} The parsed JavaScript object with large IDs as strings
 */
function parseJsonWithStringIds(jsonText) {
  // Replace large ID numbers with quoted strings before parsing
  const modifiedText = jsonText.replace(/"id":\s*(\d{16,})/g, '"id":"$1"');
  return JSON.parse(modifiedText);
}

export { parseJsonWithStringIds };
