const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");
const Token = require("../models/token");
const Tags = require("../models/tags");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const async = require("async");
const middleware = require("../middleware");
const NodeGeocoder = require("node-geocoder");
const iplocate = require('node-iplocate');
const mongoose = require('mongoose');

const loginRegExp = RegExp("^[a-zA-Z0-9_-]{3,20}$");
const emailRegExp = RegExp("^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$");
const passwordRegExp = RegExp("(?!^[0-9]*$)(?!^[a-zA-Z]*$)^([a-zA-Z0-9]{6,15})$");

var options = {
	provider: 'google',
	httpAdapter: 'https',
	apiKey: 'AIzaSyBxM1Dxy_gcBhgoCKoSAgfCL6TjwGf2dQE',
	formatter: null
};
var geocoder = NodeGeocoder(options);

//LANDING PAGE
router.get("/", (req, res) => {
	res.render("landing");
});

router.get("/gettags", middleware.isLoggedIn, (req, res) => {
	Tags.find((err, tags) => {
		if (err) {
			console.log(err);
		} else {
			var ret = [];
			tags.forEach((tag) => {
				ret.push(tag.text);
			});
			res.json(ret);
		}
	});
});

// REGISTER PAGE ROUTE
router.get("/register", middleware.checkIfLogged, (req, res) => {
	res.render("register");
});

// ADDING REGISTERED USER DATA TO THE DB
router.post("/register", middleware.checkIfLogged, (req, res) => {
	if (!req.body.email || !req.body.password ||
		!req.body.username || !req.body.firstname ||
		!req.body.lastname) {
		req.flash("error", "Please fill in all the required fields!");
		return res.redirect("/register");
	}
	if (!loginRegExp.test(req.body.firstname) || !loginRegExp.test(req.body.lastname) || !loginRegExp.test(req.body.username)) {
		req.flash("error", "Please make sure you've entered a correct username, First Name of Last Name");
		return res.redirect("/register");
	}
	if (!emailRegExp.test(req.body.email)) {
		req.flash("error", "Please make sure you've entered a correct email address!");
		return res.redirect("/register");
	}
	if (!passwordRegExp.test(req.body.password)) {
		req.flash("error", "Please make sure your password contains at least 6 characters, 1 digit and 1 letter of any register");
		return res.redirect("/register");
	}
	var email = req.sanitize(req.body.email);
	var username = req.sanitize(req.body.username);
	var firstname = req.sanitize(req.body.firstname);
	var lastname = req.sanitize(req.body.lastname);
	var reallocationname = "Kyiv";
	var reallatitude = 50.4501;
	var reallongitude = 30.5234;

	var coords = {};
	geocoder.geocode(req.body.location, (err, data) => {
		if (!data) {
			var newUser = new User({
				username: username,
				email: email,
				lastname: lastname,
				firstname: firstname,
				reallocationname: reallocationname,
				reallocation: {
					type: "Point",
					coordinates: [reallongitude, reallatitude]
				},
				interests: [{
					text: "dating"
				}],
				hasLocation: false
			});
			newUser.location = undefined;
		} else {
			if (err) {
				console.log(err);
				req.flash("error", "Invalid address");
				return res.redirect("back");
			} else {
				coords.lat = data[0].latitude;
				coords.lng = data[0].longitude;
				coords.location = data[0].city;
				var newUser = new User({
					username: username,
					email: email,
					lastname: lastname,
					firstname: firstname,
					reallocationname: reallocationname,
					reallocation: {
						type: "Point",
						coordinates: [reallongitude, reallatitude]
					},
					locationname: coords.location,
					location: {
						type: "Point",
						coordinates: [coords.lng, coords.lat]
					},
					interests: [{
						text: "dating"
					}],
					hasLocation: true
				});
			}
		}

		User.findOne({
			email: email
		}, (err, user) => {
			if (user) {
				req.flash("error", "User with this email already exists! Please provide a different email address.");
				return res.redirect("/register");
			}
			User.register(newUser, req.body.password, (err, user) => {
				if (err) {
					console.log(err);
					req.flash("error", err.message);
					return res.redirect("/register");
				}
				var newToken = new Token({
					_userId: user._id,
					token: crypto.randomBytes(16).toString('hex')
				});
				Token.create(newToken, (err, token) => {
					if (err) {
						req.flash("error", err.message);
						return res.redirect("/register");
					}
					var transporter = nodemailer.createTransport({
						service: 'sendgrid',
						auth: {
							user: "steve.vovchyna@gmail.com",
							pass: "omtMovBe7sEwdz_6KCHz"
						}
					});
					// User.schema.index({location: "2dsphere"}, {sparse: true});
					// User.schema.index({reallocation: "2dsphere"}, {sparse: true});
					var mailOptions = {
						from: 'matcha.42.svovchyn@gmail.com',
						to: req.sanitize(user.email),
						subject: 'Account Verification Token',
						text: 'Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/localhost:3000\/verification\/' + token.token + '.\n'
					};
					transporter.sendMail(mailOptions, (err) => {
						if (err) {
							req.flash("error", err.message);
							return res.redirect("/register");
						} else {
							req.flash('success', 'A verification email has been sent to ' + newUser.email + '.');
							return res.redirect("/login");
						}
					});
				});
			});
		});
	});
});

//VERIFICATION ROUTE
router.get("/verification/:token", middleware.checkIfLogged, (req, res) => {
	Token.findOne({
		token: req.sanitize(req.params.token)
	}, (err, token) => {
		if (!token) {
			req.flash("error", "Invalid link! Please recheck your email");
			return res.redirect("/login");
		}
		User.findOne({
			_id: token._userId
		}, (err, user) => {
			if (!user) {
				req.flash("error", "There's no user with the corresponding token - please check your link again!");
				return res.redirect("/login");
			}
			if (user.isVerified) {
				req.flash("success", "You are already verified! Please, log in!");
				return res.redirect("/login");
			}
			user.isVerified = true;
			if (!user.hasLocation) {
				user.location = undefined;
			}
			if (!user.reallocation.coordinates[0]) {
				user.reallocation = undefined;
			}
			user.save((err) => {
				if (err) {
					req.flash("error", err.message);
					return res.redirect("/login");
				} else {
					req.flash("success", "Your account has been verified! You can now log in!");
					res.redirect("/login");
				}
			});
		});
	});
});

//LOGIN PAGE ROUTE
router.get("/login", middleware.checkIfLogged, (req, res) => {
	mongoose.connect("mongodb://localhost/matcha", {useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true, autoIndex: true});
	res.render("login");
});

// 42 AUTH ROUTES
router.get('/auth/42', middleware.checkIfLogged, passport.authenticate('42'));

router.get('/auth/42/callback',
	passport.authenticate('42', {
		failureRedirect: '/login'
	}), (req, res) => {
		// Successful authentication, redirect home.
		res.redirect('/feed/research');
	});

// GITHUB AUTH ROUTES
router.get('/auth/github', middleware.checkIfLogged, passport.authenticate('github'));

router.get('/auth/github/callback',
	passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
	// Successful authentication, redirect home.
		res.redirect('/feed/research');
});


//AUTH ROUTE
router.post("/login", middleware.checkIfLogged, middleware.ifVerified, middleware.location, passport.authenticate("local", {
	successRedirect: "/feed/research",
	failureRedirect: "/login",
	failureFlash: true
}));

//LOGOUT ROUTE
router.get("/logout", (req, res) => {
	req.logout();
	req.flash("success", "Logged you out!");
	res.redirect("/");
});

//RESET PASSWORD ROUTE
router.get("/forgot", (req, res) => {
	res.render("forgot");
});

router.post('/forgot', (req, res, next) => {
	async.waterfall([
		(done) => {
			crypto.randomBytes(20, (err, buf) => {
				var token = buf.toString('hex');
				done(err, token);
			});
		},
		(token, done) => {
			if (!req.body.email) {
				req.flash('error', 'Please fill in the field.');
				return res.redirect('/forgot');
			}
			User.findOne({
				email: req.sanitize(req.body.email)
			}, (err, user) => {
				if (!user) {
					req.flash('error', 'No account with that email address exists.');
					return res.redirect('/forgot');
				}
				if (user.intra_id) {
					req.flash('error', 'Unfortunately, this feature is for non-OAuth users only');
					return res.redirect('/forgot');
				}
				user.passwordResetToken = token;
				user.passwordResetExpires = Date.now() + 3600000; // 1 hour
				if (!user.hasLocation) {
					user.location = undefined;
				}
				if (!user.reallocation.coordinates[0]) {
					user.reallocation = undefined;
				}
				user.save((err) => {
					if (err) {
						console.log(err);
						req.flash('error', err.message);
						return res.redirect('/forgot');
					} else {
						done(err, token, user);
					}
				});
			});
		},
		(token, user, done) => {
			var transporter = nodemailer.createTransport({
				service: 'sendgrid',
				auth: {
					user: "steve.vovchyna@gmail.com",
					pass: "omtMovBe7sEwdz_6KCHz"
				}
			});
			var mailOptions = {
				to: req.sanitize(req.sanitize(user.email)),
				from: 'matcha.42.svovchyn@gmail.com',
				subject: 'Password Reset',
				text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
					'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
					'http://localhost:3000/reset/' + token + '\n\n' +
					'If you did not request this, please ignore this email and your password will remain unchanged.\n'
			};
			transporter.sendMail(mailOptions, (err) => {
				req.flash('success', 'An e-mail has been sent to ' + req.sanitize(user.email) + ' with further instructions.');
				done(err, 'done');
			});
		}
	], (err) => {
		if (err) return next(err);
		res.redirect('/forgot');
	});
});

router.get('/reset/:token', (req, res) => {
	User.findOne({
		passwordResetToken: req.sanitize(req.params.token),
		passwordResetExpires: {
			$gt: Date.now()
		}
	}, (err, user) => {
		if (!user) {
			req.flash('error', 'Password reset token is invalid or has expired.');
			return res.redirect('/forgot');
		}
		res.render('reset', {
			token: req.sanitize(req.params.token)
		});
	});
});

router.post('/reset/:token', (req, res) => {
	async.waterfall([
		(done) => {
			if (!req.body.password || !req.body.confirm) {
				req.flash("error", "Empty fields! Please, fill in both fields!");
				return res.redirect('back');
			}
			if (!passwordRegExp.test(req.body.password) && !passwordRegExp.test(req.body.confirm)) {
				req.flash("error", "Please make sure your password contains at least 6 characters, 1 digit and 1 letter of any register");
				return res.redirect("back");
			}
			User.findOne({
				passwordResetToken: req.sanitize(req.params.token),
				passwordResetExpires: {
					$gt: Date.now()
				}
			}, (err, user) => {
				if (!user) {
					req.flash('error', 'Password reset token is invalid or has expired.');
					return res.redirect('back');
				}
				if (req.sanitize(req.body.password) === req.sanitize(req.body.confirm)) {
					var pass = req.sanitize(req.body.password);
					user.setPassword(pass, (err) => {
						user.passwordResetToken = undefined;
						user.passwordResetExpires = undefined;
						if (!user.hasLocation) {
							user.location = undefined;
						}
						if (!user.reallocation.coordinates[0]) {
							user.reallocation = undefined;
						}
						user.save((err) => {
							done(err, user);
						});
					})
				} else {
					req.flash("error", "Passwords do not match.");
					return res.redirect('back');
				}
			});
		}, (user, done) => {
			var transporter = nodemailer.createTransport({
				service: 'sendgrid',
				auth: {
					user: "steve.vovchyna@gmail.com",
					pass: "omtMovBe7sEwdz_6KCHz"
				}
			});
			var mailOptions = {
				to: req.sanitize(user.email),
				from: 'matcha.42.svovchyn@gmail.com',
				subject: 'Your password has been changed',
				text: 'Hello,\n\n' +
					'This is a confirmation that the password for your account ' + req.sanitize(user.email) + ' has just been changed.\n'
			};
			transporter.sendMail(mailOptions, (err) => {
				req.flash('success', 'Success! Your password has been changed.');
				done(err);
			});
		}
	], function (err) {
		res.redirect('/login');
	});
});

module.exports = router;
