import express from "express";
import { signup, login, logout, getAllDoctors, getDoctorAvailableTimeSlots, getCurrentUser, updateUserProfile, updateAanganwadiCode } from "../controllers/userController.js";
import { searchHealthRecords, getSearchSuggestions } from "../controllers/healthRecordController.js";
import {authMiddleware} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

// Protected user routes
router.get("/profile", authMiddleware(["aanganwadi_staff", "coordinator", "doctor"]), getCurrentUser);
router.put("/profile", authMiddleware(["aanganwadi_staff", "coordinator", "doctor"]), updateUserProfile);
router.put("/update-aanganwadi-code", authMiddleware(["aanganwadi_staff"]), updateAanganwadiCode);



router.get("/search", authMiddleware(["aanganwadi_staff"]),searchHealthRecords);
router.get("/searchSuggestions", authMiddleware(["aanganwadi_staff"]),getSearchSuggestions);



router.get("/doctors", getAllDoctors);
router.get("/doctor/:doctorId/available-slots", getDoctorAvailableTimeSlots);

export default router;
