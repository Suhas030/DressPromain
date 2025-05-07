// File: src/components/FindClothes/AnalysisResults.jsx
import { useState } from 'react';

function AnalysisResults({
  detectedItems,
  selectedItems,
  handleItemSelection,
  imgPreviews,
  userPreferences,
  setUserPreferences,
  findSimilarProducts,
  resetToHome
}) {
  const [showSettings, setShowSettings] = useState(false);
  
  // Group items by image index for better organization
  const groupItemsByImage = () => {
    const groups = {};
    
    detectedItems.forEach(item => {
      if (!groups[item.imageIndex]) {
        groups[item.imageIndex] = [];
      }
      groups[item.imageIndex].push(item);
    });
    
    return groups;
  };
  
  const itemsByImage = groupItemsByImage();
  
  // Handle gender preference change
  const handleGenderChange = (e) => {
    setUserPreferences({
      ...userPreferences,
      gender: e.target.value
    });
  };
  
  // Get color display style
  const getColorStyle = (colorName) => {
    const colorMap = {
      'red': '#ff0000',
      'blue': '#0000ff',
      'green': '#008000',
      'black': '#000000',
      'white': '#ffffff',
      'yellow': '#ffff00',
      'purple': '#800080',
      'pink': '#ffc0cb',
      'brown': '#a52a2a',
      'gray': '#808080',
      'grey': '#808080',
      'orange': '#ffa500',
      'navy': '#000080',
      'cream': '#fffdd0',
      'beige': '#f5f5dc',
      'tan': '#d2b48c'
    };
    
    return colorMap[colorName.toLowerCase()] || '#cccccc';
  };
  
  // Capitalize first letter
  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <div className="fc-analysis-results">
      <h2 className="fc-section-title">Detected Items</h2>
      
      <div className="fc-analysis-instructions">
        <p>We detected these clothing items in your photos. Select the items you'd like to find similar products for:</p>
      </div>
      
      {/* Quick preference selection */}
      {!showSettings && (
        <div className="fc-preference-bar">
          <label>
            Preferred Gender:
            <select 
              value={userPreferences.gender} 
              onChange={handleGenderChange}
              className="fc-gender-select"
            >
              <option value="">All</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="unisex">Unisex</option>
            </select>
          </label>
          <button 
            className="fc-advanced-settings-btn"
            onClick={() => setShowSettings(true)}
          >
            Advanced Settings
          </button>
        </div>
      )}
      
      {/* Advanced settings view */}
      {showSettings && (
        <div className="fc-advanced-settings">
          <h3>Customize Your Preferences</h3>
          
          <div className="fc-settings-form">
            <div className="fc-form-group">
              <label htmlFor="gender-select">Preferred Gender:</label>
              <select 
                id="gender-select"
                value={userPreferences.gender} 
                onChange={handleGenderChange}
                className="fc-select"
              >
                <option value="">All</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            
            {/* Additional preference options can be added here */}
          </div>
          
          <button 
            className="fc-back-to-items-btn"
            onClick={() => setShowSettings(false)}
          >
            Back to Items
          </button>
        </div>
      )}
      
      {/* Display detected items by image */}
      {!showSettings && (
        <div className="fc-detected-items-container">
          {Object.keys(itemsByImage).map(imageIndex => (
            <div key={imageIndex} className="fc-image-items-group">
              <div className="fc-source-image">
                <img 
                  src={imgPreviews[imageIndex]} 
                  alt={`Source ${parseInt(imageIndex) + 1}`} 
                  className="fc-source-thumbnail"
                />
                <span className="fc-image-label">Image {parseInt(imageIndex) + 1}</span>
              </div>
              
              <div className="fc-items-grid">
                {itemsByImage[imageIndex].map(item => (
                  <div 
                    key={item.id} 
                    className={`fc-item-card ${selectedItems.includes(item.id) ? 'fc-selected' : ''}`}
                    onClick={() => handleItemSelection(item.id)}
                  >
                    <div className="fc-item-preview">
                      <div 
                        className="fc-color-swatch" 
                        style={{ backgroundColor: getColorStyle(item.color) }}
                      ></div>
                      <div className="fc-item-type">
                        {capitalize(item.type)}
                      </div>
                      <div className="fc-item-color">
                        {capitalize(item.color)}
                      </div>
                    </div>
                    <div className="fc-selection-marker">
                      {selectedItems.includes(item.id) ? '✓' : '+'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="fc-action-buttons">
        <button 
          className="fc-primary-btn" 
          onClick={findSimilarProducts}
          disabled={selectedItems.length === 0}
        >
          Find Similar Products ({selectedItems.length})
        </button>
        <button className="fc-secondary-btn" onClick={resetToHome}>
          Start Over
        </button>
      </div>
    </div>
  );
}

export default AnalysisResults;