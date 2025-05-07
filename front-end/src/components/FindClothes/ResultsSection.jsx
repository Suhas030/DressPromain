// File: src/components/FindClothes/ResultsSection.jsx

function ResultsSection({ 
    results, 
    products, 
    userPreferences, 
    resetState, 
    setShowVerificationForm, 
    setShowHome 
  }) {
    // Function to group products by type
    const groupProductsByType = () => {
      const grouped = {};
      
      products.forEach(product => {
        if (!grouped[product.type]) {
          grouped[product.type] = [];
        }
        grouped[product.type].push(product);
      });
      
      return grouped;
    };
  
    const groupedProducts = groupProductsByType();
    const productTypes = Object.keys(groupedProducts);
  
    // Capitalize first letter of string
    const capitalize = (str) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    };
  
    return (
      <div className="fc-results-section">
        <div className="fc-style-analysis">
          <h3>Your Style Profile</h3>
          <div className="fc-gender-tag">
            <span className="fc-style-tag fc-gender">
              {userPreferences.gender ? capitalize(userPreferences.gender) : 'Unisex'}
            </span>
          </div>
          <div className="fc-style-tags">
            {userPreferences.items.filter(item => item.enabled).map(item => (
              <span key={item.id} className="fc-style-tag">
                {item.color} {item.type}
              </span>
            ))}
          </div>
          <p className="fc-analysis-description">
            Based on your selections, here are personalized product recommendations from Amazon.in:
          </p>
        </div>
        
        <div className="fc-products-container">
          {productTypes.length > 0 ? (
            productTypes.map(type => (
              <div key={type} className="fc-product-category">
                <h3 className="fc-category-title">{capitalize(type)}</h3>
                <div className="fc-product-list">
                  {groupedProducts[type].map(product => (
                    <div key={product.id} className="fc-product-card">
                      <div className="fc-product-image">
                        <img src={product.image} alt={product.title} />
                      </div>
                      <div className="fc-product-details">
                        <h4 className="fc-product-title">{product.title}</h4>
                        <p className="fc-product-brand">{product.brand}</p>
                        <div className="fc-product-rating">
                          <span className="fc-stars">{'★'.repeat(Math.floor(product.rating))}</span>
                          <span className="fc-rating-count">({product.reviews})</span>
                        </div>
                        <p className="fc-product-price">{product.price}</p>
                        <div className="fc-product-attributes">
                          {product.attributes.map((attr, idx) => (
                            <span key={idx} className="fc-product-attribute">{attr}</span>
                          ))}
                        </div>
                        <a 
                          href={product.link} 
                          className="fc-buy-now-btn" 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          View on Amazon
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="fc-no-products">
              <p>No matching products found. Try adjusting your preferences.</p>
            </div>
          )}
        </div>
        
        <div className="fc-action-buttons">
          <button 
            className="fc-refine-btn" 
            onClick={() => setShowVerificationForm(true)}
          >
            Refine Preferences
          </button>
          <button 
            className="fc-reset-btn" 
            onClick={resetState}
          >
            Start Over
          </button>
          <button 
            className="fc-home-btn" 
            onClick={() => setShowHome(true)}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
}

export default ResultsSection;