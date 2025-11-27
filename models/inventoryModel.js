import mongoose from "mongoose";

const InventorySchema = new mongoose.Schema(
  {
    itemId: { type: String, unique: true }, // Auto-generated unique ID
    itemType: {
      type: String,
      enum: ["money", "clothes", "books", "toys", "food", "stationary", "medical_supplies"],
      required: true,
    },
    
    // For monetary inventory
    totalAmount: { type: Number, default: 0 }, // Total money available
    allocatedAmount: { type: Number, default: 0 }, // Money allocated to appeals
    availableAmount: { type: Number, default: 0 }, // Available for new appeals
    
    // For physical items
    itemName: { type: String }, // e.g., "Children's Books", "Winter Clothes"
    itemDescription: { type: String },
    category: { type: String }, // Subcategory like "picture books", "t-shirts"
    size: { type: String }, // For clothes: S, M, L, XL
    ageGroup: { type: String }, // "0-2 years", "3-5 years", "6-12 years"
    
    totalQuantity: { type: Number, default: 0 }, // Total items in stock
    allocatedQuantity: { type: Number, default: 0 }, // Items allocated to appeals
    availableQuantity: { type: Number, default: 0 }, // Available for new appeals
    
    condition: { type: String, enum: ["new", "good", "fair"] },
    
    // Source tracking
    sourceType: {
      type: String,
      enum: ["donation", "purchase", "transfer"],
      default: "donation"
    },
    sourceDonationId: { type: mongoose.Schema.Types.ObjectId, ref: "Donation" },
    
    // Storage location
    location: { type: String, default: "Main Office" },
    
    // Expiry for perishable items
    expiryDate: { type: Date },
    
    // Item status
    status: {
      type: String,
      enum: ["available", "low_stock", "out_of_stock", "expired"],
      default: "available"
    },
    
    // Minimum stock alert
    minimumStock: { type: Number, default: 5 },
    
    // Tracking
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // Images
    images: [{
      url: String,
      publicId: String,
      format: String
    }],
    
    notes: { type: String }
  },
  { timestamps: true }
);

// Generate inventory item ID
InventorySchema.pre('save', async function(next) {
  if (!this.itemId) {
    const count = await mongoose.model('Inventory').countDocuments();
    this.itemId = `INV${String(count + 1).padStart(6, '0')}`;
  }
  
  // Auto-calculate available amounts/quantities
  if (this.itemType === 'money') {
    this.availableAmount = this.totalAmount - this.allocatedAmount;
  } else {
    this.availableQuantity = this.totalQuantity - this.allocatedQuantity;
  }
  
  // Auto-update status based on stock levels
  if (this.itemType !== 'money') {
    if (this.availableQuantity === 0) {
      this.status = 'out_of_stock';
    } else if (this.availableQuantity <= this.minimumStock) {
      this.status = 'low_stock';
    } else {
      this.status = 'available';
    }
  }
  
  this.lastUpdated = new Date();
  next();
});

export const Inventory = mongoose.model("Inventory", InventorySchema);