const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust the path to your User model
const auth = require('../middleware/auth'); // Assuming you have auth middleware

// Get user profile data
router.get('/profile', auth, async (req, res) => {
  try {
    // Exclude password from the response
    const user = await User.findById(req.user.id).select('-password');
    
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
router.put('/update-details', auth, async (req, res) => {
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
    const user = await User.findById(req.user.id);
    
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

module.exports = router;