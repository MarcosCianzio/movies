"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../entity/user");
const argon2_1 = __importDefault(require("argon2"));
const type_graphql_1 = require("type-graphql");
const uuid_1 = require("uuid");
const constants_1 = require("../../constants");
const User_1 = require("../../inputs/User");
const sendEmail_1 = require("../../utils/sendEmail");
const changePassword_1 = require("../../validators/changePassword");
const formatter_1 = require("../../validators/formatter");
const user_2 = require("../../validators/user");
let PathError = class PathError {
};
__decorate([
    type_graphql_1.Field(),
    __metadata("design:type", String)
], PathError.prototype, "path", void 0);
__decorate([
    type_graphql_1.Field(),
    __metadata("design:type", String)
], PathError.prototype, "message", void 0);
PathError = __decorate([
    type_graphql_1.ObjectType()
], PathError);
let UserResponse = class UserResponse {
};
__decorate([
    type_graphql_1.Field(() => [PathError], { nullable: true }),
    __metadata("design:type", Array)
], UserResponse.prototype, "errors", void 0);
__decorate([
    type_graphql_1.Field(() => user_1.User, { nullable: true }),
    __metadata("design:type", user_1.User)
], UserResponse.prototype, "user", void 0);
UserResponse = __decorate([
    type_graphql_1.ObjectType()
], UserResponse);
let AuthMutations = class AuthMutations {
    async changePassword(token, newPassword, { redis, req }) {
        try {
            await changePassword_1.changePasswordSchema.validate({ newPassword }, { abortEarly: false });
        }
        catch (error) {
            return formatter_1.format(error);
        }
        const key = constants_1.FORGET_PASSWORD_PREFIX + token;
        const userId = await redis.get(key);
        if (!userId) {
            return {
                errors: [
                    {
                        path: "token",
                        message: "Token invalid or expired",
                    },
                ],
            };
        }
        const user = await user_1.User.findOne({ id: parseInt(userId) });
        if (!user) {
            return {
                errors: [
                    {
                        path: "token",
                        message: "User no longer exists",
                    },
                ],
            };
        }
        await user_1.User.update({ id: parseInt(userId) }, { password: await argon2_1.default.hash(newPassword) });
        redis.del(key);
        req.session.userId = user.id;
        return {
            user,
        };
    }
    async forgotPassword(email, { redis }) {
        const user = await user_1.User.findOne({ email });
        if (!user) {
            return false;
        }
        const token = uuid_1.v4();
        redis.set(constants_1.FORGET_PASSWORD_PREFIX + token, user.id, "ex", 1000 * 60 * 60 * 24 * 3);
        await sendEmail_1.sendEmail(email, `<a href="http://localhost:3000/change-password/${token}">reset password</a>`, "Change password");
        return true;
    }
    async register(options, { req }) {
        try {
            await user_2.userSchema.validate(options, { abortEarly: false });
        }
        catch (error) {
            return formatter_1.format(error);
        }
        const userAlreadyExist = await user_1.User.findOne({ username: options.username });
        if (userAlreadyExist) {
            return {
                errors: [
                    {
                        path: "username",
                        message: "Username already exists",
                    },
                ],
            };
        }
        const hashedPassword = await argon2_1.default.hash(options.password);
        const user = await user_1.User.create({
            email: options.email,
            username: options.username,
            password: hashedPassword,
        }).save();
        req.session.userId = user.id;
        return { user };
    }
    async login(usernameOrEmail, password, { req }) {
        const isEmail = usernameOrEmail.includes("@");
        const user = await user_1.User.findOne(isEmail
            ? { email: usernameOrEmail }
            : {
                username: usernameOrEmail,
            });
        if (!user) {
            return {
                errors: [
                    {
                        path: "usernameOrEmail",
                        message: `${isEmail ? "Email" : "Username"} doesn't exist`,
                    },
                ],
            };
        }
        const valid = await argon2_1.default.verify(user.password, password);
        if (!valid) {
            return {
                errors: [
                    {
                        path: "password",
                        message: "Password incorrect",
                    },
                ],
            };
        }
        req.session.userId = user.id;
        return { user };
    }
    logout({ req, res }) {
        return new Promise((resolve) => req.session.destroy((err) => {
            res.clearCookie("qid");
            if (err) {
                resolve(false);
                return;
            }
            resolve(true);
        }));
    }
};
__decorate([
    type_graphql_1.Mutation(() => UserResponse),
    __param(0, type_graphql_1.Arg("token")),
    __param(1, type_graphql_1.Arg("newPassword")),
    __param(2, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AuthMutations.prototype, "changePassword", null);
__decorate([
    type_graphql_1.Mutation(() => Boolean),
    __param(0, type_graphql_1.Arg("email")),
    __param(1, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthMutations.prototype, "forgotPassword", null);
__decorate([
    type_graphql_1.Mutation(() => UserResponse),
    __param(0, type_graphql_1.Arg("options")),
    __param(1, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [User_1.UsernamePassword, Object]),
    __metadata("design:returntype", Promise)
], AuthMutations.prototype, "register", null);
__decorate([
    type_graphql_1.Mutation(() => UserResponse),
    __param(0, type_graphql_1.Arg("usernameOrEmail")),
    __param(1, type_graphql_1.Arg("password")),
    __param(2, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AuthMutations.prototype, "login", null);
__decorate([
    type_graphql_1.Mutation(() => Boolean),
    __param(0, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthMutations.prototype, "logout", null);
AuthMutations = __decorate([
    type_graphql_1.Resolver(user_1.User)
], AuthMutations);
exports.AuthMutations = AuthMutations;
//# sourceMappingURL=auth.js.map