import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    clientName: { type: String, required: true, trim: true, maxlength: 80 },
    assignee: { type: String, required: true, trim: true, maxlength: 80 },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Open', 'In progress', 'Completed'],
      default: 'Open'
    }
  },
  { timestamps: true }
);

export default mongoose.model('Request', requestSchema);