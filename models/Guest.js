const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  side: { type: String, enum: ['Groom', 'Bride'], required: true },
  category: { type: String, enum: ['Family', 'Friends', 'Work'], required: true },
  invitedCount: { type: Number, required: true, default: 1 },
  confirmedCount: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Declined'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Guest', guestSchema);
