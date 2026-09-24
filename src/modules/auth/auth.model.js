import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, returned) => {
        delete returned.password;
        return returned;
      },
    },
  },
);

export default mongoose.model('User', userSchema);
