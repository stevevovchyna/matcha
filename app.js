require("dotenv").config();

const express = 		require('express'),
app =		 			express(),
bodyParser = 			require("body-parser"),
mongoose = 				require("mongoose"),
User = 					require("./models/user"),
Likes = 				require("./models/likes"),
Messages = 				require("./models/message"),
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
chatRoutes = require("./routes/chat");

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
	res.locals.message = "";
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
app.use(chatRoutes);

// seed("Male");
// seed("Female");
// seed("Bi-Sexual");

var eventSocket = io.of('/events');
var onlineUsers = [];
// on connection event
eventSocket.on('connection', function (socket) {
	if (socket.request.user && socket.request.user.logged_in) {
		onlineUsers.push(socket.request.user);
		console.log(socket.request.user.username + " connected");
	}	
	eventSocket.emit('broadcast', onlineUsers);

	socket.on('disconnect', function () {
		for (var i = 0; i < onlineUsers.length; i++) {
			if (onlineUsers[i]._id.toString() === socket.request.user._id.toString()) {
				User.findByIdAndUpdate(socket.request.user._id, { lastseen: Date.now() }, (err, user) => {
					if (err) {
						console.log(err);
					} else {
						console.log(socket.request.user.username + " disconnected");
					}
				});
				onlineUsers.splice(i, 1);
			}
		}
		eventSocket.emit('broadcast', onlineUsers);
	});
});

//

var socket = io;

socket.on("connection", socket => {
	console.log("user connected to the chat");

	socket.on("disconnect", function () {
		console.log("user disconnected from the chat");
	});

	//Someone is typing
	socket.on("typing", data => {
		socket.broadcast.emit("notifyTyping", {
			user: data.user,
			message: data.message
		});
	});

	//when soemone stops typing
	socket.on("stopTyping", () => {
		socket.broadcast.emit("notifyStopTyping");
	});

	socket.on("chat message", function (msg) {
		console.log("message: " + msg);

		//broadcast message to everyone in port:5000 except yourself.
		socket.broadcast.emit("received", {
			message: msg,
			user: socket.request.user.username
		});

		//save chat to the database
		Messages.create({}, (err, message) => {
			message.body = msg;
			message.sentBy = socket.request.user._id;
			message.save();
		});
		
	});
});



let port = process.env.PORT;
if (port == null || port == "") {
	port = 3000;
}
server.listen(port, process.env.IP, () => {
	console.log("Setup is done, Sir!");
});
