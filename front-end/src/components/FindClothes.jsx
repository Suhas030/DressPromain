import React, { useState, useEffect, useRef } from 'react';
import ModelService from '../utils/ModelService';

function FindClothes() {
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
    
    const fileInputRef = useRef(null);
    const canvasRefs = useRef([]);
    
    // API endpoints (kept for fallback)
    const apiEndpoints = [
        "https://outfit-detect-recs-production.up.railway.app/upload-multiple-photos",
        "http://localhost:8080/upload-multiple-photos",
        "https://outfit-detect-recs-production.up.railway.app/bulk-analyze",
        "http://localhost:8080/bulk-analyze"
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
        // Use createRef without React. prefix since we've imported React directly
        canvasRefs.current = previewImages.map(() => React.createRef());
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
                    setStatusMessage(`Analyzing image ${i+1} of ${updatedPreviews.length}...`);
                    
                    // Use the ModelService to detect outfits
                    const detections = await ModelService.detectOutfit(img.element);
                    
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
                        console.warn(`No detections for image ${i+1}`);
                        img.analysis = { error: "No clothing detected" };
                    }
                } catch (error) {
                    console.error(`Error processing image ${i+1}:`, error);
                    img.analysis = { error: error.message };
                }
            }
            
            // Update preview images with analysis results
            setPreviewImages(updatedPreviews);
            setDetectedItems(allDetectedItems);
            
            // Process colors from all detections
            if (allDetections.length > 0) {
                const dominantColors = ModelService.combineColors(allDetections);
                
                // Set style analysis
                const styleTypes = determineStyleTypes(allDetectedItems, selectedGender);
                
                setStyleAnalysis({
                    dominant_colors: dominantColors,
                    dominant_types: styleTypes
                });
                
                console.log("Created style analysis:", {
                    dominant_colors: dominantColors,
                    dominant_types: styleTypes
                });
            } else {
                setError("No clothing items could be detected in your photos");
            }
            
            // Get recommendations
            await fetchRecommendations();
            
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    // Function to render color swatches
    const renderColorSwatches = (colors) => {
        console.log("Rendering color swatches with:", colors);
        
        if (!colors || colors.length === 0) {
            return <div className="fc-empty-swatches">No colors detected</div>;
        }
        
        return (
            <div className="fc-color-swatches">
                {colors.map((color, index) => (
                    <div key={index} className="fc-color-swatch" 
                         style={{
                            backgroundColor: color[0],
                            width: `${Math.max(10, Math.min(50, color[1]))}%`
                         }}
                         title={`${color[1]}%`}>
                        <span className="fc-color-percentage">{color[1]}%</span>
                    </div>
                ))}
            </div>
        );
    };
    
    // Fetch product recommendations
    const fetchRecommendations = async () => {
        setStatusMessage("Getting product recommendations...");
        
        // Mock product recommendations for demo
        setTimeout(() => {
            // Sample recommendation data (you would usually get this from your API)
            const mockRecommendations = [
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
            ];
            
            // Filter by gender if needed
            setRecommendations(mockRecommendations);
            setStatusMessage("");
            
        }, 1000);
    };
    
    // renderPreviewGrid function to render each preview image with canvas overlay
    const renderPreviewGrid = () => {
        return (
            <div className="fc-preview-grid">
                {previewImages.map((img, index) => (
                    <div key={img.id} className="fc-preview-card">
                        <div className="fc-image-container">
                            <img src={img.src} alt="Your outfit" />
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

    // Render function
    return (
        <div className="content-wrapper">
            <div className="fc-container">
                {showHome ? (
                    <div className='fc-home'>
                        <h1 className='fc-title'>Discover Your Style</h1>
                        <p className='fc-subtitle'>Upload 2-5 outfit photos to get personalized recommendations</p>
                        <button className='btn fc-primary-btn' onClick={() => setShowHome(false)}>
                            Get Started
                        </button>
                    </div>
                ) : (
                    <div className="fc-main-content">
                        {!recommendations.length ? (
                            <div className="fc-upload-section">
                                <h2>Upload Your Style Photos</h2>
                                <p className="fc-instructions">
                                    We'll analyze your outfit photos to understand your style preferences 
                                    and suggest products that match your aesthetic.
                                </p>
                                
                                <div className="fc-file-upload">
                                    <input 
                                        ref={fileInputRef}
                                        type="file" 
                                        multiple 
                                        accept=".jpg, .jpeg, .png" 
                                        onChange={handleFileChange}
                                        id="fc-file-input"
                                    />
                                    <label htmlFor="fc-file-input" className="fc-upload-label">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                                        </svg>
                                        Choose Photos
                                    </label>
                                    <p className="fc-file-requirements">Select 2-5 photos of your outfits</p>
                                </div>
                                
                                {/* Show model load error if any */}
                                {modelLoadError && (
                                    <div className="fc-model-error">
                                        <p>Warning: {modelLoadError}</p>
                                        <p>We'll use fallback detection methods instead.</p>
                                    </div>
                                )}
                                
                                {previewImages.length > 0 && renderPreviewGrid()}
                                
                                <div className="fc-gender-selection">
                                    <h3>Select Your Gender</h3>
                                    <p>This helps us recommend products that match your style preferences</p>
                                    <div className="fc-gender-options">
                                        <button 
                                            className={`fc-gender-btn ${selectedGender === 'male' ? 'active' : ''}`}
                                            onClick={() => setSelectedGender('male')}
                                        >
                                            Men's Fashion
                                        </button>
                                        <button 
                                            className={`fc-gender-btn ${selectedGender === 'female' ? 'active' : ''}`}
                                            onClick={() => setSelectedGender('female')}
                                        >
                                            Women's Fashion
                                        </button>
                                        <button 
                                            className={`fc-gender-btn ${selectedGender === 'unisex' ? 'active' : ''}`}
                                            onClick={() => setSelectedGender('unisex')}
                                        >
                                            Unisex/Non-Binary
                                        </button>
                                    </div>
                                </div>
                                
                                {error && (
                                    <div className="fc-error-message">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                        </svg>
                                        {error}
                                    </div>
                                )}
                                
                                {!isModelLoaded && (
                                    <div className="fc-model-loading">
                                        <div className="fc-spinner"></div>
                                        <p>Loading outfit detection model...</p>
                                    </div>
                                )}
                                
                                {debugMode && (
                                    <div className="fc-debug-panel" style={{
                                        border: '1px solid #ddd', 
                                        padding: '10px', 
                                        margin: '10px 0', 
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}>
                                        <h3>Debug Information</h3>
                                        <div>
                                            <p><strong>Model Status:</strong> {isModelLoaded ? 'Loaded' : 'Loading...'}</p>
                                            {modelLoadError && <p><strong>Model Error:</strong> {modelLoadError}</p>}
                                            <p><strong>API Endpoints:</strong></p>
                                            <ul>
                                                {apiEndpoints.map((endpoint, i) => (
                                                    <li key={i}>{endpoint}</li>
                                                ))}
                                            </ul>
                                            <p><strong>Local Model:</strong> Using ONNX model for detection</p>
                                            <p><strong>Fallback:</strong> Using browser-based color extraction</p>
                                            
                                            {Object.keys(detectedItems).length > 0 && (
                                                <div>
                                                    <p><strong>Detected Items:</strong></p>
                                                    <ul>
                                                        {Object.entries(detectedItems).map(([className, items]) => (
                                                            <li key={className}>
                                                                {className}: {items.length} instances
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ marginTop: '10px' }}>
                                            <button 
                                                style={{
                                                    padding: '5px 10px',
                                                    cursor: 'pointer',
                                                    backgroundColor: '#e2e8f0',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '4px',
                                                    marginRight: '10px'
                                                }}
                                                onClick={async () => {
                                                    // Test model detection
                                                    if (previewImages.length > 0) {
                                                        try {
                                                            const img = previewImages[0];
                                                            const detections = await ModelService.detectOutfit(img.element);
                                                            console.log("Test detection results:", detections);
                                                            alert(`Detected ${detections.length} items in the first image`);
                                                        } catch (e) {
                                                            console.error("Test detection failed:", e);
                                                            alert(`Detection failed: ${e.message}`);
                                                        }
                                                    } else {
                                                        alert("Please upload at least one image first");
                                                    }
                                                }}
                                            >
                                                Test Detection
                                            </button>
                                            <button
                                                style={{
                                                    padding: '5px 10px',
                                                    cursor: 'pointer',
                                                    backgroundColor: '#e2e8f0',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '4px'
                                                }}
                                                onClick={() => {
                                                    // Use mock data for testing
                                                    setStyleAnalysis({
                                                        dominant_colors: [
                                                            ["rgb(45, 52, 67)", 35],
                                                            ["rgb(180, 180, 180)", 28],
                                                            ["rgb(255, 255, 255)", 15],
                                                            ["rgb(55, 94, 151)", 12],
                                                            ["rgb(0, 0, 0)", 10]
                                                        ],
                                                        dominant_types: [
                                                            ["Casual", 45],
                                                            ["Classic", 30],
                                                            ["Minimalist", 25]
                                                        ]
                                                    });
                                                    fetchRecommendations();
                                                }}
                                            >
                                                Use Test Data
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {isAnalyzing && (
                                    <div className="fc-loading">
                                        <div className="fc-spinner"></div>
                                        <p>{statusMessage || "Analyzing your style..."}</p>
                                    </div>
                                )}
                                
                                <div className="fc-action-buttons">
                                    <button 
                                        className="btn fc-secondary-btn"
                                        onClick={() => setShowHome(true)}
                                    >
                                        Back to Home
                                    </button>
                                    <button 
                                        className="btn fc-primary-btn"
                                        onClick={handleSubmit}
                                        disabled={isAnalyzing || files.length < 2 || !selectedGender}
                                    >
                                        {isAnalyzing ? 'Analyzing...' : 'Get Recommendations'}
                                    </button>
                                </div>

                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <button 
                                        onClick={() => setDebugMode(!debugMode)} 
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#999',
                                            textDecoration: 'underline',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {debugMode ? 'Hide Debug Mode' : 'Show Debug Mode'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="fc-results">
                                <div className="fc-style-summary">
                                    <h2>Your Style Profile</h2>
                                    
                                    {styleAnalysis && (
                                        <div className="fc-style-profile">
                                            <div className="fc-style-factor">
                                                <h3>Your Color Palette</h3>
                                                {renderColorSwatches(styleAnalysis.dominant_colors)}
                                            </div>
                                            
                                            <div className="fc-style-factor">
                                                <h3>Your Style Aesthetic</h3>
                                                <div className="fc-style-tags">
                                                    {styleAnalysis.dominant_types.map((type, i) => (
                                                        <span key={i} className="fc-style-tag">
                                                            {type[0]}
                                                            <span className="fc-style-percentage">{type[1]}%</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="fc-style-factor">
                                                <h3>Detected Outfit Items</h3>
                                                <div className="fc-detected-items">
                                                    {Object.entries(detectedItems).length > 0 ? (
                                                        <ul className="fc-items-list">
                                                            {Object.entries(detectedItems).map(([className, items]) => (
                                                                <li key={className}>
                                                                    <strong>{className}</strong>
                                                                    <span className="fc-item-count">({items.length})</span>
                                                                    <div className="fc-item-confidence">
                                                                        Avg. confidence: 
                                                                        {Math.round(
                                                                            items.reduce((sum, item) => sum + item.confidence, 0) / 
                                                                            items.length * 100
                                                                        )}%
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p>No specific items detected</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="fc-analyzed-photos">
                                        <h3>Analyzed Photos</h3>
                                        <div className="fc-photos-grid">
                                            {previewImages.map((img, index) => (
                                                <div key={img.id} className="fc-analyzed-photo">
                                                    <div className="fc-image-container">
                                                        <img src={img.src} alt="Your outfit" />
                                                        <canvas
                                                            ref={el => canvasRefs.current[index] = el}
                                                            className="fc-detection-overlay"
                                                            width={img.width}
                                                            height={img.height}
                                                        />
                                                    </div>
                                                    
                                                    {img.analysis && !img.analysis.error && (
                                                        <div className="fc-photo-rating">
                                                            <span>{convertRatingToStars(img.analysis.rating)}</span>
                                                            <span className="fc-rating-number">{img.analysis.rating}/10</span>
                                                            
                                                            {img.analysis.detections && img.analysis.detections.length > 0 && (
                                                                <div className="fc-detected-items-mini">
                                                                    {img.analysis.detections.map((det, i) => (
                                                                        <span key={i} className="fc-detected-item-mini">
                                                                            {det.class}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {img.analysis && img.analysis.error && (
                                                        <div className="fc-photo-error">
                                                            {img.analysis.error}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="fc-recommendations-section">
                                    <h2>Recommended For Your Style</h2>
                                    <p>Based on your uploaded photos, we think you'll love these items:</p>
                                    
                                    <div className="fc-products-grid">
                                        {recommendations.map(product => (
                                            <div key={product.id} className="fc-product-card">
                                                <div className="fc-product-image">
                                                    <img src={product.image_url} alt={product.name} />
                                                </div>
                                                <div className="fc-product-info">
                                                    <h3>{product.name}</h3>
                                                    <p className="fc-product-price">{product.price}</p>
                                                    <a 
                                                        href={product.url}
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="fc-buy-btn"
                                                    >
                                                        View Product
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="fc-action-buttons">
                                    <button 
                                        className="btn fc-secondary-btn"
                                        onClick={() => setShowHome(true)}
                                    >
                                        Back to Home
                                    </button>
                                    <button 
                                        className="btn fc-primary-btn"
                                        onClick={resetAnalysis}
                                    >
                                        Try Different Photos
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FindClothes;