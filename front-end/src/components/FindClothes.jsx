import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { ProductFilters } from './ProductFilters';
import { ProductList } from './ProductList';

function FindClothes() {
  const [files, setFiles] = useState([]);
  const [imgPreviews, setImgPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [showHome, setShowHome] = useState(true);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [apiStatus, setApiStatus] = useState({ loading: false, error: null });
  const [userPreferences, setUserPreferences] = useState({
    gender: '',
    style: 'any',
    priceRange: 'any',
    items: []
  });

  // API endpoints - we'll try multiple in case the primary is down
  const apiEndpoints = [
    "https://outfit-detect-recs-production.up.railway.app/upload-photo/",
    "http://localhost:8080/upload-photo/" // Fallback to local development if running
  ];

  // Clothing taxonomy - for better categorization
  const clothingCategories = {
    tops: ["short sleeve top", "long sleeve top", "t-shirt", "shirt", "blouse", "sweater", "hoodie", "vest"],
    bottoms: ["shorts", "trousers", "skirt", "jeans", "pants"],
    outerwear: ["short sleeve outwear", "long sleeve outwear", "jacket", "coat"],
    dresses: ["short sleeve dress", "long sleeve dress", "vest dress", "sling dress"],
    others: ["sling", "suit"]
  };

  // Map to convert model classes to user-friendly names
  const classNameMapping = {
    "short sleeve top": "Short Sleeve Shirt/Top",
    "long sleeve top": "Long Sleeve Shirt/Top",
    "short sleeve outwear": "Light Jacket",
    "long sleeve outwear": "Jacket/Coat",
    "vest": "Vest/Sleeveless Top",
    "shorts": "Shorts",
    "trousers": "Trousers/Pants",
    "skirt": "Skirt",
    "short sleeve dress": "Short Sleeve Dress",
    "long sleeve dress": "Long Sleeve Dress",
    "vest dress": "Sleeveless Dress",
    "sling dress": "Sling Dress",
    "sling": "Sling/Strap Top"
  };

  // Maximum number of files allowed
  const MAX_FILES = 5;
  const MIN_FILES = 1; // Changed to 1 to allow single outfit analysis

  // Handle file change for multiple image uploads
  const handleFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const selectedFiles = Array.from(e.target.files);
    
    // Check if we're exceeding the maximum allowed files
    if (files.length + selectedFiles.length > MAX_FILES) {
      setError(`You can only upload up to ${MAX_FILES} images in total.`);
      return;
    }

    // Add new files to existing files
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
    
    // Generate previews for the newly selected files
    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (e) => {
        setImgPreviews(prevPreviews => [...prevPreviews, e.target.result]);
      };
    });

    // Clear any existing error
    setError(null);
  };

  // Remove a file from the selection
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setImgPreviews(imgPreviews.filter((_, i) => i !== index));
  };

  // Process each image and analyze styles
  const processImages = async () => {
    if (files.length < MIN_FILES) {
      setError(`Please upload at least ${MIN_FILES} image to analyze your style.`);
      return;
    }

    setLoading(true);
    setError(null);
    
    const detections = [];
    
    // Process each file
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        // Try each endpoint until one works
        let response = null;
        for (const endpoint of apiEndpoints) {
          try {
            // Set a timeout to prevent long waits for dead endpoints
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            response = await fetch(endpoint, {
              method: "POST",
              body: formData,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              break; // Exit the loop if we get a successful response
            }
          } catch (error) {
            console.error(`Error with endpoint ${endpoint}:`, error);
            // Continue to next endpoint
          }
        }
        
        if (!response || !response.ok) {
          throw new Error("Failed to process image. All endpoints failed.");
        }
        
        const data = await response.json();
        
        // Check if response includes detected clothing
        if (data.text && !data.text.includes("No outfit detected") && !data.text.includes("Multiple outfits detected")) {
          const parsedOutfit = parseDetectionText(data.text);
          if (parsedOutfit) {
            detections.push(parsedOutfit);
          }
        }
      } catch (error) {
        console.error("Error processing image:", error);
      }
    }
    
    if (detections.length === 0) {
      setError("Could not detect any clothing items in your images. Please try again with clearer photos.");
      setLoading(false);
      return;
    }
    
    // Extract all unique clothing items from all detections
    setAnalyzing(true);
    try {
      const allItems = extractAllClothingItems(detections);
      setDetectedItems(allItems);
      
      // Analyze common styles
      const styleAnalysis = analyzeStyles(detections);
      setResults(styleAnalysis);
      
      // Initialize user preferences with detected items
      setUserPreferences({
        gender: '', // Will be selected by user
        style: 'any',
        priceRange: 'any',
        items: allItems
      });
      
      // Show verification form
      setShowVerificationForm(true);
    } catch (err) {
      console.error("Error analyzing styles:", err);
      setError("Failed to analyze your style. Please try again.");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };
  
  // Extract all unique clothing items from detections
  const extractAllClothingItems = (detections) => {
    // Create a map to store unique items by type
    const uniqueItems = new Map();
    
    detections.forEach(detection => {
      detection.forEach(item => {
        const itemType = item.type;
        const itemColor = item.colors[0] || 'neutral';
        
        // Create a unique key for this item type
        const key = `${itemType}`;
        
        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, {
            id: nanoid(),
            type: itemType,
            color: itemColor,
            enabled: true,
            category: getCategoryForType(itemType),
            displayName: classNameMapping[itemType] || itemType
          });
        }
      });
    });
    
    return Array.from(uniqueItems.values());
  };
  
  // Get category for a clothing type
  const getCategoryForType = (type) => {
    for (const [category, types] of Object.entries(clothingCategories)) {
      if (types.includes(type)) {
        return category;
      }
    }
    return 'others';
  };

  // Parse the detection text to extract clothing items and their attributes
  const parseDetectionText = (text) => {
    try {
      // Extract from structured data in format:
      // - **Rating**: 7/10
      // - **Color Harmony**: ...
      // etc.
      
      const parts = text.split('- **');
      const items = [];
      
      // List of detected clothing items from our model
      const clothingKeywords = [
        'short sleeve top', 'long sleeve top', 'short sleeve outwear', 
        'long sleeve outwear', 'vest', 'shorts', 'trousers', 'skirt', 
        'short sleeve dress', 'long sleeve dress', 'vest dress', 'sling dress', 'sling',
        't-shirt', 'shirt', 'blouse', 'top', 'pants', 'jeans', 'jacket', 'coat'
      ];
      
      const colorKeywords = [
        'red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 
        'pink', 'brown', 'gray', 'grey', 'orange', 'navy', 'cream', 'beige', 
        'tan', 'gold', 'silver', 'khaki', 'olive', 'maroon', 'teal', 'turquoise'
      ];
      
      // Look for clothing items in the text
      parts.forEach(part => {
        if (!part) return;
        
        const lowerPart = part.toLowerCase();
        
        // First check exact matches from our model's class names
        for (const clothingItem of clothingKeywords) {
          if (lowerPart.includes(clothingItem)) {
            // Find associated colors
            const colors = colorKeywords.filter(color => lowerPart.includes(color));
            
            items.push({
              type: clothingItem,
              colors: colors.length > 0 ? colors : ['neutral']
            });
          }
        }
      });
      
      return items.length > 0 ? items : null;
    } catch (error) {
      console.error("Error parsing detection text:", error);
      return null;
    }
  };

  // Analyze common styles across all detections
  const analyzeStyles = (detections) => {
    if (!detections || detections.length === 0) {
      throw new Error("No detections to analyze");
    }
    
    // Count frequency of clothing types and colors
    const typeFrequency = {};
    const colorFrequency = {};
    
    detections.forEach(items => {
      if (!items) return;
      
      items.forEach(item => {
        // Count clothing types
        typeFrequency[item.type] = (typeFrequency[item.type] || 0) + 1;
        
        // Count colors
        item.colors.forEach(color => {
          colorFrequency[color] = (colorFrequency[color] || 0) + 1;
        });
      });
    });
    
    // Find all detected types and colors
    const allTypes = Object.keys(typeFrequency);
    const allColors = Object.keys(colorFrequency);
    
    if (allTypes.length === 0 || allColors.length === 0) {
      throw new Error("Couldn't identify styles");
    }
    
    return {
      types: allTypes,
      colors: allColors,
      // Create search queries by combining types and colors
      searchQueries: allTypes.flatMap(type => 
        allColors.map(color => `${color} ${type}`)
      )
    };
  };

  // Handle changes in the verification form
  const handlePreferenceChange = (e) => {
    const { name, value } = e.target;
    setUserPreferences({
      ...userPreferences,
      [name]: value
    });
  };

  // Handle toggle for clothing items
  const toggleItemEnabled = (id) => {
    setUserPreferences(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    }));
  };

  // Handle changes in item type or color
  const handleItemChange = (id, field, value) => {
    setUserPreferences(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  // Add a new custom item
  const addCustomItem = () => {
    const newItem = {
      id: nanoid(),
      type: 'short sleeve top', // Default value
      color: 'black', // Default value
      enabled: true,
      category: 'tops',
      displayName: classNameMapping['short sleeve top'] || 'Short Sleeve Top'
    };
    
    setUserPreferences(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Remove a custom item
  const removeItem = (id) => {
    setUserPreferences(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  // Submit the verified preferences and fetch products
  const submitPreferences = async () => {
    if (!userPreferences.gender) {
      setError("Please select a gender preference for more accurate recommendations.");
      return;
    }
    
    const enabledItems = userPreferences.items.filter(item => item.enabled);
    
    if (enabledItems.length === 0) {
      setError("Please enable at least one clothing item to get recommendations.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Generate search queries based on user preferences
      const searchQueries = enabledItems.map(item => ({
        type: item.type,
        color: item.color,
        gender: userPreferences.gender,
        priceRange: userPreferences.priceRange,
        style: userPreferences.style
      }));
      
      // Fetch real products with filtered preferences
      await fetchRealProducts(searchQueries);
      
      // Hide verification form and show results
      setShowVerificationForm(false);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to fetch product recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch real product data from Amazon via RapidAPI
  const fetchRealProducts = async (queries) => {
    setApiStatus({ loading: true, error: null });
    
    try {
      const allProducts = [];
      
      // Process each query (clothing item) one at a time
      for (const query of queries) {
        try {
          const searchTerm = `${query.color} ${query.type} ${query.gender}`;
          
          // Make request to your backend to proxy the API call
          const response = await fetch('/api/amazon-products', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              searchTerm,
              gender: query.gender,
              priceRange: query.priceRange,
              style: query.style
            })
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch products from API');
          }
          
          const data = await response.json();
          
          // Process and add the products
          if (data && data.products && data.products.length > 0) {
            // Add metadata to each product
            const processedProducts = data.products.map(product => ({
              ...product,
              query: {
                type: query.type,
                color: query.color,
                gender: query.gender
              }
            }));
            
            allProducts.push(...processedProducts);
          }
        } catch (error) {
          console.error(`Error fetching products for ${query.type}:`, error);
          // Continue with other queries even if one fails
        }
      }
      
      // If we couldn't get any real products, fall back to mock products
      if (allProducts.length === 0) {
        const mockProducts = createMockProducts(queries);
        setProducts(mockProducts);
        setApiStatus({ loading: false, error: "Couldn't retrieve real products, showing mock data instead." });
      } else {
        setProducts(allProducts);
        setApiStatus({ loading: false, error: null });
      }
    } catch (error) {
      console.error("Error in product fetching:", error);
      // Fallback to mock products
      const mockProducts = createMockProducts(queries);
      setProducts(mockProducts);
      setApiStatus({ loading: false, error: "API request failed, showing mock products instead." });
    }
  };

  // Create mock product data if API fails
  const createMockProducts = (queries) => {
    const mockProducts = [];
    
    // Indian brand names by gender
    const menBrandNames = [
      'Allen Solly', 'Van Heusen', 'Louis Philippe', 'Peter England',
      'Raymond', 'Park Avenue', 'Manyavar', 'Indian Terrain', 'Wrogn',
      'U.S. Polo Assn.', 'Flying Machine', 'Rare Rabbit', 'Spykar'
    ];
    
    const womenBrandNames = [
      'W for Woman', 'Biba', 'FabIndia', 'AND', 'Global Desi',
      'Zara', 'H&M', 'Westside', 'Label Ritu Kumar', 'Anita Dongre',
      'Mango', 'Forever 21', 'Libas', 'Aurelia'
    ];
    
    const unisexBrandNames = [
      'Levi\'s', 'H&M', 'Zara', 'Marks & Spencer', 'GAP', 
      'United Colors of Benetton', 'Tommy Hilfiger', 'Adidas', 'Nike',
      'Puma', 'Reebok'
    ];
    
    queries.forEach(query => {
      let brandNames = [];
      
      if (query.gender === 'men') {
        brandNames = [...menBrandNames, ...unisexBrandNames];
      } else if (query.gender === 'women') {
        brandNames = [...womenBrandNames, ...unisexBrandNames];
      } else {
        brandNames = [...menBrandNames, ...womenBrandNames, ...unisexBrandNames];
      }
      
      // Create 2-4 products for each query
      const numProducts = Math.floor(Math.random() * 3) + 2;
      
      for (let i = 0; i < numProducts; i++) {
        const brand = brandNames[Math.floor(Math.random() * brandNames.length)];
        let price;
        
        // Set price based on priceRange
        if (query.priceRange === 'budget') {
          price = Math.floor(Math.random() * 500) + 299;
        } else if (query.priceRange === 'premium') {
          price = Math.floor(Math.random() * 3000) + 2000;
        } else {
          price = Math.floor(Math.random() * 1500) + 499;
        }
        
        // Generate product ID
        const productId = nanoid(8);
        
        // Create product title
        const genderLabel = query.gender === 'men' ? 'Men' : query.gender === 'women' ? 'Women' : 'Unisex';
        const stylePrefix = query.style !== 'any' ? `${query.style} ` : '';
        
        const titles = [
          `${brand} ${stylePrefix}${query.color.charAt(0).toUpperCase() + query.color.slice(1)} ${query.type} for ${genderLabel}`,
          `${brand} Premium ${query.color} ${query.type} - ${genderLabel}`,
          `${brand} Signature ${query.color} ${query.type} Collection (${genderLabel})`,
          `${brand} Designer ${query.color} ${query.type} - ${genderLabel} Fashion`
        ];
        
        const title = titles[Math.floor(Math.random() * titles.length)];
        
        // Product attributes
        const attributes = [
          `Size: ${['S', 'M', 'L', 'XL', 'XXL'][Math.floor(Math.random() * 5)]}`,
          `Material: ${['Cotton', 'Linen', 'Polyester', 'Cotton Blend', 'Silk'][Math.floor(Math.random() * 5)]}`,
          `Pattern: ${['Solid', 'Striped', 'Checkered', 'Printed', 'Plain'][Math.floor(Math.random() * 5)]}`,
          `Fit: ${['Regular', 'Slim', 'Relaxed', 'Tailored', 'Oversized'][Math.floor(Math.random() * 5)]}`
        ];
        
        // Image dimensions
        const imageWidth = 300;
        const imageHeight = 400;
        
        mockProducts.push({
          id: productId,
          title: title,
          brand: brand,
          description: `Premium quality ${query.color} ${query.type} perfect for all occasions.`,
          attributes: attributes,
          price: `₹${price.toLocaleString('en-IN')}`,
          rating: (Math.random() * 2 + 3).toFixed(1),
          reviews: Math.floor(Math.random() * 1000) + 10,
          image: `/api/placeholder/${imageWidth}/${imageHeight}`,
          link: `https://www.amazon.in/dp/${productId}`,
          query: {
            type: query.type,
            color: query.color,
            gender: query.gender,
            style: query.style,
            priceRange: query.priceRange
          }
        });
      }
    });
    
    return mockProducts;
  };

  // Reset the component state
  const resetState = () => {
    setFiles([]);
    setImgPreviews([]);
    setResults(null);
    setProducts([]);
    setError(null);
    setApiStatus({ loading: false, error: null });
    setShowVerificationForm(false);
    setUserPreferences({
      gender: '',
      style: 'any',
      priceRange: 'any',
      items: []
    });
  };

  // Render clothing type options grouped by category
  const renderClothingTypeOptions = () => {
    return Object.entries(clothingCategories).map(([category, types]) => (
      <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
        {types.map(type => (
          <option key={type} value={type}>
            {classNameMapping[type] || type}
          </option>
        ))}
      </optgroup>
    ));
  };

  // Render the color options
  const renderColorOptions = () => {
    const colors = [
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 
      'pink', 'brown', 'gray', 'orange', 'navy', 'cream', 'beige', 
      'tan', 'gold', 'silver', 'khaki', 'olive', 'maroon', 'teal'
    ];
    
    return colors.map(color => (
      <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
    ));
  };

  if (showHome) {
    return (
      <div className='fc-find-clothes-home'>
        <div className="fc-hero-section">
          <h1 className='fc-app-title'>DressPro: Find Your Style</h1>
          <p className='fc-app-details'>
            Upload outfit photos and we'll analyze your style preferences to recommend matching products from top brands on Amazon.in.
          </p>
          <button className='fc-start-btn' onClick={() => setShowHome(false)}>Get Started</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-find-clothes-container">
      <h2 className="fc-section-title">Find Your Perfect Style</h2>
      
      {!loading && !results && !showVerificationForm && (
        <div className="fc-upload-section">
          <p className="fc-instructions">
            Upload 1-5 photos of outfits you like to help us understand your style preferences.
          </p>
          
          <div className="fc-file-upload-area">
            <div className="fc-image-grid">
              {imgPreviews.map((preview, index) => (
                <div key={index} className="fc-image-card">
                  <div className="fc-image-wrapper">
                    <img src={preview} alt={`Outfit ${index + 1}`} />
                    <button 
                      className="fc-remove-btn" 
                      onClick={() => removeFile(index)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              
              {files.length < MAX_FILES && (
                <div className="fc-image-card fc-upload-card">
                  <label htmlFor="file-input" className="fc-upload-label">
                    <div className="fc-upload-placeholder">
                      <span className="fc-upload-icon">+</span>
                      <span>Add Photo</span>
                    </div>
                    <input
                      id="file-input"
                      type="file"
                      accept=".jpg, .jpeg, .png"
                      multiple
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          
          {error && <p className="fc-error-message">{error}</p>}
          
          <div className="fc-file-status">
            <span className={`fc-file-count ${files.length >= MIN_FILES ? 'fc-sufficient' : 'fc-insufficient'}`}>
              {files.length} of {MAX_FILES} images selected {files.length < MIN_FILES ? `(Need at least ${MIN_FILES})` : ''}
            </span>
          </div>
          
          <div className="fc-action-buttons">
            <button 
              className="fc-analyze-btn" 
              onClick={processImages}
              disabled={files.length < MIN_FILES}
            >
              Analyze My Style
            </button>
            <button className="fc-back-btn" onClick={() => setShowHome(true)}>
              Back to Home
            </button>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="fc-loading-section">
          <div className="fc-spinner"></div>
          <p className="fc-loading-text">{analyzing ? "Analyzing your style preferences..." : "Processing your images..."}</p>
        </div>
      )}
      
      {showVerificationForm && !loading && (
        <div className="fc-verification-section">
          <h3>Verify Your Style Preferences</h3>
          <p className="fc-verification-instruction">
            We've detected these items in your photos. Please verify and adjust as needed:
          </p>
          
          {error && <p className="fc-error-message">{error}</p>}
          
          <div className="fc-verification-form">
            <div className="fc-form-group">
              <label htmlFor="gender-select">Select Gender:</label>
              <select 
                id="gender-select"
                name="gender"
                value={userPreferences.gender}
                onChange={handlePreferenceChange}
                className="fc-select"
                required
              >
                <option value="">-- Select Gender --</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            
            <div className="fc-form-group">
              <label htmlFor="style-select">Style Preference:</label>
              <select 
                id="style-select"
                name="style"
                value={userPreferences.style}
                onChange={handlePreferenceChange}
                className="fc-select"
              >
                <option value="any">Any Style</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
                <option value="business">Business</option>
                <option value="party">Party</option>
                <option value="ethnic">Ethnic</option>
                <option value="sports">Sports/Athletic</option>
              </select>
            </div>
            
            <div className="fc-form-group">
              <label htmlFor="price-select">Price Range:</label>
              <select 
                id="price-select"
                name="priceRange"
                value={userPreferences.priceRange}
                onChange={handlePreferenceChange}
                className="fc-select"
              >
                <option value="any">Any Price</option>
                <option value="budget">Budget (Under ₹1000)</option>
                <option value="mid">Mid-Range (₹1000-₹2500)</option>
                <option value="premium">Premium (Above ₹2500)</option>
              </select>
            </div>
            
            <div className="fc-detected-items">
              <h4>Detected Items:</h4>
              {userPreferences.items.map((item) => (
                <div key={item.id} className="fc-item-card">
                  <div className="fc-item-toggle">
                    <input
                      type="checkbox"
                      id={`toggle-item-${item.id}`}
                      checked={item.enabled}
                      onChange={() => toggleItemEnabled(item.id)}
                    />
                    <label htmlFor={`toggle-item-${item.id}`}>Include</label>
                  </div>
                  
                  <div className="fc-item-fields">
                    <div className="fc-form-group">
                      <label>Type:</label>
                      <select 
                        value={item.type}
                        onChange={(e) => handleItemChange(item.id, 'type', e.target.value)}
                        className="fc-select fc-select-sm"
                      >
                        {renderClothingTypeOptions()}
                      </select>
                    </div>
                    
                    <div className="fc-
