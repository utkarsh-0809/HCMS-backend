import express from "express";
import { getUserNotifications,markAllNotificationsAsRead ,markSingleNotificationAsRead } from "../controllers/notificationController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.get("/",authMiddleware(["aanganwadi_staff","doctor","coordinator"]), getUserNotifications);
router.patch("/mark-all-read/:id", markAllNotificationsAsRead);
//for single notification
router.patch('/mark-single-read/:notificationId',markSingleNotificationAsRead );

export default router;
