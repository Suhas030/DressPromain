// Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  main_category: String,
  product_type: {  // Normalized clothing type (shirt, t-shirt, pants, etc.)
    type: String,
    index: true
  },
  clothing_class: {  // Match to your model's detection classes (full sleeve top, etc.)
    type: String,
    index: true
  },
  color: {
    type: String,
    index: true
  },
  gender: {
    type: String,
    enum: ['men', 'women', 'boys', 'girls', 'unisex'],
    index: true
  },
  price: {
    type: Number,
    default: 29.99  // Default price when null
  },
  average_rating: Number,
  rating_count: Number,
  image_url: String,
  product_url: String,
  size: String,
  brand: String,
  details: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('Product', ProductSchema);