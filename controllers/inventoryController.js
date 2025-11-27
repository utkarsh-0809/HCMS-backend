import { Inventory, User } from '../models/index.js';

// Create new inventory item
export const createInventoryItem = async (req, res) => {
  try {
    const {
      itemType,
      totalAmount,
      itemName,
      itemDescription,
      category,
      size,
      ageGroup,
      totalQuantity,
      condition,
      sourceType,
      sourceDonationId,
      location,
      expiryDate,
      minimumStock,
      notes
    } = req.body;

    const inventoryItem = new Inventory({
      itemType,
      totalAmount,
      itemName,
      itemDescription,
      category,
      size,
      ageGroup,
      totalQuantity,
      condition,
      sourceType,
      sourceDonationId,
      location,
      expiryDate,
      minimumStock,
      notes,
      updatedBy: req.user.id
    });

    await inventoryItem.save();

    res.status(201).json({
      message: 'Inventory item created successfully',
      item: inventoryItem
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ message: 'Failed to create inventory item' });
  }
};

// Get all inventory items
export const getAllInventoryItems = async (req, res) => {
  try {
    const { itemType, status, category, ageGroup } = req.query;
    
    let filter = {};
    if (itemType) filter.itemType = itemType;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (ageGroup) filter.ageGroup = ageGroup;

    const items = await Inventory.find(filter)
      .populate('updatedBy', 'name')
      .populate('sourceDonationId', 'donorName donationId')
      .sort({ createdAt: -1 });

    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({ message: 'Failed to fetch inventory items' });
  }
};

// Get inventory item by ID
export const getInventoryItemById = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const item = await Inventory.findById(itemId)
      .populate('updatedBy', 'name email')
      .populate('sourceDonationId', 'donorName donationId donationType');

    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.status(200).json(item);
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ message: 'Failed to fetch inventory item' });
  }
};

// Update inventory item
export const updateInventoryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const updateData = req.body;

    // Add updatedBy field
    updateData.updatedBy = req.user.id;
    updateData.lastUpdated = new Date();

    const item = await Inventory.findByIdAndUpdate(
      itemId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.status(200).json({
      message: 'Inventory item updated successfully',
      item
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ message: 'Failed to update inventory item' });
  }
};

// Allocate inventory for an appeal
export const allocateInventory = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { amount, quantity, appealId } = req.body;

    const item = await Inventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Check if enough stock is available
    if (item.itemType === 'money') {
      if (amount > item.availableAmount) {
        return res.status(400).json({ 
          message: 'Insufficient funds available',
          available: item.availableAmount,
          requested: amount
        });
      }
      item.allocatedAmount += amount;
    } else {
      if (quantity > item.availableQuantity) {
        return res.status(400).json({ 
          message: 'Insufficient quantity available',
          available: item.availableQuantity,
          requested: quantity
        });
      }
      item.allocatedQuantity += quantity;
    }

    item.updatedBy = req.user.id;
    await item.save();

    res.status(200).json({
      message: 'Inventory allocated successfully',
      item
    });
  } catch (error) {
    console.error('Error allocating inventory:', error);
    res.status(500).json({ message: 'Failed to allocate inventory' });
  }
};

// Release allocated inventory (when appeal is rejected or cancelled)
export const releaseInventory = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { amount, quantity } = req.body;

    const item = await Inventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    if (item.itemType === 'money') {
      item.allocatedAmount = Math.max(0, item.allocatedAmount - amount);
    } else {
      item.allocatedQuantity = Math.max(0, item.allocatedQuantity - quantity);
    }

    item.updatedBy = req.user.id;
    await item.save();

    res.status(200).json({
      message: 'Inventory released successfully',
      item
    });
  } catch (error) {
    console.error('Error releasing inventory:', error);
    res.status(500).json({ message: 'Failed to release inventory' });
  }
};

// Get low stock alerts
export const getLowStockAlerts = async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      $expr: {
        $and: [
          { $ne: ['$itemType', 'money'] },
          { $lte: ['$availableQuantity', '$minimumStock'] }
        ]
      }
    }).populate('updatedBy', 'name');

    res.status(200).json(lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    res.status(500).json({ message: 'Failed to fetch low stock alerts' });
  }
};

// Get inventory statistics
export const getInventoryStats = async (req, res) => {
  try {
    const stats = await Inventory.aggregate([
      {
        $group: {
          _id: '$itemType',
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$totalQuantity' },
          availableQuantity: { $sum: '$availableQuantity' },
          totalAmount: { $sum: '$totalAmount' },
          availableAmount: { $sum: '$availableAmount' }
        }
      }
    ]);

    const statusStats = await Inventory.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      itemTypeStats: stats,
      statusStats: statusStats
    });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({ message: 'Failed to fetch inventory statistics' });
  }
};

// Delete inventory item
export const deleteInventoryItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await Inventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Check if item has allocated stock
    if (item.allocatedQuantity > 0 || item.allocatedAmount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete item with allocated stock. Release allocations first.' 
      });
    }

    await Inventory.findByIdAndDelete(itemId);

    res.status(200).json({
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ message: 'Failed to delete inventory item' });
  }
};