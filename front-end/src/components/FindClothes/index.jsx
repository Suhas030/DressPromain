// File: src/components/FindClothes/index.jsx
import { useState } from 'react';
import UploadSection from './UploadSection';
import DetectedItemsSection from './DetectedItemsSection';
import VerificationForm from './VerificationForm';
import ResultsSection from './ResultsSection';

function FindClothes() {
  const [files, setFiles] = useState([]);
  const [imgPreviews, setImgPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [showHome, setShowHome] = useState(true);
  const [showDetectedItems, setShowDetectedItems] = useState(false);
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

  // Amazon product API endpoint (replace with your actual API endpoint)
  const amazonApiEndpoint = "https://your-amazon-api-service.com/api/search";

  // Maximum number of files allowed
  const MAX_FILES = 5;
  const MIN_FILES = 2;

  // Process each image and analyze styles
  const processImages = async () => {
    if (files.length < MIN_FILES) {
      setError(`Please upload at least ${MIN_FILES} images to analyze your style.`);
      return;
    }

    setLoading(true);
    setError(null);
    
    const allDetections = [];
    const detectionsByImage = {};
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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
          if (parsedOutfit && parsedOutfit.length > 0) {
            // Store detections by image index
            detectionsByImage[i] = parsedOutfit;
            allDetections.push(...parsedOutfit);
          }
        }
      } catch (error) {
        console.error("Error processing image:", error);
      }
    }
    
    if (allDetections.length === 0) {
      setError("Could not detect any clothing items in your images. Please try again with clearer photos.");
      setLoading(false);
      return;
    }
    
    // Analyze detected items
    try {
      // Prepare all detected items with image reference
      const items = prepareAllDetectedItems(detectionsByImage);
      setDetectedItems(items);
      
      // Show detected items section
      setShowDetectedItems(true);
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
      // This improved parser focuses on top and bottom colors as detected by the model
      const items = [];
      
      // Look specifically for top and bottom patterns in the detection text
      const topMatch = text.toLowerCase().match(/(top|shirt|t-shirt|blouse|sweater|hoodie|jacket|blazer).*?(red|blue|green|black|white|yellow|purple|pink|brown|gray|grey|orange|navy|cream|beige|tan)/i);
      
      const bottomMatch = text.toLowerCase().match(/(bottom|pants|jeans|trousers|shorts|skirt|dress).*?(red|blue|green|black|white|yellow|purple|pink|brown|gray|grey|orange|navy|cream|beige|tan)/i);

      // If top is detected, add it with its color
      if (topMatch) {
        items.push({
          type: 'top',
          colors: [topMatch[2]], // Use the color detected for top
        });
      }
      
      // If bottom is detected, add it with its color
      if (bottomMatch) {
        items.push({
          type: 'bottom',
          colors: [bottomMatch[2]], // Use the color detected for bottom
        });
      }
      
      // If dress is detected (as a single item), add it with its color
      const dressMatch = text.toLowerCase().match(/(dress).*?(red|blue|green|black|white|yellow|purple|pink|brown|gray|grey|orange|navy|cream|beige|tan)/i);
      if (dressMatch && !topMatch && !bottomMatch) {
        items.push({
          type: 'dress',
          colors: [dressMatch[2]], // Use the color detected for dress
        });
      }
      
      return items.length > 0 ? items : null;
    } catch (error) {
      console.error("Error parsing detection text:", error);
      return null;
    }
  };

  // Prepare all detected items from all images
  const prepareAllDetectedItems = (detectionsByImage) => {
    const allItems = [];
    
    // Process each image's detections
    Object.entries(detectionsByImage).forEach(([imageIndex, detections]) => {
      detections.forEach((item) => {
        // For each color detected in this item
        item.colors.forEach((color) => {
          allItems.push({
            id: `${imageIndex}-${item.type}-${color}-${Math.random().toString(36).substr(2, 5)}`,
            type: item.type,
            color: color,
            imageIndex: parseInt(imageIndex),
            enabled: true // By default, all detected items are enabled
          });
        });
      });
    });
    
    return allItems;
  };

  // Process to verification form with selected items
  const proceedToVerification = () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one item to continue");
      return;
    }
    
    // Create user preferences from selected items
    const selectedItemsData = detectedItems.filter(item => selectedItems.includes(item.id));
    
    setUserPreferences({
      gender: '',
      items: selectedItemsData
    });
    
    setShowDetectedItems(false);
    setShowVerificationForm(true);
  };

  // Fetch real Amazon products
  const fetchRealAmazonProducts = async (preferences) => {
    try {
      setLoading(true);
      const enabledItems = preferences.items.filter(item => item.enabled);
      
      if (enabledItems.length === 0) {
        throw new Error("No items selected for product search");
      }

      // Create search queries for each item
      const productPromises = enabledItems.map(async (item) => {
        try {
          // Build a search query for this item
          const genderPrefix = preferences.gender ? `${preferences.gender}'s ` : '';
          const searchQuery = `${genderPrefix}${item.color} ${item.type}`;
          
          // In production, you'd use an actual Amazon API integration
          // This is where you'd connect to a real service that fetches Amazon products
          const response = await fetch(`${amazonApiEndpoint}?query=${encodeURIComponent(searchQuery)}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch products for ${searchQuery}`);
          }
          
          const data = await response.json();
          
          // Transform the API response to match our product format
          return data.products.map(product => ({
            id: product.asin,
            title: product.title,
            brand: product.brand,
            description: product.description || `${item.color} ${item.type} for ${preferences.gender || 'Unisex'}`,
            attributes: [
              `Size: ${product.size || 'Various'}`,
              `Material: ${product.material || 'Various'}`,
              `Pattern: ${product.pattern || 'Various'}`
            ],
            price: product.price,
            rating: product.rating,
            reviews: product.reviewCount,
            image: product.imageUrl,
            link: product.productUrl,
            color: item.color,
            type: item.type,
            gender: preferences.gender,
            isReal: true
          }));
        } catch (error) {
          console.error(`Error fetching products for ${item.type}:`, error);
          return [];
        }
      });
      
      // Wait for all product fetches to complete
      const productResults = await Promise.all(productPromises);
      
      // Flatten the results
      const allProducts = productResults.flat();
      
      setProducts(allProducts);
      setLoading(false);
      return allProducts;
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to fetch product recommendations. Please try again.");
      setLoading(false);
      
      // For now, fall back to simulated products until real API integration is complete
      return simulateAmazonFetch(preferences.items.filter(item => item.enabled), preferences.gender);
    }
  };

  // This is a temporary function until the real Amazon API integration is complete
  // In a real app, replace this entirely with fetchRealAmazonProducts
  const simulateAmazonFetch = async (items, gender) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create a simulated response with realistic Amazon.in data
    const products = [];
    
    // For each enabled item, create 2-3 products
    items.forEach(item => {
      const numProducts = Math.floor(Math.random() * 2) + 2;
      
      // This would be replaced with actual API calls to fetch real products
      for (let i = 0; i < numProducts; i++) {
        // In real implementation, this would be data from Amazon's API
        products.push({
          id: `AMZN${Math.random().toString(36).substr(2, 8)}`,
          title: `${capitalize(item.color)} ${capitalize(item.type)} for ${gender === 'men' ? 'Men' : gender === 'women' ? 'Women' : 'Unisex'}`,
          brand: getRandomBrand(gender),
          description: `Premium quality ${item.color} ${item.type} perfect for all occasions.`,
          attributes: [
            `Size: ${['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)]}`,
            `Material: ${['Cotton', 'Linen', 'Polyester'][Math.floor(Math.random() * 3)]}`,
            `Pattern: ${['Solid', 'Striped', 'Checkered'][Math.floor(Math.random() * 3)]}`
          ],
          price: `₹${(Math.floor(Math.random() * 2000) + 499).toLocaleString('en-IN')}`,
          rating: (Math.random() * 2 + 3).toFixed(1),
          reviews: Math.floor(Math.random() * 500) + 10,
          image: `/api/placeholder/300/400`, // This would be a real image URL from Amazon
          link: `https://www.amazon.in/dp/${Math.random().toString(36).substr(2, 10)}`,
          color: item.color,
          type: item.type,
          gender: gender,
          // Flag to indicate these are real products (in a real implementation)
          isReal: false
        });
      }
    });
    
    return products;
  };
  
  // Helper to capitalize first letter
  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  
  // Get random brand based on gender
  const getRandomBrand = (gender) => {
    const menBrands = ['Allen Solly', 'Van Heusen', 'Louis Philippe', 'Raymond', 'U.S. Polo Assn.'];
    const womenBrands = ['W for Woman', 'Biba', 'FabIndia', 'AND', 'Global Desi'];
    const unisexBrands = ['Levi\'s', 'H&M', 'Zara', 'Nike', 'Puma'];
    
    let brandList;
    if (gender === 'men') {
      brandList = [...menBrands, ...unisexBrands];
    } else if (gender === 'women') {
      brandList = [...womenBrands, ...unisexBrands];
    } else {
      brandList = unisexBrands;
    }
    
    return brandList[Math.floor(Math.random() * brandList.length)];
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
      // Use the real Amazon product fetcher (or fallback to simulation for now)
      // In production, you would only use fetchRealAmazonProducts
      const fetchedProducts = await fetchRealAmazonProducts(userPreferences);
      setProducts(fetchedProducts);
      
      // Set results for display
      setResults({
        gender: userPreferences.gender,
        items: enabledItems
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

  // Reset the component state
  const resetState = () => {
    setFiles([]);
    setImgPreviews([]);
    setResults(null);
    setProducts([]);
    setError(null);
    setShowDetectedItems(false);
    setShowVerificationForm(false);
    setSelectedItems([]);
    setUserPreferences({
      gender: '',
      items: []
    });
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
      
      {!loading && !results && !showVerificationForm && !showDetectedItems && (
        <UploadSection 
          files={files}
          setFiles={setFiles}
          imgPreviews={imgPreviews}
          setImgPreviews={setImgPreviews}
          error={error}
          setError={setError}
          processImages={processImages}
          setShowHome={setShowHome}
          MAX_FILES={MAX_FILES}
          MIN_FILES={MIN_FILES}
        />
      )}
      
      {loading && (
        <div className="fc-loading-section">
          <div className="fc-spinner"></div>
          <p className="fc-loading-text">
            {analyzing ? "Analyzing your style preferences..." : 
             products.length ? "Fetching product recommendations..." : 
             "Processing your images..."}
          </p>
        </div>
      )}

      {showDetectedItems && !loading && (
        <DetectedItemsSection
          detectedItems={detectedItems}
          imgPreviews={imgPreviews}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          proceedToVerification={proceedToVerification}
          resetState={resetState}
        />
      )}
      
      {showVerificationForm && !loading && (
        <VerificationForm 
          error={error}
          userPreferences={userPreferences}
          setUserPreferences={setUserPreferences}
          resetState={resetState}
          submitPreferences={submitPreferences}
          imgPreviews={imgPreviews}
        />
      )}
      
      {results && !loading && !showVerificationForm && (
        <ResultsSection 
          results={results}
          products={products}
          userPreferences={userPreferences}
          resetState={resetState}
          setShowVerificationForm={setShowVerificationForm}
          setShowHome={setShowHome}
        />
      )}
    </div>
  );
}

export default FindClothes;