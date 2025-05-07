// File: src/components/FindClothes/ProductRecommendations.jsx

function ProductRecommendations({
    products,
    userPreferences,
    goBackToAnalysis,
    resetToHome
  }) {
    // Group products by type for organized display
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
    
    // Capitalize first letter
    const capitalize = (str) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    };
    
    // Generate star rating display
    const renderStarRating = (rating) => {
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 >= 0.5;
      
      return (
        <div className="fc-star-rating">
          {'★'.repeat(fullStars)}
          {hasHalfStar ? '½' : ''}
          {'☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0))}
        </div>
      );
    };
  
    return (
      <div className="fc-product-recommendations">
        <h2 className="fc-section-title">Your Style Recommendations</h2>
        
        <div className="fc-style-summary">
          <h3>Based on Your Style</h3>
          <div className="fc-style-tags">
            {userPreferences.gender && (
              <span className="fc-style-tag fc-gender-tag">
                {capitalize(userPreferences.gender)}
              </span>
            )}
            
            {userPreferences.items.map(item => (
              <span key={item.id} className="fc-style-tag">
                {capitalize(item.color)} {capitalize(item.type)}
              </span>
            ))}
          </div>
        </div>
        
        {productTypes.length === 0 ? (
          <div className="fc-no-products">
            <p>No matching products found. Try adjusting your preferences.</p>
          </div>
        ) : (
          <div className="fc-product-sections">
            {productTypes.map(type => (
              <div key={type} className="fc-product-category">
                <h3 className="fc-category-title">{capitalize(type)}</h3>
                
                <div className="fc-product-grid">
                  {groupedProducts[type].map(product => (
                    <div key={product.id} className="fc-product-card">
                      <div className="fc-product-image">
                        <img src={product.image} alt={product.title} />
                      </div>
                      
                      <div className="fc-product-details">
                        <h4 className="fc-product-title">{product.title}</h4>
                        <p className="fc-product-brand">{product.brand}</p>
                        
                        <div className="fc-product-rating">
                          {renderStarRating(product.rating)}
                          <span className="fc-review-count">({product.reviews})</span>
                        </div>
                        
                        <p className="fc-product-price">{product.price}</p>
                        
                        <div className="fc-product-attributes">
                          {product.attributes.map((attr, idx) => (
                            <span key={idx} className="fc-product-attribute">{attr}</span>
                          ))}
                        </div>
                        
                        <a 
                          href={product.link} 
                          className="fc-view-product-btn" 
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
            ))}
          </div>
        )}
        
        <div className="fc-action-buttons">
          <button 
            className="fc-primary-btn" 
            onClick={goBackToAnalysis}
          >
            Refine Selection
          </button>
          <button 
            className="fc-secondary-btn" 
            onClick={resetToHome}
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }
  
  export default ProductRecommendations;