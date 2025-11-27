import { Donation, User, Inventory } from '../models/index.js';

// Create a new donation
export const createDonation = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);

    const {
      donorName,
      donorEmail,
      donorPhone,
      donorAddress,
      donationType,
      amount,
      paymentMethod,
      transactionId,
      itemDescription,
      quantity,
      condition
    } = req.body;

    // Validate required fields
    if (!donorName || !donorEmail || !donorPhone || !donationType) {
      return res.status(400).json({ 
        message: 'Missing required fields: donorName, donorEmail, donorPhone, donationType' 
      });
    }

    // Process uploaded images
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push({
          url: file.path,
          publicId: file.filename,
          format: file.mimetype
        });
      });
    }

    const donation = new Donation({
      donorName,
      donorEmail,
      donorPhone,
      donorAddress,
      donationType,
      amount: amount ? parseFloat(amount) : undefined,
      paymentMethod,
      transactionId,
      itemDescription,
      quantity: quantity ? parseInt(quantity) : undefined,
      condition,
      images,
      status: 'received'
    });

    await donation.save();
    
    // Automatically add non-money donations to inventory
    if (donationType !== 'money' && itemDescription && quantity) {
      try {
        const inventoryItem = new Inventory({
          itemType: donationType,
          itemName: itemDescription,
          itemDescription: itemDescription,
          category: donationType,
          totalQuantity: parseInt(quantity),
          availableQuantity: parseInt(quantity),
          allocatedQuantity: 0,
          condition: condition || 'good',
          sourceType: 'donation',
          sourceDonationId: donation._id,
          status: 'available',
          location: 'main_warehouse',
          addedBy: 'system',
          minimumStock: 5
        });

        await inventoryItem.save();
        console.log('Inventory item created for donation:', inventoryItem._id);
      } catch (inventoryError) {
        console.error('Error creating inventory item:', inventoryError);
        // Don't fail the donation if inventory creation fails
      }
    } else if (donationType === 'money' && amount) {
      // For money donations, create a financial inventory record
      try {
        const moneyInventoryItem = new Inventory({
          itemType: 'money',
          itemName: 'Monetary Donation',
          itemDescription: `₹${amount} donation from ${donorName}`,
          category: 'money',
          totalAmount: parseFloat(amount),
          availableAmount: parseFloat(amount),
          allocatedAmount: 0,
          condition: 'good',
          sourceType: 'donation',
          sourceDonationId: donation._id,
          status: 'available',
          location: 'fund_account',
          addedBy: 'system',
          minimumStock: 0
        });

        await moneyInventoryItem.save();
        console.log('Money inventory item created for donation:', moneyInventoryItem._id);
      } catch (inventoryError) {
        console.error('Error creating money inventory item:', inventoryError);
      }
    }
    
    res.status(201).json({
      message: 'Donation received successfully',
      donation
    });
  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ message: 'Failed to create donation', error: error.message });
  }
};

// Get all donations (for coordinators)
export const getAllDonations = async (req, res) => {
  try {
    const { status, donationType } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (donationType) filter.donationType = donationType;

    const donations = await Donation.find(filter)
      .populate('verifiedBy', 'name')
      .populate('distributedTo.coordinatorId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Failed to fetch donations' });
  }
};

// Get donation by ID
export const getDonationById = async (req, res) => {
  try {
    const { donationId } = req.params;
    
    const donation = await Donation.findById(donationId)
      .populate('verifiedBy', 'name email')
      .populate('distributedTo.coordinatorId', 'name email');

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    res.status(200).json(donation);
  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({ message: 'Failed to fetch donation' });
  }
};

// Verify donation (coordinators only)
export const verifyDonation = async (req, res) => {
  try {
    const { donationId } = req.params;
    const { notes } = req.body;

    if (req.user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Only coordinators can verify donations' });
    }

    const donation = await Donation.findByIdAndUpdate(
      donationId,
      {
        status: 'verified',
        verifiedBy: req.user.id,
        verificationDate: new Date(),
        notes
      },
      { new: true }
    );

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    res.status(200).json({
      message: 'Donation verified successfully',
      donation
    });
  } catch (error) {
    console.error('Error verifying donation:', error);
    res.status(500).json({ message: 'Failed to verify donation' });
  }
};

// Distribute donation to aanganwadi
export const distributeDonation = async (req, res) => {
  try {
    const { donationId } = req.params;
    const { aanganwadiCode, aanganwadiName } = req.body;

    if (req.user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Only coordinators can distribute donations' });
    }

    const donation = await Donation.findById(donationId);
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    if (donation.status !== 'verified') {
      return res.status(400).json({ message: 'Donation must be verified before distribution' });
    }

    donation.status = 'distributed';
    donation.distributedTo = {
      aanganwadiCode,
      aanganwadiName,
      coordinatorId: req.user.id,
      distributionDate: new Date()
    };

    await donation.save();

    res.status(200).json({
      message: 'Donation distributed successfully',
      donation
    });
  } catch (error) {
    console.error('Error distributing donation:', error);
    res.status(500).json({ message: 'Failed to distribute donation' });
  }
};

// Get donations for a specific aanganwadi
export const getDonationsByAanganwadi = async (req, res) => {
  try {
    const { aanganwadiCode } = req.params;
    
    const donations = await Donation.find({
      'distributedTo.aanganwadiCode': aanganwadiCode,
      status: 'distributed'
    })
    .populate('distributedTo.coordinatorId', 'name')
    .sort({ 'distributedTo.distributionDate': -1 });

    res.status(200).json(donations);
  } catch (error) {
    console.error('Error fetching aanganwadi donations:', error);
    res.status(500).json({ message: 'Failed to fetch donations' });
  }
};

// Get donation statistics
export const getDonationStats = async (req, res) => {
  try {
    const stats = await Donation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { 
            $sum: { 
              $cond: [{ $eq: ['$donationType', 'money'] }, '$amount', 0] 
            } 
          }
        }
      }
    ]);

    const typeStats = await Donation.aggregate([
      {
        $group: {
          _id: '$donationType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      statusStats: stats,
      typeStats: typeStats
    });
  } catch (error) {
    console.error('Error fetching donation stats:', error);
    res.status(500).json({ message: 'Failed to fetch donation statistics' });
  }
};

// Manually process existing donations into inventory
export const processDonationsToInventory = async (req, res) => {
  try {
    // Find all received donations that haven't been processed
    const donations = await Donation.find({
      status: 'received'
    });

    let processedCount = 0;
    
    for (const donation of donations) {
      // Check if this donation already has an inventory item
      const existingInventory = await Inventory.findOne({ sourceDonationId: donation._id });
      
      if (!existingInventory) {
        if (donation.donationType === 'money' && donation.amount) {
          // Process money donation
          const inventoryItem = new Inventory({
            itemType: 'money',
            itemName: 'Monetary Donation',
            itemDescription: `₹${donation.amount} donation from ${donation.donorName}`,
            category: 'money',
            totalAmount: donation.amount,
            availableAmount: donation.amount,
            allocatedAmount: 0,
            condition: 'good',
            sourceType: 'donation',
            sourceDonationId: donation._id,
            status: 'available',
            location: 'fund_account',
            addedBy: req.user ? req.user.id : 'system',
            minimumStock: 0
          });
          await inventoryItem.save();
          processedCount++;
        } else if (donation.donationType !== 'money' && donation.itemDescription && donation.quantity) {
          // Process physical item donation
          const inventoryItem = new Inventory({
            itemType: donation.donationType,
            itemName: donation.itemDescription,
            itemDescription: donation.itemDescription,
            category: donation.donationType,
            totalQuantity: donation.quantity,
            availableQuantity: donation.quantity,
            allocatedQuantity: 0,
            condition: donation.condition || 'good',
            sourceType: 'donation',
            sourceDonationId: donation._id,
            status: 'available',
            location: 'main_warehouse',
            addedBy: req.user ? req.user.id : 'system',
            minimumStock: 5
          });
          await inventoryItem.save();
          processedCount++;
        }
      }
    }

    res.status(200).json({
      message: `Successfully processed ${processedCount} donations into inventory`,
      processedCount
    });
  } catch (error) {
    console.error('Error processing donations to inventory:', error);
    res.status(500).json({ message: 'Failed to process donations to inventory' });
  }
};