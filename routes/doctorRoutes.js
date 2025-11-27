import express from "express";
import {
  getAllAanganwadis,
  getAanganwadiChildren,
  getChildHealthDetails,
  addChildHealthRecord,
  updateVolunteerStatus,
  getVolunteerDoctors,
  volunteerForAanganwadi,
  stopVolunteering,
  getDoctorDashboard
} from "../controllers/doctorController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes for volunteer doctors
router.get("/dashboard", authMiddleware(["doctor"]), getDoctorDashboard);
router.get("/aanganwadis/all", authMiddleware(["doctor"]), getAllAanganwadis);
router.post("/volunteer", authMiddleware(["doctor"]), volunteerForAanganwadi);
router.post("/stop-volunteer", authMiddleware(["doctor"]), stopVolunteering);
router.get("/aanganwadi/:aanganwadiCode/children", authMiddleware(["doctor"]), getAanganwadiChildren);
router.get("/child/:childId", authMiddleware(["doctor"]), getChildHealthDetails);
router.post("/child/:childId/health-record", authMiddleware(["doctor"]), addChildHealthRecord);
router.put("/volunteer-status", authMiddleware(["doctor"]), updateVolunteerStatus);

// Public route to get volunteer doctors list
router.get("/volunteers", getVolunteerDoctors);

export default router;