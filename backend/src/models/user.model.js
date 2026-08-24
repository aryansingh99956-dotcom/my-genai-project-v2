 const mongoose = require("mongoose");

 const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: [true, "username already exists"],
        required: true
    },
    email: {
        type: String,
        required: [ true, "account already exists with this email" ],
        unique: true
    },
    password: {
        type: String,
        required: true
    }
 });

 const usermodel = mongoose.model("users"   , userSchema);

 module.exports = usermodel;