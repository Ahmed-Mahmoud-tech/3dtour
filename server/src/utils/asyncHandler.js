/**
 * Wraps an async route handler/middleware so rejections flow to the global
 * error handler in index.js (which masks 500 details) instead of each
 * controller hand-rolling a try/catch that leaks err.message to clients.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
