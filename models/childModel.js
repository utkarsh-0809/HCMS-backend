import mongoose from "mongoose";

const ChildSchema = new mongoose.Schema(
  {
    // Basic child information
    name: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    childId: { type: String, unique: true, required: true }, // Unique identifier for the child
    
    // Parent/Guardian information
    parentName: { type: String, required: true },
    parentPhone: { type: String, required: true },
    parentEmail: { type: String },
    address: { type: String, required: true },
    
    // Aanganwadi information
    aanganwadiCode: { type: String, required: true }, // Which aanganwadi the child belongs to
    aanganwadiStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Staff member responsible
    
    // Health information
    healthRecords: [{ type: mongoose.Schema.Types.ObjectId, ref: "HealthRecord" }],
    vaccinationRecords: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vaccination" }],
    
    // BMI tracking over time
    bmiHistory: [{
      date: { type: Date, required: true },
      height: { type: Number, required: true }, // in cm
      weight: { type: Number, required: true }, // in kg
      bmi: { type: Number, required: true },
      category: { type: String, enum: ["Underweight", "Normal", "Overweight", "Obese"] },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    }],
    
    // Current status
    isActive: { type: Boolean, default: true }, // Whether child is still enrolled
    enrollmentDate: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Generate unique child ID before saving
ChildSchema.pre('save', async function(next) {
  if (!this.childId) {
    const count = await mongoose.model('Child').countDocuments();
    this.childId = `CH${String(count + 1).padStart(6, '0')}`;
  }
  this.lastUpdated = new Date();
  next();
});

export const Child = mongoose.model("Child", ChildSchema);