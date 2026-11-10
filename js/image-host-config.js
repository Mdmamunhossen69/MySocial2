// Optional Cloudinary direct-upload configuration.
// The unsigned preset is public. Restrict allowed formats in Cloudinary.
// Browser-side file-size checks are not a security boundary and can be bypassed.
// Never put an API secret in this browser file.
// Leave both values empty to use HTTPS image URLs only.
export const imageHostConfig = {
  cloudName: "pjvr6uiq",
  uploadPreset: "mysocial2_upload"
};
