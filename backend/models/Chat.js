const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  analysisId: { 
    type: String, 
    required: true, 
    index: true 
  },
  messages: [{
    id: { 
      type: String, 
      required: true 
    },
    type: { 
      type: String, 
      enum: ['user', 'ai', 'error'], 
      required: true 
    },
    content: { 
      type: String, 
      required: true 
    },
    contexts: [{ 
      id: String, 
      name: String, 
      type: { 
        type: String, 
        enum: ['data', 'pivot', 'visualization', 'report'] 
      },
      data: mongoose.Schema.Types.Mixed 
    }],
    timestamp: { 
      type: Date, 
      default: Date.now 
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  // Add compound index for efficient queries
  indexes: [
    { userId: 1, analysisId: 1 }
  ]
});

// Update the updatedAt field before saving
chatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Update the updatedAt field before updating
chatSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Instance method to add a message
chatSchema.methods.addMessage = function(messageData) {
  this.messages.push({
    id: messageData.id || Date.now().toString(),
    type: messageData.type,
    content: messageData.content,
    contexts: messageData.contexts || [],
    timestamp: messageData.timestamp || new Date()
  });
  return this.save();
};

// Static method to find or create chat
chatSchema.statics.findOrCreate = async function(userId, analysisId) {
  let chat = await this.findOne({ userId, analysisId });
  
  if (!chat) {
    chat = new this({
      userId,
      analysisId,
      messages: []
    });
    await chat.save();
  }
  
  return chat;
};

// Static method to get recent chats for a user
chatSchema.statics.getRecentChats = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('analysisId updatedAt messages')
    .populate('analysisId', 'fileName');
};

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat; 