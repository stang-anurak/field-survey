export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';
export interface FormField { id: string; key: string; label: string; type: FieldType; required: boolean; options: string[]; placeholder: string; helpText: string }
export interface SurveyType { id: string; name: string; description: string; color: string }
export type CustomValue = string | number | boolean | string[];
export type PhotoState = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED' | 'REMOVED';
export interface OwnerPhoto { photoId: string; fileName: string; status: PhotoState; size: number; mime: string }
export interface OwnerView {
  surveyId: string; surveyTypeId: string; status: string; latitude: number; longitude: number; gpsAccuracy: number | null;
  surveyorName: string; description: string; customFields: Record<string, CustomValue>;
  expectedPhotoCount: number; uploadedPhotoCount: number; photos: OwnerPhoto[]; pendingPhotos?: OwnerPhoto[];
}
export interface PublicSurvey {
  surveyId: string; typeId: string; typeName: string; color: string; latitude: number; longitude: number; description: string;
  surveyorName?: string; createdAt: string; photoCount: number;
  customFields: { key: string; label: string; type: FieldType; value: CustomValue }[];
  photos?: { photoId: string }[];
}
