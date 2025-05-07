// File: src/components/FindClothes/VerificationForm.jsx
import { nanoid } from 'nanoid';

function VerificationForm({ 
  error, 
  userPreferences, 
  setUserPreferences, 
  resetState, 
  submitPreferences,
  imgPreviews
}) {
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

  // Handle changes in item type or color
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
      enabled: true,
      imageIndex: -1 // Custom item with no associated image
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

  // Render the clothing type options
  const renderClothingTypeOptions = () => {
    const clothingTypes = [
      'shirt', 'top', 't-shirt', 'blouse', 'sweater', 'hoodie',
      'pants', 'trousers', 'jeans', 'skirt', 'shorts',
      'jacket', 'coat', 'outwear', 'dress', 'suit'
    ];
    
    return clothingTypes.map(type => (
      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
    ));
  };

  // Update the renderColorOptions function to include only the colors your model can detect
  const renderColorOptions = () => {
    const colors = [
      'red', 'blue', 'green', 'black', 'white', 'yellow', 'purple',
      'pink', 'brown', 'gray', 'orange', 'navy', 'cream', 'beige', 'tan'
    ];
    
    return colors.map((color) => (
      <option key={color} value={color}>
        {color.charAt(0).toUpperCase() + color.slice(1)}
      </option>
    ));
  };

  // Group items by image index for better organization
  const groupItemsByImage = () => {
    const itemsByImage = {};
    
    userPreferences.items.forEach(item => {
      const imageIndex = item.imageIndex;
      if (!itemsByImage[imageIndex]) {
        itemsByImage[imageIndex] = [];
      }
      itemsByImage[imageIndex].push(item);
    });
    
    return itemsByImage;
  };

  const groupedItems = groupItemsByImage();
  const imageIndices = Object.keys(groupedItems).sort((a, b) => {
    // Sort by image index, with custom items (-1) at the end
    if (a === '-1') return 1;
    if (b === '-1') return -1;
    return parseInt(a) - parseInt(b);
  });

  return (
    <div className="fc-verification-section">
      <h3>Verify Your Style Preferences</h3>
      <p className="fc-verification-instruction">
        We've detected these items in your photos. Select which items you'd like to find products for:
      </p>
      
      {error && <p className="fc-error-message">{error}</p>}
      
      <div className="fc-verification-form">
        <div className="fc-form-group">
          <label htmlFor="gender-select">Select Gender:</label>
          <select 
            id="gender-select"
            name="gender"
            value={userPreferences.gender}
            onChange={handlePreferenceChange}
            className="fc-select"
          >
            <option value="">-- Select Gender --</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>
        
        <div className="fc-detected-items">
          <h4>Detected Items by Photo:</h4>
          
          {imageIndices.map(imageIndex => (
            <div key={imageIndex} className="fc-image-items-group">
              {imageIndex !== '-1' && (
                <div className="fc-source-image">
                  <img 
                    src={imgPreviews[parseInt(imageIndex)]} 
                    alt={`Source ${parseInt(imageIndex) + 1}`} 
                    className="fc-thumbnail"
                  />
                  <div className="fc-image-label">Photo {parseInt(imageIndex) + 1}</div>
                </div>
              )}
              
              {imageIndex === '-1' && <h4 className="fc-custom-items-header">Custom Items</h4>}
              
              <div className="fc-items-in-image">
                {groupedItems[imageIndex].map(item => (
                  <div key={item.id} className="fc-item-card">
                    <div className="fc-item-toggle">
                      <input
                        type="checkbox"
                        id={`toggle-item-${item.id}`}
                        checked={item.enabled}
                        onChange={() => toggleItemEnabled(item.id)}
                      />
                      <label htmlFor={`toggle-item-${item.id}`}>Include</label>
                    </div>
                    
                    <div className="fc-item-fields">
                      <div className="fc-form-group">
                        <label>Type:</label>
                        <select 
                          value={item.type}
                          onChange={(e) => handleItemChange(item.id, 'type', e.target.value)}
                          className="fc-select fc-select-sm"
                        >
                          {renderClothingTypeOptions()}
                        </select>
                      </div>
                      
                      <div className="fc-form-group">
                        <label>Color:</label>
                        <select 
                          value={item.color}
                          onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
                          className="fc-select fc-select-sm"
                        >
                          {renderColorOptions()}
                        </select>
                      </div>
                    </div>
                    
                    <button 
                      className="fc-remove-item-btn"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <button className="fc-add-item-btn" onClick={addCustomItem}>
            + Add Another Item
          </button>
        </div>
        
        <div className="fc-action-buttons">
          <button className="fc-analyze-btn" onClick={submitPreferences}>
            Find Products
          </button>
          <button className="fc-back-btn" onClick={resetState}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerificationForm;