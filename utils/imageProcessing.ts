/**
 * Process an image file: resize if too large and convert to WebP
 * @param file The input file
 * @param maxWidth Maximum width (default 1920)
 * @param maxHeight Maximum height (default 1920)
 * @param quality WebP quality (0-1, default 0.8)
 * @returns Promise resolving to the processed File
 */
export const processImage = (
    file: File,
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8
): Promise<File> => {
    return new Promise((resolve, reject) => {
        // If not an image, return original file
        if (!file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                // Create canvas
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                // Draw image
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Could not convert image to blob"));
                            return;
                        }

                        // Create new file
                        const newFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, "") + ".webp",
                            {
                                type: "image/webp",
                                lastModified: Date.now(),
                            }
                        );
                        resolve(newFile);
                    },
                    "image/webp",
                    quality
                );
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
