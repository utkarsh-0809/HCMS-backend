
import { instance } from "../utils/razorpay.js";

export const capturePayment = async (req, res) => {
//   const { courses } = req.body
//   const userId = req.user.id
console.log("here");
  let total_amount = req.body.amount*10;

  const options = {
    amount: total_amount * 100,
    currency: "INR",
    receipt: Math.random(Date.now()).toString(),
  }

  try {
    // Initiate the payment using Razorpay
    const paymentResponse = await instance.orders.create(options)
    console.log(paymentResponse)
    res.json({
      success: true,
      data: paymentResponse,
    })
  } catch (error) {
    console.log("here is error",error)
    res
      .status(500)
      .json({ success: false, message: "Could not initiate order." })
  }
}
