import React, { useState, useEffect, useRef } from 'react';
import ModelService from '../utils/ModelService';

function FindClothes() {
    // State declarations
    const [showHome, setShowHome] = useState(true);
    const [files, setFiles] = useState([]);
    const [previewImages, setPreviewImages] = useState([]);
    const [selectedGender, setSelectedGender] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [styleAnalysis, setStyleAnalysis] = useState(null);
    const [debugMode, setDebugMode] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [detectedItems, setDetectedItems] = useState({});
    const [modelLoadError, setModelLoadError] = useState(null);
    const [subcategories, setSubcategories] = useState([]);
    const [selectedSubcategory, setSelectedSubcategory] = useState('');
    const [isLoadingSubcategories, setIsLoadingSubcategories] = useState(false);
    const [availableColors, setAvailableColors] = useState([]);
    const [selectedColors, setSelectedColors] = useState([]);
    const [detectionStage, setDetectionStage] = useState('upload'); // 'upload', 'refine', 'results'
    const [detectedItemsWithSubcategories, setDetectedItemsWithSubcategories] = useState({});
    const [availableSubcategoriesByType, setAvailableSubcategoriesByType] = useState({});

    const fileInputRef = useRef(null);
    const canvasRefs = useRef([]);

    // API endpoints (kept for fallback)
    const apiEndpoints = [
        "https://outfit-detect-recs-production.up.railway.app/upload-multiple-photos",
        "http://localhost:5000/upload-multiple-photos",
        "https://outfit-detect-recs-production.up.railway.app/bulk-analyze",
        "http://localhost:5000/bulk-analyze"
    ];

    // Clear errors when files change
    useEffect(() => {
        if (files.length > 0) {
            setError(null);
        }
    }, [files]);

    // Load the model when component mounts
    useEffect(() => {
        async function loadModel() {
            try {
                setStatusMessage("Loading outfit detection model...");
                await ModelService.loadModel();
                console.log("ONNX model loaded successfully");

                // Add verification
                const verified = await ModelService.verifyModelLabels();
                if (!verified) {
                    console.warn("Model label verification failed - detection might not be accurate");
                }

                setIsModelLoaded(true);
                setModelLoadError(null);
            } catch (error) {
                console.error("Failed to load model:", error);
                setModelLoadError(`Failed to load detection model: ${error.message}`);
                // Still set as loaded to allow using fallback
                setIsModelLoaded(true);
            }
        }

        loadModel();
    }, []);

    // Initialize canvas refs when preview images update
    useEffect(() => {
        // Just initialize an array of nulls with the correct length
        canvasRefs.current = Array(previewImages.length).fill(null);
    }, [previewImages.length]);

    // Handle file selection
    const handleFileChange = (event) => {
        const selectedFiles = Array.from(event.target.files);

        if (selectedFiles.length > 5) {
            setError("Maximum 5 images allowed");
            return;
        }

        if (selectedFiles.length < 2) {
            setError("Please select at least 2 images");
            return;
        }

        const imagePromises = selectedFiles.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        resolve({
                            id: `img-${Math.random().toString(36).substr(2, 9)}`,
                            file: file,
                            name: file.name,
                            src: e.target.result,
                            width: img.width,
                            height: img.height,
                            element: img
                        });
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(imagePromises).then(images => {
            setFiles(selectedFiles);
            setPreviewImages(images);
            // Reset any previously detected items
            setDetectedItems({});
        });
    };

    // Convert rating to stars for display
    const convertRatingToStars = (rating) => {
        // Ensure rating is a valid number between 0-10
        const validRating = Math.max(0, Math.min(10, Number(rating) || 0));

        // Calculate stars (0-5 scale)
        const fullStars = Math.floor(validRating / 2);
        const halfStar = validRating % 2 >= 1;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        return (
            <>
                {'★'.repeat(Math.max(0, fullStars))}
                {halfStar ? '½' : ''}
                {'☆'.repeat(Math.max(0, emptyStars))}
            </>
        );
    };

    // Handle form submission
    const handleSubmit = async () => {
        if (!selectedGender) {
            setError("Please select your gender for accurate recommendations");
            return;
        }

        if (files.length < 2) {
            setError("Please select at least 2 images");
            return;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            // Log details about submission
            console.log("Submitting files:", files.map(f => f.name));
            console.log("Selected gender:", selectedGender);

            // Process images with local model
            setStatusMessage("Starting individual image analysis...");
            console.log("Starting individual image analysis...");

            // Process each image with the model
            const updatedPreviews = [...previewImages];
            const allDetectedItems = {};
            const allDetections = [];

            // Process each image sequentially
            for (let i = 0; i < updatedPreviews.length; i++) {
                const img = updatedPreviews[i];

                try {
                    setStatusMessage(`Analyzing image ${i + 1} of ${updatedPreviews.length}...`);

                    // Use the ModelService to detect outfits
                    const detections = await ModelService.detectOutfit(img.element);

                    // Add this debug logging with more detail
                    console.log(`Image ${i + 1} detections found: ${detections.length}`);
                    console.log(`Detection details:`, detections.map(d =>
                        `${d.class} (${(d.confidence * 100).toFixed(1)}%) at [${d.bbox.map(v => Math.round(v)).join(', ')}]`
                    ));

                    if (detections && detections.length > 0) {
                        // Draw detection overlays on canvas
                        if (canvasRefs.current[i]) {
                            const canvas = canvasRefs.current[i];
                            ModelService.drawDetectionOverlay(img.element, detections, canvas);
                        }

                        // Add detection to analysis results
                        img.analysis = {
                            detections,
                            rating: calculateRating(detections),
                            colors: ModelService.combineColors(detections)
                        };

                        // Track detected items by class for statistics
                        detections.forEach(detection => {
                            allDetections.push(detection);

                            if (!allDetectedItems[detection.class]) {
                                allDetectedItems[detection.class] = [];
                            }

                            allDetectedItems[detection.class].push({
                                confidence: detection.confidence,
                                colors: detection.colors,
                                bbox: detection.bbox,
                                imageIndex: i
                            });
                        });
                    } else {
                        console.warn(`No detections for image ${i + 1}`);
                        img.analysis = { error: "No clothing detected" };
                    }
                } catch (error) {
                    console.error(`Error processing image ${i + 1}:`, error);
                    img.analysis = { error: error.message };
                }
            }

            // Update preview images with analysis results
            setPreviewImages(updatedPreviews);
            setDetectedItems(allDetectedItems);

            // Process colors from all detections
            if (allDetections.length > 0) {
                const dominantColors = ModelService.combineColors(allDetections);

                // Validate the colors
                const validatedColors = dominantColors.filter(color =>
                    Array.isArray(color) &&
                    color.length >= 2 &&
                    typeof color[0] === 'string' &&
                    !color[0].includes('NaN') &&
                    color[0].startsWith('rgb(')
                );

                // Set style analysis
                const styleTypes = determineStyleTypes(allDetectedItems, selectedGender);

                const analysisData = {
                    dominant_colors: validatedColors.length > 0 ? validatedColors : [["rgb(128, 128, 128)", 100]],
                    dominant_types: styleTypes
                };

                // Store the analysis data locally before setting state
                const stableAnalysisData = { ...analysisData };

                // Update state
                setStyleAnalysis(analysisData);
                console.log("Created style analysis:", analysisData);

                // Initialize subcategory selection structure
                const itemsWithSubcategories = {};
                Object.keys(allDetectedItems).forEach(className => {
                    itemsWithSubcategories[className] = {
                        items: allDetectedItems[className],
                        selectedSubcategories: [] // Initialize with empty array for multiple selections
                    };
                });
                setDetectedItemsWithSubcategories(itemsWithSubcategories);

                // Move to refinement stage instead of getting recommendations immediately
                setDetectionStage('refine');

                // Fetch subcategories for each detected clothing class
                fetchSubcategoriesForDetectedItems(allDetectedItems);
            } else {
                setError("No clothing items could be detected in your photos");
            }

        } catch (error) {
            console.error("Analysis error:", error);
            setError(`Analysis failed: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Calculate a rating based on detections
    const calculateRating = (detections) => {
        // Simple rating calculation based on confidence and number of items
        if (!detections || detections.length === 0) return 5.0;

        // Calculate average confidence
        const avgConfidence = detections.reduce((sum, det) => sum + det.confidence, 0) / detections.length;

        // More items detected = better outfit (typically)
        const itemBonus = Math.min(detections.length * 0.5, 2);

        // Calculate rating on a 10-point scale
        const rating = 5 + (avgConfidence * 3) + itemBonus;

        // Return rating clipped between 3 and 10
        return Math.max(3, Math.min(10, parseFloat(rating.toFixed(1))));
    };

    // Determine style types based on detected items
    const determineStyleTypes = (detectedItems, gender) => {
        // Simplified style determination
        const styles = {
            "Casual": 0,
            "Formal": 0,
            "Classic": 0,
            "Trendy": 0,
            "Minimalist": 0,
            "Bohemian": 0
        };

        // Analyze detected clothing types
        Object.entries(detectedItems).forEach(([className, items]) => {
            const count = items.length;

            // Basic rules based on clothing types
            if (className.includes('top')) {
                styles["Casual"] += count * 10;

                if (className.includes('sleeve')) {
                    styles["Classic"] += count * 15;
                }
            }

            if (className.includes('outwear')) {
                styles["Casual"] += count * 10;
                styles["Trendy"] += count * 5;
            }

            if (className.includes('dress')) {
                styles["Formal"] += count * 20;

                if (className.includes('sling')) {
                    styles["Trendy"] += count * 15;
                    styles["Bohemian"] += count * 10;
                }
            }

            if (className.includes('trousers')) {
                styles["Classic"] += count * 10;
                styles["Minimalist"] += count * 5;
            }

            if (className.includes('shorts')) {
                styles["Casual"] += count * 15;
            }

            if (className.includes('skirt')) {
                styles["Trendy"] += count * 10;
                styles["Bohemian"] += count * 5;
            }
        });

        // Convert to list and calculate percentages
        const styleList = Object.entries(styles)
            .filter(([_, score]) => score > 0)
            .sort((a, b) => b[1] - a[1]);

        if (styleList.length === 0) {
            // Provide defaults if no styles were determined
            return [["Casual", 50], ["Classic", 30], ["Minimalist", 20]];
        }

        const total = styleList.reduce((sum, [_, score]) => sum + score, 0);
        return styleList
            .map(([style, score]) => [style, Math.round((score / total) * 100)])
            .slice(0, 3); // Take top 3 styles
    };

    // Reset the analysis
    const resetAnalysis = () => {
        setRecommendations([]);
        setStyleAnalysis(null);
        setSelectedGender('');
        setFiles([]);
        setPreviewImages([]);
        setError(null);
        setDetectedItems({});
        setSubcategories([]);
        setSelectedSubcategory('');
        setAvailableColors([]);
        setSelectedColors([]);
        setDetectionStage('upload');
        setDetectedItemsWithSubcategories({});
        setAvailableSubcategoriesByType({});
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Function to render color swatches
    const renderColorSwatches = (colors) => {
        // Ensure colors is an array with at least one element
        if (!colors || !Array.isArray(colors) || colors.length === 0) {
            return <div className="fc-empty-swatches">No colors detected</div>;
        }

        return (
            <div className="fc-color-swatches">
                {colors.map((color, index) => {
                    // Enhanced error handling for invalid color formats
                    try {
                        // Ensure each color entry is valid
                        if (!color || !Array.isArray(color) || color.length < 2 || typeof color[0] !== 'string') {
                            console.warn('Invalid color format:', color);
                            return null;
                        }

                        // Extract RGB values with better error handling
                        const rgbMatch = color[0].match(/\d+/g);
                        if (!rgbMatch || rgbMatch.length < 3) {
                            console.warn('Invalid RGB format:', color[0]);
                            return null;
                        }

                        const [r, g, b] = rgbMatch.map(Number);
                        if (isNaN(r) || isNaN(g) || isNaN(b)) {
                            console.warn('NaN values in RGB:', color[0]);
                            return null;
                        }

                        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        const textColor = luminance > 0.5 ? '#000' : '#fff';
                        const percentage = typeof color[1] === 'number' ? color[1] : 0;

                        return (
                            <div key={index}
                                className="fc-color-swatch"
                                style={{
                                    backgroundColor: color[0],
                                    width: `${Math.max(10, Math.min(50, percentage))}%`,
                                    color: textColor
                                }}
                                title={color[0]}
                            >
                                <span className="fc-color-percentage">
                                    {percentage}%
                                </span>
                            </div>
                        );
                    } catch (e) {
                        console.error("Error rendering color swatch:", e);
                        return null; // Skip this color on error
                    }
                }).filter(Boolean)}  {/* Filter out null values */}
            </div>
        );
    };

    // Fetch subcategories for detected items - updated function
    const fetchSubcategoriesForDetectedItems = async (detectedItems) => {
        if (!detectedItems || Object.keys(detectedItems).length === 0) {
            console.log("No detected items to fetch subcategories for");
            return;
        }

        setIsLoadingSubcategories(true);
        const subcategoriesByType = {};

        try {
            // For each detected clothing class, fetch available subcategories
            for (const className of Object.keys(detectedItems)) {
                try {
                    // Try to get subcategories from API
                    const url = `http://localhost:5000/api/product-subcategories?clothingClass=${encodeURIComponent(className)}&gender=${selectedGender || 'all'}`;
                    
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.status}`);
                    }

                    const data = await response.json();
                    
                    // Check if API returned a meaningful list of subcategories
                    if (data && data.subcategories && Array.isArray(data.subcategories) && data.subcategories.length > 3) {
                        // Only use API data if it has a substantial number of subcategories
                        subcategoriesByType[className] = data.subcategories;
                        console.log(`Using API subcategories for ${className}:`, data.subcategories);
                    } else {
                        // API returned too few subcategories, use defaults instead
                        throw new Error(`API returned insufficient subcategories for ${className}`);
                    }
                } catch (error) {
                    console.warn(`Falling back to default subcategories for ${className}:`, error.message);
                    
                    // IMPORTANT: Use the default subcategories from our predefined object
                    if (DEFAULT_SUBCATEGORIES[className] && Array.isArray(DEFAULT_SUBCATEGORIES[className])) {
                        subcategoriesByType[className] = [...DEFAULT_SUBCATEGORIES[className]];
                        console.log(`Using default subcategories for ${className}:`, DEFAULT_SUBCATEGORIES[className]);
                    } else {
                        // If there's no default for this class (shouldn't happen), provide some basic options
                        console.warn(`No default subcategories found for ${className}, using generic fallback`);
                        
                        if (className.includes('top')) {
                            subcategoriesByType[className] = ['t-shirt', 'shirt', 'blouse', 'polo'];
                        } else if (className.includes('trousers')) {
                            subcategoriesByType[className] = ['jeans', 'pants', 'chinos', 'slacks'];
                        } else if (className.includes('dress')) {
                            subcategoriesByType[className] = ['casual dress', 'formal dress', 'cocktail dress'];
                        } else if (className.includes('outwear')) {
                            subcategoriesByType[className] = ['jacket', 'coat', 'blazer'];
                        } else if (className.includes('shorts')) {
                            subcategoriesByType[className] = ['casual shorts', 'sport shorts', 'bermuda'];
                        } else if (className.includes('skirt')) {
                            subcategoriesByType[className] = ['mini skirt', 'midi skirt', 'maxi skirt'];
                        } else {
                            subcategoriesByType[className] = ['casual', 'formal', 'sporty'];
                        }
                    }
                }

                // Initialize the selection structure regardless of where subcategories came from
                setDetectedItemsWithSubcategories(prev => ({
                    ...prev,
                    [className]: {
                        ...prev[className],
                        selectedSubcategories: [] // Empty array for multiple selections
                    }
                }));
            }

            setAvailableSubcategoriesByType(subcategoriesByType);
            console.log("Final available subcategories:", subcategoriesByType);
        } catch (error) {
            console.error("Error in subcategory processing:", error);
            // Even if the overall process fails, make sure we have something to show
            for (const className of Object.keys(detectedItems)) {
                if (!subcategoriesByType[className] && DEFAULT_SUBCATEGORIES[className]) {
                    subcategoriesByType[className] = [...DEFAULT_SUBCATEGORIES[className]];
                }
            }
            setAvailableSubcategoriesByType(subcategoriesByType);
        } finally {
            setIsLoadingSubcategories(false);
        }
    };

    // Handle subcategory selection (supporting multiple selections)
    const handleSubcategorySelect = (className, subcategory) => {
        setDetectedItemsWithSubcategories(prev => {
            const currentItem = prev[className] || {};
            const currentSelections = currentItem.selectedSubcategories || [];
            
            // Toggle selection
            let newSelections;
            if (currentSelections.includes(subcategory)) {
                // Remove if already selected
                newSelections = currentSelections.filter(item => item !== subcategory);
            } else {
                // Add if not selected
                newSelections = [...currentSelections, subcategory];
            }
            
            return {
                ...prev,
                [className]: {
                    ...currentItem,
                    selectedSubcategories: newSelections
                }
            };
        });
    };

    // Get recommendations based on refined subcategories
    const fetchRecommendationsWithSubcategories = async () => {
        setStatusMessage("Getting product recommendations...");
        
        try {
            // Get all selections and prepare them for recommendations
            const selections = [];
            
            Object.entries(detectedItemsWithSubcategories).forEach(([className, data]) => {
                if (data.selectedSubcategories && data.selectedSubcategories.length > 0) {
                    selections.push({
                        clothingClass: className,
                        subcategories: data.selectedSubcategories, // Now using array of subcategories
                        count: data.items.length
                    });
                }
            });
            
            // Sort by count to get dominant items first
            selections.sort((a, b) => b.count - a.count);
            
            if (selections.length === 0) {
                throw new Error("No subcategories selected");
            }
            
            // Use the dominant item for recommendations
            const dominant = selections[0];
            
            // Extract dominant colors
            const dominantColors = styleAnalysis?.dominant_colors || [];
            const colorParams = dominantColors.map(color => color[0]);
            
            // Create API endpoint URL 
            const baseUrl = "http://localhost:5000/api/product-recommendations";
            
            // Use the first subcategory for the API call, but we could modify the backend to accept multiple
            const primarySubcategory = dominant.subcategories[0];
            
            // Build query parameters
            const params = `?clothingClass=${encodeURIComponent(dominant.clothingClass)}&productType=${encodeURIComponent(primarySubcategory)}&gender=${selectedGender}&colors=${encodeURIComponent(JSON.stringify(colorParams))}&limit=8`;
            
            console.log(`Fetching recommendations from: ${baseUrl + params}`);
            
            const response = await fetch(baseUrl + params);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Got product data:", data);
            
            if (data && data.products && Array.isArray(data.products)) {
                setRecommendations(data.products);
                // Move to results stage
                setDetectionStage('results');
            } else {
                throw new Error("No product data received from API");
            }
            
        } catch (error) {
            console.error("Failed to get recommendations:", error);
            
            // Fall back to mock data based on the selections
            let mockCategory = 'default';
            let mockSubcategory = null;
            
            if (Object.keys(detectedItemsWithSubcategories).length > 0) {
                const className = Object.keys(detectedItemsWithSubcategories)[0];
                mockCategory = className;
                const subcats = detectedItemsWithSubcategories[className].selectedSubcategories || [];
                mockSubcategory = subcats.length > 0 ? subcats[0] : null;
            }
            
            const mockRecommendations = getLocalRecommendations(mockCategory, selectedGender, mockSubcategory);
            setRecommendations(mockRecommendations);
            setDetectionStage('results');
        } finally {
            setStatusMessage("");
        }
    };

    // Get local recommendations when API fails
    const getLocalRecommendations = (clothingClass, gender, subcategory = null) => {
        // If a subcategory is provided, try to use that first
        if (subcategory) {
            // Check if we have specific recommendations for this subcategory
            const subcategoryRecommendations = {
                't-shirt': [
                    {
                        id: "tshirt1",
                        name: "Premium Cotton T-Shirt",
                        price: "$19.99",
                        image_url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop",
                        url: "https://example.com/product/tshirt1",
                        type: "t-shirt",
                        color: "black"
                    },
                    {
                        id: "tshirt2",
                        name: "Graphic Print T-Shirt",
                        price: "$24.99",
                        image_url: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&h=500&fit=crop",
                        url: "https://example.com/product/tshirt2",
                        type: "t-shirt",
                        color: "white"
                    }
                ],
                'jeans': [
                    {
                        id: "jeans1",
                        name: "Slim Fit Denim Jeans",
                        price: "$59.99",
                        image_url: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop",
                        url: "https://example.com/product/jeans1",
                        type: "jeans",
                        color: "blue"
                    },
                    {
                        id: "jeans2",
                        name: "Relaxed Fit Jeans",
                        price: "$49.99",
                        image_url: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop",
                        url: "https://example.com/product/jeans2",
                        type: "jeans",
                        color: "navy"
                    }
                ],
                'formal shirt': [
                    {
                        id: "formalshirt1",
                        name: "Classic Oxford Dress Shirt",
                        price: "$69.99",
                        image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop",
                        url: "https://example.com/product/formalshirt1",
                        type: "formal shirt",
                        color: "white"
                    },
                    {
                        id: "formalshirt2",
                        name: "Wrinkle-Free Dress Shirt",
                        price: "$59.99",
                        image_url: "https://images.unsplash.com/photo-1563630423918-b58f07336ac5?w=400&h=500&fit=crop",
                        url: "https://example.com/product/formalshirt2",
                        type: "formal shirt",
                        color: "blue"
                    }
                ]
                // Add more subcategory-specific recommendations as needed
            };
            
            if (subcategoryRecommendations[subcategory]) {
                return subcategoryRecommendations[subcategory];
            }
        }
        
        // Your existing class-based recommendations
        const recommendationsByClass = {
            'short sleeve top': [
                {
                    id: "top1",
                    name: "Classic Fit T-Shirt",
                    price: "$24.99",
                    image_url: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=500&fit=crop",
                    url: "https://example.com/product/top1"
                },
                {
                    id: "top2",
                    name: "Casual Polo Shirt",
                    price: "$29.99",
                    image_url: "https://images.unsplash.com/photo-1571455786673-9d9d6c194f90?w=400&h=500&fit=crop",
                    url: "https://example.com/product/top2"
                },
            ],
            'long sleeve top': [
                {
                    id: "lsleeve1",
                    name: "Button-Down Oxford Shirt",
                    price: "$39.99",
                    image_url: "https://images.unsplash.com/photo-1602810316693-3667c854239a?w=400&h=500&fit=crop",
                    url: "https://example.com/product/lsleeve1"
                },
                {
                    id: "lsleeve2",
                    name: "Cotton Henley Shirt",
                    price: "$35.99",
                    image_url: "https://images.unsplash.com/photo-1626497764746-6dc36546b388?w=400&h=500&fit=crop",
                    url: "https://example.com/product/lsleeve2"
                },
            ],
            'trousers': [
                {
                    id: "pants1",
                    name: "Slim Fit Chino Pants",
                    price: "$49.99",
                    image_url: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=500&fit=crop",
                    url: "https://example.com/product/pants1"
                },
                {
                    id: "pants2",
                    name: "Stretch Dress Pants",
                    price: "$59.99",
                    image_url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop",
                    url: "https://example.com/product/pants2"
                },
            ],
            'default': [
                {
                    id: "p1",
                    name: "Classic Oxford Button-Down Shirt",
                    price: "$49.99",
                    image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop",
                    url: "https://example.com/product/1"
                },
                {
                    id: "p2",
                    name: "Slim Fit Chino Pants",
                    price: "$59.99",
                    image_url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop",
                    url: "https://example.com/product/2"
                },
                {
                    id: "p3",
                    name: "Casual Denim Jacket",
                    price: "$89.99",
                    image_url: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400&h=500&fit=crop",
                    url: "https://example.com/product/3"
                },
                {
                    id: "p4",
                    name: "Premium Leather Sneakers",
                    price: "$129.99",
                    image_url: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=500&fit=crop",
                    url: "https://example.com/product/4"
                }
            ]
        };

        return recommendationsByClass[clothingClass] || recommendationsByClass['default'];
    };

    // renderPreviewGrid function to render each preview image with canvas overlay
    const renderPreviewGrid = () => {
        return (
            <div className="fc-preview-grid">
                {previewImages.map((img, index) => (
                    <div key={img.id} className="fc-preview-card">
                        <div className="fc-image-container">
                            <img 
                                src={img.src} 
                                alt="Your outfit"
                            /> {/* Added the missing closing tag here */}
                            <canvas
                                ref={el => canvasRefs.current[index] = el}
                                className="fc-detection-overlay"
                                width={img.width}
                                height={img.height}
                            />
                        </div>

                        <div className="fc-preview-info">
                            <span className="fc-preview-name">
                                {img.name.length > 20
                                    ? img.name.substring(0, 20) + '...'
                                    : img.name}
                            </span>

                            {img.analysis && !img.analysis.error && img.analysis.detections && (
                                <div className="fc-preview-analysis">
                                    <div className="fc-preview-rating">
                                        <span>{convertRatingToStars(img.analysis.rating)}</span>
                                        <span className="fc-rating-number">{img.analysis.rating}/10</span>
                                    </div>
                                    <div className="fc-detection-info">
                                        {img.analysis.detections.map((detection, i) => (
                                            <div key={i} className="fc-detection-item">
                                                {detection.class} ({Math.round(detection.confidence * 100)}%)
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {img.analysis && img.analysis.error && (
                                <div className="fc-preview-error">
                                    {img.analysis.error}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };
    
    // Update the refinement stage rendering to support multiple selections
    const renderRefinementStage = () => {
        console.log("Current subcategories by type:", availableSubcategoriesByType);
        
        return (
            <div className="fc-refinement-stage">
                <h2>Refine Your Clothing Items</h2>
                <p>We detected the following clothing items in your photos. Please select specific types to get better recommendations.</p>
                
                {Object.entries(detectedItemsWithSubcategories).map(([className, data]) => (
                    <div key={className} className="fc-refinement-item">
                        <h3 className="fc-item-class">
                            {className}
                            <span className="fc-item-count">
                                ({data.items.length} {data.items.length === 1 ? 'item' : 'items'})
                            </span>
                        </h3>
                        
                        <div className="fc-item-subcategories">
                            <p>Select specific types (choose multiple):</p>
                            <div className="fc-subcategory-scroll-container">
                                <div className="fc-subcategory-buttons">
                                    {isLoadingSubcategories ? (
                                        <div className="fc-loading-subcategories">
                                            <div className="fc-spinner-small"></div>
                                            <span>Loading options...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {availableSubcategoriesByType[className]?.length > 0 ? (
                                                availableSubcategoriesByType[className].map(subcategory => (
                                                    <button
                                                        key={subcategory}
                                                        className={`fc-subcategory-button ${
                                                            data.selectedSubcategories && 
                                                            data.selectedSubcategories.includes(subcategory) ? 'active' : ''
                                                        }`}
                                                        onClick={() => handleSubcategorySelect(className, subcategory)}
                                                    >
                                                        {subcategory}
                                                    </button>
                                                ))
                                            ) : (
                                                <span>No specific types available</span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="fc-detected-examples">
                            <p>Examples from your photos:</p>
                            <div className="fc-example-images">
                                {data.items.map((item, idx) => {
                                    const imgIndex = item.imageIndex;
                                    if (imgIndex === undefined || !previewImages[imgIndex]) return null;
                                    
                                    return (
                                        <div key={idx} className="fc-example-item">
                                            <img 
                                                src={previewImages[imgIndex].src} 
                                                alt={className}
                                                className="fc-example-thumbnail"
                                            />
                                            <span className="fc-confidence">
                                                {Math.round(item.confidence * 100)}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
                
                <div className="fc-action-bar">
                    <button 
                        className="fc-button fc-button-secondary" 
                        onClick={() => setDetectionStage('upload')}
                    >
                        Back
                    </button>
                    <button 
                        className="fc-button" 
                        onClick={fetchRecommendationsWithSubcategories}
                    >
                        Get Recommendations
                    </button>
                </div>
            </div>
        );
    };
    
    // Render the upload stage
    const renderUploadStage = () => {
        return (
            <div className="fc-upload-section">
                <h2>Find Similar Clothes from Your Photos</h2>
                <p>Upload 2-5 photos of your outfit to get personalized recommendations</p>
                
                <div className="fc-file-upload">
                    <input
                        type="file"
                        id="fc-file-input"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        ref={fileInputRef}
                    />
                    <label htmlFor="fc-file-input" className="fc-upload-label">
                        Choose Photos
                    </label>
                    
                    <p className="fc-file-requirements">
                        Select 2-5 images (JPG, PNG) - Max 5MB each
                    </p>
                    
                    {error && (
                        <div className="fc-error-message">{error}</div>
                    )}
                    
                    {files.length > 0 && (
                        <>
                            <div className="fc-gender-selector">
                                <div 
                                    className={`fc-gender-option ${selectedGender === 'male' ? 'selected' : ''}`}
                                    onClick={() => setSelectedGender('male')}
                                >
                                    Male
                                </div>
                                <div 
                                    className={`fc-gender-option ${selectedGender === 'female' ? 'selected' : ''}`}
                                    onClick={() => setSelectedGender('female')}
                                >
                                    Female
                                </div>
                            </div>
                            
                            {renderPreviewGrid()}
                            
                            <button 
                                className="fc-button"
                                onClick={handleSubmit}
                                disabled={isAnalyzing}
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Photos'}
                            </button>
                        </>
                    )}
                </div>
                
                {isAnalyzing && (
                    <div className="fc-loading">
                        <div className="fc-spinner"></div>
                        <p>{statusMessage || 'Processing your photos...'}</p>
                    </div>
                )}
            </div>
        );
    };
    
    // Render the results stage
    const renderResultsStage = () => {
        // Function to proxy image URLs
        const getProxiedImageUrl = (originalUrl) => {
            // Return local images as is
            if (!originalUrl || originalUrl.startsWith('/') || originalUrl.startsWith('data:')) {
                return originalUrl || 'https://via.placeholder.com/400x500?text=No+Image';
            }
            
            // Use the proxy for remote images
            return `http://localhost:5000/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
        };

        return (
            <div className="fc-results">
                <div className="fc-style-summary">
                    <h2>Style Analysis Results</h2>
                    
                    {styleAnalysis && (
                        <>
                            <h3>Dominant Colors</h3>
                            {renderColorSwatches(styleAnalysis.dominant_colors)}
                            
                            <h3>Style Categories</h3>
                            <div className="fc-style-categories">
                                {styleAnalysis.dominant_types.map(([style, percentage], i) => (
                                    <div key={i} className="fc-style-category">
                                        <span className="fc-style-name">{style}</span>
                                        <div className="fc-style-bar">
                                            <div 
                                                className="fc-style-fill"
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                            <span className="fc-style-percentage">{percentage}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
                
                <h2>Recommended Products</h2>
                <div className="fc-recommendations-grid">
                    {recommendations.map(product => (
                        <a 
                            href={product.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            key={product.id}
                            className="fc-product-card"
                        >
                            <img 
                                src={getProxiedImageUrl(product.image_url)} 
                                alt={product.name}
                                className="fc-product-image"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/400x500?text=Image+Error';
                                }}
                            />
                            <div className="fc-product-info">
                                <h3 className="fc-product-title">{product.name}</h3>
                                <div className="fc-product-price">{product.price}</div>
                                {product.brand && (
                                    <div className="fc-product-brand">{product.brand}</div>
                                )}
                            </div>
                        </a>
                    ))}
                </div>
                
                <div className="fc-action-bar">
                    <button 
                        className="fc-button fc-button-secondary" 
                        onClick={() => setDetectionStage('refine')}
                    >
                        Back to Refinement
                    </button>
                    <button 
                        className="fc-button fc-button-secondary" 
                        onClick={resetAnalysis}
                    >
                        Start Over
                    </button>
                </div>
            </div>
        );
    };

    // Define default subcategories (INSIDE the component body)
    const DEFAULT_SUBCATEGORIES = {
        'short sleeve top': ['t-shirt', 'polo shirt', 'casual shirt', 'blouse', 'crop top'],
        'long sleeve top': ['dress shirt', 'formal shirt', 'casual shirt', 'sweater', 'blouse', 'turtleneck'],
        'short sleeve outwear': ['denim jacket', 'bomber jacket', 'casual jacket', 'blazer'],
        'long sleeve outwear': ['winter coat', 'trench coat', 'leather jacket', 'bomber jacket', 'blazer'],
        'vest': ['sleeveless vest', 'suit vest', 'puffer vest', 'knit vest'],
        'sling': ['camisole', 'tank top', 'sleeveless top', 'spaghetti strap top'],
        'shorts': ['casual shorts', 'athletic shorts', 'denim shorts', 'bermuda shorts', 'cargo shorts'],
        'trousers': ['jeans', 'chinos', 'dress pants', 'sweatpants', 'leggings', 'cargo pants'],
        'skirt': ['mini skirt', 'midi skirt', 'maxi skirt', 'pleated skirt', 'pencil skirt', 'a-line skirt'],
        'short sleeve dress': ['casual dress', 'cocktail dress', 'sun dress', 'shift dress', 'a-line dress'],
        'long sleeve dress': ['maxi dress', 'formal dress', 'sweater dress', 'shirt dress', 'wrap dress'],
        'vest dress': ['sleeveless dress', 'shift dress', 'cocktail dress', 'formal dress'],
        'sling dress': ['spaghetti strap dress', 'slip dress', 'evening gown', 'cocktail dress']
    };
    
    // Debug logging for subcategories - keep this INSIDE the component
    useEffect(() => {
        console.log("DEFAULT_SUBCATEGORIES loaded:", DEFAULT_SUBCATEGORIES);
    }, []);
    
    return (
        <div className="find-clothes-container">
            {detectionStage === 'upload' ? renderUploadStage() : 
             detectionStage === 'refine' ? renderRefinementStage() : 
             renderResultsStage()}
        </div>
    );
}

export default FindClothes;

/* CSS Styles (to be added in your CSS file)
.fc-refinement-stage {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.fc-refinement-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.fc-item-class {
  font-size: 1.3rem;
  color: #333;
  margin-top: 0;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}

.fc-item-count {
  font-size: 0.9rem;
  color: #666;
  margin-left: 10px;
  font-weight: normal;
}

.fc-item-subcategories p {
  margin-bottom: 8px;
  color: #555;
}

.fc-detected-examples {
  margin-top: 15px;
}

.fc-detected-examples p {
  margin-bottom: 8px;
  color: #555;
}

.fc-example-images {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.fc-example-item {
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 4px;
  overflow: hidden;
}

.fc-example-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fc-confidence {
  position: absolute;
  bottom: 0;
  right: 0;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-top-left-radius: 4px;
}

.fc-subcategory-scroll-container {
  max-height: 150px;
  overflow-y: auto;
  margin-bottom: 10px;
}

.fc-subcategory-button {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  margin-right: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.3s;
}

.fc-subcategory-button.active {
  background: #0056b3;
}

.fc-subcategory-button:hover {
  background: #0056b3;
}
*/