/**
 * Sanitize filename for Android/FAT32 compatibility
 * 
 * Android and FAT32 filesystems restrict characters: : * ? " < > | /
 * This utility removes/replaces those characters to ensure files can be synced to Android devices.
 * 
 * Replacement strategy: Replace restricted characters with hyphens (-) to maintain word separation.
 * 
 * @param {string} filename - The original filename to sanitize
 * @returns {string} Sanitized filename safe for Android/FAT32 filesystems
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return filename;
  }

  // Replace Android/FAT32 restricted characters with hyphen
  // Restricted chars: : * ? " < > | /
  const sanitized = filename
    .replace(/[:\*?"<>|\/]/g, '-')  // Replace restricted chars with hyphen
    .replace(/-+/g, '-')             // Collapse consecutive hyphens to single hyphen
    .replace(/^-+|-+$/g, '');        // Remove leading/trailing hyphens

  return sanitized;
}

/**
 * Sanitize full file path including extension (for multi-part filenames like "NNN-Title.mp3")
 * 
 * @param {string} filename - The full filename with extension (e.g., "001-Episode Title.mp3")
 * @returns {string} Sanitized filename with extension preserved
 */
export function sanitizeFullFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return filename;
  }

  // Split filename and extension
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    // No extension, sanitize entire filename
    return sanitizeFilename(filename);
  }

  const nameWithoutExt = filename.substring(0, lastDotIndex);
  const extension = filename.substring(lastDotIndex);

  // Sanitize the name part, keep extension as-is
  return sanitizeFilename(nameWithoutExt) + extension;
}
