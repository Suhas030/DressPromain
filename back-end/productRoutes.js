const express = require('express');
const router = express.Router();
const Product = require('./app/product');
const fetch = require('node-fetch');

// Enhanced mapping from detected classes to product database classes
const CLASS_MAPPING = {
  'short sleeve top': ['t-shirt', 'polo shirt', 'top'],
  'long sleeve top': ['shirt', 'sweater', 'blouse', 'top', 'sweatshirt'],
  'short sleeve outwear': ['jacket'],
  'long sleeve outwear': ['coat', 'jacket'],
  'vest': ['vest', 'sleeveless top'],
  'sling': ['camisole', 'tank top'],
  'shorts': ['shorts'],
  'trousers': ['pants', 'jeans', 'trousers'],
  'skirt': ['skirt'],
  'short sleeve dress': ['dress'],
  'long sleeve dress': ['dress'],
  'vest dress': ['dress'],
  'sling dress': ['dress']
};

// Helper function to normalize RGB to standard color name
function getNearestColor(rgbString) {
  // Extract RGB values from string like "rgb(255, 0, 0)"
  const rgbMatch = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!rgbMatch) return "unknown";
  
  const [_, r, g, b] = rgbMatch.map(Number);
  
  // Standard colors with RGB values
  const colorMap = {
    'black': [0, 0, 0],
    'white': [255, 255, 255],
    'gray': [128, 128, 128],
    'red': [255, 0, 0],
    'blue': [0, 0, 255],
    'green': [0, 128, 0],
    'yellow': [255, 255, 0],
    'purple': [128, 0, 128],
    'pink': [255, 192, 203],
    'brown': [165, 42, 42],
    'orange': [255, 165, 0],
    'beige': [245, 245, 220],
    'navy': [0, 0, 128],
    'teal': [0, 128, 128]
  };
  
  // Find closest color by Euclidean distance
  let minDistance = Number.MAX_VALUE;
  let nearestColor = "unknown";
  
  for (const [name, [r2, g2, b2]] of Object.entries(colorMap)) {
    const distance = Math.sqrt(
      Math.pow(r - r2, 2) + 
      Math.pow(g - g2, 2) + 
      Math.pow(b - b2, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestColor = name;
    }
  }
  
  return nearestColor;
}

// API endpoint for product recommendations with multiple colors and subcategory support
router.get('/product-recommendations', async (req, res) => {
  try {
    // Get query parameters
    const { clothingClass, productType, colors, gender, limit = 8 } = req.query;
    
    console.log('Recommendation request:', { clothingClass, productType, colors, gender });
    
    // Build base query
    const query = {};
    
    // Handle clothing class mapping
    if (clothingClass) {
      // If specific product type is provided, use that
      if (productType) {
        console.log(`Using specific product type: ${productType}`);
        query.product_type = productType;
      } 
      // Otherwise use the class mapping
      else {
        const possibleTypes = CLASS_MAPPING[clothingClass] || [];
        if (possibleTypes.length > 0) {
          query.product_type = { $in: possibleTypes };
          console.log(`Using product types from mapping: ${possibleTypes}`);
        } else {
          // If no mapping, try direct match with clothing_class
          query.clothing_class = clothingClass;
          console.log(`No mapping found, using clothing_class directly: ${clothingClass}`);
        }
      }
    }
    
    // Add gender filter
    if (gender) {
      if (gender === 'male') {
        query.gender = { $in: ['men', 'unisex'] };
      } else if (gender === 'female') {
        query.gender = { $in: ['women', 'unisex'] };
      } else if (gender !== 'all') {
        query.gender = gender;
      }
    }
    
    // Process multiple colors
    const colorQueries = [];
    
    if (colors) {
      try {
        // Handle both JSON array format and single color
        const colorsList = typeof colors === 'string' && colors.startsWith('[') 
          ? JSON.parse(colors) 
          : [colors];
        
        colorsList.forEach(colorStr => {
          if (colorStr.startsWith('rgb')) {
            const normalizedColor = getNearestColor(colorStr);
            if (normalizedColor !== "unknown") {
              colorQueries.push(normalizedColor);
            }
          } else {
            // Already a color name
            colorQueries.push(colorStr);
          }
        });
        
        if (colorQueries.length > 0) {
          query.color = { $in: colorQueries };
        }
      } catch (e) {
        console.error('Error parsing colors:', e);
      }
    }
    
    console.log('MongoDB query:', JSON.stringify(query));
    
    // Find matching products
    let products = await Product.find(query)
      .sort({ average_rating: -1 })
      .limit(parseInt(limit))
      .lean();
    
    console.log(`Found ${products.length} products with strict filters`);
    
    // If no products found, try relaxing color constraints
    if (products.length === 0 && query.color) {
      console.log('No products found with color filter, trying without color');
      delete query.color;
      
      products = await Product.find(query)
        .sort({ average_rating: -1 })
        .limit(parseInt(limit))
        .lean();
      
      console.log(`Found ${products.length} products without color filter`);
    }
    
    // If still no products, try with just basic class and gender
    if (products.length === 0 && query.product_type) {
      console.log('No products found with product type, trying broader search');
      
      // If we had a specific product type, try the whole class mapping
      if (productType && clothingClass) {
        const possibleTypes = CLASS_MAPPING[clothingClass] || [];
        if (possibleTypes.length > 0) {
          delete query.product_type;
          query.product_type = { $in: possibleTypes };
          
          products = await Product.find(query)
            .sort({ average_rating: -1 })
            .limit(parseInt(limit))
            .lean();
          
          console.log(`Found ${products.length} products with broader class mapping`);
        }
      } else {
        // Otherwise just try any clothing
        delete query.product_type;
        if (query.clothing_class) delete query.clothing_class;
        
        products = await Product.find(query)
          .sort({ average_rating: -1 })
          .limit(parseInt(limit))
          .lean();
        
        console.log(`Found ${products.length} products with minimal filtering`);
      }
    }
    
    // Format response to ensure we have consistent data for display
    const formattedProducts = products.map(p => ({
      id: p._id || p.id,
      name: p.title || "Untitled Product",
      price: p.price ? `$${p.price.toFixed(2)}` : "Price unavailable",
      image_url: p.image_url || "https://via.placeholder.com/400x500?text=No+Image",
      url: p.product_url || "#",
      color: p.color || "unknown",
      type: p.product_type || "unknown",
      rating: p.average_rating || 0,
      brand: p.brand || "Unknown"
    }));
    
    res.json({ products: formattedProducts });
    
  } catch (error) {
    console.error('Error in product recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch product recommendations' });
  }
});

// API endpoint for available product subcategories
router.get('/product-subcategories', async (req, res) => {
  try {
    const { clothingClass, gender } = req.query;
    
    if (!clothingClass) {
      return res.status(400).json({ error: 'Clothing class is required' });
    }
    
    console.log(`Fetching subcategories for class: ${clothingClass}, gender: ${gender || 'all'}`);
    
    // Get database mapping for this clothing class
    const productTypes = CLASS_MAPPING[clothingClass] || [];
    
    // Build query to find available subcategories in the database
    const query = {};
    
    // Add product types from mapping
    if (productTypes.length > 0) {
      query.product_type = { $in: productTypes };
    } else {
      // Fallback to clothing class if no mapping exists
      query.clothing_class = clothingClass;
    }
    
    // Add gender filter if provided
    if (gender) {
      if (gender === 'male') {
        query.gender = { $in: ['men', 'unisex'] };
      } else if (gender === 'female') {
        query.gender = { $in: ['women', 'unisex'] };
      } else if (gender !== 'all') {
        query.gender = gender;
      }
    }
    
    console.log('Subcategory search query:', query);
    
    // Find distinct product types that match this query
    const availableTypes = await Product.distinct("product_type", query);
    
    console.log(`Found ${availableTypes.length} available product types:`, availableTypes);
    
    res.json({ subcategories: availableTypes });
    
  } catch (error) {
    console.error('Error fetching product subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch product subcategories', details: error.message });
  }
});

// Create proxy endpoint for Amazon images
router.get('/image-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).send('URL parameter is required');
    }
    
    // More permissive URL validation
    if (!url.match(/^https?:\/\//)) {
      return res.status(403).send('Invalid URL format');
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).send(`Error fetching image: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    
    // Enhanced CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    
    // Stream the image data
    response.body.pipe(res);
    
  } catch (error) {
    console.error('Error proxying image:', error);
    res.status(500).send('Error retrieving image');
  }
});

module.exports = router;