import { Schema, Types, model } from 'mongoose';

export type ConsentType = 'essential' | 'analytics' | 'marketing' | 'terms' | 'privacy';

export interface IConsentLog {
  userId: Types.ObjectId;
  consentType: ConsentType;
  granted: boolean;
  timestamp: Date;
  ipHash: string;
  policyVersion: string;
}

const consentLogSchema = new Schema<IConsentLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  consentType: {
    type: String,
    enum: ['essential', 'analytics', 'marketing', 'terms', 'privacy'],
    required: true,
  },
  granted: {
    type: Boolean,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  ipHash: {
    type: String,
    default: '',
  },
  policyVersion: {
    type: String,
    required: true,
  },
});

// Index for looking up consent by user and type
consentLogSchema.index({ userId: 1, consentType: 1 });

export const ConsentLog = model<IConsentLog>('ConsentLog', consentLogSchema);
