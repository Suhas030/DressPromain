// Add these imports at the top
import ModelService from '../utils/ModelService';
import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';

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
    
    const fileInputRef = useRef(null);
    
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
                await ModelService.loadModel();
                setIsModelLoaded(true);
                console.log("Model loaded successfully");
            } catch (error) {
                console.error("Failed to load model:", error);
                setError("Failed to load outfit detection model. Please try again later.");
            }
        }
        
        loadModel();
    }, []);

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
                    resolve({
                        id: nanoid(),
                        file,
                        name: file.name,
                        src: e.target.result,
                        analysis: null
                    });
                };
                reader.readAsDataURL(file);
            });
        });
        
        Promise.all(imagePromises).then(images => {
            setFiles(selectedFiles);
            setPreviewImages(images);
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
            const allColors = {};
            
            // Process each image sequentially
            for (let i = 0; i < updatedPreviews.length; i++) {
                const img = updatedPreviews[i];
                setStatusMessage(`Analyzing image ${i+1}/${updatedPreviews.length}...`);
                
                try {
                    // Create an image element for the model to process
                    const imageElement = new Image();
                    await new Promise((resolve, reject) => {
                        imageElement.onload = resolve;
                        imageElement.onerror = reject;
                        imageElement.src = img.src;
                    });
                    
                    // Detect outfit in the image
                    const detections = await ModelService.detectOutfit(imageElement);
                    
                    if (detections && detections.length > 0) {
                        // Update preview with analysis
                        // Normalize confidence to 0-10 scale and ensure it's valid
                        const confidence = detections[0].confidence || 0;
                        const rating = Math.min(10, Math.max(0, Math.round(confidence * 10)));
                        
                        updatedPreviews[i].analysis = {
                            rating: rating,
                            detections
                        };
                        
                        // Add to detected items
                        detections.forEach(detection => {
                            // Track detection by class
                            if (!allDetectedItems[detection.class]) {
                                allDetectedItems[detection.class] = [];
                            }
                            allDetectedItems[detection.class].push({
                                ...detection,
                                imageId: img.id
                            });
                            
                            // Aggregate colors
                            if (detection.colors) {
                                detection.colors.forEach(([color, percentage]) => {
                                    if (!allColors[color]) {
                                        allColors[color] = 0;
                                    }
                                    allColors[color] += percentage;
                                });
                            }
                        });
                    } else {
                        updatedPreviews[i].analysis = {
                            error: "No outfits detected"
                        };
                    }
                } catch (error) {
                    console.error(`Analysis error for image ${i+1}:`, error);
                    updatedPreviews[i].analysis = {
                        error: error.message
                    };
                }
            }
            
            // Update preview images with analysis results
            setPreviewImages(updatedPreviews);
            setDetectedItems(allDetectedItems);
            
            // Calculate dominant colors
            const totalPercentage = Object.values(allColors).reduce((sum, val) => sum + val, 0) || 100;
            const dominantColors = Object.entries(allColors)
                .map(([color, percentage]) => [
                    color,
                    Math.round((percentage / totalPercentage) * 100)
                ])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            // Set style analysis
            setStyleAnalysis({
                dominant_colors: dominantColors,
                dominant_types: [
                    ["Casual", 45],
                    ["Classic", 30],
                    ["Minimalist", 25]
                ]
            });
            
            console.log("Created style analysis:", {
                dominant_colors: dominantColors,
                dominant_types: [
                    ["Casual", 45],
                    ["Classic", 30],
                    ["Minimalist", 25]
                ]
            });
            
            // Get recommendations
            await fetchRecommendations();
            
        } catch (error) {
            console.error("Analysis error:", error);
            setError(`Analysis failed: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    // Reset the analysis
    const resetAnalysis = () => {
        setRecommendations([]);
        setStyleAnalysis(null);
        setSelectedGender('');
        setFiles([]);
        setPreviewImages([]);
        setError(null);
        fileInputRef.current.value = '';
    };
    
    // Function to render color swatches
    const renderColorSwatches = (colors) => {
        console.log("Rendering color swatches with:", colors);
        
        if (!colors || colors.length === 0) {
            return <div className="fc-empty-swatches">No colors detected</div>;
        }
        
        return (
            <div className="fc-color-swatches">
                {colors.map((color, index) => {
                    console.log(`Color ${index}:`, color[0], color[1] + "%");
                    return (
                        <div 
                            key={index}
                            className="fc-color-swatch"
                            style={{
                                backgroundColor: color[0],
                                width: `${color[1]}%`
                            }}
                            title={`${color[0]} (${color[1]}%)`}
                        />
                    );
                })}
            </div>
        );
    };
    
    // Fetch product recommendations
    const fetchRecommendations = async () => {
        setStatusMessage("Getting product recommendations...");
        
        // Mock product recommendations for demo
        setTimeout(() => {
            const products = [
                {
                    id: 1,
                    name: "Classic Cotton T-Shirt",
                    price: "$24.99",
                    image_url: "/images/products/tshirt.jpg", // Local image
                    url: "https://www.amazon.com/dp/B0BLXVHG8N"
                },
                {
                    id: 2,
                    name: "Slim Fit Jeans",
                    price: "$49.99",
                    image_url: "/images/products/jeans.jpg", // Local image
                    url: "https://www.amazon.com/dp/B0BLXVHG8N"
                },
                {
                    id: 3,
                    name: "Casual Summer Dress",
                    price: "$39.99",
                    image_url: "/images/products/dress.jpg", // Local image
                    url: "https://www.amazon.com/dp/B0BLXVHG8N"
                },
                {
                    id: 4,
                    name: "Lightweight Cardigan",
                    price: "$34.99",
                    image_url: "/images/products/cardigan.jpg", // Local image
                    url: "https://www.amazon.com/dp/B0BLXVHG8N"
                },
                {
                    id: 5,
                    name: "Classic Oxford Shirt",
                    price: "$45.99",
                    image_url: "/images/products/shirt.jpg", // Local image
                    url: "https://www.amazon.com/dp/B0BLXVHG8N"
                },
                {
                    id: 6,
                    name: "Casual Sneakers",
                    price: "$59.99",
                    image_url: "/images/products/sneakers.jpg", // Local image
                    url: "https://www.amazon.com/dp/B0BLXVHG8N"
                }
            ];
            
            setRecommendations(products);
        }, 1000);
    };

    // Your existing render function here
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
                                
                                {previewImages.length > 0 && (
                                    <div className="fc-preview-grid">
                                        {previewImages.map(img => (
                                            <div key={img.id} className="fc-preview-card">
                                                <img src={img.src} alt="Your outfit" />
                                                <div className="fc-preview-info">
                                                    <span className="fc-preview-name">
                                                        {img.name.length > 20 
                                                            ? img.name.substring(0, 20) + '...' 
                                                            : img.name}
                                                    </span>
                                                    
                                                    {img.analysis && !img.analysis.error && (
                                                        <div className="fc-preview-analysis">
                                                            <div className="fc-preview-rating">
                                                                <span>{convertRatingToStars(img.analysis.rating)}</span>
                                                                <span className="fc-rating-number">{img.analysis.rating}/10</span>
                                                                {img.analysis.detections && img.analysis.detections.length > 0 && (
                                                                    <span style={{fontSize: '0.8rem', color: '#4a5568', marginTop: '4px'}}>
                                                                        {img.analysis.detections[0].class}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {img.analysis && img.analysis.error && (
                                                        <div className="fc-preview-error">
                                                            Error analyzing image
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
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
                                            <p><strong>API Endpoints:</strong></p>
                                            <ul>
                                                {apiEndpoints.map((endpoint, i) => (
                                                    <li key={i}>{endpoint}</li>
                                                ))}
                                            </ul>
                                            <p><strong>Local Model:</strong> Using ONNX model for detection</p>
                                            <p><strong>Fallback:</strong> Using browser-based color extraction</p>
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
                                                            setIsAnalyzing(true);
                                                            const img = previewImages[0];
                                                            const imageElement = new Image();
                                                            await new Promise((resolve, reject) => {
                                                                imageElement.onload = resolve;
                                                                imageElement.onerror = reject;
                                                                imageElement.src = img.src;
                                                            });
                                                            
                                                            const detections = await ModelService.detectOutfit(imageElement);
                                                            console.log("Debug detection result:", detections);
                                                            
                                                            alert(`Detected ${detections.length} items in image`);
                                                        } catch (error) {
                                                            console.error("Debug detection error:", error);
                                                            alert(`Detection error: ${error.message}`);
                                                        } finally {
                                                            setIsAnalyzing(false);
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
                                                            ["rgb(45, 52, 67)", 35], // Navy blue
                                                            ["rgb(180, 180, 180)", 28], // Light gray
                                                            ["rgb(255, 255, 255)", 15], // White
                                                            ["rgb(55, 94, 151)", 12], // Blue
                                                            ["rgb(0, 0, 0)", 10] // Black
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
                                        disabled={isAnalyzing || files.length < 2 || !selectedGender || !isModelLoaded}
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
                                            {console.log("styleAnalysis in render:", styleAnalysis)}
                                            <div className="fc-style-factor">
                                                <h3>Your Color Palette</h3>
                                                {console.log("About to render color swatches with:", styleAnalysis.dominant_colors)}
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
                                                        <ul className="fc-items-list" style={{ listStyle: 'none', padding: 0 }}>
                                                            {Object.entries(detectedItems).map(([className, items]) => (
                                                                <li key={className} style={{ marginBottom: '8px' }}>
                                                                    <strong>{className}</strong> ({items.length})
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
                                            {previewImages.map(img => (
                                                <div key={img.id} className="fc-analyzed-photo">
                                                    <img src={img.src} alt="Your outfit" />
                                                    {img.analysis && !img.analysis.error && (
                                                        <div className="fc-photo-rating">
                                                            <span>{convertRatingToStars(img.analysis.rating)}</span>
                                                            <span className="fc-rating-number">{img.analysis.rating}/10</span>
                                                            {img.analysis.detections && img.analysis.detections.length > 0 && (
                                                                <div style={{ marginTop: '5px', fontSize: '0.9em' }}>
                                                                    Detected: <strong>{img.analysis.detections[0].class}</strong>
                                                                </div>
                                                            )}
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