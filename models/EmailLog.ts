import mongoose, { Schema, Document, Model } from 'mongoose';

export type EmailLogStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface IEmailLog extends Document {
  campaignId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  recipientEmail: string;
  status: EmailLogStatus;
  sentAt?: Date;
  attempts: number;
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailLogSchema = new Schema<IEmailLog>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    recipientEmail: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    sentAt: { type: Date },
    attempts: { type: Number, default: 0, index: true },
    errorReason: { type: String },
  },
  { timestamps: true }
);

// Compound index to ensure only one delivery log exists for any given recipient within a specific campaign
EmailLogSchema.index({ campaignId: 1, recipientEmail: 1 }, { unique: true });

export const EmailLog: Model<IEmailLog> =
  mongoose.models.EmailLog || mongoose.model<IEmailLog>('EmailLog', EmailLogSchema);
export default EmailLog;
