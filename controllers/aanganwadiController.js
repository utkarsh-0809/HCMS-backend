import { Aanganwadi } from "../models/index.js";

export const verifyAanganwadiCode = async (req, res) => {
  try {
    const { code } = req.params;
    const aanganwadi = await Aanganwadi.findOne({ code: code.toUpperCase() }).select('name address code');
    if (!aanganwadi) {
      return res.status(404).json({ message: 'Aanganwadi code not found' });
    }
    res.status(200).json(aanganwadi);
  } catch (error) {
    console.error('Error verifying aanganwadi code:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAanganwadiByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const aanganwadi = await Aanganwadi.findOne({ code: code.toUpperCase() });
    if (!aanganwadi) return res.status(404).json({ message: 'Aanganwadi not found' });
    res.status(200).json(aanganwadi);
  } catch (error) {
    console.error('Error fetching aanganwadi:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
