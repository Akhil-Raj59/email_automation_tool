import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILead extends Document {
  email: string;
  name: string;
  variables: Record<string, string>;
  campaignId: mongoose.Types.ObjectId;
  status: 'active' | 'unsubscribed';
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    variables: {
      type: Map,
      of: String,
      default: {},
    },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'unsubscribed'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness of a recipient email address within a single campaign
LeadSchema.index({ email: 1, campaignId: 1 }, { unique: true });

export const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
export default Lead;
