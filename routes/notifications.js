const express = require("express");
const router = express.Router({mergeParams: true});
const passport = require("passport");
const User = require("../models/user");
const Likes = require("../models/likes");
const Dislikeslog = require("../models/dislikeslog");
const Likeslog = require("../models/likeslog");
const Visits = require("../models/visits");
const Notifications = require("../models/notifications");
const middleware = require("../middleware");

router.get('/notifications/:user_id', middleware.isLoggedIn, middleware.checkOwnership, (req, res) => {
	Notifications.find({for_who: req.params.user_id})
	.populate('for_who')
	.populate('from_whom')
	.sort('-createdAt')
	.limit(100)
	.exec((err, foundNotifications) => {
		res.send({ status: "success", foundNotifications: foundNotifications });
	})
});

router.put('/notifications/:notification_id/check', middleware.isLoggedIn, middleware.checkNotificationRecipient, (req, res) => {
	Notifications.findByIdAndUpdate(req.params.notification_id, { isChecked: true }, (err, updatedNotification) => {
		if (err) {
			res.send({status: "error"});
		} else {
			console.log(updatedNotification);
			res.send({status: "success", updatedNotification: updatedNotification});
		}
	});
});

router.put('/notifications/:user_id/checkall', middleware.isLoggedIn, middleware.checkOwnership, (req, res) => {
	Notifications.updateMany({"isChecked": false, "for_who": req.params.user_id}, {"$set":{"isChecked": true}}, {"multi": true}, (err, updatedNotifications) => {
		if (err) {
			res.send({status: "error"});
		} else {
			console.log(updatedNotifications)
			res.send({status: "success", updatedNotification: updatedNotifications});
		}
	});
});

module.exports = router;
