const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const NoteSchema = new Schema({
    user : {     //To make sure you see your own Notes not everybody else that's why user is being used
        type : Schema.ObjectId,
        ref : 'User'
    },
    title : {
        type : String,
        required : true
    },
    body : {
        type : String,
        required : true
    },
    createAt : {
        type : Date,
        default : Date.now()
    },
    updatedAt : {
        type : Date,
        default : Date.now()
    }
});


module.exports = mongoose.model('Note' , NoteSchema);