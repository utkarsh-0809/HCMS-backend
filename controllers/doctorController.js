import {
  HealthRecord,
  Vaccination,
  User,
  Notification,
  Child
} from "../models/index.js";

// Get all aanganwadis for volunteer doctors to see
export const getAllAanganwadis = async (req, res) => {
  try {
    const { city } = req.query;
    
    // Get all Aanganwadis from the Aanganwadi collection
    const { Aanganwadi } = await import('../models/index.js');
    
    let query = {};
    if (city) {
      query.address = { $regex: city, $options: 'i' };
    }
    
    const aanganwadis = await Aanganwadi.find(query)
      .populate('coordinatorId', 'name email phone')
      .sort({ name: 1 });

    // Get child count and staff count for each aanganwadi
    const aanganwadiData = await Promise.all(
      aanganwadis.map(async (aanganwadi) => {
        const [childCount, staffCount] = await Promise.all([
          Child.countDocuments({ aanganwadiCode: aanganwadi.code, isActive: true }),
          User.countDocuments({ aanganwadiCode: aanganwadi.code, role: 'aanganwadi_staff' })
        ]);

        return {
          _id: aanganwadi._id,
          name: aanganwadi.name,
          address: aanganwadi.address,
          code: aanganwadi.code,
          staffCapacity: aanganwadi.staffCapacity,
          coordinator: aanganwadi.coordinatorId,
          childCount,
          staffCount,
          createdAt: aanganwadi.createdAt
        };
      })
    );

    res.status(200).json(aanganwadiData);
  } catch (error) {
    console.error('Error fetching all aanganwadis:', error);
    res.status(500).json({ message: 'Failed to fetch aanganwadis' });
  }
};

// Volunteer for an aanganwadi
export const volunteerForAanganwadi = async (req, res) => {
  try {
    const { aanganwadiCode } = req.body;
    const doctorId = req.user.id;

    // Check if aanganwadi exists
    const { Aanganwadi } = await import('../models/index.js');
    const aanganwadi = await Aanganwadi.findOne({ code: aanganwadiCode });
    if (!aanganwadi) {
      return res.status(404).json({ message: 'Aanganwadi not found' });
    }

    // Check if doctor is already volunteering for this aanganwadi
    const doctor = await User.findById(doctorId);
    if (doctor.volunteerAanganwadis && doctor.volunteerAanganwadis.includes(aanganwadiCode)) {
      return res.status(400).json({ message: 'Already volunteering for this Aanganwadi' });
    }

    // Add aanganwadi to doctor's volunteer list
    await User.findByIdAndUpdate(doctorId, {
      $addToSet: { volunteerAanganwadis: aanganwadiCode },
      isVolunteer: true
    });

    // Notify coordinator
    const notification = new Notification({
      recipientId: aanganwadi.coordinatorId,
      type: 'volunteer',
      message: `Dr. ${doctor.name} has volunteered for ${aanganwadi.name}`,
      relatedData: {
        doctorId: doctorId,
        aanganwadiId: aanganwadi._id
      }
    });
    await notification.save();

    res.status(200).json({ message: 'Successfully volunteered for Aanganwadi' });
  } catch (error) {
    console.error('Error volunteering for aanganwadi:', error);
    res.status(500).json({ message: 'Failed to volunteer for aanganwadi' });
  }
};

// Stop volunteering for an aanganwadi
export const stopVolunteering = async (req, res) => {
  try {
    const { aanganwadiCode } = req.body;
    const doctorId = req.user.id;

    await User.findByIdAndUpdate(doctorId, {
      $pull: { volunteerAanganwadis: aanganwadiCode }
    });

    res.status(200).json({ message: 'Stopped volunteering for Aanganwadi' });
  } catch (error) {
    console.error('Error stopping volunteer:', error);
    res.status(500).json({ message: 'Failed to stop volunteering' });
  }
};

// Get doctor's dashboard data
export const getDoctorDashboard = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const doctor = await User.findById(doctorId).select('-password');
    
    // Get volunteer aanganwadis with details
    const volunteerAanganwadis = [];
    if (doctor.volunteerAanganwadis && doctor.volunteerAanganwadis.length > 0) {
      const { Aanganwadi } = await import('../models/index.js');
      
      for (const code of doctor.volunteerAanganwadis) {
        const aanganwadi = await Aanganwadi.findOne({ code })
          .populate('coordinatorId', 'name email phone');
        
        if (aanganwadi) {
          const [childCount, staffCount] = await Promise.all([
            Child.countDocuments({ aanganwadiCode: code, isActive: true }),
            User.countDocuments({ aanganwadiCode: code, role: 'aanganwadi_staff' })
          ]);

          volunteerAanganwadis.push({
            ...aanganwadi.toObject(),
            childCount,
            staffCount
          });
        }
      }
    }

    res.status(200).json({
      doctor,
      volunteerAanganwadis,
      totalVolunteerAanganwadis: volunteerAanganwadis.length
    });
  } catch (error) {
    console.error('Error fetching doctor dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
};

// Get children for a specific aanganwadi (for volunteer doctors)
export const getAanganwadiChildren = async (req, res) => {
  try {
    const { aanganwadiCode } = req.params;
    
    const children = await Child.find({ 
      aanganwadiCode, 
      isActive: true 
    })
    .populate('healthRecords')
    .populate('vaccinationRecords')
    .populate('aanganwadiStaff', 'name email phone')
    .sort({ name: 1 });

    res.status(200).json(children);
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ message: 'Failed to fetch children' });
  }
};

// Get detailed child health data for doctors
export const getChildHealthDetails = async (req, res) => {
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
      .populate('aanganwadiStaff', 'name email phone aanganwadiName');

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    res.status(200).json(child);
  } catch (error) {
    console.error('Error fetching child health details:', error);
    res.status(500).json({ message: 'Failed to fetch child details' });
  }
};

// Add health record for a child (volunteer doctors)
export const addChildHealthRecord = async (req, res) => {
  try {
    const { childId } = req.params;
    const {
      diagnosis,
      treatment,
      prescription,
      notes
    } = req.body;

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can add health records' });
    }

    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    const healthRecord = new HealthRecord({
      childId,
      recordedBy: req.user.id,
      doctorId: req.user.id,
      diagnosis,
      treatment,
      prescription,
      notes,
      isManualUpload: false
    });

    await healthRecord.save();

    // Add to child's health records
    child.healthRecords.push(healthRecord._id);
    await child.save();

    // Notify aanganwadi staff
    const notification = new Notification({
      recipientId: child.aanganwadiStaff,
      type: 'health',
      message: `New health record added for ${child.name} by Dr. ${req.user.name}`,
      relatedData: {
        childId: child._id,
        healthRecordId: healthRecord._id
      }
    });
    await notification.save();

    res.status(201).json({
      message: 'Health record added successfully',
      healthRecord
    });
  } catch (error) {
    console.error('Error adding health record:', error);
    res.status(500).json({ message: 'Failed to add health record' });
  }
};

// Update doctor volunteer status
export const updateVolunteerStatus = async (req, res) => {
  try {
    const { isVolunteer } = req.body;
    
    const doctor = await User.findByIdAndUpdate(
      req.user.id,
      { isVolunteer },
      { new: true }
    ).select('-password');

    res.status(200).json({
      message: 'Volunteer status updated successfully',
      doctor
    });
  } catch (error) {
    console.error('Error updating volunteer status:', error);
    res.status(500).json({ message: 'Failed to update volunteer status' });
  }
};

// Get volunteer doctors
export const getVolunteerDoctors = async (req, res) => {
  try {
    const volunteers = await User.find({
      role: 'doctor',
      isVolunteer: true
    }).select('name email specialization phone');

    res.status(200).json(volunteers);
  } catch (error) {
    console.error('Error fetching volunteer doctors:', error);
    res.status(500).json({ message: 'Failed to fetch volunteer doctors' });
  }
};