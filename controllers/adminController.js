import { Vaccination } from "../models/vaccinationModel.js";
import { User } from "../models/userModel.js";
import { HealthRecord } from "../models/healthRecordModel.js";
import { Notification } from "../models/notificationModel.js"

export const getVaccinationRecords = async (req, res) => {
    try {
      const vaccinations = await Vaccination.find()
      .populate("studentId", "name gender email phone dateOfBirth") // Populate student details
      .populate("healthRecordId", "diagnosis treatment prescription date doctorId isManualUpload externalDoctorName externalHospitalName attachments") // Populate health record details
      .populate("verifiedBy", "name email"); // Select only these fields
  
      const formattedVaccinations = vaccinations.map((vaccination) => ({
        id: vaccination._id,
        studentName: vaccination.studentId.name,
        studentId: vaccination.studentId._id,
        gender: vaccination.studentId.gender,
        vaccineName: vaccination.vaccineName,
        dateAdministered: vaccination.dateAdministered.toISOString().split("T")[0],
        administeredBy: vaccination.administeredBy,
        facilityName: vaccination.facilityName,
        status: vaccination.status,
        verifiedBy: vaccination.verifiedBy?.name || "Not verified"
      }));
  
      res.status(200).json(formattedVaccinations);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
  

export const updateVaccinationStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'completed', 'pending', or 'overdue'
  
      if (!["completed", "pending", "overdue"].includes(status)) {
        console.log("invalid status received ")
        return res.status(400).json({ message: "Invalid status" });
      }
      console.log("Admin User:", req.user);
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized: Admin ID missing" });
      }

      const vaccination = await Vaccination.findByIdAndUpdate(
        id,
        { status, verifiedBy: req.user.id }, // Assuming `req.user.id` contains admin ID
        { new: true }
      );
  
      if (!vaccination) {
        return res.status(404).json({ message: "Vaccination record not found" });
        console.log("vaccination not found");
      }
      console.log("vaccination status updated");
      
      //store in mongodb
      const notification = await Notification.create({
        recipientId: vaccination.studentId,
        type: "vaccination",
        message: `Your ${vaccination.vaccineName} vaccination record has been ${status}.`,
      });
      console.log("stored in db");
      const io = req.app.get("socketio"); // Get Socket.io instance
      const studentSocket = req.app.get("onlineUsers").get(vaccination.studentId.toString());

      if (studentSocket) {
        console.log("informing patient about the vaccination status");
        studentSocket.emit("vaccinationStatusUpdate", { message: notification.message, vaccination });
      }
      else {
        console.log(`Student ${vaccination.studentId} is offline.`);
      }

  
      res.status(200).json({ message: `Vaccination ${status} successfully`, vaccination });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  
  export const viewVaccinationDetails = async (req, res) => {
    try {
      
        const { id } = req.params;
    
        const vaccination = await Vaccination.findById(id)
        .populate({
          path: "studentId",
          select: "name gender email phone dateOfBirth"
        })
        .populate({
          path: "healthRecordId",
          select: "diagnosis treatment prescription date doctorId isManualUpload externalDoctorName externalHospitalName attachments",
          populate: {
            path: "doctorId",
            select: "name "
          }
        })
        .populate("verifiedBy", "name email");
    
        if (!vaccination) {
          return res.status(404).json({ message: "Vaccination record not found" });
        }
    
        const detailedVaccination = {
          id: vaccination._id,
          studentName: vaccination.studentId.name,
          studentId: vaccination.studentId._id,
          gender: vaccination.studentId.gender,
          email: vaccination.studentId.email,
          phone: vaccination.studentId.phone,
          dateOfBirth: vaccination.studentId.dateOfBirth?.toISOString().split("T")[0] || null,
          vaccineName: vaccination.vaccineName,
          dateAdministered: vaccination.dateAdministered.toISOString().split("T")[0],
          dosageNumber: vaccination.dosageNumber,
          administeredBy: vaccination.administeredBy,
          facilityName: vaccination.facilityName,
          batchNumber: vaccination.batchNumber,
          nextDueDate: vaccination.nextDueDate ? vaccination.nextDueDate.toISOString().split("T")[0] : null,
          status: vaccination.status,
          notes: vaccination.notes,
          supportingDocuments: vaccination.supportingDocuments || [],
          verifiedBy: vaccination.verifiedBy ? { name: vaccination.verifiedBy.name, email: vaccination.verifiedBy.email } : null,
        };
        
        console.log("Supporting Documents:", vaccination.supportingDocuments);
        res.status(200).json(detailedVaccination);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    };
