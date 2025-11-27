import mongoose from "mongoose";
const notificationSchema = new mongoose.Schema(
    {
      recipientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
      }, // The user receiving the notification
      type: { 
        type: String, 
        enum: ["vaccination", "health", "donation", "child_update", "volunteer"], 
        required: true 
      },
      message: { type: String, required: true },
      isRead: { type: Boolean, default: false }, // Track if the user has seen it
      
      // Additional context for specific notification types
      relatedData: {
        childId: { type: mongoose.Schema.Types.ObjectId, ref: "Child" },
        donationId: { type: mongoose.Schema.Types.ObjectId, ref: "Donation" },
        vaccinationId: { type: mongoose.Schema.Types.ObjectId, ref: "Vaccination" },
        healthRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "HealthRecord" },
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        aanganwadiId: { type: mongoose.Schema.Types.ObjectId, ref: "Aanganwadi" }
      }
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt fields
  );

export const Notification = mongoose.model("Notification", notificationSchema);