// File: src/components/FindClothes/UploadSection.jsx
import { useRef } from 'react';

function UploadSection({ 
  files, 
  setFiles, 
  imgPreviews, 
  setImgPreviews, 
  processImages, 
  resetToHome,
  maxFiles,
  minFiles
}) {
  const fileInputRef = useRef(null);
  
  // Handle file selection
  const handleFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const selectedFiles = Array.from(e.target.files);
    
    // Check if exceeding max files limit
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} images in total.`);
      return;
    }
    
    // Add new files to existing list
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
    
    // Generate image previews
    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (e) => {
        setImgPreviews(prevPreviews => [...prevPreviews, e.target.result]);
      };
    });
    
    // Reset file input for reuse
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Remove a file from selection
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setImgPreviews(imgPreviews.filter((_, i) => i !== index));
  };

  return (
    <div className="fc-upload-section">
      <h2 className="fc-section-title">Upload Your Style Photos</h2>
      
      <p className="fc-instructions">
        Upload {minFiles}-{maxFiles} photos of outfits you like to help us understand your style preferences.
      </p>
      
      <div className="fc-upload-grid">
        {/* Preview of uploaded images */}
        {imgPreviews.map((preview, index) => (
          <div key={index} className="fc-image-preview">
            <img src={preview} alt={`Outfit ${index + 1}`} className="fc-preview-img" />
            <button 
              className="fc-remove-btn" 
              onClick={() => removeFile(index)}
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        ))}
        
        {/* Upload button */}
        {files.length < maxFiles && (
          <div className="fc-upload-button-container">
            <label htmlFor="file-input" className="fc-upload-label">
              <div className="fc-upload-icon">+</div>
              <span>Add Photo</span>
              <input
                id="file-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}
      </div>
      
      <div className="fc-file-counter">
        <span className={files.length >= minFiles ? "fc-sufficient" : "fc-insufficient"}>
          {files.length} of {maxFiles} images selected
          {files.length < minFiles ? ` (Need at least ${minFiles})` : ''}
        </span>
      </div>
      
      <div className="fc-action-buttons">
        <button 
          className="fc-primary-btn" 
          onClick={processImages}
          disabled={files.length < minFiles}
        >
          Analyze My Style
        </button>
        <button className="fc-secondary-btn" onClick={resetToHome}>
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default UploadSection;