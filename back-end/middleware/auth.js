// middleware/auth.js
module.exports = function(req, res, next) {
  // Check if user is authenticated via session
  if (!req.session || !req.session.user) {
    console.log('Auth middleware: Not authenticated, access denied');
    return res.status(401).json({ message: 'Not authenticated, access denied' });
  }
  
  // Add user information to the request object
  req.user = {
    id: req.session.user.id // Make sure this matches what's stored in the session
  };
  
  console.log('Auth middleware: User authenticated, ID:', req.user.id);
  next();
};