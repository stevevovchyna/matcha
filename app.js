require("dotenv").config();

const express = 		require('express'),
app =		 			express(),
bodyParser = 			require("body-parser"),
mongoose = 				require("mongoose"),
User = 					require("./models/user"),
Likes = 				require("./models/likes"),
Dislikeslog = 			require("./models/dislikeslog"),
Token = 				require("./models/token"),
passport = 				require("passport"),
localStrategy = 		require("passport-local"),
passportLocalMongoose = require("passport-local-mongoose"),
methodOverride = 		require("method-override"),
flash = 				require("connect-flash"),
moment =        		require("moment"),
expressSanitizer = 		require('express-sanitizer'),
assert = 				require('assert'),
nodemailer = 			require("nodemailer"),
crypto = 				require("crypto"),
async = 				require("async"),
iplocate = 				require('node-iplocate'),
seed = 					require("./seed"),
http = 					require('http'),
socketio = 				require('socket.io'),
passportSocketIo = 		require('passport.socketio'),
cookieParser = 			require('cookie-parser'),
session = 				require('express-session'),
redis = 				require('redis'),
redisStore = 			require('connect-redis')(session),
server = 				http.Server(app),
io = 					socketio(server),
redisClient = 			redis.createClient();

const sessionStore = new redisStore({ host: 'localhost', port: 6379, client: redisClient, ttl: 86400 });

redisClient.on('error', (err) => {
	console.log('Redis error: ', err);
});

// requiring routes from ./routes folder
const authRoutes = require("./routes/index"),
feedRoutes = require("./routes/feed"),
likesRoutes = require("./routes/likes"),
profileRoutes = require("./routes/profile");
fakenblockRoutes = require("./routes/fakenblock");

// databse connection
mongoose.connect("mongodb://localhost/matcha", {useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true});

app.set("view engine", "ejs"); //no need to write .ejs in the end of the file name
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({ //session initializer
	store: sessionStore,
	cookie: { secure: false },
	secret: "I love Kate",
	resave: false,
	saveUninitialized: true
}));
io.use(passportSocketIo.authorize({
	key: 'connect.sid',
	secret: "I love Kate",
	store: sessionStore,
	passport: passport,
	cookieParser: cookieParser
}));

app.use(expressSanitizer());

app.use(flash());
app.use(express.static("public")); // including .css files directory here
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));


passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(function (user, done) {
	done(null, user.id);
});
passport.deserializeUser(function (id, done) {
	User.findById(id).populate('blockedUsers').exec((err, user) => {
		done(err, user);
	});
});

// allows using current user data across all the views
app.use((req, res, next) => {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.locals.moment = require('moment');

//including routes from the ./routes folder
app.use(authRoutes);
app.use("/profile", profileRoutes);
app.use("/likes", likesRoutes);
app.use("/feed", feedRoutes);
app.use("/fakenblock", fakenblockRoutes);

// seed("Male");
// seed("Female");
// seed("Bi-Sexual");

var eventSocket = io.of('/events');
var onlineUsers = [];
// on connection event
// eventSocket.on('connection', function (socket) {
// 	if (socket.request.user && socket.request.user.logged_in) {
// 		onlineUsers.push(socket.request.user);
// 		console.log(socket.request.user.username + " connected");
// 	}	
// 	eventSocket.emit('broadcast', onlineUsers);

// 	socket.on('disconnect', function () {
// 		for (var i = 0; i < onlineUsers.length; i++) {
// 			if (onlineUsers[i]._id.toString() === socket.request.user._id.toString()) {
// 				User.findByIdAndUpdate(socket.request.user._id, { lastseen: Date.now() }, (err, user) => {
// 					if (err) {
// 						console.log(err);
// 					} else {
// 						console.log(socket.request.user.username + " disconnected");
// 					}
// 				});
// 				onlineUsers.splice(i, 1);
// 			}
// 		}
// 		eventSocket.emit('broadcast', onlineUsers);
// 	});
// });


let port = process.env.PORT;
if (port == null || port == "") {
	port = 3000;
}
server.listen(port, process.env.IP, () => {
	console.log("Setup is done, Sir!");
});
