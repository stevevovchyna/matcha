const express = require("express");
const router = express.Router({mergeParams: true});
const passport = require("passport");
const User = require("../models/user");
const middleware = require("../middleware");
const _ = require('lodash');
const moment = require('moment');

router.get("/browse", middleware.isLoggedIn, middleware.haveFilled, (req, res) => {
	console.log("tut takozh gotovo!!");
	res.redirect("/feed/browse/default.asc");
});

router.get("/browse/:sort_type.:order", middleware.isLoggedIn, middleware.haveFilled, (req, res) => {
	var sortType = req.sanitize(req.params.sort_type.toString());
	var order = req.sanitize(req.params.order.toString());
	if (sortType.toString() !== "default" && sortType.toString() !== "location" &&
		sortType.toString() !== "famerate" &&
		sortType.toString() !== "tags"  && sortType.toString() !== 'age' || (order.toString() !== "asc" && order.toString() !== "desc")) {
		req.flash("error", "Invalid link!!!");
		res.redirect("/feed/browse/default.asc");
	} else {
		if (req.user.location) {
			var long = req.user.location.coordinates[0];
			var lat = req.user.location.coordinates[1];
		} else if (req.user.reallocation) {
			var long = req.user.reallocation.coordinates[0];
			var lat = req.user.reallocation.coordinates[1];
		} else {
			var long = 30.5234;
			var lat = 50.4501;
		}
		switch(sortType) {
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
		User.find({})
		.populate('likes')
		.populate('visits')
		.exec((err, user) => {
			if (err) {
				req.flash("error", err.message);
				res.redirect("back");
			} else {
				if (user.length > 1) {
				User.aggregate([{
					$geoNear: {
						near: {
							type: "Point",
							coordinates: [long, lat]
						},
						key: 'location',
						distanceField: "dist.calculated",
						maxDistance: 1000000000,
						minDistance: 0,
						spherical: true
					}
				}], (err, foundUsers) => {
					if (err) {
						console.log(err);
						req.flash("error", err.message);
						res.redirect("back");
					} else {
						console.log(user);
						var usersWithoutMe = foundUsers.filter(foundUser => foundUser._id.toString() !== req.user._id.toString());
						var ret = [];

						if (req.user.sexPreferences.toString() !== "Bi-Sexual") {

							// GAY USER PATTERN
							if (req.user.gender.toString() === req.user.sexPreferences.toString()) {
								usersWithoutMe.forEach(oneuser => {
									if (req.user.gender.toString() === oneuser.gender.toString() &&
										req.user.sexPreferences.toString() === oneuser.sexPreferences.toString() &&
										oneuser.sexPreferences.toString() !== "Bi-Sexual") {
											oneuser.age = moment(Date.now()).diff(moment(oneuser.birthday), 'days');
											oneuser.famerate = oneuser.likes.length + oneuser.visits.length;
											oneuser.commmontags = _.intersection(_.map(req.user.interests, 'text'), _.map(oneuser.interests, 'text')).length;
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
											oneuser.age = moment(Date.now()).diff(moment(oneuser.birthday), 'days');
											oneuser.famerate = oneuser.likes.length + oneuser.visits.length;
											oneuser.commmontags = _.intersection(_.map(req.user.interests, 'text'), _.map(oneuser.interests, 'text')).length;
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
							user.forEach(oneuser => {
								if (oneuser.sexPreferences.toString() === "Bi-Sexual") {
									oneuser.age = moment(Date.now()).diff(moment(oneuser.birthday), 'days');
									oneuser.famerate = oneuser.likes.length + oneuser.visits.length;
									oneuser.commontags = _.intersection(_.map(req.user.interests, 'text'), _.map(oneuser.interests, 'text')).length;
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
			} else {
				req.flash('error', "Oops, there are still no users apart from you!");
				res.redirect('back');
			}
		}
		});
	}
});

router.get('/research', middleware.isLoggedIn, (req, res) => {
	res.render('research');
});


router.put('/research/result', middleware.isLoggedIn, middleware.checkSortInput, (req, res) => {
	var sortType = req.sanitize(req.body.userparams.sorttype.toString());
	var order = req.sanitize(req.body.userparams.sortorder.toString());

	req.body.userparams.agemax = parseInt(req.body.userparams.agemax) * 365;
	req.body.userparams.agemin = parseInt(req.body.userparams.agemin) * 365;

	if (sortType.toString() !== "default" && sortType.toString() !== "location" &&
		sortType.toString() !== "famerate" &&
		sortType.toString() !== "tags"  && sortType.toString() !== 'age' ||
		(order.toString() !== "asc" && order.toString() !== "desc")) {
		req.flash("error", "Invalid link!!!");
		res.redirect("/feed/browse/default.asc");
	} else {
		if (req.user.location) {
			var long = req.user.location.coordinates[0];
			var lat = req.user.location.coordinates[1];
		} else if (req.user.reallocation) {
			var long = req.user.reallocation.coordinates[0];
			var lat = req.user.reallocation.coordinates[1];
		} else {
			var long = 30.5234;
			var lat = 50.4501;
		}
		switch(sortType) {
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
		User.find({}).populate("blockedUsers").populate('likes').populate('visits')
			.exec((err, user) => {
				if (err) {
					req.flash("error", err.message);
					res.redirect("back");
				} else {
					if (user.length < 2) {
						req.flash('error', "Oops, there are still no users apart from you!");
						res.redirect('back');
					} else {
					User.aggregate([{
						$geoNear: {
							near: {
								type: "Point",
								coordinates: [long, lat]
							},
							key: 'location',
							distanceField: "dist.calculated",
							maxDistance: 1000000000,
							spherical: true
						}
					}], (err, foundUser) => {
						if (err) {
							console.log(err);
							req.flash("error", err.message);
							res.redirect("back");
						} else {
							for (var i = 0; i < foundUser.length; i++) {
								foundUser[i].age = moment(Date.now()).diff(moment(foundUser[i].birthday), 'days');
								foundUser[i].famerate = foundUser[i].likes.length + foundUser[i].visits.length;
								foundUser[i].commontags = _.intersection(_.map(req.user.interests, 'text'), _.map(foundUser[i].interests, 'text')).length;
								if (foundUser[i]._id.toString() === req.user._id.toString()) {
									foundUser.splice(i, 1);
									i--;
								}
							}
							var ret = [];
							for (var i = 0; i < foundUser.length; i++) {
								if ((_.inRange(parseInt(foundUser[i].dist.calculated.toString()) / 1000, parseInt(req.body.userparams.locmin), parseInt(req.body.userparams.locmax) + 1)) &&
									(_.inRange(parseInt(foundUser[i].famerate), parseInt(req.body.userparams.famemin), parseInt(req.body.userparams.famemax) + 1)) &&
									(_.inRange(parseInt(foundUser[i].commontags), parseInt(req.body.userparams.tagmin), parseInt(req.body.userparams.tagmax) + 1)) &&
									(_.inRange(parseInt(foundUser[i].age), parseInt(req.body.userparams.agemin), parseInt(req.body.userparams.agemax + 1)))) {
									ret.push(foundUser[i]);
								}
							}
							var ret = _.sortBy(ret, sort);
							var zapasik = user.filter(user => user._id.toString() === req.user._id.toString());
							var zapasikIds = zapasik[0].blockedUsers.map(userid => userid.id.toString());
							var userret = ret.filter(finaluser => !zapasikIds.includes(finaluser._id.toString()));
							var orderOut = {'sorttype': sortType, 'order' : order};
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
				}
			});
		}
});

module.exports = router;
