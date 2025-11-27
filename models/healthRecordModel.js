import mongoose from "mongoose";

const HealthRecordSchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },
    recordedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    }, // Staff member or doctor who recorded this
    
    // Checkup Type - Regular or Detailed
    checkupType: {
      type: String,
      enum: ["regular", "detailed"],
      required: true,
      default: "regular"
    },
    
    date: { type: Date, default: Date.now },

    // Basic measurements (for all checkups)
    measurements: {
      height: { type: Number }, // in cm
      weight: { type: Number }, // in kg
      headCircumference: { type: Number }, // in cm (important for children)
      chestCircumference: { type: Number }, // in cm
    },

    // Vital signs (for all checkups)
    vitalSigns: {
      temperature: { type: Number }, // in Celsius
      heartRate: { type: Number }, // beats per minute
      respiratoryRate: { type: Number }, // breaths per minute
      bloodPressure: {
        systolic: { type: Number },
        diastolic: { type: Number }
      }
    },

    // General observations (for all checkups)
    generalObservations: {
      appetite: { 
        type: String, 
        enum: ["Poor", "Fair", "Good", "Excellent"],
        default: "Good"
      },
      sleep: { 
        type: String, 
        enum: ["Poor", "Fair", "Good", "Excellent"],
        default: "Good"
      },
      activity: { 
        type: String, 
        enum: ["Low", "Moderate", "High"],
        default: "Moderate"
      },
      behavior: { 
        type: String, 
        enum: ["Calm", "Active", "Hyperactive", "Withdrawn"],
        default: "Active"
      },
      skinCondition: { 
        type: String, 
        enum: ["Normal", "Dry", "Rash", "Other"],
        default: "Normal"
      }
    },

    // Development milestones (for regular checkups)
    developmentMilestones: {
      motorSkills: { 
        type: String, 
        enum: ["Age-appropriate", "Advanced", "Delayed", "Concerns"],
        default: "Age-appropriate"
      },
      languageSkills: { 
        type: String, 
        enum: ["Age-appropriate", "Advanced", "Delayed", "Concerns"],
        default: "Age-appropriate"
      },
      socialSkills: { 
        type: String, 
        enum: ["Age-appropriate", "Advanced", "Delayed", "Concerns"],
        default: "Age-appropriate"
      },
      cognitiveSkills: { 
        type: String, 
        enum: ["Age-appropriate", "Advanced", "Delayed", "Concerns"],
        default: "Age-appropriate"
      }
    },

    // Nutrition assessment (for regular checkups)
    nutrition: {
      nutritionalStatus: { 
        type: String, 
        enum: ["Well-nourished", "Mildly malnourished", "Moderately malnourished", "Severely malnourished"],
        default: "Well-nourished"
      },
      feedingPatterns: { type: String }, // Free text
      supplements: { type: String } // Any supplements being given
    },

    // Medical details (only for detailed checkups)
    medicalDetails: {
      doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Null if manually uploaded
      diagnosis: { type: String }, // Only for detailed checkups
      treatment: { type: String }, // Only for detailed checkups
      prescription: { type: String }, // Only for detailed checkups
      symptoms: { type: String }, // Chief complaints
      followUpRequired: { type: Boolean, default: false },
      followUpDate: { type: Date },
      isManualUpload: { type: Boolean, default: false },
      externalDoctorName: { type: String }, // Name of doctor (if outside platform)
      externalHospitalName: { type: String }, // Hospital/clinic name (if external)
    },

    // BMI Tracking (calculated from measurements)
    bmi: {
      value: { type: Number },
      category: { 
        type: String, 
        enum: ["Underweight", "Normal weight", "Overweight", "Obese"],
      },
      recordedDate: { type: Date, default: Date.now }
    },

    // Vaccination Status Tracking
    vaccinationStatus: {
      totalMandatory: { type: Number, default: 6 },
      completed: { type: Number, default: 0 },
      completionPercentage: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    },

    // General notes and recommendations
    notes: { type: String }, // General observations and notes
    recommendations: { type: String }, // Recommendations for care
    
    // Attachments
    attachments: [{
      url: String,
      publicId: String,
      format: String,
    }], // File URLs
  },
  { timestamps: true }
);

// Add BMI calculation method
HealthRecordSchema.methods.calculateBMI = function() {
  if (this.measurements && this.measurements.height && this.measurements.weight) {
    const heightInMeters = this.measurements.height / 100;
    const bmiValue = this.measurements.weight / (heightInMeters * heightInMeters);
    this.bmi.value = Math.round(bmiValue * 10) / 10;
    
    // Determine BMI category for children (simplified)
    if (bmiValue < 18.5) {
      this.bmi.category = "Underweight";
    } else if (bmiValue < 25) {
      this.bmi.category = "Normal weight";
    } else if (bmiValue < 30) {
      this.bmi.category = "Overweight";
    } else {
      this.bmi.category = "Obese";
    }
  }
};

// Pre-save middleware to calculate BMI
HealthRecordSchema.pre('save', function(next) {
  if (this.measurements && this.measurements.height && this.measurements.weight) {
    this.calculateBMI();
  }
  next();
});

export const HealthRecord = mongoose.model("HealthRecord", HealthRecordSchema);