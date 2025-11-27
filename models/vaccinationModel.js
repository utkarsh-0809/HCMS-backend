import mongoose from "mongoose";

// Define the 6 mandatory vaccinations
const MANDATORY_VACCINATIONS = [
  "Hepatitis B",
  "MMR (Measles, Mumps, Rubella)",
  "Varicella (Chickenpox)",
  "Tdap (Tetanus, Diphtheria, Pertussis)",
  "Meningococcal ACWY",
  "COVID-19"
];

const VaccinationSchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Aanganwadi staff who recorded this
    },
    vaccineName: {
      type: String,
      enum: MANDATORY_VACCINATIONS,
      required: true,
    },
    dateAdministered: {
      type: Date,
      required: true,
    },
    dosageNumber: {
      type: Number,
      min: 1,
      default: 1,
    },
    administeredBy: {
      type: String,
      required: true, // Doctor/Healthcare provider name
    },
    facilityName: {
      type: String,
      required: true, // Hospital/Clinic name
    },
    batchNumber: {
      type: String,
    },
    nextDueDate: {
      type: Date, // For vaccines requiring multiple doses
    },
    status: {
      type: String,
      enum: ["completed", "pending", "overdue"],
      default: "completed",
    },
    supportingDocuments: [
      {
        url: String,
        publicId: String,
        format: String,
        resourceType: String
      }
    ],
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User" // Coordinator who verified the vaccination
    },
    notes: {
      type: String, // Any additional notes about the vaccination
    }
  },
  { timestamps: true }
);

// Static method to get mandatory vaccinations list
VaccinationSchema.statics.getMandatoryVaccinations = function() {
  return MANDATORY_VACCINATIONS;
};

// Instance method to check if vaccination is mandatory
VaccinationSchema.methods.isMandatory = function() {
  return MANDATORY_VACCINATIONS.includes(this.vaccineName);
};

export const Vaccination = mongoose.model("Vaccination", VaccinationSchema);
export { MANDATORY_VACCINATIONS };