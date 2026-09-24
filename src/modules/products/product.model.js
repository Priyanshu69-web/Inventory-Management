import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
  },
  { timestamps: true },
);

productSchema.index({ category: 1 });
productSchema.index({ name: 1 });

export default mongoose.model('Product', productSchema);
