import { Appeal, User, Inventory, Notification } from '../models/index.js';

// Create a new appeal (coordinators only)
export const createAppeal = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Only coordinators can create appeals' });
    }

    const {
      title,
      description,
      urgency,
      requestedItems,
      justification,
      currentSituation,
      expectedFulfillmentDate
    } = req.body;

    // Get coordinator's aanganwadi details
    const coordinator = await User.findById(req.user.id);
    console.log('Coordinator details:', {
      id: coordinator._id,
      name: coordinator.name,
      aanganwadiCode: coordinator.aanganwadiCode,
      aanganwadiSetup: coordinator.aanganwadiSetup,
      assignedAanganwadis: coordinator.assignedAanganwadis
    });
    
    const aanganwadiCode = coordinator.aanganwadiCode || 
                          coordinator.aanganwadiSetup?.code || 
                          coordinator.assignedAanganwadis?.[0];
    const aanganwadiName = coordinator.aanganwadiName || 
                          coordinator.aanganwadiSetup?.name;
    
    console.log('Resolved aanganwadi:', { aanganwadiCode, aanganwadiName });
    
    if (!aanganwadiCode) {
      return res.status(400).json({ message: 'Coordinator must be assigned to an aanganwadi' });
    }

    const appeal = new Appeal({
      coordinatorId: req.user.id,
      aanganwadiCode: aanganwadiCode,
      aanganwadiName: aanganwadiName || `Aanganwadi ${aanganwadiCode}`,
      title,
      description,
      urgency,
      requestedItems,
      justification,
      currentSituation,
      expectedFulfillmentDate,
      status: 'pending'
    });

    await appeal.save();

    // Create notification for admins
    const adminUsers = await User.find({ role: 'admin' });
    for (const admin of adminUsers) {
      await Notification.create({
        userId: admin._id,
        title: 'New Appeal Submitted',
        message: `${coordinator.name} has submitted a new appeal: ${title}`,
        type: 'appeal',
        relatedId: appeal._id
      });
    }

    res.status(201).json({
      message: 'Appeal created successfully',
      appeal
    });
  } catch (error) {
    console.error('Error creating appeal:', error);
    res.status(500).json({ message: 'Failed to create appeal' });
  }
};

// Get all appeals (admins see all, coordinators see their own)
export const getAllAppeals = async (req, res) => {
  try {
    const { status, urgency, aanganwadiCode } = req.query;
    
    let filter = {};
    
    // Coordinators can only see their own appeals
    if (req.user.role === 'coordinator') {
      filter.coordinatorId = req.user.id;
    }
    
    if (status) filter.status = status;
    if (urgency) filter.urgency = urgency;
    if (aanganwadiCode) filter.aanganwadiCode = aanganwadiCode;

    const appeals = await Appeal.find(filter)
      .populate('coordinatorId', 'name email aanganwadiCode')
      .populate('reviewedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(appeals);
  } catch (error) {
    console.error('Error fetching appeals:', error);
    res.status(500).json({ message: 'Failed to fetch appeals' });
  }
};

// Get appeal by ID
export const getAppealById = async (req, res) => {
  try {
    const { appealId } = req.params;
    
    const appeal = await Appeal.findById(appealId)
      .populate('coordinatorId', 'name email phone aanganwadiCode')
      .populate('reviewedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('statusUpdates.updatedBy', 'name');

    if (!appeal) {
      return res.status(404).json({ message: 'Appeal not found' });
    }

    // Check access permissions
    if (req.user.role === 'coordinator' && appeal.coordinatorId._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json(appeal);
  } catch (error) {
    console.error('Error fetching appeal:', error);
    res.status(500).json({ message: 'Failed to fetch appeal' });
  }
};

// Update appeal status (admins only)
export const updateAppealStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update appeal status' });
    }

    const { appealId } = req.params;
    const { status, reviewComments, approvedItems } = req.body;

    const appeal = await Appeal.findById(appealId);
    if (!appeal) {
      return res.status(404).json({ message: 'Appeal not found' });
    }

    // Update appeal - the post-save hook will handle inventory allocation automatically
    appeal.status = status;
    appeal.reviewedBy = req.user.id;
    appeal.reviewDate = new Date();
    appeal.reviewComments = reviewComments;

    if (status === 'approved' || status === 'partially_approved') {
      appeal.approvedBy = req.user.id;
      appeal.approvalDate = new Date();
      appeal.approvedItems = approvedItems || appeal.requestedItems;
    }

    // Save the appeal - this will trigger the post-save hook for auto-allocation
    await appeal.save();

    // Create notification for coordinator
    await Notification.create({
      userId: appeal.coordinatorId,
      title: 'Appeal Status Updated',
      message: `Your appeal "${appeal.title}" has been ${status}`,
      type: 'appeal_update',
      relatedId: appeal._id
    });

    res.status(200).json({
      message: 'Appeal status updated successfully',
      appeal
    });
  } catch (error) {
    console.error('Error updating appeal status:', error);
    res.status(500).json({ message: 'Failed to update appeal status' });
  }
};

// Upload supporting documents
export const uploadSupportingDocuments = async (req, res) => {
  try {
    const { appealId } = req.params;
    const files = req.files; // Assuming multer middleware

    const appeal = await Appeal.findById(appealId);
    if (!appeal) {
      return res.status(404).json({ message: 'Appeal not found' });
    }

    // Check access permissions
    if (req.user.role === 'coordinator' && appeal.coordinatorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Process uploaded files
    const supportingDocuments = files.map(file => ({
      filename: file.originalname,
      url: file.path,
      publicId: file.filename,
      documentType: req.body.documentType || 'general',
      uploadDate: new Date()
    }));

    appeal.supportingDocuments.push(...supportingDocuments);
    await appeal.save();

    res.status(200).json({
      message: 'Documents uploaded successfully',
      documents: supportingDocuments
    });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ message: 'Failed to upload documents' });
  }
};

// Update fulfillment status
export const updateFulfillmentStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update fulfillment status' });
    }

    const { appealId } = req.params;
    const { fulfillmentStatus, fulfilledItems, actualFulfillmentDate } = req.body;

    const appeal = await Appeal.findById(appealId);
    if (!appeal) {
      return res.status(404).json({ message: 'Appeal not found' });
    }

    appeal.fulfillmentStatus = fulfillmentStatus;
    if (fulfilledItems) {
      appeal.fulfilledItems = fulfilledItems;
    }
    if (actualFulfillmentDate) {
      appeal.actualFulfillmentDate = actualFulfillmentDate;
    }

    await appeal.save();

    // Create notification for coordinator
    await Notification.create({
      userId: appeal.coordinatorId,
      title: 'Appeal Fulfillment Update',
      message: `Fulfillment status for "${appeal.title}" updated to ${fulfillmentStatus}`,
      type: 'fulfillment_update',
      relatedId: appeal._id
    });

    res.status(200).json({
      message: 'Fulfillment status updated successfully',
      appeal
    });
  } catch (error) {
    console.error('Error updating fulfillment status:', error);
    res.status(500).json({ message: 'Failed to update fulfillment status' });
  }
};

// Submit coordinator feedback
export const submitCoordinatorFeedback = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { rating, comments, receivedDate } = req.body;

    const appeal = await Appeal.findById(appealId);
    if (!appeal) {
      return res.status(404).json({ message: 'Appeal not found' });
    }

    // Check if coordinator owns this appeal
    if (appeal.coordinatorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    appeal.coordinatorFeedback = {
      rating,
      comments,
      receivedDate,
      feedbackDate: new Date()
    };

    await appeal.save();

    res.status(200).json({
      message: 'Feedback submitted successfully',
      appeal
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
};

// Get appeal statistics
export const getAppealStats = async (req, res) => {
  try {
    const statusStats = await Appeal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const urgencyStats = await Appeal.aggregate([
      {
        $group: {
          _id: '$urgency',
          count: { $sum: 1 }
        }
      }
    ]);

    const aanganwadiStats = await Appeal.aggregate([
      {
        $group: {
          _id: '$aanganwadiCode',
          count: { $sum: 1 },
          aanganwadiName: { $first: '$aanganwadiName' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      statusStats,
      urgencyStats,
      aanganwadiStats
    });
  } catch (error) {
    console.error('Error fetching appeal stats:', error);
    res.status(500).json({ message: 'Failed to fetch appeal statistics' });
  }
};