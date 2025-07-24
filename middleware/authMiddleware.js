// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const auth = (roles = []) => {
  return (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) return res.status(401).send('Access denied');

    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      req.user = verified;

      if (roles.length && !roles.includes(verified.role)) {
        return res.status(403).send('Role not authorized');
      }

      next();
    } catch (err) {
      res.status(400).send('Invalid token');
    }
  };
};

module.exports = auth;