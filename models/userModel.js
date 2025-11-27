import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Hashed
    role: {
      type: String,
      enum: ["aanganwadi_staff", "coordinator", "doctor"],
      required: true,
    },

    phone: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },

    // Aanganwadi Staff specific fields
    aanganwadiName: { type: String }, // Name of the aanganwadi they work at
    aanganwadiAddress: { type: String }, // Address of the aanganwadi
    aanganwadiCode: { type: String }, // Unique code for the aanganwadi
    staffId: { type: String }, // Staff identification number

    // Doctors
    specialization: { type: String }, // Only for doctors
    isVolunteer: { type: Boolean, default: false }, // Whether doctor volunteers for aanganwadis
    volunteerAanganwadis: [{ type: String }], // List of aanganwadi codes doctor volunteers for
    
    // Coordinators
    assignedAanganwadis: [{ type: String }], // List of aanganwadi codes they coordinate (max 1)
    aanganwadiSetup: {
      name: { type: String },
      address: { type: String }, 
      code: { type: String },
      staffCapacity: { type: Number, default: 10 }
    }, // Coordinator's aanganwadi setup info
  },
  { timestamps: true }
);



export const User = mongoose.model("User", UserSchema);
