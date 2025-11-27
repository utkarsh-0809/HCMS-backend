import mongoose from "mongoose";

const DonationSchema = new mongoose.Schema(
  {
    donorName: { type: String, required: true },
    donorEmail: { type: String, required: true },
    donorPhone: { type: String, required: true },
    donorAddress: { type: String },
    
    donationType: {
      type: String,
      enum: ["money", "clothes", "food", "stationary", "books", "toys", "medical_supplies"],
      required: true,
    },
    
    // For monetary donations
    amount: { type: Number }, // Required if donationType is "money"
    paymentMethod: { type: String, enum: ["online", "bank_transfer", "cash", "cheque"] },
    transactionId: { type: String },
    
    // For physical donations
    itemDescription: { type: String }, // Description of items donated
    quantity: { type: Number }, // Number of items
    condition: { type: String, enum: ["new", "good", "fair"] }, // Condition of items
    
    // Images of donated items (for verification)
    images: [{
      url: String,
      publicId: String,
      format: String
    }],
    
    // Donation status
    status: {
      type: String,
      enum: ["received", "verified", "distributed", "cancelled"],
      default: "received",
    },
    
    // Distribution tracking
    distributedTo: {
      aanganwadiCode: { type: String },
      aanganwadiName: { type: String },
      coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      distributionDate: { type: Date }
    },
    
    // Processing
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Coordinator who verified
    verificationDate: { type: Date },
    notes: { type: String }, // Any additional notes
    
    // Urgency level
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    }
  },
  { timestamps: true }
);

// Generate donation ID
DonationSchema.pre('save', async function(next) {
  if (!this.donationId) {
    const count = await mongoose.model('Donation').countDocuments();
    this.donationId = `DON${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export const Donation = mongoose.model("Donation", DonationSchema);