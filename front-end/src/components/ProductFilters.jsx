import { useState, useEffect } from 'react';

export function ProductFilters({ products, userPreferences, onFilterChange }) {
  const [filters, setFilters] = useState({
    category: 'all',
    priceRange: userPreferences.priceRange || 'any',
    sortBy: 'relevance'
  });

  // Extract unique categories from products
  const categories = ['all', ...new Set(products.map(product => {
    // Map type to category
    const type = product.query?.type || '';
    if (type.includes('top') || type.includes('shirt') || type.includes('blouse')) {
      return 'tops';
    } else if (type.includes('trouser') || type.includes('pants') || type.includes('jeans') || type.includes('shorts') || type.includes('skirt')) {
      return 'bottoms';
    } else if (type.includes('outwear') || type.includes('jacket') || type.includes('coat')) {
      return 'outerwear';
    } else if (type.includes('dress')) {
      return 'dresses';
    } else {
      return 'others';
    }
  }))];

  // Process price ranges
  const priceRanges = [
    { value: 'any', label: 'Any Price' },
    { value: 'budget', label: 'Budget (Under ₹1000)' },
    { value: 'mid', label: 'Mid-Range (₹1000-₹2500)' },
    { value: 'premium', label: 'Premium (Above ₹2500)' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Customer Rating' }
  ];

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // Apply filters and sorting to products
  useEffect(() => {
    let filteredProducts = [...products];
    
    // Apply category filter
    if (filters.category !== 'all') {
      filteredProducts = filteredProducts.filter(product => {
        const type = product.query?.type || '';
        
        if (filters.category === 'tops') {
          return type.includes('top') || type.includes('shirt') || type.includes('blouse');
        } else if (filters.category === 'bottoms') {
          return type.includes('trouser') || type.includes('pants') || type.includes('jeans') || 
                 type.includes('shorts') || type.includes('skirt');
        } else if (filters.category === 'outerwear') {
          return type.includes('outwear') || type.includes('jacket') || type.includes('coat');
        } else if (filters.category === 'dresses') {
          return type.includes('dress');
        } else if (filters.category === 'others') {
          return !type.includes('top') && !type.includes('shirt') && !type.includes('blouse') &&
                 !type.includes('trouser') && !type.includes('pants') && !type.includes('jeans') &&
                 !type.includes('shorts') && !type.includes('skirt') && !type.includes('outwear') &&
                 !type.includes('jacket') && !type.includes('coat') && !type.includes('dress');
        }
        return true;
      });
    }
    
    // Apply price range filter
    if (filters.priceRange !== 'any') {
      filteredProducts = filteredProducts.filter(product => {
        // Extract numeric price from the price string (e.g., "₹1,299")
        const priceStr = product.price || '';
        const priceValue = parseInt(priceStr.replace(/[^\d]/g, ''), 10);
        
        if (filters.priceRange === 'budget') {
          return priceValue < 1000;
        } else if (filters.priceRange === 'mid') {
          return priceValue >= 1000 && priceValue <= 2500;
        } else if (filters.priceRange === 'premium') {
          return priceValue > 2500;
        }
        return true;
      });
    }
    
    // Apply sorting
    if (filters.sortBy === 'price-low') {
      filteredProducts.sort((a, b) => {
        const priceA = parseInt(a.price?.replace(/[^\d]/g, '') || '0', 10);
        const priceB = parseInt(b.price?.replace(/[^\d]/g, '') || '0', 10);
        return priceA - priceB;
      });
    } else if (filters.sortBy === 'price-high') {
      filteredProducts.sort((a, b) => {
        const priceA = parseInt(a.price?.replace(/[^\d]/g, '') || '0', 10);
        const priceB = parseInt(b.price?.replace(/[^\d]/g, '') || '0', 10);
        return priceB - priceA;
      });
    } else if (filters.sortBy === 'rating') {
      filteredProducts.sort((a, b) => {
        const ratingA = parseFloat(a.rating || 0);
        const ratingB = parseFloat(b.rating || 0);
        return ratingB - ratingA;
      });
    }
    
    // Update filtered products
    onFilterChange(filteredProducts);
  }, [filters, products, onFilterChange]);

  return (
    <div className="fc-product-filters">
      <div className="fc-filter-grid">
        <div className="fc-filter-group">
          <label htmlFor="category-filter">Category:</label>
          <select
            id="category-filter"
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
            className="fc-select"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="fc-filter-group">
          <label htmlFor="price-filter">Price Range:</label>
          <select
            id="price-filter"
            name="priceRange"
            value={filters.priceRange}
            onChange={handleFilterChange}
            className="fc-select"
          >
            {priceRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="fc-filter-group">
          <label htmlFor="sort-filter">Sort By:</label>
          <select
            id="sort-filter"
            name="sortBy"
            value={filters.sortBy}
            onChange={handleFilterChange}
            className="fc-select"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="fc-results-count">
        <p>{products.length} items found</p>
      </div>
    </div>
  );
}
