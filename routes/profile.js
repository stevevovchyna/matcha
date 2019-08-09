const express = require("express");
const router = express.Router({mergeParams: true});
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

var options = {
	provider: 'google',
	httpAdapter: 'https',
	apiKey: 'AIzaSyBxM1Dxy_gcBhgoCKoSAgfCL6TjwGf2dQE',
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
	cloud_name: 'dstvx12kw',
	api_key: '362871427717468',
	api_secret: 'b9OL__XMw1SlZsYtLvFLe6_Cn00'
});

router.get("/:id", middleware.isLoggedIn, (req, res) => {
	console.log(req.params.id);
	console.log(req.user._id);
	User.findById(req.sanitize(req.params.id), (err, user) => {
		if (req.user._id.toString() !== req.params.id.toString()) {
			Visits.create({profile_id: req.params.id, visitor_id: req.user._id}, (err, newVisit) => {
				if (err) console.log(err);
				user.visits.push(newVisit);
				user.save((err) => {
					if (err) console.log(err);
					User.findById(req.user._id, (err, myuser) => {
						myuser.myVisits.push(newVisit);
						myuser.save((err) => {
							if (err) console.log(err);
							res.render("profiles/profile", {user: user})
						});
					})
				});
			});
		} else {
			res.render("profiles/profile", { user: user });
		}
	});
});

router.get("/:id/edit", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.params.id).populate("tags").exec((err, user) => {
		if (!user || err) {
			req.flash("error", "Invalid link!");
			console.log(err);
			return res.redirect("/feed/browse");
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
				var newArr = arr.map(function(value) {
					return {text: value};
				});
				newArr.forEach((tag) => {
					user.interests.push(tag);
				});
				user.save();
				var uniqueArr = new Object();
				Tags.find((err, dbtags) => {
					if (dbtags) {
						for (var i = 0; i < arr.length; i++) {
							for (let dbtag of dbtags) {
								if (dbtag.text.toString() === arr[i].toString()) {
									arr.splice(i, 1);
									i--;
									break ;
								}
							}
						}
						uniqueArr = arr.map(function(value) {
							return {text: value};
						});
						Tags.insertMany(uniqueArr, (err, tags) => {
							if(err){console.log(err);};
							req.flash("success", "Tags added!");
							return res.redirect("/profile/" + req.params.id + "/edit");
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
			req.flash("error", err.message);
			console.log(err);
			res.redirect("/profile/" + req.params.id + "/edit");
		} else {
			user.interests.pull(req.params.tag_id);
			user.save((err) => {
				if (err) {
					req.flash("error", err.message);
					console.log(err);
					res.redirect("/profile/" + req.params.id + "/edit");
				} else {
					req.flash('success', "Tag removed!");
					res.redirect("/profile/" + req.params.id + "/edit");
				}
			});
		}
	});
});

router.put("/:id/editinfo", middleware.checkProfileOwnership, middleware.checkDate, (req, res) => {
	var email = req.sanitize(req.body.user.email);
	var username = req.sanitize(req.body.user.username);
	var firstname = req.sanitize(req.body.user.firstname);
	var lastname = req.sanitize(req.body.user.lastname);
	var bio = req.sanitize(req.body.user.bio);
	var gender = req.sanitize(req.body.user.gender);
	var sexPreferences = req.sanitize(req.body.user.sexPreferences);
	var birthDate = new DateOnly(xss(req.body.user.birthdate));
	if(req.body.location) {var location = req.sanitize(req.body.location);}
	if ((gender.toString() === "Male" || gender.toString() === "Female") &&
		(sexPreferences.toString() === "Male" || sexPreferences.toString() === "Female" || sexPreferences.toString() === "Bi-Sexual")) {
		User.findByIdAndUpdate(req.params.id, {}, (err, userdata) => {
			if (userdata.location) {
				userdata.location = undefined;
				userdata.lat = undefined;
				userdata.lng = undefined;
				userdata.save();
			}
		});
		var coords = {};
		geocoder.geocode(location, (err, data) => {
			if (!data) {
				var newUser = {
					username: username,
					email: email,
					lastname: lastname,
					firstname: firstname,
					gender: gender,
					sexPreferences: sexPreferences,
					bio: bio,
					birthday: birthDate.toDate()
				};
			} else {
				if (err) {
					console.log(err);
					req.flash("error", "Invalid address");
					return res.redirect("back");
				}
				coords.lat = data[0].latitude;
				coords.lng = data[0].longitude;
				coords.location = data[0].formattedAddress;
				var newUser = {
					username: username,
					email: email,
					lastname: lastname,
					firstname: firstname,
					gender: gender,
					sexPreferences: sexPreferences,
					bio: bio,
					locationname: coords.location,
					location: {
						type: "Point",
						coordinates: [coords.lng, coords.lat]
					},
					birthday: birthDate.toDate()
				};
			}
			User.findByIdAndUpdate(req.params.id, newUser, (err, user) => {
				if (err) {
					req.flash("error", "Something went wrong while editing your data!");
					console.log(err);
					res.redirect("back");
				}
				else {
					req.flash("success", "Profile info updated!");
					return res.redirect("/profile/" + req.params.id + "/edit");
				}
			});
		});
	} else {
		req.flash("error", "This network is created for male-female users only. No disrespect, amigo :*");
		return res.redirect("/profile/" + req.params.id + "/edit");
	}
});


router.put("/:id/editpic", middleware.checkProfileOwnership, upload.single('image'), (req, res) => {
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
					}
					else {
						if (user.pictures.length == 0) {
							user.pictures.push({ isProfile: true, url: result.secure_url, naked_url: result.public_id });
						} else {
							user.pictures.push({ url: result.secure_url, naked_url: result.public_id });
						}
						user.save(() => {
							req.flash("success", "Picture was added!");
							res.redirect("/profile/" + req.params.id + "/edit");
						});
					}
				});
			});
		}], (err) => {
			if (err) return next(err);
			res.redirect("/profile/" + req.params.id);
		});
});

router.delete("/:id/:pic_id/picdel", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.params.id, (err, user) => {
		if (err) {
			req.flash("error", err.message);
			console.log(err);
			res.redirect("/profile/" + req.params.id);
		} else {
			var url = user.pictures.id(req.params.pic_id);
			var deletedPicture = user.pictures.filter(picture => picture._id.toString() === req.params.pic_id.toString());
			user.pictures.pull(req.params.pic_id);
			console.log(deletedPicture);
			user.save(() => {
				if (deletedPicture[0].naked_url) {
					cloudinary.v2.api.delete_resources([url.naked_url], (err, result) => {
						if (err) {
							req.flash("error", err.message);
							console.log(err);
							res.redirect("/profile/" + req.params.id);
						}
						console.log("real picture deleted!!!");
					});
				}
				req.flash("success", "Picture deleted!");
				res.redirect("/profile/" + req.params.id);
			});
		}
	});
});

router.put("/:id/:pic_id/setprofile", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.params.id, (err, user) => {
		if (err) {
			req.flash("error", err.message);
			console.log(err);
			res.redirect("/profile/" + req.params.id);
		} else {
			user.pictures.forEach(pic => {
				pic.isProfile = false;
			});
			user.pictures.id(req.params.pic_id).isProfile = true;
			user.save(() => {
				req.flash("success", "Profile picture set!");
				res.redirect("/profile/" + req.params.id);
			});
		}
	});
});

module.exports = router;
