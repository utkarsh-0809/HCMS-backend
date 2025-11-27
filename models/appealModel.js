import mongoose from "mongoose";

const AppealSchema = new mongoose.Schema(
  {
    appealId: { type: String, unique: true }, // Auto-generated unique ID
    
    // Appeal creator (coordinator)
    coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    aanganwadiCode: { type: String, required: true },
    aanganwadiName: { type: String, required: true },
    
    // Appeal details
    title: { type: String, required: true }, // Brief title of the appeal
    description: { type: String, required: true }, // Detailed description of need
    urgency: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    
    // Items being requested
    requestedItems: [{
      itemType: {
        type: String,
        enum: ["money", "clothes", "books", "toys", "food", "stationary", "medical_supplies"],
        required: true
      },
      // For money requests
      amount: { type: Number }, // Amount needed
      purpose: { type: String }, // What the money will be used for
      
      // For physical items
      itemName: { type: String },
      quantity: { type: Number },
      specification: { type: String }, // Size, age group, etc.
      reason: { type: String }, // Why this item is needed
      
      priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium"
      }
    }],
    
    // Justification and supporting documents
    justification: { type: String, required: true }, // Why this appeal is necessary
    supportingDocuments: [{
      filename: String,
      url: String,
      publicId: String,
      uploadDate: { type: Date, default: Date.now },
      documentType: { type: String }, // "assessment_report", "photos", "needs_analysis", etc.
    }],
    
    // Current situation at aanganwadi
    currentSituation: {
      numberOfChildren: { type: Number },
      currentStock: { type: String }, // Description of current inventory
      immediateNeed: { type: String }, // Most urgent requirements
      impactIfNotFulfilled: { type: String }
    },
    
    // Appeal status and processing
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "partially_approved", "rejected", "fulfilled"],
      default: "pending"
    },
    
    // Admin/reviewer details
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewDate: { type: Date },
    reviewComments: { type: String },
    
    // Approval details
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvalDate: { type: Date },
    approvalComments: { type: String },
    
    // Approved items (might be different from requested)
    approvedItems: [{
      itemType: String,
      amount: Number, // For money
      itemName: String, // For physical items
      quantity: Number,
      specification: String,
      notes: String
    }],
    
    // Fulfillment tracking
    fulfillmentStatus: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "partially_completed"],
      default: "not_started"
    },
    fulfilledItems: [{
      itemType: String,
      amount: Number,
      itemName: String,
      quantity: Number,
      fulfillmentDate: { type: Date },
      trackingNumber: String,
      notes: String
    }],
    
    // Timeline
    expectedFulfillmentDate: { type: Date },
    actualFulfillmentDate: { type: Date },
    
    // Communication
    statusUpdates: [{
      status: String,
      message: String,
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now }
    }],
    
    // Feedback after fulfillment
    coordinatorFeedback: {
      rating: { type: Number, min: 1, max: 5 },
      comments: String,
      receivedDate: Date,
      feedbackDate: Date
    },
    
    // Additional metadata
    tags: [String], // For categorization
    isArchived: { type: Boolean, default: false },
    archivedDate: { type: Date },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// Generate appeal ID
AppealSchema.pre('save', async function(next) {
  if (!this.appealId) {
    try {
      // Find the highest existing appealId
      const lastAppeal = await mongoose.model('Appeal')
        .findOne({}, { appealId: 1 })
        .sort({ appealId: -1 })
        .lean();
      
      let nextNumber = 1;
      if (lastAppeal && lastAppeal.appealId) {
        // Extract number from appealId (e.g., "APP000002" -> 2)
        const lastNumber = parseInt(lastAppeal.appealId.replace('APP', ''), 10);
        nextNumber = lastNumber + 1;
      }
      
      this.appealId = `APP${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating appealId:', error);
      // Fallback to timestamp-based ID if there's an error
      this.appealId = `APP${Date.now()}`;
    }
  }
  next();
});

// Add status update when status changes
AppealSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusUpdates.push({
      status: this.status,
      message: `Status changed to ${this.status}`,
      updatedBy: this.reviewedBy || this.approvedBy,
      timestamp: new Date()
    });
  }
  next();
});

// Track status changes in pre-save hook
AppealSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this._statusChanged = true;
    this._previousStatus = this.isNew ? null : this.get('status');
    console.log(`Status change detected: ${this._previousStatus} → ${this.status}`);
  }
  next();
});

// Simple auto-allocation when appeal status changes to approved
AppealSchema.post('save', async function(doc) {
  try {
    console.log(`Post-save hook triggered for appeal ${doc.appealId || doc._id}`);
    console.log(`Current status: ${doc.status}`);
    console.log(`Status changed: ${doc._statusChanged}`);
    
    // Trigger allocation if status is approved (regardless of change detection)
    if (doc.status === 'approved' || doc.status === 'partially_approved') {
      console.log(`🚀 Starting auto-allocation for appeal: ${doc.appealId || doc._id}`);
      
      const { Inventory } = await import('./index.js');
      
      // Get items to allocate
      const itemsToAllocate = doc.approvedItems || doc.requestedItems || [];
      console.log(`Items to allocate:`, itemsToAllocate);
      
      for (const item of itemsToAllocate) {
        try {
          console.log(`Processing item: ${item.itemType}, Amount/Quantity: ${item.amount || item.quantity}`);
          
          if (item.itemType === 'money' && item.amount) {
            // Find money inventory and reduce available amount
            const moneyInventory = await Inventory.findOne({ 
              itemType: 'money',
              $expr: {
                $gte: [
                  { $subtract: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$allocatedAmount', 0] }] },
                  item.amount
                ]
              }
            });
            
            console.log(`Money inventory found:`, moneyInventory);
            
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
            // Find item inventory and reduce available quantity
            const itemInventory = await Inventory.findOne({ 
              itemType: item.itemType,
              $expr: {
                $gte: [
                  { $subtract: [{ $ifNull: ['$totalQuantity', 0] }, { $ifNull: ['$allocatedQuantity', 0] }] },
                  item.quantity
                ]
              }
            });
            
            console.log(`Item inventory found:`, itemInventory);
            
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
      
      console.log(`🏁 Allocation complete for appeal: ${doc.appealId || doc._id}`);
    } else {
      console.log(`⏭️ Skipping allocation - status is: ${doc.status}`);
    }
  } catch (error) {
    console.error('❌ Error in post-save auto-allocation:', error);
  }
});

export const Appeal = mongoose.model("Appeal", AppealSchema);