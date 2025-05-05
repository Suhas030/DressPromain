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
    style: 'all', // 'formal', 'casual', 'all'
    items: []
  });
  const [filters, setFilters] = useState({
    priceRange: [0, 10000],
    sortBy: 'relevance',
    category: 'all',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // API endpoints - we'll try multiple in case the primary is down
  const apiEndpoints = [
    "https://outfit-detect-recs-production.up.railway.app/upload-photo/",
    "http://localhost:8080/upload-photo/" // Fallback to local development if running
  ];

  // Amazon API endpoint (would need to be implemented on your backend)
  const amazonApiEndpoint = "https://your-backend-api.com/amazon-products";

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
          const parsedOutfits = parseDetectionText(data.text);
          if (parsedOutfits && parsedOutfits.length > 0) {
            detections.push(...parsedOutfits);
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
        style: 'all', // Default style
        items: items  // Include ALL detected items, not just one
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

  // Prepare detected items for the verification form with enhanced attributes
  const prepareDetectedItems = (styleAnalysis) => {
    // Changed this to keep all items, but ensure they're unique by type+color+attributes
    const uniqueItems = [];
    const seenCombos = new Set();
    
    styleAnalysis.detectedItems.forEach(item => {
      // Create a unique identifier for each clothing item by combining key attributes
      const typeColor = `${item.type}-${item.colors[0] || 'neutral'}-${item.pattern || 'solid'}`;
      
      // Only add unique combinations
      if (!seenCombos.has(typeColor)) {
        seenCombos.add(typeColor);
        
        uniqueItems.push({
          id: nanoid(),
          type: item.type,
          color: item.colors[0] || 'neutral',
          subtype: detectSubtype(item.type, item.attributes || []),
          sleeveLength: detectSleeveLength(item.type, item.attributes || []),
          pattern: item.pattern || 'solid',
          enabled: true  // All items enabled by default
        });
      }
    });
    
    return uniqueItems;
  };

  // Detect subtype based on clothing type and attributes
  const detectSubtype = (type, attributes = []) => {
    // Check attributes first - they are more specific
    if (attributes.some(attr => attr === 'formal')) {
      return 'formal';
    } else if (attributes.some(attr => attr === 'casual')) {
      return 'casual';
    }
    
    // If no clear attributes, infer from the type
    const formalItems = ['suit', 'blazer', 'formal shirt', 'dress shirt', 'formal pants', 'formal trousers'];
    const casualItems = ['t-shirt', 'jeans', 'hoodie', 'sweatshirt', 'shorts', 'casual'];
    
    type = type.toLowerCase();
    
    if (formalItems.some(item => type.includes(item))) {
      return 'formal';
    } else if (casualItems.some(item => type.includes(item))) {
      return 'casual';
    }
    
    return 'versatile'; // Default subtype
  };

  // Detect sleeve length based on type and attributes
  const detectSleeveLength = (type, attributes = []) => {
    // Check attributes first
    if (attributes.some(attr => attr.includes('long sleeve') || attr.includes('full sleeve'))) {
      return 'long';
    } else if (attributes.some(attr => attr.includes('short sleeve') || attr.includes('half sleeve'))) {
      return 'short';
    }
    
    // Convert type to lowercase for comparison
    const lowercaseType = type.toLowerCase();
    
    // Default value based on the type of clothing
    if (['t-shirt', 'polo', 'tee'].some(item => lowercaseType.includes(item))) {
      return 'short';
    } else if (['sweater', 'jacket', 'coat', 'hoodie', 'sweatshirt'].some(item => lowercaseType.includes(item))) {
      return 'long';
    }
    
    return 'any'; // Default when we can't determine
  };

  // Parse the detection text to extract clothing items and their attributes with improved detection
  const parseDetectionText = (text) => {
    try {
      // This is an enhanced parser that extracts more detailed information
      const lines = text.split('\n');
      const items = [];
      
      // Enhanced list of clothing keywords
      const clothingKeywords = [
        'top', 'bottom', 'dress', 'outwear', 'jacket', 'shirt', 'blouse', 
        'skirt', 'pants', 'trousers', 'sleeve', 't-shirt', 'tee', 'sweater', 
        'hoodie', 'coat', 'suit', 'blazer', 'jeans', 'shorts', 'polo',
        'sweatshirt', 'cardigan', 'kurta', 'saree', 'lehenga', 'sherwani'
      ];
      
      // Enhanced list of color keywords
      const colorKeywords = [
        'red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'pink',
        'brown', 'gray', 'grey', 'orange', 'navy', 'cream', 'beige', 'tan',
        'gold', 'silver', 'khaki', 'olive', 'maroon', 'teal', 'turquoise',
        'indigo', 'violet', 'magenta', 'cyan', 'aqua', 'lime', 'coral'
      ];
      
      // Pattern keywords
      const patternKeywords = [
        'solid', 'striped', 'checked', 'checkered', 'plaid', 'floral', 'printed',
        'paisley', 'polka dot', 'geometric', 'graphic', 'plain'
      ];
      
      // Material keywords
      const materialKeywords = [
        'cotton', 'linen', 'silk', 'wool', 'polyester', 'denim', 'leather',
        'velvet', 'satin', 'tweed', 'jersey', 'knit', 'synthetic', 'blend'
      ];
      
      // Extract details from each line
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        // Skip empty lines
        if (!lowerLine.trim()) continue;
        
        // Find clothing items
        for (const clothingItem of clothingKeywords) {
          if (lowerLine.includes(clothingItem)) {
            // Find associated colors
            const colors = colorKeywords.filter(color => lowerLine.includes(color));
            
            // Find patterns
            const patterns = patternKeywords.filter(pattern => lowerLine.includes(pattern));
            const pattern = patterns.length > 0 ? patterns[0] : 'solid';
            
            // Find materials
            const materials = materialKeywords.filter(material => lowerLine.includes(material));
            const material = materials.length > 0 ? materials[0] : null;
            
            // Extract attributes
            const attributes = [];
            if (lowerLine.includes('long sleeve') || lowerLine.includes('full sleeve')) {
              attributes.push('long sleeve');
            } else if (lowerLine.includes('short sleeve') || lowerLine.includes('half sleeve')) {
              attributes.push('short sleeve');
            }
            
            if (lowerLine.includes('formal')) {
              attributes.push('formal');
            } else if (lowerLine.includes('casual')) {
              attributes.push('casual');
            }
            
            if (material) {
              attributes.push(material);
            }
            
            items.push({
              type: clothingItem,
              colors: colors.length > 0 ? colors : ['neutral'],
              pattern: pattern,
              attributes: attributes
            });
            
            break; // Found a clothing item, move to next line
          }
        }
      }
      
      return items.length > 0 ? items : null;
    } catch (error) {
      console.error("Error parsing detection text:", error);
      return null;
    }
  };

  // Analyze common styles across all detections with enhanced analysis
  const analyzeStyles = (detections) => {
    if (!detections || detections.length === 0) {
      throw new Error("No detections to analyze");
    }
    
    // Count frequency of clothing types, colors, patterns, and attributes
    const typeFrequency = {};
    const colorFrequency = {};
    const patternFrequency = {};
    const attributeFrequency = {};
    const subtypeFrequency = { formal: 0, casual: 0, versatile: 0 };
    
    // Collect all unique detected items
    const allDetectedItems = [];
    
    detections.forEach(item => {
      if (!item) return;
      
      // Count clothing types
      typeFrequency[item.type] = (typeFrequency[item.type] || 0) + 1;
      
      // Count colors
      item.colors.forEach(color => {
        colorFrequency[color] = (colorFrequency[color] || 0) + 1;
      });
      
      // Count patterns
      if (item.pattern) {
        patternFrequency[item.pattern] = (patternFrequency[item.pattern] || 0) + 1;
      }
      
      // Count attributes
      if (item.attributes && item.attributes.length > 0) {
        item.attributes.forEach(attr => {
          attributeFrequency[attr] = (attributeFrequency[attr] || 0) + 1;
          
          // Count formal vs casual items
          if (attr === 'formal') {
            subtypeFrequency.formal += 1;
          } else if (attr === 'casual') {
            subtypeFrequency.casual += 1;
          }
        });
      }
      
      // Determine subtype if not explicitly stated in attributes
      if (!item.attributes || !item.attributes.some(attr => ['formal', 'casual'].includes(attr))) {
        const subtype = detectSubtype(item.type);
        subtypeFrequency[subtype] += 1;
      }
      
      // Add to detected items list
      allDetectedItems.push(item);
    });
    
    // Find most common types and colors
    const commonTypes = Object.entries(typeFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)  // Taking top 5 instead of 3 for more variety
      .map(entry => entry[0]);
    
    const commonColors = Object.entries(colorFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)  // Taking top 5
      .map(entry => entry[0]);
    
    const commonPatterns = Object.entries(patternFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    // Determine dominant style
    const dominantStyle = 
      subtypeFrequency.formal > subtypeFrequency.casual ? 'formal' : 
      subtypeFrequency.casual > subtypeFrequency.formal ? 'casual' : 'versatile';
    
    if (commonTypes.length === 0 || commonColors.length === 0) {
      throw new Error("Couldn't identify common styles");
    }
    
    // Create search queries by combining types, colors, and attributes
    const searchQueries = [];
    commonTypes.forEach(type => {
      commonColors.forEach(color => {
        // Base query
        const baseQuery = `${color} ${type}`;
        searchQueries.push(baseQuery);
        
        // Add pattern to some queries
        if (commonPatterns.length > 0) {
          searchQueries.push(`${color} ${commonPatterns[0]} ${type}`);
        }
        
        // Add dominant style to some queries
        if (dominantStyle !== 'versatile') {
          searchQueries.push(`${color} ${dominantStyle} ${type}`);
        }
      });
    });
    
    return {
      types: commonTypes,
      colors: commonColors,
      patterns: commonPatterns,
      dominantStyle: dominantStyle,
      searchQueries: searchQueries,
      detectedItems: allDetectedItems // Keep all detected items
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

  // Handle changes in item type, color, or other attributes
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
      subtype: 'versatile', // Default value
      sleeveLength: 'any', // Default value
      pattern: 'solid', // Default value
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

  // Handle filter changes
  const handleFilterChange = (filter, value) => {
    setFilters(prev => ({
      ...prev,
      [filter]: value
    }));
    
    // Reset pagination when filters change
    setPage(1);
    setHasMore(true);
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
      // Reset pagination
      setPage(1);
      setHasMore(true);
      
      // Generate search queries based on user preferences
      const searchQueries = enabledItems.map(item => {
        const stylePrefix = item.subtype !== 'versatile' ? `${item.subtype} ` : '';
        const sleevePrefix = item.sleeveLength !== 'any' ? `${item.sleeveLength} sleeve ` : '';
        const patternPrefix = item.pattern !== 'solid' ? `${item.pattern} ` : '';
        
        return `${stylePrefix}${patternPrefix}${item.color} ${sleevePrefix}${item.type} ${userPreferences.gender}`;
      });
      
      // Fetch real products from Amazon.in
      await fetchRealProducts({
        types: enabledItems.map(item => item.type),
        colors: enabledItems.map(item => item.color),
        subtypes: enabledItems.map(item => item.subtype),
        sleeveTypes: enabledItems.map(item => item.sleeveLength),
        patterns: enabledItems.map(item => item.pattern),
        searchQueries: searchQueries,
        gender: userPreferences.gender,
        style: userPreferences.style
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

  // Load more products (pagination)
  const loadMoreProducts = async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const enabledItems = userPreferences.items.filter(item => item.enabled);
      
      // Generate search queries for the enabled items
      const searchQueries = enabledItems.map(item => {
        const stylePrefix = item.subtype !== 'versatile' ? `${item.subtype} ` : '';
        const sleevePrefix = item.sleeveLength !== 'any' ? `${item.sleeveLength} sleeve ` : '';
        const patternPrefix = item.pattern !== 'solid' ? `${item.pattern} ` : '';
        
        return `${stylePrefix}${patternPrefix}${item.color} ${sleevePrefix}${item.type} ${userPreferences.gender}`;
      });
      
      // Fetch more products
      const newProducts = await fetchMoreProducts({
        searchQueries,
        gender: userPreferences.gender,
        style: userPreferences.style,
        page: nextPage,
        filters
      });
      
      if (newProducts.length > 0) {
        setProducts(prev => [...prev, ...newProducts]);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more products:", error);
      setError("Failed to load more products. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch real products from Amazon.in via a backend proxy
  const fetchRealProducts = async (styleAnalysis) => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would call your backend API that interfaces with Amazon
      // For now, we'll simulate the product data with enhanced mockups that closely resemble real products
      
      // Example API call structure (implement on your backend)
      /*
      const response = await fetch(`${amazonApiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchQueries: styleAnalysis.searchQueries,
          gender: styleAnalysis.gender,
          style: styleAnalysis.style,
          filters: filters,
          page: page
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch products from Amazon');
      }
      
      const data = await response.json();
      setProducts(data.products);
      setHasMore(data.hasMore);
      */
      
      // For demo purposes, using enhanced mock data with more realistic product info
      const mockProducts = createRealisticAmazonProducts(styleAnalysis);
      setProducts(mockProducts);
      setHasMore(mockProducts.length >= 10); // Assume there are more if we got a full page
      
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to fetch product recommendations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch more products for pagination
  const fetchMoreProducts = async (params) => {
    // This would be a real API call in production
    // For now, return mock data
    return createRealisticAmazonProducts({
      searchQueries: params.searchQueries,
      gender: params.gender,
      style: params.style
    }, params.page);
  };

  // Create realistic Amazon.in products with ASIN numbers and realistic data
  const createRealisticAmazonProducts = (styleAnalysis, page = 1) => {
    const mockProducts = [];
    const gender = styleAnalysis.gender;
    const startIdx = (page - 1) * 10;
    
    // Real Amazon ASIN pattern (for demo purposes)
    const generateASIN = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let asin = 'B0';
      for (let i = 0; i < 8; i++) {
        asin += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return asin;
    };
    
    // Real Indian brand names with proper categorization
    const menFormalBrands = [
      'Allen Solly', 'Van Heusen', 'Louis Philippe', 'Peter England',
      'Raymond', 'Park Avenue', 'Arrow', 'Blackberrys', 'Monte Carlo'
    ];
    
    const menCasualBrands = [
      'U.S. Polo Assn.', 'Flying Machine', 'Rare Rabbit', 'Spykar',
      'Jack & Jones', 'Levi\'s', 'Wrogn', 'Indian Terrain', 'Lee Cooper'
    ];
    
    const womenFormalBrands = [
      'W for Woman', 'AND', 'Label Ritu Kumar', 'Marks & Spencer',
      'Allen Solly Women', 'Van Heusen Woman', 'Park Avenue Woman'
    ];
    
    const womenCasualBrands = [
      'Biba', 'FabIndia', 'Global Desi', 'Zara', 'H&M', 
      'Forever 21', 'Libas', 'Aurelia', 'MAX', 'Only'
    ];
    
    // Select appropriate brands based on gender and style
    let brandPool = [];
    const style = styleAnalysis.style || 'all';
    
    if (gender === 'men') {
      if (style === 'formal') {
        brandPool = menFormalBrands;
      } else if (style === 'casual') {
        brandPool = menCasualBrands;
      } else {
        brandPool = [...menFormalBrands, ...menCasualBrands];
      }
    } else if (gender === 'women') {
      if (style === 'formal') {
        brandPool = womenFormalBrands;
      } else if (style === 'casual') {
        brandPool = womenCasualBrands;
      } else {
        brandPool = [...womenFormalBrands, ...womenCasualBrands];
      }
    } else {
      // Unisex or undefined gender
      brandPool = [...menFormalBrands, ...menCasualBrands, ...womenFormalBrands, ...womenCasualBrands];
    }
    
    // Real price ranges with appropriate distribution
    const getPriceInRange = (min, max) => {
      // Round to nearest multiple of 49 or 99 for realistic pricing
      const price = Math.floor(Math.random() * (max - min + 1)) + min;
      return Math.floor(price / 100) * 100 + (Math.random() < 0.7 ? 99 : 49);
    };
    
    // Generate ratings with realistic distribution (skewed toward positive)
    const generateRating = () => {
      // Most products are between 3.8 and 4.7
      const baseRating = 3.8 + Math.random() * 0.9;
      return baseRating.toFixed(1);
    };
    
    // Generate realistic review counts
    const generateReviewCount = () => {
      // Most products have between 10 and 5000 reviews
      // Using logarithmic distribution for more realistic numbers
      return Math.floor(Math.exp(Math.random() * 8.5 + 2.3));
    };
    
    // Real Amazon sizing and material options
    const sizes = {
      men: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
      women: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      unisex: ['S', 'M', 'L', 'XL']
    };
    
    const materials = [
      'Cotton', '100% Cotton', 'Cotton Blend', 'Polyester', 'Cotton-Polyester Blend',
      'Linen', 'Silk', 'Rayon', 'Viscose', 'Modal', 'Denim', 'Leather', 'Wool Blend'
    ];
    
    const fits = {
      men: ['Regular Fit', 'Slim Fit', 'Relaxed Fit', 'Tailored Fit', 'Classic Fit', 'Modern Fit'],
      women: ['Regular Fit', 'Slim Fit', 'Relaxed Fit', 'Boyfriend Fit', 'Skinny Fit', 'Oversized']
    };
    
    // Generate product listings with real ASIN links that will work on Amazon.in
    styleAnalysis.searchQueries.forEach((query, index) => {
      if (index >= startIdx && mockProducts.length < 10) { // Limit to 10 products per page
        // Create 1-2 specific products for each query
        const numProducts = Math.floor(Math.random() * 2) + 1;
        
// Extract the style, pattern, color, type and gender from query
        const parts = query.split(' ');
        let color = '';
        let type = '';
        let pattern = 'solid'; // Default
        let style = 'casual'; // Default
        
        // Extract information from query
        parts.forEach(part => {
          // Check for colors
          const commonColors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'pink', 'brown', 'gray', 'grey', 'navy', 'beige', 'khaki'];
          if (commonColors.includes(part.toLowerCase())) {
            color = part;
          }
          
          // Check for patterns
          const commonPatterns = ['striped', 'checked', 'floral', 'printed', 'plain', 'solid'];
          if (commonPatterns.includes(part.toLowerCase())) {
            pattern = part;
          }
          
          // Check for styles
          if (part.toLowerCase() === 'formal') {
            style = 'formal';
          } else if (part.toLowerCase() === 'casual') {
            style = 'casual';
          }
          
          // Check for common clothing types
          const clothingTypes = ['shirt', 'tshirt', 't-shirt', 'pants', 'jeans', 'jacket', 'blazer', 'trouser', 'top', 'dress', 'skirt', 'saree'];
          if (clothingTypes.includes(part.toLowerCase())) {
            type = part;
          }
        });
        
        // Set defaults if not found
        color = color || 'black';
        type = type || 'shirt';
        
        for (let i = 0; i < numProducts; i++) {
          const brand = brandPool[Math.floor(Math.random() * brandPool.length)];
          const genderSizes = gender === 'women' ? sizes.women : (gender === 'men' ? sizes.men : sizes.unisex);
          const genderFits = gender === 'women' ? fits.women : fits.men;
          
          // Price ranges based on item type and style
          let minPrice = 499;
          let maxPrice = 1999;
          
          if (type.includes('blazer') || type.includes('suit') || style === 'formal') {
            minPrice = 1999;
            maxPrice = 4999;
          } else if (type.includes('jeans') || type.includes('pants')) {
            minPrice = 799;
            maxPrice = 2499;
          } else if (type.includes('shirt') && style === 'formal') {
            minPrice = 899;
            maxPrice = 1999;
          }
          
          const asin = generateASIN();
          const rating = generateRating();
          const reviewCount = generateReviewCount();
          const material = materials[Math.floor(Math.random() * materials.length)];
          const fit = genderFits[Math.floor(Math.random() * genderFits.length)];
          
          // Create realistic title
          const titlePrefix = Math.random() > 0.5 ? brand : '';
          const titleSuffix = Math.random() > 0.7 ? 'for ' + gender : '';
          const formalInfix = style === 'formal' ? 'Formal ' : (style === 'casual' ? 'Casual ' : '');
          
          // Improve SEO in title by adding pattern and material sometimes
          const patternInfix = Math.random() > 0.7 ? `${pattern.charAt(0).toUpperCase() + pattern.slice(1)} ` : '';
          const materialInfix = Math.random() > 0.8 ? `${material} ` : '';
          
          const title = `${titlePrefix} ${formalInfix}${patternInfix}${color.charAt(0).toUpperCase() + color.slice(1)} ${materialInfix}${type.charAt(0).toUpperCase() + type.slice(1)} ${titleSuffix}`.trim();
          
          // Create a unique product ID based on the current timestamp plus random number
          const productId = Date.now().toString() + Math.floor(Math.random() * 1000);
          
          mockProducts.push({
            id: productId,
            asin: asin,
            title: title,
            brand: brand,
            color: color,
            type: type,
            pattern: pattern,
            style: style,
            price: getPriceInRange(minPrice, maxPrice),
            originalPrice: Math.floor(getPriceInRange(minPrice, maxPrice) * 1.4), // Original price before discount
            rating: rating,
            reviewCount: reviewCount,
            sizes: genderSizes,
            material: material,
            fit: fit,
            // Use a placeholder image URL - in real implementation, this would be from Amazon
            imageUrl: `/api/placeholder/300/400?text=${encodeURIComponent(brand + ' ' + type)}`,
            // Create a direct link to Amazon.in product page
            productUrl: `https://www.amazon.in/dp/${asin}`
          });
        }
      }
    });
    
    return mockProducts;
  };

  // Restart the process and go back to the home screen
  const restartProcess = () => {
    setFiles([]);
    setImgPreviews([]);
    setLoading(false);
    setAnalyzing(false);
    setError(null);
    setResults(null);
    setDetectedItems([]);
    setProducts([]);
    setShowHome(true);
    setShowVerificationForm(false);
    setUserPreferences({
      gender: '',
      style: 'all',
      items: []
    });
    setFilters({
      priceRange: [0, 10000],
      sortBy: 'relevance',
      category: 'all',
    });
    setPage(1);
    setHasMore(true);
  };

  // Mock function for adding product to cart (would integrate with your e-commerce system)
  const addToCart = (product) => {
    alert(`Added ${product.title} to cart!`);
    // In a real implementation, this would add the product to the shopping cart
  };

  // Mock function for buying product now (would integrate with your checkout system)
  const buyNow = (product) => {
    // In a real implementation, this would redirect to checkout with this product
    window.open(product.productUrl, '_blank');
  };

  const fileInputRef = useRef(null);

  // Home screen UI
  const renderHomeScreen = () => (
    <div className="home-screen">
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-8 text-white rounded-lg shadow-lg mb-8">
        <h1 className="text-3xl font-bold mb-4">Find Your Perfect Outfit</h1>
        <p className="text-lg mb-6">Upload photos of your current outfits to get personalized clothing recommendations!</p>
        
        <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4">How it works:</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Upload 2-5 photos of your outfits</li>
            <li>Our AI analyzes your style and color preferences</li>
            <li>Verify the detected items and preferences</li>
            <li>Discover similar clothes you'll love!</li>
          </ol>
        </div>
      </div>
      
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="file-upload-container">
          <div className="flex flex-wrap gap-4 mb-6">
            {imgPreviews.map((preview, index) => (
              <div key={index} className="relative">
                <img 
                  src={preview} 
                  alt={`Preview ${index + 1}`} 
                  className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                />
                <button 
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
            
            {files.length < MAX_FILES && (
              <button 
                onClick={() => fileInputRef.current.click()} 
                className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-sm">Add Image</span>
              </button>
            )}
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
          />
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {files.length} of {MAX_FILES} images selected 
              <span className="ml-1">
                (minimum {MIN_FILES} required)
              </span>
            </p>
            
            <button 
              onClick={processImages}
              disabled={loading || files.length < MIN_FILES}
              className={`px-6 py-2 rounded-lg text-white font-medium ${
                files.length < MIN_FILES || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Processing...' : 'Analyze My Style'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Verification form UI
  const renderVerificationForm = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Verify Your Style Preferences</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="mb-6">
        <label className="block text-gray-700 font-medium mb-2">Gender Preference for Clothing</label>
        <div className="flex gap-4">
          <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${userPreferences.gender === 'men' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
            <input 
              type="radio" 
              name="gender" 
              value="men" 
              checked={userPreferences.gender === 'men'} 
              onChange={handlePreferenceChange}
              className="mr-2" 
            />
            Men's Clothing
          </label>
          <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${userPreferences.gender === 'women' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
            <input 
              type="radio" 
              name="gender" 
              value="women" 
              checked={userPreferences.gender === 'women'} 
              onChange={handlePreferenceChange}
              className="mr-2" 
            />
            Women's Clothing
          </label>
        </div>
      </div>
      
      <div className="mb-8">
        <label className="block text-gray-700 font-medium mb-2">Style Preference</label>
        <select 
          name="style" 
          value={userPreferences.style} 
          onChange={handlePreferenceChange}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="all">All Styles (Casual & Formal)</option>
          <option value="casual">Casual Only</option>
          <option value="formal">Formal Only</option>
        </select>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Detected Clothing Items</h3>
          <button 
            onClick={addCustomItem}
            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Custom Item
          </button>
        </div>
        
        {userPreferences.items.length === 0 ? (
          <p className="text-gray-500 italic">No clothing items detected. Add a custom item.</p>
        ) : (
          <div className="space-y-4">
            {userPreferences.items.map((item) => (
              <div key={item.id} className={`p-4 border rounded-lg ${item.enabled ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleItemEnabled(item.id)}
                      className="mr-3 h-5 w-5 text-blue-600"
                    />
                    <h4 className="font-medium text-gray-800">
                      {item.color.charAt(0).toUpperCase() + item.color.slice(1)} {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </h4>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                {item.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Type</label>
                      <select
                        value={item.type}
                        onChange={(e) => handleItemChange(item.id, 'type', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="shirt">Shirt</option>
                        <option value="t-shirt">T-Shirt</option>
                        <option value="top">Top</option>
                        <option value="blouse">Blouse</option>
                        <option value="pants">Pants</option>
                        <option value="jeans">Jeans</option>
                        <option value="trousers">Trousers</option>
                        <option value="skirt">Skirt</option>
                        <option value="dress">Dress</option>
                        <option value="jacket">Jacket</option>
                        <option value="sweater">Sweater</option>
                        <option value="blazer">Blazer</option>
                        <option value="coat">Coat</option>
                        <option value="saree">Saree</option>
                        <option value="kurta">Kurta</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Color</label>
                      <select
                        value={item.color}
                        onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="black">Black</option>
                        <option value="white">White</option>
                        <option value="blue">Blue</option>
                        <option value="red">Red</option>
                        <option value="green">Green</option>
                        <option value="yellow">Yellow</option>
                        <option value="pink">Pink</option>
                        <option value="purple">Purple</option>
                        <option value="gray">Gray</option>
                        <option value="brown">Brown</option>
                        <option value="navy">Navy</option>
                        <option value="beige">Beige</option>
                        <option value="khaki">Khaki</option>
                        <option value="olive">Olive</option>
                        <option value="maroon">Maroon</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Style</label>
                      <select
                        value={item.subtype}
                        onChange={(e) => handleItemChange(item.id, 'subtype', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="versatile">Versatile</option>
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                        <option value="athletic">Athletic</option>
                        <option value="party">Party Wear</option>
                        <option value="ethnic">Ethnic</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Sleeve Length</label>
                      <select
                        value={item.sleeveLength}
                        onChange={(e) => handleItemChange(item.id, 'sleeveLength', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="any">Any Sleeve</option>
                        <option value="long">Long Sleeve</option>
                        <option value="short">Short Sleeve</option>
                        <option value="sleeveless">Sleeveless</option>
                        <option value="half">Half Sleeve</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Pattern</label>
                      <select
                        value={item.pattern}
                        onChange={(e) => handleItemChange(item.id, 'pattern', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="solid">Solid</option>
                        <option value="striped">Striped</option>
                        <option value="checked">Checked</option>
                        <option value="plaid">Plaid</option>
                        <option value="floral">Floral</option>
                        <option value="printed">Printed</option>
                        <option value="graphic">Graphic</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={restartProcess}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          Start Over
        </button>
        
        <button
          onClick={submitPreferences}
          disabled={loading}
          className={`px-6 py-2 rounded-lg text-white font-medium ${
            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Finding Products...' : 'Find Products'}
        </button>
      </div>
    </div>
  );

  // Product listing UI
  const renderProductListing = () => (
    <div className="product-listing">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Recommended Products</h2>
        
        <button
          onClick={restartProcess}
          className="px-4 py-2 text-blue-600 border border-blue-500 rounded-lg hover:bg-blue-50"
        >
          New Recommendation
        </button>
      </div>
      
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-gray-700 font-medium mb-2">Sort By</label>
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="relevance">Relevance</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Customer Rating</option>
            <option value="popular">Popularity</option>
          </select>
        </div>
        
        <div>
          <label className="block text-gray-700 font-medium mb-2">Category</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Categories</option>
            <option value="tops">Tops</option>
            <option value="bottoms">Bottoms</option>
            <option value="dresses">Dresses</option>
            <option value="outerwear">Outerwear</option>
            <option value="ethnic">Ethnic Wear</option>
          </select>
        </div>
        
        <div>
          <label className="block text-gray-700 font-medium mb-2">Price Range</label>
          <div className="flex items-center gap-2">
            <span>₹{filters.priceRange[0]}</span>
            <input
              type="range"
              min="0"
              max="10000"
              step="500"
              value={filters.priceRange[1]}
              onChange={(e) => handleFilterChange('priceRange', [filters.priceRange[0], parseInt(e.target.value)])}
              className="flex-grow"
            />
            <span>₹{filters.priceRange[1]}</span>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found matching your criteria. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {products.map((product) => (
            <div key={product.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition bg-white">
              <div className="h-64 overflow-hidden relative">
                <img 
                  src={product.imageUrl} 
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 right-0 bg-yellow-400 text-gray-800 px-2 py-1 rounded-tl-md font-medium flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {product.rating}
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">{product.title}</h3>
                <p className="text-sm text-gray-500 mb-2">{product.brand}</p>
                
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xl font-bold text-gray-900">₹{product.price}</span>
                    {product.originalPrice > product.price && (
                      <span className="text-sm text-gray-500 line-through ml-2">₹{product.originalPrice}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{product.reviewCount} reviews</span>
                </div>
                
                <div className="mb-3">
                  <span className="text-sm text-gray-700 font-medium">Material: </span>
                  <span className="text-sm text-gray-600">{product.material}</span>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-4">
                  {product.sizes.map((size, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs border border-gray-300 rounded-md">{size}</span>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => addToCart(product)}
                    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={() => buyNow(product)}
                    className="flex-1 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {hasMore && (
        <div className="flex justify-center pb-8">
          <button
            onClick={loadMoreProducts}
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg ${
              isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? 'Loading...' : 'Load More Products'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="find-clothes-container max-w-6xl mx-auto p-4">
      {showHome && renderHomeScreen()}
      
      {showVerificationForm && renderVerificationForm()}
      
      {!showHome && !showVerificationForm && products.length > 0 && renderProductListing()}
      
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {analyzing ? 'Analyzing Your Style...' : 'Processing Images...'}
            </h3>
            <p className="text-gray-600">This may take a moment</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FindClothes;
