import { useState } from 'react';

export function ProductList({ products }) {
  const [expandedProduct, setExpandedProduct] = useState(null);

  // Toggle product details
  const toggleProductDetails = (productId) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
    } else {
      setExpandedProduct(productId);
    }
  };

  // Handle product click (navigate to Amazon)
  const handleProductClick = (productLink) => {
    // Open the product link in a new tab
    window.open(productLink, '_blank', 'noopener noreferrer');
  };

  // Format star rating display
  const renderStarRating = (rating) => {
    if (!rating) return null;
    
    const numRating = parseFloat(rating);
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating - fullStars >= 0.5;
    
    const stars = [];
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={`full-${i}`} className="fc-star-full">★</span>);
    }
    
    // Add half star if needed
    if (hasHalfStar) {
      stars.push(<span key="half" className="fc-star-half">★</span>);
    }
    
    // Add empty stars
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="fc-star-empty">☆</span>);
    }
    
    return (
      <div className="fc-star-rating">
        {stars} <span className="fc-rating-value">({rating})</span>
      </div>
    );
  };

  // Group products by query type
  const groupedProducts = products.reduce((groups, product) => {
    const queryType = product.query?.type || 'Other';
    const displayType = queryType.charAt(0).toUpperCase() + queryType.slice(1);
    
    if (!groups[displayType]) {
      groups[displayType] = [];
    }
    
    groups[displayType].push(product);
    return groups;
  }, {});

  return (
    <div className="fc-product-list">
      {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
        <div key={category} className="fc-category-section">
          <h4 className="fc-category-title">{category}</h4>
          
          <div className="fc-product-grid">
            {categoryProducts.map((product) => (
              <div key={product.id} className="fc-product-card">
                <div className="fc-product-image" onClick={() => handleProductClick(product.link)}>
                  <img src={product.image} alt={product.title} />
                </div>
                
                <div className="fc-product-info">
                  <div className="fc-product-title" onClick={() => handleProductClick(product.link)}>
                    {product.title}
                  </div>
                  
                  <div className="fc-product-brand">
                    {product.brand}
                  </div>
                  
                  <div className="fc-product-price">
                    {product.price}
                  </div>
                  
                  {renderStarRating(product.rating)}
                  
                  {product.reviews && (
                    <div className="fc-product-reviews">
                      {product.reviews} reviews
                    </div>
                  )}
                  
                  <div className="fc-product-actions">
                    <button 
                      className="fc-details-btn"
                      onClick={() => toggleProductDetails(product.id)}
                    >
                      {expandedProduct === product.id ? 'Hide Details' : 'Show Details'}
                    </button>
                    
                    <button 
                      className="fc-buy-btn"
                      onClick={() => handleProductClick(product.link)}
                    >
                      View on Amazon
                    </button>
                  </div>
                  
                  {expandedProduct === product.id && (
                    <div className="fc-product-details">
                      <p className="fc-product-description">
                        {product.description || 'No description available.'}
                      </p>
                      
                      {product.attributes && product.attributes.length > 0 && (
                        <div className="fc-product-attributes">
                          <h5>Product Details:</h5>
                          <ul>
                            {product.attributes.map((attr, index) => (
                              <li key={index}>{attr}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="fc-product-query-info">
                        <p>Matched with: {product.query?.color} {product.query?.type} ({product.query?.gender})</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {products.length === 0 && (
        <div className="fc-no-products">
          <p>No products found matching your criteria. Try adjusting your filters.</p>
        </div>
      )}
    </div>
  );
}
