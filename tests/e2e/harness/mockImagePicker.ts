export interface ImagePickerAsset {
  uri: string;
  base64?: string;
  width?: number;
  height?: number;
  type?: string;
  fileName?: string;
  fileSize?: number;
}

export interface ImagePickerResult {
  canceled: boolean;
  assets: ImagePickerAsset[] | null;
}

export class MockImagePickerController {
  private static mockResult: ImagePickerResult = {
    canceled: false,
    assets: [
      {
        uri: 'file:///mock/prescription_demo.jpg',
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        width: 1080,
        height: 1920,
        type: 'image',
        fileName: 'prescription_demo.jpg',
      },
    ],
  };

  static setResult(result: ImagePickerResult): void {
    this.mockResult = result;
  }

  static simulateCancel(): void {
    this.mockResult = { canceled: true, assets: null };
  }

  static resetDefault(): void {
    this.mockResult = {
      canceled: false,
      assets: [
        {
          uri: 'file:///mock/prescription_demo.jpg',
          base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          width: 1080,
          height: 1920,
          type: 'image',
          fileName: 'prescription_demo.jpg',
        },
      ],
    };
  }
}

export async function requestCameraPermissionsAsync() {
  return { status: 'granted', granted: true };
}

export async function requestMediaLibraryPermissionsAsync() {
  return { status: 'granted', granted: true };
}

export async function launchCameraAsync(): Promise<ImagePickerResult> {
  return (MockImagePickerController as any).mockResult;
}

export async function launchImageLibraryAsync(): Promise<ImagePickerResult> {
  return (MockImagePickerController as any).mockResult;
}
