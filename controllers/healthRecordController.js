import { HealthRecord } from "../models/healthRecordModel.js";
import { uploadMultipleDocuments } from "../utils/cloudinary.js";
import fs from 'fs';

// Create a new health record
export const createHealthRecord = async (req, res) => {
  try {
    console.log("Request Body:", req.body);

    const { 
      childId,
      checkupType = "regular", // regular or detailed
      date,
      // Measurements
      height,
      weight,
      headCircumference,
      chestCircumference,
      // Vital signs
      temperature,
      heartRate,
      respiratoryRate,
      systolicBP,
      diastolicBP,
      // General observations
      appetite,
      sleep,
      activity,
      behavior,
      skinCondition,
      // Development milestones
      motorSkills,
      languageSkills,
      socialSkills,
      cognitiveSkills,
      // Nutrition
      nutritionalStatus,
      feedingPatterns,
      supplements,
      // Medical details (only for detailed checkups)
      diagnosis,
      treatment,
      prescription,
      symptoms,
      followUpRequired,
      followUpDate,
      doctorId,
      externalDoctorName,
      externalHospitalName,
      // General
      notes,
      recommendations
    } = req.body;
    
    const recordedBy = req.user.id;
    const isManualUpload = req.body.isManualUpload === "true";

    // Validate childId
    if (!childId) {
      return res.status(400).json({ message: "Child ID is required" });
    }

    // Validate required fields based on checkup type
    if (checkupType === "detailed") {
      if (!diagnosis) {
        return res.status(400).json({ message: "Diagnosis is required for detailed checkups" });
      }
      if (!isManualUpload && (!doctorId || doctorId === "")) {
        return res.status(400).json({ message: "Doctor ID is required for detailed checkups" });
      }
    }

    // Handle file uploads
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log("Files received:", req.files);
      const filePaths = req.files.map(file => file.path);
      const uploadResults = await uploadMultipleDocuments(filePaths);
      console.log("Upload results:", uploadResults);
    
      attachments = uploadResults.map(result => ({
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

    // Prepare the health record data
    const healthRecordData = {
      childId,
      recordedBy,
      checkupType,
      date: date ? new Date(date) : new Date(),
      attachments,
      notes,
      recommendations
    };

    // Add measurements if provided
    if (height || weight || headCircumference || chestCircumference) {
      healthRecordData.measurements = {};
      if (height) healthRecordData.measurements.height = parseFloat(height);
      if (weight) healthRecordData.measurements.weight = parseFloat(weight);
      if (headCircumference) healthRecordData.measurements.headCircumference = parseFloat(headCircumference);
      if (chestCircumference) healthRecordData.measurements.chestCircumference = parseFloat(chestCircumference);
    }

    // Add vital signs if provided
    if (temperature || heartRate || respiratoryRate || systolicBP || diastolicBP) {
      healthRecordData.vitalSigns = {};
      if (temperature) healthRecordData.vitalSigns.temperature = parseFloat(temperature);
      if (heartRate) healthRecordData.vitalSigns.heartRate = parseInt(heartRate);
      if (respiratoryRate) healthRecordData.vitalSigns.respiratoryRate = parseInt(respiratoryRate);
      if (systolicBP || diastolicBP) {
        healthRecordData.vitalSigns.bloodPressure = {};
        if (systolicBP) healthRecordData.vitalSigns.bloodPressure.systolic = parseInt(systolicBP);
        if (diastolicBP) healthRecordData.vitalSigns.bloodPressure.diastolic = parseInt(diastolicBP);
      }
    }

    // Add general observations if provided
    if (appetite || sleep || activity || behavior || skinCondition) {
      healthRecordData.generalObservations = {};
      if (appetite) healthRecordData.generalObservations.appetite = appetite;
      if (sleep) healthRecordData.generalObservations.sleep = sleep;
      if (activity) healthRecordData.generalObservations.activity = activity;
      if (behavior) healthRecordData.generalObservations.behavior = behavior;
      if (skinCondition) healthRecordData.generalObservations.skinCondition = skinCondition;
    }

    // Add development milestones if provided
    if (motorSkills || languageSkills || socialSkills || cognitiveSkills) {
      healthRecordData.developmentMilestones = {};
      if (motorSkills) healthRecordData.developmentMilestones.motorSkills = motorSkills;
      if (languageSkills) healthRecordData.developmentMilestones.languageSkills = languageSkills;
      if (socialSkills) healthRecordData.developmentMilestones.socialSkills = socialSkills;
      if (cognitiveSkills) healthRecordData.developmentMilestones.cognitiveSkills = cognitiveSkills;
    }

    // Add nutrition assessment if provided
    if (nutritionalStatus || feedingPatterns || supplements) {
      healthRecordData.nutrition = {};
      if (nutritionalStatus) healthRecordData.nutrition.nutritionalStatus = nutritionalStatus;
      if (feedingPatterns) healthRecordData.nutrition.feedingPatterns = feedingPatterns;
      if (supplements) healthRecordData.nutrition.supplements = supplements;
    }

    // Add medical details for detailed checkups
    if (checkupType === "detailed") {
      healthRecordData.medicalDetails = {
        diagnosis,
        treatment,
        prescription,
        symptoms,
        followUpRequired: followUpRequired === "true" || followUpRequired === true,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        isManualUpload,
        externalDoctorName: isManualUpload ? externalDoctorName : null,
        externalHospitalName: isManualUpload ? externalHospitalName : null,
        doctorId: isManualUpload ? null : doctorId
      };
    }

    const newRecord = new HealthRecord(healthRecordData);
    
    console.log("Health record data before saving:", healthRecordData);

    await newRecord.save();
    res.status(201).json({ message: "Health record created successfully", newRecord });
  } catch (error) {
    console.error("Error creating health record:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Get all health records for the logged-in student
export const getHealthRecords = async (req, res) => {
  try {
    const records = await HealthRecord.find({ studentId: req.user.id });
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: "Error fetching health records", error });
  }
};

// Get a single health record by ID
export const getHealthRecordById = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Health record not found" });
    
    if (record.studentId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ message: "Error fetching health record", error });
  }
};

// Update a health record
export const updateHealthRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Health record not found" });

    if (record.studentId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    Object.assign(record, req.body);
    await record.save();
    res.status(200).json({ message: "Health record updated successfully", record });
  } catch (error) {
    res.status(500).json({ message: "Error updating health record", error });
  }
};

// Delete a health record
export const deleteHealthRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Health record not found" });

    if (record.studentId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    await record.deleteOne();
    res.status(200).json({ message: "Health record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting health record", error });
  }
};




export const getHealthRecordsadmin = async (req, res) => {
  try {
    // Fetch all health records and populate student and doctor details
    const healthRecords = await HealthRecord.find()
      .populate("studentId", "name gender email phone dateOfBirth") // Populate student details
      .populate("doctorId", "name specialization email phone"); // Populate doctor details

    // Format the records for the frontend
    const formattedRecords = healthRecords.map((record) => ({
      id: record._id,
      studentName: record.studentId?.name || "Unknown",
      studentId: record.studentId?._id || null,
      gender: record.studentId?.gender || "Unknown",
      diagnosis: record.diagnosis,
      date: record.date.toISOString().split("T")[0],
      prescription: record.prescription || "No prescription provided",
      attachments: record.attachments.map(att => ({
        url: att.url || null,
        format: att.url ? att.url.split('.').pop().toLowerCase() : null,
      })),
      doctorName: record.isManualUpload
        ? record.externalDoctorName
        : record.doctorId?.name || "Unknown",
      hospitalName: record.isManualUpload ? record.externalHospitalName : null,
      bmi: record.bmi ? {
        value: record.bmi.value,
        height: record.bmi.height,
        weight: record.bmi.weight,
        category: record.bmi.category,
        recordedDate: record.bmi.recordedDate?.toISOString().split("T")[0]
      } : null,
      vaccinationStatus: record.vaccinationStatus ? {
        completed: record.vaccinationStatus.completed,
        totalMandatory: record.vaccinationStatus.totalMandatory,
        completionPercentage: record.vaccinationStatus.completionPercentage
      } : null
    }));
    console.log("Formatted records:", formattedRecords);
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error("Error fetching health records:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update BMI for a health record
export const updateBMI = async (req, res) => {
  try {
    const { height, weight } = req.body;
    const recordId = req.params.id;

    if (!height || !weight) {
      return res.status(400).json({ message: "Height and weight are required" });
    }

    const record = await HealthRecord.findById(recordId);
    if (!record) {
      return res.status(404).json({ message: "Health record not found" });
    }

    if (record.studentId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Update BMI data
    record.bmi = {
      height: parseFloat(height),
      weight: parseFloat(weight),
      recordedDate: new Date()
    };

    await record.save(); // This will trigger the BMI calculation

    res.status(200).json({ 
      message: "BMI updated successfully", 
      bmi: record.bmi 
    });
  } catch (error) {
    console.error("Error updating BMI:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get BMI history for a student
export const getBMIHistory = async (req, res) => {
  try {
    const studentId = req.user.id;

    const records = await HealthRecord.find({ 
      studentId, 
      'bmi.value': { $exists: true } 
    })
    .select('bmi date')
    .sort({ 'bmi.recordedDate': -1 });

    const bmiHistory = records.map(record => ({
      date: record.bmi.recordedDate?.toISOString().split("T")[0] || record.date.toISOString().split("T")[0],
      value: record.bmi.value,
      height: record.bmi.height,
      weight: record.bmi.weight,
      category: record.bmi.category
    }));

    res.status(200).json(bmiHistory);
  } catch (error) {
    console.error("Error fetching BMI history:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


//Search



export const searchHealthRecords = async (req, res) => {
  try {
    const { query } = req.query;
    const studentId = req.user.id;
    console.log("Search query:", query);
    console.log("Student ID:", studentId);

    const records = await HealthRecord.find({
      studentId,
      $or: [
        { diagnosis: { $regex: query, $options: "i" } },
        { treatment: { $regex: query, $options: "i" } },
        { prescription: { $regex: query, $options: "i" } },
        { externalDoctorName: { $regex: query, $options: "i" } },
        { externalHospitalName: { $regex: query, $options: "i" } },
      ],
    });

    console.log("Records found:", records.length);
    res.status(200).json(records);
  } catch (error) {
    console.error("Error searching health records:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query; // User's input
    const studentId = req.user.id; // Authenticated user ID

    if (!query) {
      return res.status(400).json({ message: "Query parameter is required" });
    }

    // Fetch suggestions based on partial matches
    const suggestions = await HealthRecord.find({
      studentId,
      $or: [
        { diagnosis: { $regex: query, $options: "i" } },
        { treatment: { $regex: query, $options: "i" } },
        { prescription: { $regex: query, $options: "i" } },
        { externalDoctorName: { $regex: query, $options: "i" } },
        { externalHospitalName: { $regex: query, $options: "i" } },
      ],
    }).limit(5); // Limit the number of suggestions

    // Extract unique suggestions (e.g., diagnosis names)
    const uniqueSuggestions = [...new Set(suggestions.map(s => s.diagnosis))];

    res.status(200).json(uniqueSuggestions);
  } catch (error) {
    console.error("Error fetching search suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get health records for a specific child
export const getChildHealthRecords = async (req, res) => {
  try {
    const { childId } = req.params;
    
    // Find health records for the specific child
    const records = await HealthRecord.find({ childId })
      .populate('childId', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      message: "Child health records retrieved successfully",
      data: records
    });
  } catch (error) {
    console.error("Error fetching child health records:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};