const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/dressPro', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Import User model
const User = require('./User');
const productRoutes = require('./productRoutes');

// Middleware
app.use(express.json());

// Add this to server.js right after your imports
app.use((req, res, next) => {
  res.header('Cross-Origin-Embedder-Policy', 'require-corp');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Then update your CORS configuration
app.use(cors({
  origin: '*', // Allow any origin during development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Session configuration
app.use(session({
  secret: 'dress-pro-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: 'mongodb://localhost:27017/dressPro',
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true
  }
}));

// Authentication middleware
const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'front-end/dist')));
}

// Routes
// Register User
app.post('/api/users/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user with empty details
    user = new User({
      name,
      email,
      password,
      details: {
        age: null,
        topSize: '',
        bottomSize: ''
      }
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login User
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Store user in session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };
    
    res.json({ message: 'Login successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile data
app.get('/api/users/profile', auth, async (req, res) => {
  try {
    // Exclude password from the response
    const user = await User.findById(req.session.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user details
app.put('/api/users/update-details', auth, async (req, res) => {
  try {
    const { age, topSize, bottomSize } = req.body;
    
    // Validate inputs
    if (age && (isNaN(age) || age < 1 || age > 120)) {
      return res.status(400).json({ message: 'Age must be between 1 and 120' });
    }
    
    const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', ''];
    if ((topSize && !validSizes.includes(topSize)) || 
        (bottomSize && !validSizes.includes(bottomSize))) {
      return res.status(400).json({ message: 'Invalid size selection' });
    }
    
    // Find user and update details
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize details object if it doesn't exist
    if (!user.details) {
      user.details = {};
    }
    
    // Update only provided fields
    if (age !== undefined) user.details.age = age;
    if (topSize !== undefined) user.details.topSize = topSize;
    if (bottomSize !== undefined) user.details.bottomSize = bottomSize;
    
    await user.save();
    
    res.json({ 
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        email: user.email,
        details: user.details
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Auth Status
app.get('/api/users/auth-status', (req, res) => {
  if (req.session.user) {
    return res.json({ 
      isAuthenticated: true, 
      user: req.session.user 
    });
  }
  return res.status(401).json({ isAuthenticated: false });
});

// Logout User
app.post('/api/users/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

app.use('/api', productRoutes);

// Catch-all route for SPA
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'front-end/dist', 'index.html'));
  });
}

// Add a test route to verify API is working
app.get('/api/test', (req, res) => {
  res.json({ status: 'API is working' });
});

// Log all available routes for debugging
console.log('Available routes:');
app._router.stack.forEach(r => {
  if (r.route && r.route.path) {
    console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
  }
});

// Also add this after your routes to handle preflight requests
app.options('*', cors());

// Make sure the server is listening
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});