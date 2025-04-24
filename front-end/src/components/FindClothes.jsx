import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';

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
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
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
    const styleAnalysis = analyzeStyles(detections);
    setResults(styleAnalysis);
    
    // Fetch products based on analysis
    await fetchProducts(styleAnalysis);
    
    setLoading(false);
    setAnalyzing(false);
  };

  // Parse the detection text to extract clothing items and their attributes
  const parseDetectionText = (text) => {
    try {
      // This is a simple parser - you might need to adjust based on your API response format
      const parts = text.split('- **');
      const items = [];
      
      // Extract clothing items mentioned in the text
      const clothingKeywords = ['top', 'bottom', 'dress', 'outwear', 'jacket', 'shirt', 'blouse', 'skirt', 'pants', 'trousers'];
      const colorKeywords = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'pink', 'brown', 'gray', 'orange', 'navy', 'cream', 'beige'];
      
      // Look for clothing items and colors in each part
      for (const part of parts) {
        for (const clothingItem of clothingKeywords) {
          if (part.toLowerCase().includes(clothingItem)) {
            // Find associated colors
            const colors = colorKeywords.filter(color => part.toLowerCase().includes(color));
            
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
    
    return {
      types: commonTypes,
      colors: commonColors,
      // Create search queries by combining types and colors
      searchQueries: commonTypes.flatMap(type => 
        commonColors.map(color => `${color} ${type}`)
      )
    };
  };

  // Fetch products using the Serp API (Google Search API)
  const fetchProducts = async (styleAnalysis) => {
    try {
      setProducts([]);
      
      // For demo purposes, we'll create mock product data
      // In a real application, you would call a product API here
      const mockProducts = createMockProducts(styleAnalysis);
      setProducts(mockProducts);
      
      // Example of using an actual API (commented out)
      /*
      // Using Google's Custom Search API as an example
      const apiKey = "YOUR_API_KEY";
      const cx = "YOUR_SEARCH_ENGINE_ID";
      
      const productResults = [];
      
      for (const query of styleAnalysis.searchQueries.slice(0, 3)) {
        const response = await fetch(
          `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query + " clothing buy")}&searchType=image`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          // Extract product information
          const items = data.items.slice(0, 4).map(item => ({
            id: nanoid(),
            title: item.title,
            link: item.link,
            image: item.image.thumbnailLink,
            source: item.displayLink,
            query: query
          }));
          
          productResults.push(...items);
        }
      }
      
      setProducts(productResults);
      */
      
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to fetch product recommendations. Please try again.");
    }
  };

  // Create mock products for demonstration
  const createMockProducts = (styleAnalysis) => {
    const mockProducts = [];
    
    styleAnalysis.searchQueries.forEach((query, index) => {
      // Create 2-4 products for each query
      const numProducts = Math.floor(Math.random() * 3) + 2;
      
      for (let i = 0; i < numProducts; i++) {
        mockProducts.push({
          id: nanoid(),
          title: `${query.charAt(0).toUpperCase() + query.slice(1)} Fashion Item ${i + 1}`,
          description: `Stylish ${query} perfect for any occasion`,
          price: `$${Math.floor(Math.random() * 100) + 20}.99`,
          image: `/api/placeholder/300/300`, // Placeholder image
          link: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
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
      <div className='home'>
        <br />
        <br />
        <br />
        <h1 className='app-title'>Find Clothes</h1>
        <p className='app-details'>
          Upload multiple outfit photos and we'll analyze your style to recommend matching products.
        </p>
        <button className='btn' onClick={() => setShowHome(false)}>Get Started</button>
      </div>
    );
  }

  return (
    <div className="find-clothes-container">
      <h2 className="section-title">Find Your Style</h2>
      
      {!loading && !results && (
        <div className="upload-section">
          <p className="instructions">
            Upload 2-5 photos of outfits you like to help us understand your style preferences.
          </p>
          
          <div className="file-upload-area">
            {files.length < MAX_FILES && (
              <div className="upload-button-container">
                <label htmlFor="file-input" className="img-input-label">
                  Choose Images
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept=".jpg, .jpeg, .png"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            )}
            
            <div className="file-preview-container">
              {imgPreviews.map((preview, index) => (
                <div key={index} className="file-preview">
                  <img src={preview} alt={`Preview ${index + 1}`} />
                  <button 
                    className="remove-file-btn" 
                    onClick={() => removeFile(index)}
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {error && <p className="error-message">{error}</p>}
          
          <div className="action-buttons">
            <button 
              className="btn" 
              onClick={processImages}
              disabled={files.length < MIN_FILES}
            >
              Analyze My Style
            </button>
            <button className="btn secondary" onClick={() => setShowHome(true)}>
              Back to Home
            </button>
          </div>
          
          <p className="file-count">
            {files.length} of {MAX_FILES} images selected
          </p>
        </div>
      )}
      
      {loading && (
        <div className="loading-section">
          <div className="loading" />
          <p>{analyzing ? "Analyzing your style..." : "Processing your images..."}</p>
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
                <span key={color} className="style-tag color-tag">{color}</span>
              ))}
            </div>
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
                    <h4 className="product-title">{product.title}</h4>
                    <p className="product-price">{product.price}</p>
                    <div className="product-tag">{product.query}</div>
                  </a>
                ))}
              </div>
            ) : (
              <p>No products found matching your style.</p>
            )}
          </div>
          
          <div className="action-buttons">
            <button className="btn" onClick={resetState}>
              Start Over
            </button>
            <button className="btn secondary" onClick={() => setShowHome(true)}>
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FindClothes;