// File: src/components/FindClothes/UploadSection.jsx
import { useRef } from 'react';

function UploadSection({ 
  files, 
  setFiles, 
  imgPreviews, 
  setImgPreviews, 
  error, 
  setError,
  processImages,
  setShowHome,
  MAX_FILES,
  MIN_FILES
}) {
  const fileInputRef = useRef(null);

  // Handle file change for multiple image uploads
  const handleFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const selectedFiles = Array.from(e.target.files);
    
    // Check if we're exceeding the maximum allowed files
    if (files.length + selectedFiles.length > MAX_FILES) {
      setError(`You can only upload up to ${MAX_FILES} images in total.`);
      return;
    }

    // Add new files to existing files
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
    
    // Generate previews for the newly selected files
    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (e) => {
        setImgPreviews(prevPreviews => [...prevPreviews, e.target.result]);
      };
    });

    // Clear any existing error
    setError(null);
    
    // Reset the file input value to allow selecting the same file again
    if(fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove a file from the selection
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setImgPreviews(imgPreviews.filter((_, i) => i !== index));
  };

  return (
    <div className="fc-upload-section">
      <p className="fc-instructions">
        Upload 2-5 photos of outfits you like to help us understand your style preferences.
      </p>
      
      <div className="fc-file-upload-area">
        <div className="fc-image-grid">
          {imgPreviews.map((preview, index) => (
            <div key={index} className="fc-image-card">
              <div className="fc-image-wrapper">
                <img src={preview} alt={`Outfit ${index + 1}`} />
                <button 
                  className="fc-remove-btn" 
                  onClick={() => removeFile(index)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          
          {files.length < MAX_FILES && (
            <div className="fc-image-card fc-upload-card">
              <label htmlFor="file-input" className="fc-upload-label">
                <div className="fc-upload-placeholder">
                  <span className="fc-upload-icon">+</span>
                  <span>Add Photo</span>
                </div>
                <input
                  id="file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg, .jpeg, .png"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
      </div>
      
      {error && <p className="fc-error-message">{error}</p>}
      
      <div className="fc-file-status">
        <span className={`fc-file-count ${files.length >= MIN_FILES ? 'fc-sufficient' : 'fc-insufficient'}`}>
          {files.length} of {MAX_FILES} images selected {files.length < MIN_FILES ? `(Need at least ${MIN_FILES})` : ''}
        </span>
      </div>
      
      <div className="fc-action-buttons">
        <button 
          className="fc-analyze-btn" 
          onClick={processImages}
          disabled={files.length < MIN_FILES}
        >
          Analyze My Style
        </button>
        <button className="fc-back-btn" onClick={() => setShowHome(true)}>
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default UploadSection;