import type { Rating, Report, Restroom } from '../domain/types';

export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceError';
  }
}

export interface SubmitResult<T> {
  record: T;
  message: string;
}

export interface RestroomDataProvider {
  mode: 'demo' | 'server';
  label: string;
  listRestrooms(): Promise<Restroom[]>;
  listReports(): Promise<Report[]>;
  listRatings(): Promise<Rating[]>;
  submitReport(body: unknown, options: { online: boolean }): Promise<SubmitResult<Report>>;
  submitRating(body: unknown, options: { online: boolean }): Promise<SubmitResult<Rating>>;
  moderate(id: string, status: 'approved' | 'rejected'): Promise<Report>;
  saveRestroom(body: unknown): Promise<Restroom>;
  reset(): Promise<void>;
}
