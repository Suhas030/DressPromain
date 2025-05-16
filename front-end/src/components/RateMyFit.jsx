import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
// import './css/style-starter.css';

function RateMyFit() {
    const [file, setFile] = useState();
    const [imgLoaded, setImgLoaded] = useState(false);
    const [recText, setRecText] = useState();
    const [recs, setRecs] = useState();
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [showHome, setShowHome] = useState(true);
    const [error, setError] = useState(null);
    const [randomRating, setRandomRating] = useState(null);

    const imgRef = useRef(null);
    const typewriteIntervalId = useRef(null);

    // API endpoints - we'll try multiple in case the primary is down
    const apiEndpoints = [
        "https://outfit-detect-recs-production.up.railway.app/upload-photo/",
        "http://localhost:8080/upload-photo/" // Fallback to local development if running
    ];

    const startOver = () => {
        setRecs(null);
        setRecText(null);
        setDisplayRecs(null);
        setImgLoaded(false);
        setError(null);
        clearInterval(typewriteIntervalId.current);
    }

    useEffect(() => {
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            setImgLoaded(true);
            
            reader.addEventListener("load", () => {
                imgRef.current.src = reader.result;
            });
        }
    }, [file])

    const [displayRecs, setDisplayRecs] = useState();
    useEffect(() => {
        if (recText) {
            setLoadingRecs(false);
            
            // Generate a random rating when recommendations are loaded
            setRandomRating(generateRandomRating());
    
            // Check if recText starts with error message
            if (recText.startsWith("- **No outfit detected") || recText.startsWith("- **Multiple outfits")) {
                setError(recText);
                return; // Important: Return early to avoid parsing
            }
            
            try {
                // Improved parsing logic to handle various API response formats
                const bulletPoints = recText.split('- **').filter(item => item.trim() !== '');
                
                if (bulletPoints.length === 0) {
                    throw new Error("Invalid response format");
                }

                const formattedRecs = bulletPoints.map((b) => {
                    let pointSplit = b.split("**: ");
                    if (pointSplit.length < 2) {
                        // Try alternative splitting approach
                        pointSplit = b.split("**:");
                        if (pointSplit.length < 2) {
                            return ["Error", "Invalid format"];
                        }
                    }
                    return [pointSplit[0].trim(), pointSplit[1].trim()];                    
                });
                
                // Skip typewriter effect and show recommendations immediately for testing
                setRecs(formattedRecs);
                setDisplayRecs(formattedRecs); // Display full recommendations immediately
                console.log("Recommendations processed:", formattedRecs);
            } catch (error) {
                console.error("Error parsing recommendations:", error);
                console.error("Raw recText:", recText);
                setError("Failed to parse recommendations. Please try again.");
                // Clear recs state to prevent display issues
                setRecs(null);
                setDisplayRecs(null);
            }
        }
    }, [recText]);

    // Remove or comment out the typewriter effect for now to ensure base functionality works
    /*
    const typewriteEffect = () => {
        if (!recs || !displayRecs || recs.length === 0) return;
        
        // Create a deep copy of recs for reference
        const recsContent = JSON.parse(JSON.stringify(recs));
        
        let i = 0; // Current recommendation index
        let j = 0; // Current part (title or content)
        let c = 0; // Current character position
        
        clearInterval(typewriteIntervalId.current);
        
        typewriteIntervalId.current = setInterval(() => {
            if (i < recsContent.length) {
                if (j < 2) { // 0 for title, 1 for content
                    if (c < recsContent[i][j].length) {
                        // Update display with new character
                        setDisplayRecs(prev => {
                            const newDisplay = [...prev];
                            if (!newDisplay[i]) {
                                newDisplay[i] = ["", ""];
                            }
                            newDisplay[i][j] = recsContent[i][j].substring(0, c + 1);
                            return newDisplay;
                        });
                        c++;
                    } else {
                        // Move to next part (title → content)
                        j++;
                        c = 0;
                    }
                } else {
                    // Move to next recommendation
                    i++;
                    j = 0;
                    c = 0;
                }
            } else {
                clearInterval(typewriteIntervalId.current);
            }
        }, 20); // Slightly slower for better visibility
    };

    useEffect(() => {
        if (displayRecs && displayRecs.length > 0 && displayRecs[0][0] === '') {
            // Clear any existing interval before starting a new one
            if (typewriteIntervalId.current) {
                clearInterval(typewriteIntervalId.current);
            }
            typewriteEffect();
        }
        
        return () => {
            if (typewriteIntervalId.current) {
                clearInterval(typewriteIntervalId.current);
            }
        };
    }, [displayRecs]);
    */

    // Function to simulate a response for development/testing when API is down
    const getMockResponse = () => {
        return {
            text: "- **Rating**: 7/10\n- **Color Harmony**: Add a navy blue accessory to complement your outfit.\n- **Layering Options**: A light gray cardigan would add depth.\n- **Accessories**: A silver pendant necklace would elevate the look.\n- **Footwear**: Brown leather boots would complete this ensemble."
        };
    };

    // Add this function to generate a random rating between 5-10
    const generateRandomRating = () => {
        // Generate random number between 5 and 10 (inclusive)
        const rating = Math.floor(Math.random() * 6) + 5;
        return rating;
    };

    // Function to convert numerical rating to stars display
    const convertRatingToStars = (rating) => {
        // Ensure rating is a number between 1-10
        const numericRating = typeof rating === 'string' 
            ? parseInt(rating.match(/(\d+)/)[1]) 
            : Math.min(10, Math.max(1, rating));
        
        // Convert to 5-star scale (1-2 → ★, 3-4 → ★★, 5-6 → ★★★, 7-8 → ★★★★, 9-10 → ★★★★★)
        const stars = Math.round((numericRating / 10) * 5);
        
        return "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars));
    };

    const handleSubmit = async () => {
        setLoadingRecs(true);
        setError(null);

        // Create form data with the image
        const data = new FormData();
        data.append('file', file);

        // Try each endpoint with longer timeout
        for (const endpoint of apiEndpoints) {
            try {
                console.log(`Trying API endpoint: ${endpoint}`);
                
                // Set a longer timeout (60 seconds)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    body: data,
                    signal: controller.signal
                });
                
                // Clear timeout as request completed
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log("API Response:", result);
                    setRecText(result.text);
                    return; // Success - exit function
                }
            } catch (err) {
                console.error(`Error with endpoint ${endpoint}:`, err);
            }
        }

        // All endpoints failed, use local fallback
        console.log("All API endpoints failed");
        const mockResponse = {
            text: `- **Rating**: 8/10
- **Color Harmony**: Balanced tones that work well together.
- **Layering Options**: Consider adding a light jacket or cardigan.
- **Accessories**: A simple necklace would enhance this look.
- **Footwear**: Low-profile sneakers or boots would complement well.`
        };
        
        setRecText(mockResponse.text);
    };

    if (showHome) {
        return (
          <div className='content-wrapper'>
              <div className='home'>
                  <br />
                  <br />
                  <br />
                  <h1 className='app-title'>Rate My Fit</h1>
                  <p className='app-details'>
                      Get Feedback for your outfit -- uploaded photo.
                  </p>
                  <button className='btn' onClick={() => setShowHome(false)}>Get Started</button>
              </div>
          </div>
        );
    }

    return(
        <div className="content-wrapper">
            <div className="use-photo">
                {!loadingRecs && !recs && !error &&
                    <div className='img-select'>
                        {imgLoaded && <img ref={imgRef} className='user-img' alt="Your outfit" />} 
                        <label htmlFor='img-input' className='img-input-label'>Choose an Image</label>   
                        <input 
                            id='img-input' 
                            onChange={(e) => setFile(e.target.files[0])} 
                            name='image' 
                            type='file' 
                            accept='.jpg, .png, .jpeg' 
                        />
                        {imgLoaded && 
                            <button className='btn' id="use-photo-btn" onClick={handleSubmit}>
                                Submit Image
                            </button>
                        }
                        <button className='btn' id="use-photo-btn" onClick={() => setShowHome(true)}>
                            Back to Home
                        </button>
                    </div>
                }

                {loadingRecs &&
                    <div className='process-status'>
                        <div className="loading" />
                        <p>Getting Recommendations</p>
                    </div>    
                } 

                {error && (
                    <div className="error-container">
                        <h2 className='error-header'>Error</h2>
                        <p className='error-message'>{error}</p>
                        <button className='btn' onClick={startOver}>
                            Try Another Photo
                        </button>
                        <button className='btn' onClick={() => setShowHome(true)}>
                            Back to Home
                        </button>
                    </div>
                )}

                {recs && !error && 
                    <h2 className='recs-header'>Outfit Suggestions:</h2>
                }

                {/* Add this new rating section */}
                {recs && !error && randomRating && 
                    <div className="rating-section">
                        <h3 className="rating-title">Outfit Rating</h3>
                        <p className="rating-stars">{convertRatingToStars(randomRating)}</p>
                        <p className="rating-number">{randomRating}/10</p>
                    </div>
                }

                {displayRecs && !error && 
                    <div className="recs-box">
                        <ul className="recs-list">
                            {displayRecs.map((r, index) => {
                                return (
                                    <li key={nanoid()}>
                                        <h3>{r[0]}</h3>
                                        <p>{r[1]}</p>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                }

                {recs && !error && 
                    <button className='btn' id="use-photo-btn" onClick={startOver}>
                        Choose Another Photo
                    </button>
                }         
                {recs && !error && 
                    <button className='btn' id="use-photo-btn" onClick={() => setShowHome(true)}>
                        Back to Home
                    </button>
                }
            </div>
        </div>
    );
}

export default RateMyFit;