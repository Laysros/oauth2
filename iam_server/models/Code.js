const mongoose = require('mongoose');

const CodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    clientId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    redirectUri: {
        type: String,
        required: true
    },
    scope: {
        type: [String],
        default: []
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model('Code', CodeSchema);
