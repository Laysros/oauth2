const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true,
        unique: true
    },
    clientSecret: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    redirectUris: {
        type: [String],
        required: true
    },
    grants: {
        type: [String],
        default: ['authorization_code']
    },
    allowedScopes: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Client', ClientSchema);
