const jwt = require("jsonwebtoken");
const tokenBlacklistModel = require("../models/blacklist.model");



async function authUser(req, res, next){
    console.log("get-me cookies:", req.cookies);
    const token = req.cookies.token;    

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const isBlacklisted = await tokenBlacklistModel.findOne({ token });
    if (isBlacklisted) {
        return res.status(401).json({ message: "token is invalid." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("decoded token:", decoded);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

}


module.exports = {
    authUser
};

        