import express from "express";
import {
  getCoordinatorDashboard,
  createAanganwadi,
  getCoordinatorStudents,
  getCoordinatorStaff,
  getAanganwadiStats
} from "../controllers/coordinatorController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All routes require coordinator authentication
router.use(authMiddleware(["coordinator"]));

// Dashboard routes
router.get("/dashboard", getCoordinatorDashboard);
router.post("/aanganwadi", createAanganwadi);

// Data routes  
router.get("/students", getCoordinatorStudents);
router.get("/staff", getCoordinatorStaff);
router.get("/stats", getAanganwadiStats);

export default router;