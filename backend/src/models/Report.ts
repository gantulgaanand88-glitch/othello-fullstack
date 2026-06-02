import { Schema, Types, model } from 'mongoose';

export type ReportReason = 'cheating' | 'harassment' | 'inappropriate_name' | 'stalling' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface IReport {
  reporter: Types.ObjectId;
  reported: Types.ObjectId;
  gameId?: Types.ObjectId;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reported: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gameId: {
      type: Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
    },
    reason: {
      type: String,
      enum: ['cheating', 'harassment', 'inappropriate_name', 'stalling', 'other'],
      required: true,
    },
    description: {
      type: String,
      maxlength: 500,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  },
);

// Index for looking up reports by reported user and status
reportSchema.index({ reported: 1, status: 1 });

export const Report = model<IReport>('Report', reportSchema);
