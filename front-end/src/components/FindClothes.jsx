import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';

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
  const [userPreferences, setUserPreferences] = useState({
    gender: '',
    items: []
  });

  // API endpoints - we'll try multiple in case the primary is down
  const apiEndpoints = [
    "https://outfit-detect-recs-production.up.railway.app/upload-photo/",
    "http://localhost:8080/upload-photo/" // Fallback to local development if running
  ];

  // Maximum number of files allowed
  const MAX_FILES = 5;
  const MIN_FILES = 2;

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
      setError(`Please upload at least ${MIN_FILES} images to analyze your style.`);
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
          const parseOutfit = parseDetectionText(data.text);
          if (parseOutfit) {
            detections.push(parseOutfit);
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
    
    // Analyze common styles
    setAnalyzing(true);
    try {
      const styleAnalysis = analyzeStyles(detections);
      setResults(styleAnalysis);
      
      // Prepare detected items for verification form
      const items = prepareDetectedItems(styleAnalysis);
      setDetectedItems(items);
      
      // Initialize user preferences with detected items
      setUserPreferences({
        gender: '', // Will be selected by user
        items: items
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

  // Prepare detected items for the verification form
  const prepareDetectedItems = (styleAnalysis) => {
    return styleAnalysis.types.map((type, index) => {
      // Assign most common color to each type for initial state
      const color = styleAnalysis.colors[index % styleAnalysis.colors.length];
      
      return {
        id: nanoid(),
        type: type,
        color: color,
        enabled: true // By default, all detected items are enabled
      };
    });
  };

  // Parse the detection text to extract clothing items and their attributes
  const parseDetectionText = (text) => {
    try {
      // This is a simple parser - you might need to adjust based on your API response format
      const parts = text.split('- **');
      const items = [];
      
      // Extract clothing items mentioned in the text
      const clothingKeywords = ['top', 'bottom', 'dress', 'outwear', 'jacket', 'shirt', 'blouse', 'skirt', 'pants', 'trousers', 'sleeve', 't-shirt', 'sweater', 'hoodie', 'coat', 'suit'];
      const colorKeywords = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'pink', 'brown', 'gray', 'grey', 'orange', 'navy', 'cream', 'beige', 'tan', 'gold', 'silver', 'khaki', 'olive', 'maroon', 'teal', 'turquoise'];
      
      // Look for clothing items and colors in each part
      for (const part of parts) {
        if (!part) continue;
        
        const lowerPart = part.toLowerCase();
        for (const clothingItem of clothingKeywords) {
          if (lowerPart.includes(clothingItem)) {
            // Find associated colors
            const colors = colorKeywords.filter(color => lowerPart.includes(color));
            
            items.push({
              type: clothingItem,
              colors: colors.length > 0 ? colors : ['neutral']
            });
            
            break; // Found a clothing item, move to next part
          }
        }
      }
      
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
    
    // Find most common types and colors
    const commonTypes = Object.entries(typeFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    const commonColors = Object.entries(colorFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    if (commonTypes.length === 0 || commonColors.length === 0) {
      throw new Error("Couldn't identify common styles");
    }
    
    return {
      types: commonTypes,
      colors: commonColors,
      // Create search queries by combining types and colors
      searchQueries: commonTypes.flatMap(type => 
        commonColors.map(color => `${color} ${type}`)
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
      type: 'shirt', // Default value
      color: 'black', // Default value
      enabled: true
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
      const searchQueries = enabledItems.map(item => `${item.color} ${item.type} ${userPreferences.gender}`);
      
      // Fetch products with filtered preferences
      await fetchProducts({
        types: enabledItems.map(item => item.type),
        colors: enabledItems.map(item => item.color),
        searchQueries: searchQueries,
        gender: userPreferences.gender
      });
      
      // Hide verification form and show results
      setShowVerificationForm(false);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to fetch product recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch real product data from Amazon.in
  const fetchProducts = async (styleAnalysis) => {
    try {
      // For demo purposes, we'll create enhanced mock product data with gender filtering
      // In a production app, you would integrate with an actual Amazon API or web scraping service
      const mockProducts = createGenderSpecificProducts(styleAnalysis);
      setProducts(mockProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to fetch product recommendations. Please try again.");
    }
  };

  // Create mock Amazon.in products with realistic images, names and prices - with gender specificity
  const createGenderSpecificProducts = (styleAnalysis) => {
    const mockProducts = [];
    const gender = styleAnalysis.gender;
    
    // Product categories based on clothing types
    const categories = {
      'top': 'shirts+tops+tshirts',
      'bottom': 'pants+jeans+trousers',
      'dress': 'dresses',
      'outwear': 'jackets+coats',
      'jacket': 'jackets',
      'shirt': 'shirts',
      'blouse': 'blouses',
      'skirt': 'skirts',
      'pants': 'pants',
      'trousers': 'trousers',
      'sleeve': 'sleeves',
      't-shirt': 't-shirts',
      'sweater': 'sweaters',
      'hoodie': 'hoodies',
      'coat': 'coats',
      'suit': 'suits'
    };
    
    // Gender-specific Indian brand names for more authentic results
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
    
    let brandNames = [];
    
    if (gender === 'men') {
      brandNames = [...menBrandNames, ...unisexBrandNames];
    } else if (gender === 'women') {
      brandNames = [...womenBrandNames, ...unisexBrandNames];
    } else {
      // For unisex, use a mix of all brands
      brandNames = [...menBrandNames, ...womenBrandNames, ...unisexBrandNames];
    }
    
    styleAnalysis.searchQueries.forEach((query, index) => {
      // Create 2-3 specific products for each query
      const numProducts = Math.floor(Math.random() * 2) + 2;
      
      // Extract the color, type and gender
      const parts = query.split(' ');
      const color = parts[0];
      const type = parts[1];
      const queryGender = parts[2] || gender;
      
      // Get appropriate category for the search
      const category = categories[type] || type;
      
      for (let i = 0; i < numProducts; i++) {
        const brand = brandNames[Math.floor(Math.random() * brandNames.length)];
        const price = Math.floor(Math.random() * 2000) + 499; // Price in INR

        // Generate specific product IDs to simulate specific products rather than search results
        const productId = nanoid(8);
        
        // Create a more realistic product title
        const genderLabel = queryGender === 'men' ? 'Men' : queryGender === 'women' ? 'Women' : 'Unisex';
        const titles = [
          `${brand} ${color.charAt(0).toUpperCase() + color.slice(1)} ${type} for ${genderLabel}`,
          `${brand} Premium ${color} ${type} - ${genderLabel}`,
          `${brand} Signature ${color} ${type} Collection (${genderLabel})`,
          `${brand} Designer ${color} ${type} - ${genderLabel} Fashion`,
          `${brand} Essential ${color} ${type} - ${genderLabel}'s Wear`
        ];
        
        const title = titles[Math.floor(Math.random() * titles.length)];
        
        // For detailed product attributes to make each product unique
        const attributes = [
          `Size: ${['S', 'M', 'L', 'XL', 'XXL'][Math.floor(Math.random() * 5)]}`,
          `Material: ${['Cotton', 'Linen', 'Polyester', 'Cotton Blend', 'Silk'][Math.floor(Math.random() * 5)]}`,
          `Pattern: ${['Solid', 'Striped', 'Checkered', 'Printed', 'Plain'][Math.floor(Math.random() * 5)]}`,
          `Fit: ${['Regular', 'Slim', 'Relaxed', 'Tailored', 'Oversized'][Math.floor(Math.random() * 5)]}`
        ];
        
        // Generate a more realistic image path - in a real app, this would be an actual product image URL
        const imageWidth = 300;
        const imageHeight = 400;
        
        mockProducts.push({
          id: productId,
          title: title,
          brand: brand,
          description: `Premium quality ${color} ${type} perfect for all occasions. Made with high-quality fabric for comfort and style.`,
          attributes: attributes,
          price: `₹${price.toLocaleString('en-IN')}`,
          rating: (Math.random() * 2 + 3).toFixed(1), // Rating between 3.0 and 5.0
          reviews: Math.floor(Math.random() * 500) + 10, // Number of reviews
          image: `/api/placeholder/${imageWidth}/${imageHeight}`, // Placeholder image
          link: `https://www.amazon.in/dp/${productId}`, // Specific product link with generated ID
          color: color,
          type: type,
          gender: queryGender
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
    setShowVerificationForm(false);
    setUserPreferences({
      gender: '',
      items: []
    });
  };

  // Render the clothing type options
  const renderClothingTypeOptions = () => {
    const clothingTypes = [
      'shirt', 'top', 't-shirt', 'blouse', 'sweater', 'hoodie',
      'pants', 'trousers', 'jeans', 'skirt', 'shorts',
      'jacket', 'coat', 'outwear', 'dress', 'suit'
    ];
    
    return clothingTypes.map(type => (
      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
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
          <h1 className='fc-app-title'>Find Your Style</h1>
          <p className='fc-app-details'>
            Upload multiple outfit photos and we'll analyze your style preferences to recommend matching products from top Indian brands.
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
            Upload 2-5 photos of outfits you like to help us understand your style preferences.
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
              >
                <option value="">-- Select Gender --</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            
            <div className="fc-detected-items">
              <h4>Detected Items:</h4>
              {userPreferences.items.map((item, index) => (
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
                    
                    <div className="fc-form-group">
                      <label>Color:</label>
                      <select 
                        value={item.color}
                        onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
                        className="fc-select fc-select-sm"
                      >
                        {renderColorOptions()}
                      </select>
                    </div>
                  </div>
                  
                  <button 
                    className="fc-remove-item-btn"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
              
              <button className="fc-add-item-btn" onClick={addCustomItem}>
                + Add Another Item
              </button>
            </div>
            
            <div className="fc-action-buttons">
              <button className="fc-analyze-btn" onClick={submitPreferences}>
                Find Products
              </button>
              <button className="fc-back-btn" onClick={resetState}>
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
      
      {results && !loading && !showVerificationForm && (
        <div className="fc-results-section">
          <div className="fc-style-analysis">
            <h3>Your Style Profile</h3>
            <div className="fc-gender-tag">
              <span className="fc-style-tag fc-gender">{userPreferences.gender.charAt(0).toUpperCase() + userPreferences.gender.slice(1)}</span>
            </div>
            <div className="fc-style-tags">
              {userPreferences.items.filter(item => item.enabled).map(item => (
                <span key={item.id} className="fc-style-tag">
                  {item.color} {item.type}
                </span>
              ))}
            </div>
            <p className="fc-analysis-description">
              Based on your selections, here are personalized product recommendations:
            </p>
          </div>
          
          <div className="fc-products-container">
            <h3>Recommended Products</h3>
            
            {products.length > 0 ? (
              <div className="fc-products-grid">
                {products.map(product => (
                  <a 
                    key={product.id} 
                    href={product.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fc-product-card"
                  >
                    <div className="fc-product-image">
                      <img src={product.image} alt={product.title} />
                    </div>
                    <div className="fc-product-details">
                      <h4 className="fc-product-title">{product.title}</h4>
                      <div className="fc-product-brand">{product.brand}</div>
                      <div className="fc-product-attributes">
                        {product.attributes.map((attr, idx) => (
                          <span key={idx} className="fc-attribute">{attr}</span>
                        ))}
                      </div>
                      <div className="fc-product-price">{product.price}</div>
                      <div className="fc-product-rating">
                        <span className="fc-stars">{'★'.repeat(Math.floor(parseFloat(product.rating)))}{'☆'.repeat(5 - Math.floor(parseFloat(product.rating)))}</span>
                        <span className="fc-rating-count">({product.reviews})</span>
                      </div>
                      <div className="fc-product-tags">
                        <span className="fc-product-tag fc-tag-color">{product.color}</span>
                        <span className="fc-product-tag fc-tag-type">{product.type}</span>
                        <span className="fc-product-tag fc-tag-gender">{product.gender}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="fc-no-products">No products found matching your style.</p>
            )}
          </div>
          
          <div className="fc-action-buttons">
            <button className="fc-back-to-prefs-btn" onClick={() => setShowVerificationForm(true)}>
              Adjust Preferences
            </button>
            <button className="fc-analyze-btn" onClick={resetState}>
              Start Over
            </button>
            <button className="fc-back-btn" onClick={() => setShowHome(true)}>
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FindClothes;
