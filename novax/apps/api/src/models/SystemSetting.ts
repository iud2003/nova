import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSettingDoc extends Document {
  key: string;
  value: string;
  description: string;
  updatedBy?: mongoose.Types.ObjectId;
}

const systemSettingSchema = new Schema<ISystemSettingDoc>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    description: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SystemSetting = mongoose.model<ISystemSettingDoc>('SystemSetting', systemSettingSchema);
