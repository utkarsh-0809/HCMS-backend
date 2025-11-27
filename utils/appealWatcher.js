import mongoose from 'mongoose';
import { Inventory } from '../models/index.js';

let changeStream = null;

export const startAppealWatcher = () => {
  try {
    // Get the Appeal collection
    const appealCollection = mongoose.connection.collection('appeals');
    
    // Create change stream to watch for updates
    changeStream = appealCollection.watch([
      {
        $match: {
          'operationType': 'update',
          'updateDescription.updatedFields.status': { $in: ['approved', 'partially_approved'] }
        }
      }
    ]);

    console.log('🔍 Appeal status watcher started - watching for database changes...');

    changeStream.on('change', async (change) => {
      try {
        console.log('🚨 Database change detected:', change.operationType);
        console.log('📄 Document ID:', change.documentKey._id);
        
        if (change.updateDescription && change.updateDescription.updatedFields.status) {
          const newStatus = change.updateDescription.updatedFields.status;
          console.log(`✅ Status changed to: ${newStatus}`);
          
          if (newStatus === 'approved' || newStatus === 'partially_approved') {
            console.log('🚀 Triggering auto-allocation for database change...');
            
            // Get the full appeal document
            const appealDoc = await appealCollection.findOne({ _id: change.documentKey._id });
            
            if (appealDoc) {
              console.log(`📋 Processing appeal: ${appealDoc.appealId || appealDoc._id}`);
              console.log('🔍 Appeal details:');
              console.log('   - approvedItems:', appealDoc.approvedItems);
              console.log('   - requestedItems:', appealDoc.requestedItems);
              
              // Use approvedItems if available, otherwise fall back to requestedItems
              let itemsToAllocate = [];
              if (appealDoc.approvedItems && appealDoc.approvedItems.length > 0) {
                itemsToAllocate = appealDoc.approvedItems;
                console.log('✅ Using approvedItems for allocation');
              } else if (appealDoc.requestedItems && appealDoc.requestedItems.length > 0) {
                itemsToAllocate = appealDoc.requestedItems;
                console.log('✅ Using requestedItems for allocation (no approvedItems found)');
              }
              
              console.log('📦 Items to allocate:', itemsToAllocate);
              
              if (itemsToAllocate.length === 0) {
                console.warn('⚠️ No items to allocate! Check if requestedItems or approvedItems are properly set.');
                console.log('💡 Tip: Make sure the appeal has requestedItems with proper itemType and amount/quantity fields.');
              } else {
                await allocateInventoryForAppeal(appealDoc, itemsToAllocate);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error processing database change:', error);
      }
    });

    changeStream.on('error', (error) => {
      console.error('❌ Change stream error:', error);
    });

  } catch (error) {
    console.error('❌ Error starting appeal watcher:', error);
  }
};

export const stopAppealWatcher = () => {
  if (changeStream) {
    changeStream.close();
    console.log('🔍 Appeal status watcher stopped');
  }
};

// Allocation logic (extracted from the model)
const allocateInventoryForAppeal = async (appealDoc, itemsToAllocate) => {
  try {
    console.log(`🚀 Starting allocation for ${itemsToAllocate.length} items...`);
    
    for (const item of itemsToAllocate) {
      try {
        console.log(`🔄 Processing item: ${item.itemType}, Amount/Quantity: ${item.amount || item.quantity}`);
        
        if (item.itemType === 'money' && item.amount) {
          // Find money inventory with enough available amount
          const moneyInventory = await Inventory.findOne({ 
            itemType: 'money',
            $expr: {
              $gte: [
                { $subtract: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$allocatedAmount', 0] }] },
                item.amount
              ]
            }
          });
          
          console.log(`💰 Money inventory found:`, moneyInventory ? `ID: ${moneyInventory._id}, Total: ₹${moneyInventory.totalAmount}, Allocated: ₹${moneyInventory.allocatedAmount || 0}` : 'None');
          
          if (moneyInventory) {
            const currentAvailable = (moneyInventory.totalAmount || 0) - (moneyInventory.allocatedAmount || 0);
            moneyInventory.allocatedAmount = (moneyInventory.allocatedAmount || 0) + item.amount;
            moneyInventory.availableAmount = (moneyInventory.totalAmount || 0) - moneyInventory.allocatedAmount;
            await moneyInventory.save();
            console.log(`✅ Allocated ₹${item.amount} from money inventory. Available: ₹${currentAvailable} → ₹${moneyInventory.availableAmount}`);
          } else {
            console.warn(`❌ Not enough money in inventory for ₹${item.amount}`);
          }
        } else if (item.quantity) {
          // Find item inventory with enough available quantity
          const itemInventory = await Inventory.findOne({ 
            itemType: item.itemType,
            $expr: {
              $gte: [
                { $subtract: [{ $ifNull: ['$totalQuantity', 0] }, { $ifNull: ['$allocatedQuantity', 0] }] },
                item.quantity
              ]
            }
          });
          
          console.log(`📦 Item inventory found:`, itemInventory ? `ID: ${itemInventory._id}, Total: ${itemInventory.totalQuantity}, Allocated: ${itemInventory.allocatedQuantity || 0}` : 'None');
          
          if (itemInventory) {
            const currentAvailable = (itemInventory.totalQuantity || 0) - (itemInventory.allocatedQuantity || 0);
            itemInventory.allocatedQuantity = (itemInventory.allocatedQuantity || 0) + item.quantity;
            itemInventory.availableQuantity = (itemInventory.totalQuantity || 0) - itemInventory.allocatedQuantity;
            await itemInventory.save();
            console.log(`✅ Allocated ${item.quantity} ${item.itemType}. Available: ${currentAvailable} → ${itemInventory.availableQuantity}`);
          } else {
            console.warn(`❌ Not enough ${item.itemType} in inventory for ${item.quantity} units`);
          }
        }
      } catch (err) {
        console.error(`❌ Error allocating ${item.itemType}:`, err);
      }
    }
    
    console.log(`🏁 Allocation complete for appeal: ${appealDoc.appealId || appealDoc._id}`);
  } catch (error) {
    console.error('❌ Error in allocateInventoryForAppeal:', error);
  }
};