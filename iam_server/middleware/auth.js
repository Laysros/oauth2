const jwt = require('jsonwebtoken');

// Middleware to Verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
        req.user = decoded; // Attach decoded payload to request
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

// Middleware to Check Scope
const checkScope = (requiredScope) => {
    return (req, res, next) => {
        // req.user is set by verifyToken middleware
        console.log('DEBUG: User Token Payload:', req.user); // <--- DEBUG LOG

        if (!req.user || !req.user.scope) {
            console.log('DEBUG: No scope in token');
            return res.status(403).json({ error: 'Forbidden: Insufficient scope' });
        }

        let userScopes = req.user.scope;
        // Robustness: Handle if scope is a string (e.g. from some libraries)
        if (typeof userScopes === 'string') {
            userScopes = userScopes.split(' ');
        }

        if (!userScopes.includes(requiredScope)) {
            console.log(`DEBUG: Scope Check Failed! Required: ${requiredScope}, User Has: ${JSON.stringify(userScopes)}`);
            return res.status(403).json({ error: 'Forbidden: Insufficient scope' });
        }
        next();
    };
};

module.exports = { verifyToken, checkScope };
