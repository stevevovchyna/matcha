const express = require("express");
const router = express.Router({
	mergeParams: true
});
const passport = require("passport");
const User = require("../models/user");
const middleware = require("../middleware");
const _ = require('lodash');
const moment = require('moment');
const mongoose = require('mongoose');

router.get("/browse", middleware.isLoggedIn, middleware.haveFilled, (req, res) => {
	console.log("tut takozh gotovo!!");
	res.redirect("/feed/browse/default.asc");
});

router.get("/browse/:sort_type.:order", middleware.isLoggedIn, middleware.haveFilled, (req, res) => {
	var sortType = req.sanitize(req.params.sort_type.toString());
	var order = req.sanitize(req.params.order.toString());
	if (sortType.toString() !== "default" && sortType.toString() !== "location" &&
		sortType.toString() !== "famerate" &&
		sortType.toString() !== "tags" && sortType.toString() !== 'age' || (order.toString() !== "asc" && order.toString() !== "desc")) {
		req.flash("error", "Invalid link!!!");
		res.redirect("/feed/browse/default.asc");
	} else {
		var long = 30.5234;
		var lat = 50.4501;
		if (req.user.hasLocation) {
			long = req.user.location.coordinates[0];
			lat = req.user.location.coordinates[1];
		} else if (req.user.reallocation.coordinates[0] != null) {
			long = req.user.reallocation.coordinates[0];
			lat = req.user.reallocation.coordinates[1];
		}
		switch (sortType) {
			case 'default':
				var sort = ['dist.calculated', 'famerate', 'commontags'];
				break;
			case 'location':
				var sort = ['dist.calculated'];
				break;
			case 'famerate':
				var sort = ['famerate'];
				break;
			case 'tags':
				var sort = ["commontags"];
				break;
			case 'age':
				var sort = ['age'];
				break;
		}
		User.find({}).populate('likes').populate('visits').exec((err, user) => {
			if (err) {
				req.flash("error", err.message);
				res.redirect("back");
			} else {
				if (user.length > 1) {
					User.aggregate([{
						$geoNear: {
							query: {
								hasLocation: true
							},
							near: {
								type: "Point",
								coordinates: [long, lat]
							},
							distanceField: "dist.calculated",
							maxDistance: 100000000,
							minDistance: 0,
							spherical: true,
							key: 'location'
						}
					}], (err, locatedUser) => {
						if (err) {
							console.log(err);
							req.flash("error", "No matching users found!");
							res.redirect("back");
						} else {
							User.aggregate([{
								$geoNear: {
									near: {
										type: "Point",
										coordinates: [long, lat]
									},
									distanceField: "dist.calculated",
									maxDistance: 100000000,
									minDistance: 0,
									query: {
										hasLocation: false
									},
									spherical: true,
									key: 'reallocation'
								}
							}], (err, notLocatedUser) => {
								if (err) {
									console.log(err);
									req.flash("error", err.message);
									res.redirect("back");
								} else {
									var usersWithoutMe = notLocatedUser.concat(locatedUser);
									usersWithoutMe = usersWithoutMe.filter(foundUser => foundUser._id.toString() !== req.user._id.toString());
									usersWithoutMe.forEach(oneuser => {
										oneuser.age = moment(Date.now()).diff(moment(oneuser.birthday), 'days');
										oneuser.famerate = oneuser.likes.length + oneuser.visits.length;
										oneuser.commmontags = _.intersection(_.map(req.user.interests, 'text'), _.map(oneuser.interests, 'text')).length;
									});
									var ret = [];

									if (req.user.sexPreferences.toString() !== "Bi-Sexual") {

										// GAY USER PATTERN
										if (req.user.gender.toString() === req.user.sexPreferences.toString()) {
											usersWithoutMe.forEach(oneuser => {
												if (req.user.gender.toString() === oneuser.gender.toString() &&
													req.user.sexPreferences.toString() === oneuser.sexPreferences.toString() &&
													oneuser.sexPreferences.toString() !== "Bi-Sexual") {
													ret.push(oneuser);
												}
											});

											var ret = _.sortBy(ret, sort);
											ret = _.sortBy(ret, sort);
											res.render("browse", {
												user: order === 'asc' ? ret : ret.reverse(),
												currUser: req.user,
												order: sortType + '.' + order
											});
										} else {
											// GETEROSEXUAL USER PATTERN
											usersWithoutMe.forEach(oneuser => {
												if (req.user.gender.toString() !== oneuser.gender.toString() &&
													req.user.sexPreferences.toString() !== oneuser.sexPreferences.toString() &&
													oneuser.sexPreferences.toString() !== "Bi-Sexual") {
													ret.push(oneuser);
												}
											});
											var ret = _.sortBy(ret, sort);
											res.render("browse", {
												user: order === 'asc' ? ret : ret.reverse(),
												currUser: req.user,
												order: sortType + '.' + order
											});
										}
									} else {

										// BI-SEXUAL USER PATTERN
										usersWithoutMe.forEach(oneuser => {
											if (oneuser.sexPreferences.toString() === "Bi-Sexual") {
												ret.push(oneuser);
											}
										});

										var ret = _.sortBy(ret, sort);
										res.render("browse", {
											user: order === 'asc' ? ret : ret.reverse(),
											currUser: req.user,
											order: sortType + '.' + order
										});
									}
								}
							});
						}
					});
				} else {
					req.flash('error', "Oops, there are still no users apart from you!");
					res.redirect('back');
				}
			}
		});
	}
});

router.get('/research', middleware.isLoggedIn, middleware.haveFilled, middleware.locationForChosen, (req, res) => {
	res.render('research');
});


router.put('/research/result', middleware.isLoggedIn, middleware.checkSortInput, middleware.haveFilled, (req, res) => {
	mongoose.connect("mongodb://localhost/matcha", {
		useNewUrlParser: true,
		useFindAndModify: false,
		useCreateIndex: true,
		autoIndex: true
	});
	var sortType = req.sanitize(req.body.userparams.sorttype.toString());
	var order = req.sanitize(req.body.userparams.sortorder.toString());

	req.body.userparams.agemax = parseInt(req.body.userparams.agemax) * 365;
	req.body.userparams.agemin = parseInt(req.body.userparams.agemin) * 365;

	if (sortType.toString() !== "default" && sortType.toString() !== "location" &&
		sortType.toString() !== "famerate" &&
		sortType.toString() !== "tags" && sortType.toString() !== 'age' ||
		(order.toString() !== "asc" && order.toString() !== "desc")) {
		req.flash("error", "Invalid search parameters!");
		res.redirect("/research");
	} else {
		var long = 30.5234;
		var lat = 50.4501;
		var key = "location";
		if (req.user.hasLocation) {
			long = req.user.location.coordinates[0];
			lat = req.user.location.coordinates[1];
		} else if (req.user.reallocation.coordinates[0] != null) {
			long = req.user.reallocation.coordinates[0];
			lat = req.user.reallocation.coordinates[1];
			key = "reallocation";
		}
		switch (sortType) {
			case 'default':
				var sort = ['dist.calculated', 'famerate', 'commontags'];
				break;
			case 'location':
				var sort = ['dist.calculated'];
				break;
			case 'famerate':
				var sort = ['famerate'];
				break;
			case 'tags':
				var sort = ["commontags"];
				break;
			case 'age':
				var sort = ["age"];
				break;
		}
		User.find({}, (err, check) => {
			if (err || !check || check.length < 2) {
				console.log(err);
				req.flash("error", "No matching users found!");
				res.redirect("back");
			} else {
				var validUsersMatch = check.filter(user => user.isVerified == true);
				if (validUsersMatch.length < 2) {
					req.flash("error", "No matching users found!");
					res.redirect("back");
				} else {
					User.aggregate([{
						$geoNear: {
							query: {
								hasLocation: true
							},
							near: {
								type: "Point",
								coordinates: [long, lat]
							},
							distanceField: "dist.calculated",
							maxDistance: 100000000,
							minDistance: 0,
							spherical: true,
							key: 'location'
						}
					}], (err, locatedUser) => {
						if (err) {
							console.log(err);
							req.flash("error", "No matching users found!");
							res.redirect("back");
						} else {
							User.aggregate([{
								$geoNear: {
									near: {
										type: "Point",
										coordinates: [long, lat]
									},
									distanceField: "dist.calculated",
									maxDistance: 100000000,
									minDistance: 0,
									query: {
										hasLocation: false
									},
									spherical: true,
									key: 'reallocation'
								}
							}], (err, notLocatedUser) => {
								if (err) {
									console.log(err);
									req.flash("error", err.message);
									res.redirect("back");
								} else {
									// joining two geosearches results
									var foundUsers = notLocatedUser.concat(locatedUser);
									// cuttingth euser himself from the search result
									foundUsers = foundUsers.filter(user => user._id.toString() !== req.user._id.toString());
									// adding some useful data - age, famerate, commontags
									for (var i = 0; i < foundUsers.length; i++) {
										foundUsers[i].age = moment(Date.now()).diff(moment(foundUsers[i].birthday), 'days');
										foundUsers[i].famerate = foundUsers[i].likes.length + foundUsers[i].visits.length;
										foundUsers[i].commontags = _.intersection(_.map(req.user.interests, 'text'), _.map(foundUsers[i].interests, 'text')).length;
									}
									// filtering according to the set parameters
									var ret = [];
									for (var i = 0; i < foundUsers.length; i++) {
										if ((_.inRange(parseInt(foundUsers[i].dist.calculated.toString()) / 1000, parseInt(req.body.userparams.locmin), parseInt(req.body.userparams.locmax) + 1)) &&
											(_.inRange(parseInt(foundUsers[i].famerate), parseInt(req.body.userparams.famemin), parseInt(req.body.userparams.famemax) + 1)) &&
											(_.inRange(parseInt(foundUsers[i].commontags), parseInt(req.body.userparams.tagmin), parseInt(req.body.userparams.tagmax) + 1)) &&
											(_.inRange(parseInt(foundUsers[i].age), parseInt(req.body.userparams.agemin), parseInt(req.body.userparams.agemax + 1)))) {
											ret.push(foundUsers[i]);
										}
									}
									// sorting according to the set params
									var ret = _.sortBy(ret, sort);
									var zapasik = req.user;
									// getting an array of blocked users ids
									var zapasikIds = zapasik.blockedUsers.map(userid => userid.id.toString());
									// filtering those blocked dudes
									var userret = ret.filter(finaluser => !zapasikIds.includes(finaluser._id.toString()));

									var orderOut = {
										'sorttype': sortType,
										'order': order
									};
									req.body.userparams.agemax /= 365;
									req.body.userparams.agemin /= 365;
									res.render('research', {
										user: order === 'asc' ? userret : userret.reverse(),
										userparams: req.body.userparams,
										order: orderOut
									});
								}
							});
						}

					});
				}
			}
		});
	}

});

module.exports = router;
