const { Router } = require("express");

const authController = require("../../controller/auth.controller");
const authUser = require("../middleware/auth.middleware");

const authRouter = Router();

authRouter.post(
    "/register",
    authController.registerUserController
);

authRouter.post(
    "/login",
    authController.loginUserController
);

authRouter.get(
    "/logout",
    authController.logoutUserController
);

authRouter.get(
    "/get-me",
    authUser.authUser,
    authController.getMeController
);

module.exports = authRouter;