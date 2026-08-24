const userModel = require("../src/models/user.model"); 
const bcrypt = require("bcryptjs");  
const jwt =  require("jsonwebtoken");
const tokenBlacklistModel = require("../src/models/blacklist.model");

/** 
 * @name registerUserController
 * @description register a new user, expects username, email and password in the request body
 * @access Public
 */

async function registerUserController(req, res) {
    console.log("REGISTER REQUEST RECEIEVED", req.body);
    const { username, email, password } = req.body;

    if (!username || !email || !password) {

        return res.status(400).json({ message: "all fields are required" });
    }

    const isUserAltreadyExists = await userModel.findOne({ $or: [ { email }, { username } ]
     });

     if (isUserAltreadyExists) {

        return res.status(400).json({ message: "account already exists with this email or username" });
     }

     const hash = await bcrypt.hash(password, 10);

     const user = await userModel.create({ 
         username,
         email,
         password: hash });
    
        const token = jwt.sign({ userId: user._id, username: user.username },
        process.env.JWT_SECRET, { expiresIn: "1d" });


        res.cookie("token", token)


        res.status(201).json({ message: "User registered successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    }

        /** 
         * @name loginUserController
         * @description login a user, expects email and password in the request body
         * @access Public
         */
        async function loginUserController(req, res) {
   

            const { email, password } = req.body;
            console.log("LOGIN EMAIL:",email);
            console.log("LOGIN PASSWORD RECEIVED:", !!password);
            const user = await userModel.findOne({ email });
            console.log("USER FOUND:", !!user);

            if (!user) {
                return res.status(400).json({ message: "Invalid email or password" });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);

            console.log("PASSWORD VALID:",isPasswordValid);

            if (!isPasswordValid) {
                return res.status(400).json({ message: "Invalid email or password" });
            }

            const token = jwt.sign({ userId: user._id, username: user.username },
                process.env.JWT_SECRET, { expiresIn: "1d" });

            res.cookie("token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000
});
            res.status(200).json({ message: "User logged in successfully",
                user: {
                    id: user._id,       
                    username: user.username,
                    email: user.email
        }
    });
}

/**
 * @name 
 * @description logout a user, clear the token from the user cookie and add the token in blacklist
 * @access Public
 */

async function logoutUserController(req, res) {
    console.log("cookies:", req.cookies);
    const token = req.cookies.token;

    if (token) {
        await tokenBlacklistModel.create({ token });
    }
        res.clearCookie("token");

        res.status(200).json({
             message: "User logged out successfully" });
    }


    /**
     * @name getMeController
     * @description get the current logged in user details.
     * @access Private
     */

    async function getMeController(req, res) {
        const user = await userModel.findById(req.user.userId);

        res.status(200).json({
            message: "User details fetched successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    }


            
                   



module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController
};
