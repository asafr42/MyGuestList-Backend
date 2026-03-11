const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'myguestlist-secret-key';

module.exports = function (req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email }
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};
