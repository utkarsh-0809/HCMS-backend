import express from "express";
import { getVaccinationRecords, updateVaccinationStatus, viewVaccinationDetails } from "../controllers/adminController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {getHealthRecordsadmin} from "../controllers/healthRecordController.js";

const router = express.Router();

// Coordinator routes (renamed from admin)
router.get("/", authMiddleware(["coordinator"]), getVaccinationRecords); // Fetch all vaccination records
router.patch("/:id/status", authMiddleware(["coordinator"]), updateVaccinationStatus); // Update vaccination status
router.get("/:id/details", authMiddleware(["coordinator"]), viewVaccinationDetails); // View vaccination details
router.get("/healthrecord", authMiddleware(["coordinator"]), getHealthRecordsadmin);

export default router;
