import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
// import './FindClothes.css';

function FindClothes() {
  const [files, setFiles] = useState([]);
  const [imgPreviews, setImgPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [products, setProducts] = useState([]);
  const [showHome, setShowHome] = useState(true);

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
      
      // Fetch products based on analysis
      await fetchProducts(styleAnalysis);
    } catch (err) {
      console.error("Error analyzing styles:", err);
      setError("Failed to analyze your style. Please try again.");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  // Parse the detection text to extract clothing items and their attributes
  const parseDetectionText = (text) => {
    try {
      // This is a simple parser - you might need to adjust based on your API response format
      const parts = text.split('- **');
      const items = [];
      
      // Extract clothing items mentioned in the text
      const clothingKeywords = ['top', 'bottom', 'dress', 'outwear', 'jacket', 'shirt', 'blouse', 'skirt', 'pants', 'trousers', 'sleeve'];
      const colorKeywords = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'pink', 'brown', 'gray', 'grey', 'orange', 'navy', 'cream', 'beige', 'tan', 'gold', 'silver'];
      
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

  // Fetch real product data from Amazon.in
  const fetchProducts = async (styleAnalysis) => {
    try {
      // For demo purposes, we'll create enhanced mock product data
      // In a production app, you would integrate with an actual Amazon API or web scraping service
      const mockProducts = createAmazonProducts(styleAnalysis);
      setProducts(mockProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to fetch product recommendations. Please try again.");
    }
  };

  // Create mock Amazon.in products with realistic images, names and prices
  const createAmazonProducts = (styleAnalysis) => {
    const mockProducts = [];
    
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
      'sleeve': 'sleeves'
    };
    
    // Indian brand names for more authentic results
    const brandNames = [
      'Allen Solly', 'Van Heusen', 'Louis Philippe', 'Peter England',
      'Raymond', 'Park Avenue', 'W for Woman', 'Biba', 'FabIndia',
      'AND', 'Global Desi', 'Manyavar', 'Zara', 'H&M', 'Westside'
    ];
    
    styleAnalysis.searchQueries.forEach((query, index) => {
      // Create 2-4 products for each query
      const numProducts = Math.floor(Math.random() * 3) + 2;
      
      // Extract the color and type
      const parts = query.split(' ');
      const color = parts[0];
      const type = parts[1];
      
      // Get appropriate category for the search
      const category = categories[type] || type;
      
      for (let i = 0; i < numProducts; i++) {
        const brand = brandNames[Math.floor(Math.random() * brandNames.length)];
        const price = Math.floor(Math.random() * 2000) + 499; // Price in INR
        
        // Create a more realistic product title
        const titles = [
          `${brand} ${color.charAt(0).toUpperCase() + color.slice(1)} ${type} for ${Math.random() > 0.5 ? 'Men' : 'Women'}`,
          `${brand} Casual ${color} ${type}`,
          `${brand} Formal ${color} ${type}`,
          `${brand} Designer ${color} ${type}`,
          `${brand} ${color} ${type} Collection`
        ];
        
        const title = titles[Math.floor(Math.random() * titles.length)];
        
        // Generate a more realistic image path - in a real app, this would be an actual product image URL
        // For now we'll use placeholders, but in a real implementation you'd fetch actual images
        const imageNum = Math.floor(Math.random() * 10) + 1;
        const imageWidth = 300;
        const imageHeight = 400;
        
        mockProducts.push({
          id: nanoid(),
          title: title,
          brand: brand,
          description: `Premium quality ${color} ${type} perfect for all occasions. Made with high-quality fabric for comfort and style.`,
          price: `₹${price.toLocaleString('en-IN')}`,
          rating: (Math.random() * 2 + 3).toFixed(1), // Rating between 3.0 and 5.0
          reviews: Math.floor(Math.random() * 500) + 10, // Number of reviews
          image: `/api/placeholder/${imageWidth}/${imageHeight}`, // Placeholder image
          link: `https://www.amazon.in/s?k=${encodeURIComponent(brand + '+' + color + '+' + category)}&crid=2M096C61O4MLT&sprefix=${encodeURIComponent(color + '+' + category)}`,
          query: query
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
  };

  if (showHome) {
    return (
      <div className='find-clothes-home'>
        <div className="hero-section">
          <h1 className='app-title'>Find Your Style</h1>
          <p className='app-details'>
            Upload multiple outfit photos and we'll analyze your style preferences to recommend matching products from top Indian brands.
          </p>
          <button className='start-btn' onClick={() => setShowHome(false)}>Get Started</button>
        </div>
      </div>
    );
  }

  return (
    <div className="find-clothes-container">
      <h2 className="section-title">Find Your Perfect Style</h2>
      
      {!loading && !results && (
        <div className="upload-section">
          <p className="instructions">
            Upload 2-5 photos of outfits you like to help us understand your style preferences.
          </p>
          
          <div className="file-upload-area">
            <div className="image-grid">
              {imgPreviews.map((preview, index) => (
                <div key={index} className="image-card">
                  <div className="image-wrapper">
                    <img src={preview} alt={`Outfit ${index + 1}`} />
                    <button 
                      className="remove-btn" 
                      onClick={() => removeFile(index)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              
              {files.length < MAX_FILES && (
                <div className="image-card upload-card">
                  <label htmlFor="file-input" className="upload-label">
                    <div className="upload-placeholder">
                      <span className="upload-icon">+</span>
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
          
          {error && <p className="error-message">{error}</p>}
          
          <div className="file-status">
            <span className={`file-count ${files.length >= MIN_FILES ? 'sufficient' : 'insufficient'}`}>
              {files.length} of {MAX_FILES} images selected {files.length < MIN_FILES ? `(Need at least ${MIN_FILES})` : ''}
            </span>
          </div>
          
          <div className="action-buttons">
            <button 
              className="analyze-btn" 
              onClick={processImages}
              disabled={files.length < MIN_FILES}
            >
              Analyze My Style
            </button>
            <button className="back-btn" onClick={() => setShowHome(true)}>
              Back to Home
            </button>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="loading-section">
          <div className="spinner"></div>
          <p className="loading-text">{analyzing ? "Analyzing your style preferences..." : "Processing your images..."}</p>
        </div>
      )}
      
      {results && !loading && (
        <div className="results-section">
          <div className="style-analysis">
            <h3>Your Style Profile</h3>
            <div className="style-tags">
              {results.types.map(type => (
                <span key={type} className="style-tag">{type}</span>
              ))}
              {results.colors.map(color => (
                <span key={color} className="style-tag color-tag" style={{backgroundColor: color === 'white' ? '#f8f9fa' : ''}}>{color}</span>
              ))}
            </div>
            <p className="analysis-description">
              Based on your uploads, we've identified your preferences for {results.colors.join(', ')} colors 
              and {results.types.join(', ')} styles. Here are some recommendations from Amazon.in:
            </p>
          </div>
          
          <div className="products-container">
            <h3>Recommended Products</h3>
            
            {products.length > 0 ? (
              <div className="products-grid">
                {products.map(product => (
                  <a 
                    key={product.id} 
                    href={product.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="product-card"
                  >
                    <div className="product-image">
                      <img src={product.image} alt={product.title} />
                    </div>
                    <div className="product-details">
                      <h4 className="product-title">{product.title}</h4>
                      <div className="product-brand">{product.brand}</div>
                      <div className="product-price">{product.price}</div>
                      <div className="product-rating">
                        <span className="stars">{'★'.repeat(Math.floor(parseFloat(product.rating)))}{'☆'.repeat(5 - Math.floor(parseFloat(product.rating)))}</span>
                        <span className="rating-count">({product.reviews})</span>
                      </div>
                      <div className="product-tag">{product.query}</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="no-products">No products found matching your style.</p>
            )}
          </div>
          
          <div className="action-buttons">
            <button className="analyze-btn" onClick={resetState}>
              Try Again
            </button>
            <button className="back-btn" onClick={() => setShowHome(true)}>
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FindClothes;
