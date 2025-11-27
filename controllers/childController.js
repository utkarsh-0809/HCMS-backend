import { Child, HealthRecord, Vaccination, User } from '../models/index.js';

// Get all children for a specific aanganwadi staff
export const getChildrenByStaff = async (req, res) => {
  try {
    const staffId = req.user.id;
    
    // First get the staff member to find their aanganwadiCode
    const staffMember = await User.findById(staffId);
    if (!staffMember || !staffMember.aanganwadiCode) {
      return res.status(400).json({ message: 'Staff member not associated with any aanganwadi' });
    }
    
    // Get all children from the same aanganwadi, not just ones created by this staff
    const children = await Child.find({ 
      aanganwadiCode: staffMember.aanganwadiCode, 
      isActive: true 
    })
    .populate('healthRecords')
    .populate('vaccinationRecords')
    .sort({ name: 1 });

    res.status(200).json(children);
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ message: 'Failed to fetch children' });
  }
};

// Get children for a specific aanganwadi (for coordinators and doctors)
export const getChildrenByAanganwadi = async (req, res) => {
  try {
    const { aanganwadiCode } = req.params;
    const children = await Child.find({ 
      aanganwadiCode, 
      isActive: true 
    })
    .populate('healthRecords')
    .populate('vaccinationRecords')
    .populate('aanganwadiStaff', 'name')
    .sort({ name: 1 });

    res.status(200).json(children);
  } catch (error) {
    console.error('Error fetching children by aanganwadi:', error);
    res.status(500).json({ message: 'Failed to fetch children' });
  }
};

// Get detailed view of a specific child
export const getChildDetails = async (req, res) => {
  try {
    const { childId } = req.params;
    const child = await Child.findById(childId)
      .populate({
        path: 'healthRecords',
        populate: { path: 'recordedBy', select: 'name role' }
      })
      .populate({
        path: 'vaccinationRecords',
        populate: { path: 'recordedBy', select: 'name role' }
      })
      .populate('aanganwadiStaff', 'name email phone');

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    // Check access permissions
    const userRole = req.user.role;
    if (userRole === 'aanganwadi_staff') {
      // For aanganwadi staff, check if the child belongs to their aanganwadi
      const staffMember = await User.findById(req.user.id);
      if (!staffMember || child.aanganwadiCode !== staffMember.aanganwadiCode) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.status(200).json(child);
  } catch (error) {
    console.error('Error fetching child details:', error);
    res.status(500).json({ message: 'Failed to fetch child details' });
  }
};

// Add a new child (aanganwadi staff only)
export const addChild = async (req, res) => {
  try {
    const {
      name,
      dateOfBirth,
      gender,
      parentName,
      parentPhone,
      parentEmail,
      address
    } = req.body;

    const staffMember = await User.findById(req.user.id);
    console.log('Staff member found:', staffMember);
    
    if (!staffMember || staffMember.role !== 'aanganwadi_staff') {
      return res.status(403).json({ message: 'Only aanganwadi staff can add children' });
    }

    console.log('Staff member aanganwadiCode:', staffMember.aanganwadiCode);

    if (!staffMember.aanganwadiCode) {
      return res.status(400).json({ message: 'Staff member must have an aanganwadi code assigned' });
    }

    // Generate a unique childId
    const childId = `${staffMember.aanganwadiCode}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const child = new Child({
      name,
      dateOfBirth,
      gender,
      childId,
      parentName,
      parentPhone,
      parentEmail,
      address,
      aanganwadiCode: staffMember.aanganwadiCode,
      aanganwadiStaff: req.user.id
    });

    await child.save();
    res.status(201).json({
      message: 'Child added successfully',
      child
    });
  } catch (error) {
    console.error('Error adding child:', error);
    res.status(500).json({ message: 'Failed to add child', error: error.message });
  }
};

// Update child information
export const updateChild = async (req, res) => {
  try {
    const { childId } = req.params;
    const updateData = req.body;

    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    // Check permissions
    if (req.user.role === 'aanganwadi_staff') {
      // For aanganwadi staff, check if the child belongs to their aanganwadi
      const staffMember = await User.findById(req.user.id);
      if (!staffMember || child.aanganwadiCode !== staffMember.aanganwadiCode) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const updatedChild = await Child.findByIdAndUpdate(
      childId,
      { ...updateData, lastUpdated: new Date() },
      { new: true }
    );

    res.status(200).json({
      message: 'Child updated successfully',
      child: updatedChild
    });
  } catch (error) {
    console.error('Error updating child:', error);
    res.status(500).json({ message: 'Failed to update child' });
  }
};

// Add BMI record for a child
export const addBMIRecord = async (req, res) => {
  try {
    const { childId } = req.params;
    const { height, weight, date } = req.body;

    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    // Check permissions
    if (req.user.role === 'aanganwadi_staff') {
      // For aanganwadi staff, check if the child belongs to their aanganwadi
      const staffMember = await User.findById(req.user.id);
      if (!staffMember || child.aanganwadiCode !== staffMember.aanganwadiCode) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Calculate BMI
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    
    // Determine BMI category for children (simplified)
    let category;
    if (bmi < 16) category = "Underweight";
    else if (bmi < 25) category = "Normal";
    else if (bmi < 30) category = "Overweight";
    else category = "Obese";

    const bmiRecord = {
      date: date || new Date(),
      height,
      weight,
      bmi: Math.round(bmi * 10) / 10,
      category,
      recordedBy: req.user.id
    };

    child.bmiHistory.push(bmiRecord);
    await child.save();

    res.status(201).json({
      message: 'BMI record added successfully',
      bmiRecord
    });
  } catch (error) {
    console.error('Error adding BMI record:', error);
    res.status(500).json({ message: 'Failed to add BMI record' });
  }
};

// Get BMI history for a child
export const getBMIHistory = async (req, res) => {
  try {
    const { childId } = req.params;
    const child = await Child.findById(childId)
      .select('bmiHistory name')
      .populate('bmiHistory.recordedBy', 'name');

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    res.status(200).json({
      childName: child.name,
      bmiHistory: child.bmiHistory.sort((a, b) => new Date(a.date) - new Date(b.date))
    });
  } catch (error) {
    console.error('Error fetching BMI history:', error);
    res.status(500).json({ message: 'Failed to fetch BMI history' });
  }
};

// Delete a child (soft delete - mark as inactive)
export const deleteChild = async (req, res) => {
  try {
    const { childId } = req.params;
    
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    // Check permissions
    if (req.user.role === 'aanganwadi_staff') {
      // For aanganwadi staff, check if the child belongs to their aanganwadi
      const staffMember = await User.findById(req.user.id);
      if (!staffMember || child.aanganwadiCode !== staffMember.aanganwadiCode) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Soft delete - mark as inactive instead of permanently deleting
    const updatedChild = await Child.findByIdAndUpdate(
      childId,
      { 
        isActive: false, 
        deletedAt: new Date(),
        deletedBy: req.user.id
      },
      { new: true }
    );

    res.status(200).json({
      message: 'Child record deleted successfully',
      child: updatedChild
    });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ message: 'Failed to delete child' });
  }
};