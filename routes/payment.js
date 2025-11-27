import express from "express";
import { capturePayment } from "../controllers/payment.js";

const router = express.Router();

router.post("/capture", capturePayment);

export default router;
