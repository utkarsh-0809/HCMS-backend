import express from "express";
import {
  createHealthRecord,
  getHealthRecords,
  getHealthRecordById,
  updateHealthRecord,
  deleteHealthRecord,
  updateBMI,
  getBMIHistory,
  getHealthRecordsadmin,
  searchHealthRecords,
  getSearchSuggestions,
  getChildHealthRecords
} from "../controllers/healthRecordController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import upload from "../utils/multer.js";

const router = express.Router();

// Routes for aanganwadi staff health records
router.post('/create',authMiddleware(["aanganwadi_staff"]), upload.array('attachments'), createHealthRecord);
router.get("/", authMiddleware(["aanganwadi_staff"]), getHealthRecords);
router.get("/child/:childId", authMiddleware(["aanganwadi_staff", "coordinator", "doctor"]), getChildHealthRecords);
router.get("/:id", authMiddleware(["aanganwadi_staff"]), getHealthRecordById);
router.put("/:id/update", authMiddleware(["aanganwadi_staff"]), updateHealthRecord);
router.delete("/:id/delete", authMiddleware(["aanganwadi_staff"]), deleteHealthRecord);

// BMI routes for aanganwadi staff
router.put("/:id/bmi", authMiddleware(["aanganwadi_staff"]), updateBMI);
router.get("/staff/bmi-history", authMiddleware(["aanganwadi_staff"]), getBMIHistory);

// Search routes for aanganwadi staff
router.get("/staff/search", authMiddleware(["aanganwadi_staff"]), searchHealthRecords);
router.get("/staff/suggestions", authMiddleware(["aanganwadi_staff"]), getSearchSuggestions);

// Coordinator routes
router.get("/coordinator/all", authMiddleware(["coordinator"]), getHealthRecordsadmin);

export default router;
