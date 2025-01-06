const mongoose = require('mongoose');
mongoose.set('strictQuery' , false);
const session = require('express-session');

const mongoURI = 'mongodb+srv://rohit:notes-app@cluster01.avvckka.mongodb.net/?retryWrites=true&w=majority&appName=cluster01'

const connectDB = async() =>{
    try {
        const conn  = await mongoose.connect(process.env.MONGODB_URL)
        console.log(`Database Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(error);
    }
};


module.exports = connectDB;