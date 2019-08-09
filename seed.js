var mongoose = require("mongoose");
var User = require("./models/user");
var f = require('faker');



function seedDB(orientation, number){
	
	var randomUser = [];
	for (var i = 0; i < number; i++) {
		var long = f.address.longitude();
		var lat = f.address.latitude();
		var randomUser = (
			{
				username: f.internet.userName(),
				lastname: f.name.lastName(),
				firstname: f.name.firstName(),
				gender: i % 2 ? "Male" : "Female",
				sexPreferences: orientation,
				locationname: f.address.city(),
				location: {
					type: "Point",
					coordinates: [long, lat]
				},
				bio: f.lorem.paragraph(),
				interests: [{ text: f.hacker.noun() }, { text: f.hacker.noun() }, { text: f.hacker.noun() }],
				pictures: [{
					url: f.image.avatar(),
					isProfile: true
				}],
				email: f.internet.email(),
				isVerified: true,
				birthday: f.date.past(),
				lastseen: f.date.recent(),

			}
		);
		User.create(randomUser, (err, user) => {
			if (err) {
				console.log(err);
			} else {
				console.log("fake users created");
			}
		})

	}
}
 
module.exports = seedDB;
