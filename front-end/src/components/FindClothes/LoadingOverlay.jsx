// File: src/components/FindClothes/LoadingOverlay.jsx

function LoadingOverlay() {
    return (
      <div className="fc-loading-overlay">
        <div className="fc-loading-spinner"></div>
        <p className="fc-loading-text">Processing Your Style...</p>
      </div>
    );
  }
  
  export default LoadingOverlay;