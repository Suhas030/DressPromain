// File: src/components/FindClothes/index.jsx
import { useState, useRef } from 'react';
import UploadSection from './UploadSection';
import AnalysisResults from './AnalysisResults';
import ProductRecommendations from './ProductRecommendations';
import LoadingOverlay from './LoadingOverlay';

function FindClothes() {
  // State for image files and previews
  const [files, setFiles] = useState([]);
  const [imgPreviews, setImgPreviews] = useState([]);
  
  // UI state management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('home'); // home, upload, analysis, recommendations
  
  // Analysis and product data
  const [detectedItems, setDetectedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [productRecommendations, setProductRecommendations] = useState([]);
  
  // User preferences
  const [userPreferences, setUserPreferences] = useState({
    gender: '',
    items: []
  });

  // API endpoints
  const apiEndpoints = [
    "https://outfit-detect-recs-production.up.railway.app/upload-photo/",
    "http://localhost:8080/upload-photo/" // Fallback for local development
  ];
  
  // Constants
  const MAX_FILES = 5;
  const MIN_FILES = 2;

  // Process uploaded images
  const processImages = async () => {
    if (files.length < MIN_FILES) {
      setError(`Please upload at least ${MIN_FILES} images to analyze your style.`);
      return;
    }

    setLoading(true);
    setError(null);
    
    const allDetectedItems = [];
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      try {
        const formData = new FormData();
        formData.append("file", files[i]);
        
        // Try API endpoints until one works
        let response = null;
        let data = null;
        
        for (const endpoint of apiEndpoints) {
          try {
            // Set timeout to prevent long waits for unresponsive endpoints
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            response = await fetch(endpoint, {
              method: "POST",
              body: formData,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              data = await response.json();
              break; // Exit loop on successful response
            }
          } catch (error) {
            console.error(`Error with endpoint ${endpoint}:`, error);
            // Continue to next endpoint
          }
        }
        
        if (!response || !response.ok || !data) {
          console.error("All API endpoints failed for this image");
          continue; // Skip to next image
        }
        
        // Parse detected clothing items from API response
        const parsedItems = parseClothingItems(data.text, i);
        if (parsedItems && parsedItems.length > 0) {
          allDetectedItems.push(...parsedItems);
        }
      } catch (error) {
        console.error(`Error processing image ${i}:`, error);
      }
    }
    
    setLoading(false);
    
    if (allDetectedItems.length === 0) {
      setError("Could not detect any clothing items in your images. Please try with clearer photos.");
      return;
    }
    
    // Set detected items and move to analysis view
    setDetectedItems(allDetectedItems);
    setCurrentView('analysis');
  };

  // Parse API response text to extract clothing items
  const parseClothingItems = (text, imageIndex) => {
    if (!text || text.includes("No outfit detected") || text.includes("Multiple outfits detected")) {
      return [];
    }
    
    try {
      const items = [];
      
      // Parse for tops (shirts, t-shirts, blouses, etc.)
      const topMatch = text.toLowerCase().match(/(top|shirt|t-shirt|blouse|sweater|hoodie|jacket|blazer).*?(red|blue|green|black|white|yellow|purple|pink|brown|gray|grey|orange|navy|cream|beige|tan)/i);
      if (topMatch) {
        items.push({
          id: `img${imageIndex}-top-${topMatch[2]}-${Math.random().toString(36).substring(2, 7)}`,
          type: topMatch[1],
          color: topMatch[2],
          imageIndex: imageIndex,
          enabled: true
        });
      }
      
      // Parse for bottoms (pants, jeans, skirts, etc.)
      const bottomMatch = text.toLowerCase().match(/(bottom|pants|jeans|trousers|shorts|skirt).*?(red|blue|green|black|white|yellow|purple|pink|brown|gray|grey|orange|navy|cream|beige|tan)/i);
      if (bottomMatch) {
        items.push({
          id: `img${imageIndex}-bottom-${bottomMatch[2]}-${Math.random().toString(36).substring(2, 7)}`,
          type: bottomMatch[1],
          color: bottomMatch[2],
          imageIndex: imageIndex,
          enabled: true
        });
      }
      
      // Parse for dresses
      const dressMatch = text.toLowerCase().match(/(dress).*?(red|blue|green|black|white|yellow|purple|pink|brown|gray|grey|orange|navy|cream|beige|tan)/i);
      if (dressMatch) {
        items.push({
          id: `img${imageIndex}-dress-${dressMatch[2]}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'dress',
          color: dressMatch[2],
          imageIndex: imageIndex,
          enabled: true
        });
      }
      
      return items;
    } catch (error) {
      console.error("Error parsing detection text:", error);
      return [];
    }
  };

  // Handle item selection for recommendations
  const handleItemSelection = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Proceed to product recommendations
  const findSimilarProducts = async () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one item to find similar products");
      return;
    }

    setLoading(true);
    
    // Create user preferences from selected items
    const selectedItemsData = detectedItems.filter(item => selectedItems.includes(item.id));
    setUserPreferences({
      ...userPreferences,
      items: selectedItemsData
    });
    
    // Simulate product API call
    try {
      // In a real implementation, you'd call your e-commerce API here
      const recommendedProducts = await simulateProductAPI(selectedItemsData, userPreferences.gender);
      setProductRecommendations(recommendedProducts);
      setCurrentView('recommendations');
    } catch (error) {
      console.error("Error fetching product recommendations:", error);
      setError("Failed to find similar products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Simulate product API call (replace with real API in future)
  const simulateProductAPI = async (items, gender) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulated product data
    const productData = [];
    
    items.forEach(item => {
      // Generate 2-4 product recommendations per item
      const numProducts = Math.floor(Math.random() * 3) + 2;
      
      for (let i = 0; i < numProducts; i++) {
        const price = Math.floor(Math.random() * 3000) + 499;
        const rating = (Math.random() * 2 + 3).toFixed(1);
        const reviewCount = Math.floor(Math.random() * 1000) + 10;
        
        productData.push({
          id: `prod-${Math.random().toString(36).substring(2, 10)}`,
          title: `${capitalize(item.color)} ${capitalize(item.type)} for ${gender || 'Unisex'}`,
          brand: getRandomBrand(gender),
          price: `₹${price.toLocaleString('en-IN')}`,
          rating: rating,
          reviews: reviewCount,
          color: item.color,
          type: item.type,
          image: `/api/placeholder/300/400`, // Placeholder image URL
          link: `https://www.amazon.in/dp/${Math.random().toString(36).substring(2, 10)}`,
          attributes: [
            `Color: ${capitalize(item.color)}`,
            `Type: ${capitalize(item.type)}`,
            `Material: ${getRandomMaterial()}`
          ]
        });
      }
    });
    
    return productData;
  };

  // Utility functions
  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  
  const getRandomBrand = (gender) => {
    const menBrands = ['Allen Solly', 'Van Heusen', 'Louis Philippe', 'Raymond', 'U.S. Polo Assn.'];
    const womenBrands = ['W for Woman', 'Biba', 'FabIndia', 'AND', 'Global Desi'];
    const unisexBrands = ['Levi\'s', 'H&M', 'Zara', 'Nike', 'Puma'];
    
    if (gender === 'men') {
      return menBrands[Math.floor(Math.random() * menBrands.length)];
    } else if (gender === 'women') {
      return womenBrands[Math.floor(Math.random() * womenBrands.length)];
    } else {
      return unisexBrands[Math.floor(Math.random() * unisexBrands.length)];
    }
  };
  
  const getRandomMaterial = () => {
    const materials = ['Cotton', 'Polyester', 'Silk', 'Linen', 'Wool', 'Denim', 'Leather'];
    return materials[Math.floor(Math.random() * materials.length)];
  };

  // Reset component state
  const resetToHome = () => {
    setFiles([]);
    setImgPreviews([]);
    setDetectedItems([]);
    setSelectedItems([]);
    setProductRecommendations([]);
    setUserPreferences({ gender: '', items: [] });
    setError(null);
    setCurrentView('home');
  };
  
  const startUpload = () => {
    setCurrentView('upload');
  };

  // Render component based on current view
  if (currentView === 'home') {
    return (
      <div className="fc-home-container">
        <div className="fc-hero-section">
          <h1 className="fc-app-title">Find Your Style</h1>
          <p className="fc-app-description">
            Upload 2-5 photos of outfits you like, and we'll recommend similar products that match your style.
          </p>
          <button className="fc-start-btn" onClick={startUpload}>
            Get Started
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-container">
      {loading && <LoadingOverlay />}
      
      {error && (
        <div className="fc-error-message">
          <p>{error}</p>
          <button className="fc-try-again-btn" onClick={() => setError(null)}>
            Try Again
          </button>
        </div>
      )}
      
      {currentView === 'upload' && (
        <UploadSection 
          files={files}
          setFiles={setFiles}
          imgPreviews={imgPreviews}
          setImgPreviews={setImgPreviews}
          processImages={processImages}
          resetToHome={resetToHome}
          maxFiles={MAX_FILES}
          minFiles={MIN_FILES}
        />
      )}
      
      {currentView === 'analysis' && (
        <AnalysisResults
          detectedItems={detectedItems}
          selectedItems={selectedItems}
          handleItemSelection={handleItemSelection}
          imgPreviews={imgPreviews}
          userPreferences={userPreferences}
          setUserPreferences={setUserPreferences}
          findSimilarProducts={findSimilarProducts}
          resetToHome={resetToHome}
        />
      )}
      
      {currentView === 'recommendations' && (
        <ProductRecommendations
          products={productRecommendations}
          userPreferences={userPreferences}
          goBackToAnalysis={() => setCurrentView('analysis')}
          resetToHome={resetToHome}
        />
      )}
    </div>
  );
}

export default FindClothes;