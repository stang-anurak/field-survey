import { z } from 'zod';

const manifest = z.object({
  name: z.string().min(1).max(300),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  mime: z.string().max(100),
});
const coord = { latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) };

export const createSchema = z.object({
  surveyTypeId: z.string().min(1).max(100),
  ...coord,
  gpsAccuracy: z.number().min(0).max(100000).nullable().optional(),
  surveyorName: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  customFields: z.record(z.unknown()).default({}),
  photos: z.array(manifest).max(5).default([]),
  turnstileToken: z.string().max(4096).optional(),
}).strict();

export const patchSchema = z.object({
  latitude: coord.latitude.optional(),
  longitude: coord.longitude.optional(),
  gpsAccuracy: z.number().min(0).max(100000).nullable().optional(),
  surveyorName: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  customFields: z.record(z.unknown()).optional(),
  addPhotos: z.array(manifest).max(5).optional(),
  removePhotoIds: z.array(z.string().max(60)).max(5).optional(),
}).strict();

export const idemKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
export const idParam = z.string().regex(/^[A-Za-z0-9-]{3,60}$/);
