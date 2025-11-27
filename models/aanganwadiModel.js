import mongoose from 'mongoose';

const AanganwadiSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  staffCapacity: { type: Number, default: 10 },
  coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Aanganwadi = mongoose.model('Aanganwadi', AanganwadiSchema);
