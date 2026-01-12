const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sharedWith: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    type: {
        type: String, // MIME type or extension
        required: true
    },
    content: {
        type: String, // Mock content
        default: 'This is dummy content'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('File', FileSchema);
