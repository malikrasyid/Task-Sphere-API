/**
 * Global error handling middleware for Express.
 * Catches errors thrown by controllers/models/services and sends a standardized JSON response.
 * NOTE: This must be the last middleware added with app.use().
 * * @param {Error} err - The error object. 
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
function errorHandler(err, req, res, next) {
    // Log the error for server-side debugging
    console.error(err.stack);

    let statusCode = 500;
    let message = 'Internal Server Error';

    // 1. Check for custom status codes/messages (e.g., from model errors: throw { status: 403, message: 'Forbidden' })
    if (err.status) {
        statusCode = err.status;
        message = err.message;
    } 
    // 2. Handle JWT specific errors (if any slip past the authenticateToken middleware)
    else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid or expired token.';
    }

    // Send the standardized JSON error response
    res.status(statusCode).json({
        error: message,
    });
}

module.exports = errorHandler;