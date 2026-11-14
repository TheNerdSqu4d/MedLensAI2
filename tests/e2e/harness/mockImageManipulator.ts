export const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
};

export async function manipulateAsync(
  uri: string,
  actions: any[] = [],
  saveOptions: any = {}
) {
  return {
    uri: uri || 'file:///mock/manipulated_prescription.jpg',
    width: 1024,
    height: 768,
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  };
}
