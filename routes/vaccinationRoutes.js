import express from "express";
import { 
  addVaccinationRecord, 
  getVaccinationRecords, 
  getVaccinationStatus,
  getMandatoryVaccinations,
  getAllVaccinationRecords,
  verifyVaccinationRecord
} from "../controllers/vaccinationController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import upload from "../utils/multer.js";

const router = express.Router();

// Aanganwadi staff routes
router.post(
  "/add", 
  authMiddleware(["aanganwadi_staff"]), 
  upload.array('supportingDocuments', 5),
  addVaccinationRecord
);
router.get("/child/:childId", authMiddleware(["aanganwadi_staff", "coordinator", "doctor"]), getVaccinationRecords);
router.get("/child/:childId/status", authMiddleware(["aanganwadi_staff", "coordinator", "doctor"]), getVaccinationStatus);
router.get("/mandatory", authMiddleware(["aanganwadi_staff", "coordinator", "doctor"]), getMandatoryVaccinations);

// Coordinator routes
router.get("/coordinator/all", authMiddleware(["coordinator"]), getAllVaccinationRecords);
router.put("/coordinator/verify/:recordId", authMiddleware(["coordinator"]), verifyVaccinationRecord);

export default router;