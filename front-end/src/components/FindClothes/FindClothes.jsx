// src/components/FindClothes/FindClothes.jsx
// Main FindClothes component that coordinates the clothing finder functionality
import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import HomeView from './HomeView';
import UploadView from './UploadView';
import VerificationView from './VerificationView';
import ResultsView from './ResultsView';
import LoadingView from './LoadingView';
import { fetchAmazonProducts } from '../../services/amazonService';
import { analyzeOutfits, parseDetectionText } from '../../utils/outfitAnalyzer';

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
    clothingType: 'all',   // casual, formal, sporty, etc.
    occasion: 'any',       // work, party, daily, etc.
    priceRange: 'any',     // budget, mid-range, premium
    items: []
  });

  // API endpoints - we'll try multiple in case the primary is down
  const apiEndpoints = [
    "https://outfit-detect-recs-production.up.railway.app/upload-photo/",
    "http://localhost:8080/upload-photo/" // Fallback to local development if running
  ];

  // Maximum and minimum file constraints
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
          const parsedOutfit = parseDetectionText(data.text);
          if (parsedOutfit && parsedOutfit.length > 0) {
            detections.push(...parsedOutfit);
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
      const styleAnalysis = analyzeOutfits(detections);
      setResults(styleAnalysis);
      
      // Prepare detected items for verification form
      const items = prepareDetectedItems(styleAnalysis);
      setDetectedItems(items);
      
      // Initialize user preferences with detected items
      setUserPreferences({
        gender: '',
        clothingType: 'all',
        occasion: 'any',
        priceRange: 'any',
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

  // Prepare detected items for the verification form with more detailed attributes
  const prepareDetectedItems = (styleAnalysis) => {
    return styleAnalysis.types.map((type, index) => {
      // Get the specific subtype and fit information
      const subtype = styleAnalysis.subtypes[index] || '';
      const fit = styleAnalysis.fits[index] || '';
      const sleeve = styleAnalysis.sleeves[index] || '';
      
      // Assign most common color to each type for initial state
      const color = styleAnalysis.colors[index % styleAnalysis.colors.length];
      
      return {
        id: nanoid(),
        type: type,                 // e.g. "shirt", "pants", "jacket"
        subtype: subtype,           // e.g. "formal", "casual", "denim"
        fit: fit,                   // e.g. "slim", "regular", "loose"
        sleeve: sleeve,             // e.g. "long", "short", "sleeveless"
        color: color,               // e.g. "blue", "black", "white"
        pattern: styleAnalysis.patterns[index] || 'solid', // e.g. "striped", "checkered", "solid"
        enabled: true               // By default, all detected items are enabled
      };
    });
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

  // Handle changes in item attributes
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
      type: 'shirt',
      subtype: 'casual',
      fit: 'regular',
      sleeve: 'long',
      color: 'blue',
      pattern: 'solid',
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
      // Fetch real products from Amazon
      const amazonProducts = await fetchAmazonProducts({
        items: enabledItems,
        gender: userPreferences.gender,
        clothingType: userPreferences.clothingType,
        occasion: userPreferences.occasion,
        priceRange: userPreferences.priceRange
      });
      
      setProducts(amazonProducts);
      
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
    setShowVerificationForm(false);
    setUserPreferences({
      gender: '',
      clothingType: 'all',
      occasion: 'any',
      priceRange: 'any',
      items: []
    });
  };

  // Main render logic
  if (showHome) {
    return <HomeView onStart={() => setShowHome(false)} />;
  }

  if (loading) {
    return <LoadingView analyzing={analyzing} />;
  }

  if (showVerificationForm) {
    return (
      <VerificationView
        error={error}
        userPreferences={userPreferences}
        onPreferenceChange={handlePreferenceChange}
        onItemToggle={toggleItemEnabled}
        onItemChange={handleItemChange}
        onAddItem={addCustomItem}
        onRemoveItem={removeItem}
        onSubmit={submitPreferences}
        onReset={resetState}
      />
    );
  }

  if (results && products.length > 0) {
    return (
      <ResultsView
        products={products}
        userPreferences={userPreferences}
        onAdjustPreferences={() => setShowVerificationForm(true)}
        onReset={resetState}
        onHome={() => setShowHome(true)}
      />
    );
  }

  // Default view - upload screen
  return (
    <UploadView
      files={files}
      imgPreviews={imgPreviews}
      error={error}
      maxFiles={MAX_FILES}
      minFiles={MIN_FILES}
      onFileChange={handleFileChange}
      onRemoveFile={removeFile}
      onProcessImages={processImages}
      onBack={() => setShowHome(true)}
    />
  );
}

export default FindClothes;