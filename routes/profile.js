const express = require("express");
const router = express.Router({
	mergeParams: true
});
const passport = require("passport");
const User = require("../models/user");
const Visits = require("../models/visits");
const Tags = require("../models/tags");
const middleware = require("../middleware");
const NodeGeocoder = require("node-geocoder");
const async = require("async");
const xss = require("xss");
const mongoose = require('mongoose');
const DateOnly = require('mongoose-dateonly')(mongoose);
const loginRegExp = RegExp("^[a-zA-Z0-9_-]{3,20}$");
const emailRegExp = RegExp("^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$");
const passwordRegExp = RegExp("(?!^[0-9]*$)(?!^[a-zA-Z]*$)^([a-zA-Z0-9]{6,15})$");

var options = {
	provider: 'google',
	httpAdapter: 'https',
	apiKey: process.env.GEOCODER_API_KEY,
	formatter: null
};

var geocoder = NodeGeocoder(options);

var multer = require('multer');

var storage = multer.diskStorage({
	filename: function (req, file, callback) {
		callback(null, Date.now() + file.originalname);
	}
});
var imageFilter = function (req, file, cb) {
	// accept image files only
	if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
		return cb(new Error('Only image files are allowed!'), false);
	}
	cb(null, true);
};
var upload = multer({
	storage: storage,
	fileFilter: imageFilter
})

var cloudinary = require('cloudinary');
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get("/:id", middleware.isLoggedIn, middleware.countDistance, (req, res) => {
	User.findById(req.sanitize(req.params.id))
		.populate('blockedUsers')
		.exec((err, user) => {
			if (err || !user) {
				console.log(err);
				req.flash('error', "Invalid address! Please make sure you've entered a correct one!");
				res.redirect('/feed/research');
			} else {
				var blocked = user.blockedUsers.filter(user => user.id.toString() === req.user._id.toString());
				if (blocked.length == 0) {
					if (req.user._id.toString() !== req.params.id.toString()) {
						Visits.create({
							profile_id: req.params.id,
							visitor_id: req.user._id
						}, (err, newVisit) => {
							if (err) {
								console.log(err);
								req.flash('error', err.message);
								res.redirect('/feed/research');
							} else {
								user.visits.push(newVisit);
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
										res.redirect('/feed/research');
									} else {
										User.findById(req.user._id, (err, myuser) => {
											if (err) {
												console.log(err);
												req.flash('error', err.message);
												res.redirect('/feed/research');
											} else {
												myuser.myVisits.push(newVisit);
												if (!myuser.hasLocation) {
													myuser.location = undefined;
												}
												if (!myuser.reallocation.coordinates[0]) {
													myuser.reallocation = undefined;
												}
												myuser.save((err) => {
													if (err) {
														console.log(err);
														req.flash('error', err.message);
														res.redirect('/feed/research');
													} else {
														user.distance = parseInt(res.locals.distance);
														res.render("profiles/profile", {
															user: user,
															youAreBlocked: false
														});
													}
												});
											}
										});
									}
								});
							}
						});
					} else {
						user.distance = parseInt(res.locals.distance);
						res.render("profiles/profile", {
							user: user,
							youAreBlocked: false
						});
					}
				} else {
					user.distance = parseInt(res.locals.distance);
					res.render("profiles/profile", {
						user: user,
						youAreBlocked: true
					});
				}
			}
		});
});

router.get("/:id/edit", middleware.checkProfileOwnership, middleware.locationForChosen, (req, res) => {
	User.findById(req.params.id).populate("tags").exec((err, user) => {
		if (!user || err) {
			req.flash("error", "Invalid link!");
			console.log(err);
			return res.redirect("back");
		} else {
			res.render("profiles/edit", {
				user: user
			});
		}
	});
});

router.put("/:id/edittag", middleware.checkProfileOwnership, (req, res) => {
	User.findByIdAndUpdate(req.params.id, {}, (err, user) => {
		if (err) {
			req.flash("error", "Something went wrong while editing your data!");
			console.log(err);
			res.redirect("back");
		} else {
			var str = req.body.interests.toString().replace(/([^a-zA-Z0-9 ]+)/g, ' ').replace(/\s\s+/g, ' ').trim();
			var arr = str.split(" ");
			if (arr[0].toString() === "") {
				req.flash("error", "Field can't be empty!");
				return res.redirect("/profile/" + req.params.id + "/edit");
			} else if (arr.length > 0 && arr[0] !== "") {
				var newArr = arr.map(function (value) {
					return {
						text: value
					};
				});
				newArr.forEach((tag) => {
					user.interests.push(tag);
				});
				if (!user.hasLocation) {
					user.location = undefined;
				}
				if (!user.reallocation.coordinates[0]) {
					user.reallocation = undefined;
				}
				user.save((err) => {
					if (err) {
						console.log(err);
						req.flash('error', "Something is wrong with your tag saving!");
						res.redirect('back');
					} else {
						var uniqueArr = new Object();
						Tags.find((err, dbtags) => {
							if (dbtags) {
								for (var i = 0; i < arr.length; i++) {
									for (let dbtag of dbtags) {
										if (dbtag.text.toString() === arr[i].toString()) {
											arr.splice(i, 1);
											i--;
											break;
										}
									}
								}
								uniqueArr = arr.map((value) => {
									return {
										text: value
									};
								});
								Tags.insertMany(uniqueArr, (err, tags) => {
									if (err) {
										console.log(err);
									};
									req.flash("success", "Tags added!");
									return res.redirect("/profile/" + req.params.id + "/edit");
								});
							}
						});
					}
				});
			} else {
				req.flash("error", "Couldn't add your tags! Check if there's no duplicate!");
				res.redirect("/profile/" + req.params.id + "/edit");
			}
		}
	});
});

router.delete("/:id/:tag_id/tagdel", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.params.id, (err, user) => {
		if (err) {
			console.log(err);
			res.send({
				status: "error",
				error: err.message
			});
		} else {
			var tagToDelete = user.interests.filter(tag => tag._id.toString() === req.sanitize(req.params.tag_id));
			if (tagToDelete.length == 1) {
				user.interests.pull(req.params.tag_id);
				if (!user.hasLocation) {
					user.location = undefined;
				}
				if (!user.reallocation.coordinates[0]) {
					user.reallocation = undefined;
				}
				user.save((err) => {
					if (err) {
						console.log(err);
						res.send({
							status: "error",
							error: err.message
						});
					} else {
						res.send({
							status: "success"
						});
					}
				});
			} else {
				res.send({
					status: "error",
					error: "Tag not found"
				});
			}
		}
	});
});

router.put("/:id/editinfo", middleware.checkProfileOwnership, middleware.checkIfOAuth, middleware.checkDate, (req, res) => {
	if (!loginRegExp.test(req.body.user.firstname) || !loginRegExp.test(req.body.user.lastname) || !loginRegExp.test(req.body.user.username)) {
		req.flash("error", "Please make sure you've entered a correct username, First Name of Last Name");
		return res.redirect("back");
	}
	if (!res.locals.oauth) {
		if (!emailRegExp.test(req.body.user.email)) {
			req.flash("error", "Please make sure you've entered a correct email address!");
			return res.redirect("back");
		}
		var email = req.sanitize(req.body.user.email);
	}
	var username = req.sanitize(req.body.user.username);
	var firstname = req.sanitize(req.body.user.firstname);
	var lastname = req.sanitize(req.body.user.lastname);
	var bio = req.sanitize(req.body.user.bio);
	var gender = req.sanitize(req.body.user.gender);
	var sexPreferences = req.sanitize(req.body.user.sexPreferences);
	var birthDate = new DateOnly(xss(req.body.user.birthdate));
	if (req.body.location !== "") {
		var location = req.sanitize(req.body.location);
	} else {
		var location = "";
	}
	if ((gender.toString() === "Male" || gender.toString() === "Female") &&
		(sexPreferences.toString() === "Male" ||
			sexPreferences.toString() === "Female" ||
			sexPreferences.toString() === "Bi-Sexual")) {
		User.findByIdAndUpdate(req.params.id, {}, (err, userdata) => {
			if (err) {
				console.log(err);
				req.flash("error", err.message);
				return res.redirect("back");
			} else {
				userdata.username = username;
				if (!res.locals.oauth) {
					userdata.email = email;
				}
				userdata.lastname = lastname;
				userdata.firstname = firstname;
				userdata.gender = gender;
				userdata.sexPreferences = sexPreferences;
				userdata.bio = bio;
				userdata.birthday = birthDate.toDate();
				if (location != "") {
					geocoder.geocode(location, (err, data) => {
						if (err || data.length == 0 || data == undefined) {
							console.log(err);
							req.flash("error", "Invalid address");
							return res.redirect("back");
						} else {
							userdata.locationname = data[0].formattedAddress;
							userdata.location = {
								type: "Point",
								coordinates: [data[0].longitude, data[0].latitude]
							};
							if (!userdata.reallocation.coordinates[0]) {
								userdata.reallocation = undefined;
							}
							userdata.hasLocation = true;
							userdata.save((err) => {
								if (err) {
									console.log(err);
									req.flash("error", err.message);
									res.redirect("back");
								} else {
									req.flash("success", "Profile info updated!");
									res.redirect("/profile/" + req.params.id + "/edit");
								}
							});
						}
					});
				} else {
					userdata.location = undefined;
					userdata.locationname = undefined;
					userdata.hasLocation = false;
					if (!userdata.reallocation.coordinates[0]) {
						userdata.reallocation = undefined;
					}
					userdata.save((err) => {
						if (err) {
							console.log(err);
							req.flash("error", err.message);
							res.redirect("back");
						} else {
							req.flash("success", "Profile info updated!");
							res.redirect("/profile/" + req.params.id + "/edit");
						}
					});
				}
			}
		});
	} else {
		req.flash("error", "This network is created for male-female users only. No disrespect, amigo :*");
		return res.redirect("/profile/" + req.params.id + "/edit");
	}
});


router.put("/:id/addpic", middleware.checkProfileOwnership, upload.single('image'), middleware.pictureIsPresent, (req, res) => {
	async.waterfall([
		(done) => {
			User.findById(req.params.id, (err, user) => {
				if (err) {
					req.flash("error", err.message);
					console.log(err);
					res.redirect("back");
				}
				if (user.pictures.length == 5) {
					req.flash("error", "Max 5 pictures uploaded - delete one of the pictures to upload a new one!");
					return res.redirect("/profile/" + req.params.id + "/edit");
				} else {
					done();
				}
			});
		}, (done) => {
			cloudinary.uploader.upload(req.file.path, (result) => {
				User.findByIdAndUpdate(req.params.id, req.body.user, (err, user) => {
					if (err) {
						req.flash("error", err.message);
						console.log(err);
						res.redirect("back");
					} else {
						if (user.pictures.length == 0) {
							user.pictures.push({
								isProfile: true,
								url: result.secure_url,
								naked_url: result.public_id
							});
						} else {
							user.pictures.push({
								url: result.secure_url,
								naked_url: result.public_id
							});
						}
						if (!user.hasLocation) {
							user.location = undefined;
						}
						if (!user.reallocation.coordinates[0]) {
							user.reallocation = undefined;
						}
						user.save((err) => {
							if (err) {
								console.log(err);
								req.flash("error", err.message);
								res.redirect('back');
							} else {
								req.flash("success", "Picture was added!");
								res.redirect("/profile/" + req.params.id + "/edit");
							}
						});
					}
				});
			});
		}
	], (err) => {
		if (err) return next(err);
		res.redirect("back");
	});
});

router.delete("/:id/:pic_id/picdel", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.params.id, (err, user) => {
		if (err || !user) {
			req.flash("error", err.message);
			console.log(err);
			res.redirect("back");
		} else {
			// getting picture object without possibility to modify it as mongoose object
			var url = user.pictures.id(req.sanitize(req.params.pic_id));
			if (url) {
				var deletedPicture = user.pictures.filter(picture => picture._id.toString() === req.params.pic_id.toString());
				user.pictures.pull(req.params.pic_id);
				if (user.pictures[0]) {
					user.pictures[0].isProfile = true;
				}
				if (!user.hasLocation) {
					user.location = undefined;
				}
				if (!user.reallocation.coordinates[0]) {
					user.reallocation = undefined;
				}
				user.save(() => {
					if (deletedPicture[0].naked_url) {
						cloudinary.v2.api.delete_resources([url.naked_url], (err, result) => {
							if (err) {
								req.flash("error", err.message);
								console.log(err);
								res.redirect("back");
							}
						});
					}
					req.flash("success", "Picture deleted!");
					res.redirect("back");
				});
			} else {
				req.flash('error', "Picture not found");
				res.redirect('back');
			}
		}
	});
});

router.put("/:id/:pic_id/setprofile", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.params.id, (err, user) => {
		if (err || !user) {
			req.flash("error", "User not found");
			console.log(err);
			res.redirect("back");
		} else {
			var pictureIDChecker = user.pictures.filter(picture => picture._id.toString() === req.params.pic_id.toString());
			if (pictureIDChecker.length > 0) {
				user.pictures.forEach(pic => {
					pic.isProfile = false;
				});
				user.pictures.id(req.params.pic_id).isProfile = true;
				if (!user.hasLocation) {
					user.location = undefined;
				}
				if (!user.reallocation.coordinates[0]) {
					user.reallocation = undefined;
				}
				user.save(() => {
					req.flash("success", "Profile picture set!");
					res.redirect("back");
				});
			} else {
				req.flash('error', 'Picture not found');
				res.redirect('back');
			}
		}
	});
});

router.put("/:id/setpassword", middleware.checkIfLocal, middleware.checkProfileOwnership, (req, res) => {
	if (!req.body.password || !req.body.confirm) {
		req.flash("error", "Empty fields! Please, fill in both fields!");
		return res.redirect('back');
	} else if (!passwordRegExp.test(req.body.password) && !passwordRegExp.test(req.body.confirm)) {
		req.flash("error", "Please make sure your password contains at least 6 characters, 1 digit and 1 letter of any register");
		return res.redirect("back");
	} else {
		User.findById(req.sanitize(req.params.id), (err, foundUser) => {
			if (err) {
				console.log(err);
				req.flash('error', err.message);
				res.redirect('/profile/' + req.user._id + '/edit')
			} else {
				if (req.sanitize(req.body.password) === req.sanitize(req.body.confirm)) {
					var pass = req.sanitize(req.body.password);
					foundUser.setPassword(pass, (err) => {
						if (err) {
							console.log(err);
							req.flash('error', err.message);
							res.redirect('/profile/' + req.user._id + '/edit');
						} else {
							if (!foundUser.hasLocation) {
								foundUser.location = undefined;
							}
							if (!foundUser.reallocation.coordinates[0]) {
								foundUser.reallocation = undefined;
							}
							foundUser.save((err) => {
								if (err) {
									console.log(err);
									req.flash('error', err.message);
									res.redirect('/profile/' + req.user._id + '/edit');
								} else {
									req.flash('success', "You password has been changed");
									res.redirect('back');
								}
							});
						}
					})
				} else {
					req.flash("error", "Passwords do not match.");
					return res.redirect('back');
				}
			}
		});
	}
});

module.exports = router;
