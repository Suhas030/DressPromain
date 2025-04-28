const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  details: {
    age: {
      type: Number,
      min: 1,
      max: 120
    },
    topSize: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '']
    },
    bottomSize: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '']
    }
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);