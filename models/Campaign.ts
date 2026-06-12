import mongoose, { Schema, Document, Model } from 'mongoose';

export type CampaignStatus = 'draft' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'paused';
export type CampaignProvider = 'gmail' | 'resend' | 'ses';

export interface ICampaign extends Document {
  title: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  provider: CampaignProvider;
  scheduledAt: Date;
  sentCount: number;
  failedCount: number;
  totalCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'processing', 'completed', 'failed', 'paused'],
      default: 'draft',
      index: true,
    },
    provider: {
      type: String,
      enum: ['gmail', 'resend', 'ses'],
      default: 'gmail',
      required: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Campaign: Model<ICampaign> =
  mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', CampaignSchema);
export default Campaign;
