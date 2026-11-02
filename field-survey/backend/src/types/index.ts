import type { Readable } from 'node:stream';

export type Row = Record<string, string>;

export interface Table {
  readAll(opts?: { fresh?: boolean }): Promise<Row[]>;
  append(rows: Row[]): Promise<void>;
  /** คืน false ถ้าไม่พบ id */
  updateById(idColumn: string, id: string, patch: Row): Promise<boolean>;
}

export interface Tables {
  surveys: Table;
  photos: Table;
  surveyTypes: Table;
  formFields: Table;
  activity: Table;
}

export interface FileStore {
  /** ต้อง idempotent ตาม photoId: เรียกซ้ำต้องไม่สร้างไฟล์ซ้ำ */
  put(args: { surveyId: string; photoId: string; data: Buffer; mime: string; ext: string }): Promise<{ fileId: string }>;
  open(fileId: string): Promise<Readable>;
}

export type SurveyStatus = 'PENDING_UPLOAD' | 'UPLOADING' | 'UPLOAD_FAILED' | 'READY' | 'DELETED';
export type PhotoStatus = 'PENDING' | 'UPLOADED' | 'FAILED' | 'REMOVED';
export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';

export interface FieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  placeholder: string;
  helpText: string;
  isPublic: boolean;
}

export interface PhotoManifest {
  name: string;
  size: number;
  mime: string;
}
