/**
 * Image processing utility to resize images and convert to JPEG
 */

/**
 * Checks if a file is a HEIC/HEIF format
 * @param {File} file - File object to check
 * @returns {boolean} - True if file is HEIC/HEIF format
 */
function isHeicFile(file) {
    if (!(file instanceof File)) return false;
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    return fileName.endsWith('.heic') || 
           fileName.endsWith('.heif') || 
           mimeType === 'image/heic' || 
           mimeType === 'image/heif';
}

/**
 * Converts a HEIC file to JPEG using heic2any library
 * @param {File} heicFile - HEIC file to convert
 * @returns {Promise<File>} - Promise that resolves to a JPEG File
 */
async function convertHeicToJpeg(heicFile) {
    // Check if heic2any is available (may be loaded from CDN)
    if (typeof heic2any === 'undefined' && typeof window !== 'undefined' && typeof window.heic2any === 'undefined') {
        throw new Error('heic2any library is not loaded. Please include the library script.');
    }
    
    const heicConverter = typeof heic2any !== 'undefined' ? heic2any : window.heic2any;
    
    try {
        const convertedResult = await heicConverter({
            blob: heicFile,
            toType: 'image/jpeg',
            quality: 1.0
        });
        
        // heic2any can return an array or a single blob
        const blob = Array.isArray(convertedResult) ? convertedResult[0] : convertedResult;
        
        if (!blob) {
            throw new Error('Conversion returned no result');
        }
        
        // Convert blob to File object
        const jpegFile = new File([blob], heicFile.name.replace(/\.(heic|heif)$/i, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
        });
        
        return jpegFile;
    } catch (error) {
        console.error('HEIC conversion error:', error);
        throw new Error('Failed to convert HEIC file: ' + (error.message || error));
    }
}

/**
 * Resizes an image so that its largest side is maxSize pixels
 * and converts it to JPEG format
 * 
 * @param {File|string} input - File object or data URL string
 * @param {number} maxSize - Maximum size for the largest side (default: 512)
 * @param {number} quality - JPEG quality 0-1 (default: 0.9)
 * @returns {Promise<string>} - Promise that resolves to a base64 data URL
 */
async function resizeAndConvertToJpeg(input, maxSize = 512, quality = 0.9) {
    // Step 1: Convert HEIC to JPEG FIRST (must complete before resize)
    let processedInput = input;
    if (input instanceof File && isHeicFile(input)) {
        // Convert HEIC to JPEG and wait for it to complete fully
        processedInput = await convertHeicToJpeg(input);
        // Ensure conversion is complete before proceeding to resize
    }
    
    // Step 2: Now resize the image (HEIC conversion already done if needed)
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            // Determine which dimension is larger
            const isLandscape = width > height;
            
            // Calculate new dimensions
            if (isLandscape) {
                if (width > maxSize) {
                    height = Math.round((height / width) * maxSize);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round((width / height) * maxSize);
                    height = maxSize;
                }
            }
            
            // Create canvas to resize and convert image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            // Draw resized image on canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG base64 data URL
            const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(jpegDataUrl);
        };
        
        img.onerror = function() {
            reject(new Error('Failed to load image'));
        };
        
        // Handle input - either File object or data URL string
        // Note: processedInput is already converted from HEIC if needed
        if (processedInput instanceof File) {
            const reader = new FileReader();
            reader.onload = function(e) {
                img.src = e.target.result;
            };
            reader.onerror = function() {
                reject(new Error('Failed to read file'));
            };
            reader.readAsDataURL(processedInput);
        } else if (typeof processedInput === 'string') {
            // Assume it's a data URL
            img.src = processedInput;
        } else {
            reject(new Error('Invalid input: expected File or data URL string'));
        }
    });
}

