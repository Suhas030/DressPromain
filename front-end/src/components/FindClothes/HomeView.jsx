// src/components/FindClothes/HomeView.jsx
import React from 'react';

function HomeView({ onStart }) {
  return (
    <div className='fc-find-clothes-home'>
      <div className="fc-hero-section">
        <h1 className='fc-app-title'>Find Your Style</h1>
        <p className='fc-app-details'>
          Upload multiple outfit photos and we'll analyze your style preferences to recommend matching products from top Indian brands.
        </p>
        <button className='fc-start-btn' onClick={onStart}>Get Started</button>
      </div>
    </div>
  );
}

export default HomeView;

// src/components/FindClothes/UploadView.jsx
import React from 'react';

function UploadView({ 
  files, 
  imgPreviews, 
  error, 
  maxFiles, 
  minFiles, 
  onFileChange, 
  onRemoveFile, 
  onProcessImages, 
  onBack 
}) {
  return (
    <div className="fc-find-clothes-container">
      <h2 className="fc-section-title">Find Your Perfect Style</h2>
      <div className="fc-upload-section">
        <p className="fc-instructions">
          Upload {minFiles}-{maxFiles} photos of outfits you like to help us understand your style preferences.
        </p>
        
        <div className="fc-file-upload-area">
          <div className="fc-image-grid">
            {imgPreviews.map((preview, index) => (
              <div key={index} className="fc-image-card">
                <div className="fc-image-wrapper">
                  <img src={preview} alt={`Outfit ${index + 1}`} />
                  <button 
                    className="fc-remove-btn" 
                    onClick={() => onRemoveFile(index)}
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            
            {files.length < maxFiles && (
              <div className="fc-image-card fc-upload-card">
                <label htmlFor="file-input" className="fc-upload-label">
                  <div className="fc-upload-placeholder">
                    <span className="fc-upload-icon">+</span>
                    <span>Add Photo</span>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept=".jpg, .jpeg, .png"
                    multiple
                    onChange={onFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        
        {error && <p className="fc-error-message">{error}</p>}
        
        <div className="fc-file-status">
          <span className={`fc-file-count ${files.length >= minFiles ? 'fc-sufficient' : 'fc-insufficient'}`}>
            {files.length} of {maxFiles} images selected {files.length < minFiles ? `(Need at least ${minFiles})` : ''}
          </span>
        </div>
        
        <div className="fc-action-buttons">
          <button 
            className="fc-analyze-btn" 
            onClick={onProcessImages}
            disabled={files.length < minFiles}
          >
            Analyze My Style
          </button>
          <button className="fc-back-btn" onClick={onBack}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default UploadView;

// src/components/FindClothes/LoadingView.jsx
import React from 'react';

function LoadingView({ analyzing }) {
  return (
    <div className="fc-find-clothes-container">
      <div className="fc-loading-section">
        <div className="fc-spinner"></div>
        <p className="fc-loading-text">
          {analyzing ? "Analyzing your style preferences..." : "Processing your images..."}
        </p>
      </div>
    </div>
  );
}

export default LoadingView;

// src/components/FindClothes/VerificationView.jsx
import React from 'react';

function VerificationView({
  error,
  userPreferences,
  onPreferenceChange,
  onItemToggle,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
  onReset
}) {
  // Clothing type options
  const clothingTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'casual', label: 'Casual' },
    { value: 'formal', label: 'Formal' },
    { value: 'party', label: 'Party Wear' },
    { value: 'sports', label: 'Sports/Active Wear' },
    { value: 'traditional', label: 'Traditional/Ethnic' },
    { value: 'business', label: 'Business Attire' }
  ];

  // Occasion options
  const occasions = [
    { value: 'any', label: 'Any Occasion' },
    { value: 'daily', label: 'Daily Wear' },
    { value: 'office', label: 'Office Wear' },
    { value: 'casual', label: 'Casual Outings' },
    { value: 'party', label: 'Party/Celebrations' },
    { value: 'formal', label: 'Formal Events' },
    { value: 'wedding', label: 'Wedding/Cultural Events' },
    { value: 'sports', label: 'Sports Activities' }
  ];

  // Price range options
  const priceRanges = [
    { value: 'any', label: 'Any Price Range' },
    { value: 'budget', label: 'Budget Friendly (Under ₹1000)' },
    { value: 'mid', label: 'Mid-Range (₹1000-₹3000)' },
    { value: 'premium', label: 'Premium (Above ₹3000)' }
  ];

  // Render options for a select input
  const renderOptions = (options) => {
    return options.map(option => (
      <option key={option.value} value={option.value}>{option.label}</option>
    ));
  };

  // Render clothing type options
  const renderClothingTypeOptions = () => {
    const clothingTypes = [
      'shirt', 'top', 't-shirt', 'blouse', 'sweater', 'hoodie',
      'pants', 'trousers', 'jeans', 'skirt', 'shorts',
      'jacket', 'coat', 'outwear', 'dress', 'suit', 'kurta', 'saree'
    ];
    
    return clothingTypes.map(type => (
      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
    ));
  };

  // Render subtype options based on clothing type
  const renderSubtypeOptions = (type) => {
    const subtypeMap = {
      shirt: ['casual', 'formal', 'office', 'party', 'solid', 'printed', 'striped', 'checkered'],
      top: ['casual', 'formal', 'crop', 'tank', 'sleeveless', 'loose', 'fitted', 'graphic'],
      't-shirt': ['casual', 'graphic', 'plain', 'v-neck', 'round-neck', 'oversized', 'slim-fit'],
      blouse: ['casual', 'formal', 'office', 'party', 'crop', 'peplum', 'wrap', 'button-up'],
      sweater: ['pullover', 'cardigan', 'knit', 'crewneck', 'v-neck', 'turtleneck', 'sleeveless'],
      hoodie: ['pullover', 'zip-up', 'oversized', 'graphic', 'plain', 'cropped', 'sleeveless'],
      pants: ['casual', 'formal', 'chinos', 'cargo', 'joggers', 'pleated', 'straight', 'wide-leg'],
      trousers: ['formal', 'casual', 'pleated', 'flat-front', 'slim-fit', 'wide-leg', 'cropped'],
      jeans: ['slim', 'skinny', 'straight', 'bootcut', 'flared', 'wide-leg', 'mom', 'boyfriend', 'distressed'],
      skirt: ['mini', 'midi', 'maxi', 'pencil', 'pleated', 'a-line', 'wrap', 'high-waist'],
      shorts: ['casual', 'denim', 'bermuda', 'cargo', 'chino', 'athletic', 'high-waist'],
      jacket: ['bomber', 'denim', 'leather', 'blazer', 'windbreaker', 'puffer', 'trucker', 'track'],
      coat: ['trench', 'overcoat', 'pea coat', 'parka', 'duffle', 'topcoat', 'raincoat'],
      outwear: ['blazer', 'cardigan', 'vest', 'shrug', 'cape', 'poncho', 'shawl'],
      dress: ['casual', 'formal', 'midi', 'mini', 'maxi', 'bodycon', 'fit-and-flare', 'shift', 'wrap'],
      suit: ['formal', 'business', 'casual', 'three-piece', 'two-piece', 'slim-fit', 'classic'],
      kurta: ['casual', 'formal', 'festive', 'embroidered', 'printed', 'straight', 'anarkali', 'a-line'],
      saree: ['silk', 'cotton', 'georgette', 'chiffon', 'embroidered', 'printed', 'traditional', 'designer']
    };
    
    const subtypes = subtypeMap[type] || ['casual', 'formal', 'other'];
    
    return subtypes.map(subtype => (
      <option key={subtype} value={subtype}>{subtype.charAt(0).toUpperCase() + subtype.slice(1)}</option>
    ));
  };

  // Render fit options
  const renderFitOptions = () => {
    const fits = ['regular', 'slim', 'loose', 'relaxed', 'skinny', 'oversized', 'straight', 'tailored'];
    
    return fits.map(fit => (
      <option key={fit} value={fit}>{fit.charAt(0).toUpperCase() + fit.slice(1)}</option>
    ));
  };

  // Render sleeve options
  const renderSleeveOptions = () => {
    const sleeves = ['short', 'long', 'three-quarter', 'half', 'sleeveless', 'full', 'cap', 'bell'];
    
    return sleeves.map(sleeve => (
      <option key={sleeve} value={sleeve}>{sleeve.charAt(0).toUpperCase() + sleeve.slice(1)}</option>
    ));
  };

  // Render color options
  const renderColorOptions = () => {
    const colors = [
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 
      'pink', 'brown', 'gray', 'orange', 'navy', 'cream', 'beige', 
      'tan', 'gold', 'silver', 'khaki', 'olive', 'maroon', 'teal', 'turquoise',
      'indigo', 'magenta', 'coral', 'mint', 'lavender', 'burgundy', 'mustard'
    ];
    
    return colors.map(color => (
      <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
    ));
  };

  // Render pattern options
  const renderPatternOptions = () => {
    const patterns = [
      'solid', 'striped', 'checkered', 'plaid', 'floral', 'printed', 'graphic',
      'polka dot', 'geometric', 'abstract', 'animal print', 'tie-dye', 'camouflage'
    ];
    
    return patterns.map(pattern => (
      <option key={pattern} value={pattern}>{pattern.charAt(0).toUpperCase() + pattern.slice(1)}</option>
    ));
  };

  return (
    <div className="fc-find-clothes-container">
      <div className="fc-verification-section">
        <h3>Verify Your Style Preferences</h3>
        <p className="fc-verification-instruction">
          We've detected these items in your photos. Please verify and adjust as needed:
        </p>
        
        {error && <p className="fc-error-message">{error}</p>}
        
        <div className="fc-verification-form">
          <div className="fc-general-preferences">
            <div className="fc-form-group">
              <label htmlFor="gender-select">Gender:</label>
              <select 
                id="gender-select"
                name="gender"
                value={userPreferences.gender}
                onChange={onPreferenceChange}
                className="fc-select"
              >
                <option value="">-- Select Gender --</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            
            <div className="fc-form-group">
              <label htmlFor="clothingType-select">Clothing Type:</label>
              <select 
                id="clothingType-select"
                name="clothingType"
                value={userPreferences.clothingType}
                onChange={onPreferenceChange}
                className="fc-select"
              >
                {renderOptions(clothingTypes)}
              </select>
            </div>
            
            <div className="fc-form-group">
              <label htmlFor="occasion-select">Occasion:</label>
              <select 
                id="occasion-select"
                name="occasion"
                value={userPreferences.occasion}
                onChange={onPreferenceChange}
                className="fc-select"
              >
                {renderOptions(occasions)}
              </select>
            </div>
            
            <div className="fc-form-group">
              <label htmlFor="priceRange-select">Price Range:</label>
              <select 
                id="priceRange-select"
                name="priceRange"
                value={userPreferences.priceRange}
                onChange={onPreferenceChange}
                className="fc-select"
              >
                {renderOptions(priceRanges)}
              </select>
            </div>
          </div>
          
          <div className="fc-detected-items">
            <h4>Detected Items:</h4>
            {userPreferences.items.map((item) => (
              <div key={item.id} className="fc-item-card">
                <div className="fc-item-toggle">
                  <input
                    type="checkbox"
                    id={`toggle-item-${item.id}`}
                    checked={item.enabled}
                    onChange={() => onItemToggle(item.id)}
                  />
                  <label htmlFor={`toggle-item-${item.id}`}>Include</label>
                </div>
                
                <div className="fc-item-fields">
                  <div className="fc-form-group">
                    <label>Type:</label>
                    <select 
                      value={item.type}
                      onChange={(e) => onItemChange(item.id, 'type', e.target.value)}
                      className="fc-select fc-select-sm"
                    >
                      {renderClothingTypeOptions()}
                    </select>
                  </div>
                  
                  <div className="fc-form-group">
                    <label>Subtype:</label>
                    <select 
                      value={item.subtype}
                      onChange={(e) => onItemChange(item.id, 'subtype', e.target.value)}
                      className="fc-select fc-select-sm"
                    >
                      {renderSubtypeOptions(item.type)}
                    </select>
                  </div>
                  
                  <div className="fc-form-group">
                    <label>Fit:</label>
                    <select 
                      value={item.fit}
                      onChange={(e) => onItemChange(item.id, 'fit', e.target.value)}
                      className="fc-select fc-select-sm"
                    >
                      {renderFitOptions()}
                    </select>
                  </div>
                  
                  <div className="fc-form-group">
                    <label>Sleeve:</label>
                    <select 
                      value={item.sleeve}
                      onChange={(e) => onItemChange(item.id, 'sleeve', e.target.value)}
                      className="fc-select fc-select-sm"
                    >
                      {renderSleeveOptions()}
                    </select>
                  </div>
                  
                  <div className="fc-form-group">
                    <label>Color:</label>
                    <select 
                      value={item.color}
                      onChange={(e) => onItemChange(item.id, 'color', e.target.value)}
                      className="fc-select fc-select-sm"
                    >
                      {renderColorOptions()}
                    </select>
                  </div>
                  
                  <div className="fc-form-group">
                    <label>Pattern:</label>
                    <select 
                      value={item.pattern}
                      onChange={(e) => onItemChange(item.id, 'pattern', e.target.value)}
                      className="fc-select fc-select-sm"
                    >
                      {renderPatternOptions()}
                    </select>
                  </div>
                </div>
                
                <button 
                  className="fc-remove-item-btn"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
            ))}
            
            <button className="fc-add-item-btn" onClick={onAddItem}>
              + Add Another Item
            </button>
          </div>
          
          <div className="fc-action-buttons"></div>