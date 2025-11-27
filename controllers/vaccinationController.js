// vaccinationController.js
import { Vaccination, MANDATORY_VACCINATIONS } from "../models/vaccinationModel.js";
import { HealthRecord } from "../models/healthRecordModel.js";
import { User } from "../models/index.js";
import { Child } from "../models/childModel.js";
import { Notification } from "../models/notificationModel.js";
import { uploadMultipleDocuments } from "../utils/cloudinary.js";
import fs from "fs";

// Add Vaccination Record
export const addVaccinationRecord = async (req, res) => {
  try {
    const { 
      childId,
      vaccineName, 
      dateAdministered, 
      dosageNumber, 
      administeredBy, 
      facilityName, 
      batchNumber, 
      nextDueDate, 
      notes
    } = req.body;
    
    // Validate child exists
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }
    
    // Process uploaded files
    let supportingDocuments = [];
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(file => file.path);
      const uploadResults = await uploadMultipleDocuments(filePaths);
      
      supportingDocuments = uploadResults.map(result => ({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format
      }));
      
      // Clean up temp files after upload
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.log(`Failed to delete temp file: ${file.path}`, err);
        });
      });
    }

    // Create the vaccination record
    const vaccinationRecord = await Vaccination.create({
      childId,
      recordedBy: req.user.id,
      vaccineName,
      dateAdministered,
      dosageNumber,
      administeredBy,
      facilityName,
      batchNumber,
      nextDueDate,
      notes,
      supportingDocuments,
      status: "completed",
    });

    // Update vaccination status in health record
    await updateVaccinationStatus(childId);

    // Emit real-time notification to ALL online coordinators
    const io = req.app.get("socketio");
    const onlineUsers = req.app.get("onlineUsers");
    
    // Save notification in database for the recording staff
    const staffNotification = await Notification.create({
      recipientId: req.user.id, 
      type: "vaccination",
      message: "Vaccination record has been submitted successfully.",
    });
    
    // Find all coordinators and notify them 
    onlineUsers.forEach(async(socket, userId) => {
      const user = await User.findById(userId);
      if (user && user.role === "coordinator") {
        console.log("Informing coordinator about the vaccination record");

        await Notification.create({
          recipientId: user._id,
          type: "vaccination",
          message: `New vaccination record added for ${child.name} - ${vaccineName}`,
        });

        socket.emit("newVaccinationRecord", {
          message: `New vaccination record added for ${child.name} - ${vaccineName}`,
          vaccinationRecord: {
            ...vaccinationRecord.toObject(), 
            childName: child.name,
          },
        });
      }
    });

    res.status(201).json({ 
      message: "Vaccination record added successfully", 
      vaccinationRecord: {
        ...vaccinationRecord.toObject(), 
        childName: child.name, 
      }
    });
  } catch (error) {
    console.error("Error adding vaccination record:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get all vaccination records for a child
export const getVaccinationRecords = async (req, res) => {
  try {
    const { childId } = req.params;

    const vaccinationRecords = await Vaccination.find({ childId })
      .populate("childId", "name parentName")
      .populate("recordedBy", "name")
      .sort({ dateAdministered: -1 });

    const formattedRecords = vaccinationRecords.map((record) => ({
      id: record._id,
      vaccineName: record.vaccineName,
      dateAdministered: record.dateAdministered.toISOString().split("T")[0],
      dosageNumber: record.dosageNumber,
      administeredBy: record.administeredBy,
      facilityName: record.facilityName,
      batchNumber: record.batchNumber,
      nextDueDate: record.nextDueDate ? record.nextDueDate.toISOString().split("T")[0] : null,
      status: record.status,
      notes: record.notes,
      supportingDocuments: record.supportingDocuments,
      recordedBy: record.recordedBy?.name
    }));

    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error("Error fetching vaccination records:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get vaccination status for child
export const getVaccinationStatus = async (req, res) => {
  try {
    const { childId } = req.params;
    
    // Get all vaccination records for the child
    const vaccinationRecords = await Vaccination.find({ childId });
    
    // Get completed mandatory vaccinations
    const completedMandatory = vaccinationRecords.filter(record => 
      MANDATORY_VACCINATIONS.includes(record.vaccineName) && record.status === "completed"
    );
    
    // Group by vaccine name to get unique completed vaccines
    const uniqueCompletedVaccines = [...new Set(completedMandatory.map(record => record.vaccineName))];
    
    // Calculate status for each mandatory vaccine
    const vaccinationStatus = MANDATORY_VACCINATIONS.map(vaccine => {
      const records = vaccinationRecords.filter(record => record.vaccineName === vaccine);
      const latestRecord = records.sort((a, b) => new Date(b.dateAdministered) - new Date(a.dateAdministered))[0];
      
      return {
        vaccineName: vaccine,
        status: latestRecord ? latestRecord.status : "pending",
        dateAdministered: latestRecord ? latestRecord.dateAdministered : null,
        nextDueDate: latestRecord ? latestRecord.nextDueDate : null,
        dosageNumber: latestRecord ? latestRecord.dosageNumber : 0
      };
    });

    const summary = {
      totalMandatory: MANDATORY_VACCINATIONS.length,
      completed: uniqueCompletedVaccines.length,
      completionPercentage: Math.round((uniqueCompletedVaccines.length / MANDATORY_VACCINATIONS.length) * 100),
      vaccinations: vaccinationStatus
    };

    res.status(200).json(summary);
  } catch (error) {
    console.error("Error fetching vaccination status:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get mandatory vaccinations list
export const getMandatoryVaccinations = async (req, res) => {
  try {
    res.status(200).json({
      mandatoryVaccinations: MANDATORY_VACCINATIONS,
      total: MANDATORY_VACCINATIONS.length
    });
  } catch (error) {
    console.error("Error fetching mandatory vaccinations:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Admin: Get all vaccination records
export const getAllVaccinationRecords = async (req, res) => {
  try {
    const vaccinationRecords = await Vaccination.find()
      .populate("childId", "name parentName dateOfBirth")
      .populate("recordedBy", "name")
      .populate("verifiedBy", "name")
      .sort({ dateAdministered: -1 });

    const formattedRecords = vaccinationRecords.map((record) => ({
      id: record._id,
      childName: record.childId?.name || "Unknown",
      childId: record.childId?._id || null,
      vaccineName: record.vaccineName,
      dateAdministered: record.dateAdministered.toISOString().split("T")[0],
      dosageNumber: record.dosageNumber,
      administeredBy: record.administeredBy,
      facilityName: record.facilityName,
      batchNumber: record.batchNumber,
      status: record.status,
      recordedBy: record.recordedBy?.name || "Unknown",
      verifiedBy: record.verifiedBy?.name || "Not verified",
      supportingDocuments: record.supportingDocuments.map(doc => ({
        url: doc.url || null,
        format: doc.url ? doc.url.split('.').pop().toLowerCase() : null,
      })),
    }));

    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error("Error fetching all vaccination records:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Admin: Verify vaccination record
export const verifyVaccinationRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const coordinatorId = req.user.id;

    const vaccinationRecord = await Vaccination.findByIdAndUpdate(
      recordId,
      { 
        verifiedBy: coordinatorId,
        status: "completed"
      },
      { new: true }
    ).populate("childId", "name");

    if (!vaccinationRecord) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    // Update vaccination status in health record
    await updateVaccinationStatus(vaccinationRecord.childId._id);

    // Notify staff about verification
    await Notification.create({
      recipientId: vaccinationRecord.recordedBy,
      type: "vaccination",
      message: `Vaccination record for ${vaccinationRecord.childId.name} (${vaccinationRecord.vaccineName}) has been verified.`,
    });

    res.status(200).json({ 
      message: "Vaccination record verified successfully", 
      vaccinationRecord 
    });
  } catch (error) {
    console.error("Error verifying vaccination record:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Helper function to update vaccination status in health record
const updateVaccinationStatus = async (childId) => {
  try {
    const vaccinationRecords = await Vaccination.find({ childId });
    const completedMandatory = vaccinationRecords.filter(record => 
      MANDATORY_VACCINATIONS.includes(record.vaccineName) && record.status === "completed"
    );
    
    const uniqueCompletedVaccines = [...new Set(completedMandatory.map(record => record.vaccineName))];
    const completionPercentage = Math.round((uniqueCompletedVaccines.length / MANDATORY_VACCINATIONS.length) * 100);

    // Update the latest health record with vaccination status
    await HealthRecord.findOneAndUpdate(
      { childId },
      {
        'vaccinationStatus.completed': uniqueCompletedVaccines.length,
        'vaccinationStatus.completionPercentage': completionPercentage,
        'vaccinationStatus.lastUpdated': new Date()
      },
      { sort: { createdAt: -1 } }
    );
  } catch (error) {
    console.error("Error updating vaccination status:", error);
  }
};