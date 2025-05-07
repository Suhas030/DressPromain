// File: src/components/FindClothes/DetectedItemsSection.jsx
import React from 'react';

function DetectedItemsSection({ 
  detectedItems, 
  imgPreviews, 
  selectedItems, 
  setSelectedItems,
  proceedToVerification,
  resetState
}) {
  // Toggle an item's selection
  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => {
      const isCurrentlySelected = prev.includes(itemId);
      
      if (isCurrentlySelected) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Group items by image for better organization
  const itemsByImage = {};
  detectedItems.forEach(item => {
    if (!itemsByImage[item.imageIndex]) {
      itemsByImage[item.imageIndex] = [];
    }
    itemsByImage[item.imageIndex].push(item);
  });

  // Capitalize first letter of string
  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Map color names to CSS color values
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
    
    return colorMap[colorName.toLowerCase()] || '#cccccc'; // Default to light gray if not found
  };

  return (
    <div className="fc-detected-items-section">
      <h3>Items Detected in Your Images</h3>
      <p className="fc-instruction">
        Select the clothing items you'd like to find similar products for:
      </p>

      {Object.keys(itemsByImage).map(imageIndex => (
        <div key={imageIndex} className="fc-image-detection-group">
          <div className="fc-source-image-container">
            <img 
              src={imgPreviews[imageIndex]} 
              alt={`Source ${parseInt(imageIndex) + 1}`} 
              className="fc-source-image"
            />
            <p className="fc-image-label">Photo {parseInt(imageIndex) + 1}</p>
          </div>

          <div className="fc-detected-items-grid">
            {itemsByImage[imageIndex].map(item => (
              <div 
                key={item.id} 
                className={`fc-detected-item ${selectedItems.includes(item.id) ? 'fc-selected' : ''}`}
                onClick={() => toggleItemSelection(item.id)}
              >
                <div className="fc-item-preview">
                  <div className="fc-color-swatch" style={{
                    backgroundColor: getColorStyle(item.color)
                  }}></div>
                  <div className="fc-item-type">
                    {capitalize(item.type === 'top' ? 'Top' : 
                               item.type === 'bottom' ? 'Bottom' : 
                               capitalize(item.type))}
                  </div>
                </div>
                <div className="fc-selection-indicator">
                  {selectedItems.includes(item.id) ? '✓' : '+'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="fc-action-buttons">
        <button 
          className="fc-proceed-btn" 
          onClick={proceedToVerification}
          disabled={selectedItems.length === 0}
        >
          Continue with Selected Items ({selectedItems.length})
        </button>
        <button className="fc-back-btn" onClick={resetState}>
          Start Over
        </button>
      </div>
    </div>
  );
}

export default DetectedItemsSection;