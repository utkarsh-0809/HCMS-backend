import { User, Child, HealthRecord, Vaccination, Aanganwadi } from "../models/index.js";

// Get coordinator dashboard data
export const getCoordinatorDashboard = async (req, res) => {
  try {
    const coordinatorId = req.user.id;
    
    // Get coordinator details with assigned aanganwadi
    const coordinator = await User.findById(coordinatorId).select('-password');
    
    if (!coordinator || coordinator.role !== 'coordinator') {
      return res.status(403).json({ message: 'Access denied. Coordinator role required.' });
    }

    // Get the coordinator's aanganwadi (assuming one aanganwadi per coordinator)
    const aanganwadiCode = coordinator.assignedAanganwadis?.[0];
    let aanganwadi = null;
    let students = [];
    let staff = [];
    
    // Check if coordinator has aanganwadi setup info
    if (coordinator.aanganwadiSetup?.code) {
      aanganwadi = coordinator.aanganwadiSetup;
      const setupCode = coordinator.aanganwadiSetup.code;
      
      // Get staff for this aanganwadi
      staff = await User.find({ 
        aanganwadiCode: setupCode, 
        role: 'aanganwadi_staff' 
      }).select('-password');

      // Get students for this aanganwadi
      students = await Child.find({ 
        aanganwadiCode: setupCode, 
        isActive: true 
      })
      .populate('healthRecords')
      .populate('vaccinationRecords')
      .populate('aanganwadiStaff', 'name email phone');
      
    } else if (aanganwadiCode) {
      // Fallback: get aanganwadi info from staff members
      staff = await User.find({ 
        aanganwadiCode, 
        role: 'aanganwadi_staff' 
      }).select('-password');
      
      if (staff.length > 0) {
        const firstStaff = staff[0];
        aanganwadi = {
          name: firstStaff.aanganwadiName,
          address: firstStaff.aanganwadiAddress,
          code: firstStaff.aanganwadiCode
        };
      }

      // Get students for this aanganwadi
      students = await Child.find({ 
        aanganwadiCode, 
        isActive: true 
      })
      .populate('healthRecords')
      .populate('vaccinationRecords')
      .populate('aanganwadiStaff', 'name email phone');
    }

    // Get all volunteer doctors
    const volunteers = await User.find({
      role: 'doctor',
      isVolunteer: true
    }).select('name email specialization phone');

    res.status(200).json({
      coordinator,
      aanganwadi,
      students,
      volunteers,
      staff
    });

  } catch (error) {
    console.error('Error fetching coordinator dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
};

// Create/Setup Aanganwadi for Coordinator
export const createAanganwadi = async (req, res) => {
  try {
    const coordinatorId = req.user.id;
    const { name, address, code, staffCapacity } = req.body;

    // Validate required fields
    if (!name || !address || !code) {
      return res.status(400).json({ message: 'Name, address, and code are required' });
    }

    // Get coordinator
    const coordinator = await User.findById(coordinatorId);
    
    if (!coordinator || coordinator.role !== 'coordinator') {
      return res.status(403).json({ message: 'Access denied. Coordinator role required.' });
    }

    // Check if coordinator already has an aanganwadi
    if (coordinator.assignedAanganwadis && coordinator.assignedAanganwadis.length > 0) {
      return res.status(400).json({ message: 'Coordinator can only have one aanganwadi' });
    }

    // Check if aanganwadi code already exists in Aanganwadi collection
    const existingAanganwadi = await Aanganwadi.findOne({ code: code.toUpperCase() });

    if (existingAanganwadi) {
      return res.status(400).json({ message: 'Aanganwadi code already exists' });
    }

    // Create Aanganwadi document
    const newAanganwadi = await Aanganwadi.create({
      name,
      address,
      code: code.toUpperCase(),
      staffCapacity: staffCapacity || 10,
      coordinatorId: coordinator._id
    });

    // Update coordinator with assigned aanganwadi and setup info
    coordinator.assignedAanganwadis = [newAanganwadi.code];
    coordinator.aanganwadiSetup = {
      name: newAanganwadi.name,
      address: newAanganwadi.address,
      code: newAanganwadi.code,
      staffCapacity: newAanganwadi.staffCapacity
    };
    await coordinator.save();

    res.status(201).json({
      message: 'Aanganwadi setup successful',
      aanganwadi: newAanganwadi
    });

  } catch (error) {
    console.error('Error creating aanganwadi:', error);
    res.status(500).json({ message: 'Failed to create aanganwadi' });
  }
};

// Get all students in coordinator's aanganwadi
export const getCoordinatorStudents = async (req, res) => {
  try {
    const coordinatorId = req.user.id;
    
    const coordinator = await User.findById(coordinatorId);
    const aanganwadiCode = coordinator.assignedAanganwadis?.[0];
    
    if (!aanganwadiCode) {
      return res.status(400).json({ message: 'No aanganwadi assigned to coordinator' });
    }

    const students = await Child.find({ 
      aanganwadiCode, 
      isActive: true 
    })
    .populate('healthRecords')
    .populate('vaccinationRecords')
    .populate('aanganwadiStaff', 'name email phone')
    .sort({ name: 1 });

    res.status(200).json(students);

  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
};

// Get all staff in coordinator's aanganwadi
export const getCoordinatorStaff = async (req, res) => {
  try {
    const coordinatorId = req.user.id;
    
    const coordinator = await User.findById(coordinatorId);
    const aanganwadiCode = coordinator.assignedAanganwadis?.[0];
    
    if (!aanganwadiCode) {
      return res.status(400).json({ message: 'No aanganwadi assigned to coordinator' });
    }

    const staff = await User.find({ 
      aanganwadiCode, 
      role: 'aanganwadi_staff' 
    }).select('-password').sort({ name: 1 });

    res.status(200).json(staff);

  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ message: 'Failed to fetch staff' });
  }
};

// Get aanganwadi statistics
export const getAanganwadiStats = async (req, res) => {
  try {
    const coordinatorId = req.user.id;
    
    const coordinator = await User.findById(coordinatorId);
    const aanganwadiCode = coordinator.assignedAanganwadis?.[0];
    
    if (!aanganwadiCode) {
      return res.status(400).json({ message: 'No aanganwadi assigned to coordinator' });
    }

    // Get counts
    const [studentCount, staffCount, healthRecordCount, vaccinationCount] = await Promise.all([
      Child.countDocuments({ aanganwadiCode, isActive: true }),
      User.countDocuments({ aanganwadiCode, role: 'aanganwadi_staff' }),
      HealthRecord.countDocuments({ 
        childId: { $in: await Child.find({ aanganwadiCode, isActive: true }).distinct('_id') }
      }),
      Vaccination.countDocuments({ 
        childId: { $in: await Child.find({ aanganwadiCode, isActive: true }).distinct('_id') }
      })
    ]);

    // Get recent health records
    const recentHealthRecords = await HealthRecord.find({
      childId: { $in: await Child.find({ aanganwadiCode, isActive: true }).distinct('_id') }
    })
    .populate('childId', 'name')
    .populate('recordedBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(5);

    res.status(200).json({
      students: studentCount,
      staff: staffCount,
      healthRecords: healthRecordCount,
      vaccinations: vaccinationCount,
      recentHealthRecords
    });

  } catch (error) {
    console.error('Error fetching aanganwadi stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
};